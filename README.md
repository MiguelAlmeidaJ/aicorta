# AICorta 💈

Plataforma SaaS multi-tenant para agendamentos de barbearias.

## Stack
- pnpm workspaces (monorepo)
- NestJS (API REST)
- Next.js App Router (web)
- Prisma ORM 7 + PostgreSQL

## Começar

Requisitos: Node.js >= 22, pnpm 10 e Docker.

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Web: http://localhost:3000  
API: http://localhost:3001/api  
Health: http://localhost:3001/api/health

Ao executar `pnpm db:migrate`, crie a migration inicial com o nome `init`. Em deploy use `pnpm --filter @aicorta/api exec prisma migrate deploy` depois de versionar migrations.

## Modelo de acesso

- `SYSTEM`: operador da plataforma, papel global reservado (não é concedido via cadastro).
- `ADMIN`: proprietário/administrador de um estabelecimento.
- `EMPLOYEE`: funcionário vinculado a um estabelecimento.
- `CLIENT`: cliente, com identidade global e vínculo opcional com estabelecimentos.

Identidade (`User`) é global: `username`, `email` e `whatsapp` são únicos no sistema. `Membership` determina papel dentro de cada `Tenant`. Tokens são emitidos no login; operações tenant-scoped exigem conferência de membership no backend. Nunca confiar em tenantId fornecido sem autorização.

## Primeiras rotas

- `POST /api/auth/register` – cria conta de admin + estabelecimento.
- `POST /api/auth/login` – `identifier` (usuário, e-mail ou WhatsApp) + senha.
- `GET /api/auth/me` – usuário autenticado.
- `GET /api/tenants/:tenantId/services` – catálogo público.
- `GET /api/tenants/:tenantId/appointments` – agenda, apenas equipe.
- `POST /api/tenants/:tenantId/appointments` – agenda, apenas equipe; cliente deve existir e profissional deve pertencer ao estabelecimento.

Os endpoints de agendamento são a primeira base interna, **não** um fluxo público completo. A verificação de conflito de horários, horário de funcionamento, pagamentos, notificações, recuperação de senha e agendamento público ficam para as próximas entregas antes de produção.

## Decisões de arquitetura

Veja [docs/architecture.md](docs/architecture.md) e [docs/roadmap.md](docs/roadmap.md). Referências externas são apenas inspiração de produto; nenhum código de terceiros foi copiado.

## Autenticação e sessões

A API usa cookies `HttpOnly` de acesso (15 minutos) e refresh rotativo (30 dias, hash SHA-256 persistido em `AuthSession`).
O frontend envia `credentials: "include"`; não grava tokens em `localStorage`. O navegador precisa abrir a aplicação na origem configurada em `WEB_ORIGIN`. Use HTTPS em produção e mantenha web e API no mesmo site para os cookies `SameSite=Lax`.

Rotas:
- `POST /api/auth/register`: cadastra admin + tenant e inicia sessão.
- `POST /api/auth/login`: aceita `identifier` (username/e-mail/WhatsApp) e `password`.
- `POST /api/auth/refresh`: revoga o refresh utilizado e cria uma nova sessão.
- `POST /api/auth/logout`: revoga o refresh atual e limpa cookies.
- `GET /api/auth/me`: perfil e vínculos do usuário autenticado.
- `GET /api/auth/system`: prova de acesso apenas para `SYSTEM`.
- `/painel`: painel inicial autenticado.

**Provisionamento do SYSTEM** (não executado automaticamente):

```bash
pnpm db:generate
# Preencha SYSTEM_NAME, SYSTEM_USERNAME, SYSTEM_EMAIL, SYSTEM_WHATSAPP e SYSTEM_PASSWORD no seu ambiente.
pnpm --filter @aicorta/api system:create
```

Exemplo de variáveis (não copie valores reais para o Git):
```dotenv
SYSTEM_NAME="Administrador da plataforma"
SYSTEM_USERNAME="operador"
SYSTEM_EMAIL="operador@example.com"
SYSTEM_WHATSAPP="32999999999"
SYSTEM_PASSWORD="substitua-por-uma-senha-forte-de-uso-unico"
```

WhatsApp é salvo como DDD + celular (11 dígitos, sem +55); entradas com +55 e 55 são aceitas e normalizadas. A senha precisa ter **16+ caracteres**. O script interrompe se qualquer identificador já pertencer a outro usuário; **nunca promove** contas existentes. Reexecutar com a mesma identidade SYSTEM não altera a senha e não cria duplicados. O papel SYSTEM é global, sem bypass automático das permissões de cada tenant.

**Antes de produção:** rate limit anti brute-force, verificação de e-mail/WhatsApp, recuperação de senha, proteção de CSRF reforçada para domínios não confiáveis, revogação de todas as sessões em troca de senha, testes E2E e monitoramento. Crie e versione uma migration após atualizar o schema Prisma.

## Auth 1.1 — recuperação de senha

Configure SMTP no `.env` antes de habilitar o envio de e-mails. Nunca registre links/tokens de recuperação em logs. O fluxo público responde genericamente, evitando informar se o usuário existe.

```dotenv
SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_USER="usuario"
SMTP_PASSWORD="senha-de-app"
SMTP_FROM="AICorta <no-reply@example.com>"
WEB_ORIGIN="http://localhost:3000"
```

1. `POST /api/auth/forgot-password` com `{"email":"usuario@example.com"}`.
2. O usuário recebe link para `/redefinir-senha?token=...`, válido por 15 minutos e uma utilização.
3. `POST /api/auth/reset-password` com `{"token":"...","password":"nova senha com 10+ caracteres"}`.
4. A alteração revoga todas as sessões de refresh existentes e invalida JWTs de acesso anteriores.

Limites de requisições em memória: padrão 60/minuto por IP, login 5/minuto, registro 3/minuto e recuperação 3/minuto. Para produção com várias instâncias, usar storage compartilhado e monitoramento de abuso. Atualize o schema antes dos testes: `pnpm db:migrate` e `pnpm db:generate`. A integração SMTP só funciona com credenciais reais.

## Permissions 1.0 — escopo de estabelecimento

Endpoints de gestão exigem JWT + vínculo ativo no tenant + estabelecimento ativo. O papel global SYSTEM **não** ignora autorização por estabelecimento.

- `GET /api/tenants/:tenantId/services`: catálogo público, apenas serviços ativos.
- `GET /api/tenants/:tenantId/services/manage`: todos os serviços, ADMIN.
- `POST /api/tenants/:tenantId/services`: cadastra serviço, ADMIN.
- `PATCH /api/tenants/:tenantId/services/:serviceId`: atualiza ou desativa serviço, ADMIN.
- `GET /api/tenants/:tenantId/appointments`: agenda interna, ADMIN ou EMPLOYEE.
- `POST /api/tenants/:tenantId/appointments`: agendamento interno, ADMIN ou EMPLOYEE.

Dados de preço são inteiros em centavos (`priceCents`), duração em minutos (5 a 480). Desative serviços via `PATCH` com `{"isActive":false}` para manter histórico de agendamentos. Não há alteração de schema para este patch.

**Atenção:** a criação de agendamentos ainda não implementa prevenção transacional de horários duplicados e não deve ser disponibilizada publicamente antes dessa validação.

## People 1.0 — funcionários, clientes e convites

Os convites exigem **conta ativa já existente**. Para preservar a privacidade, não existe cadastro automático de terceiros e não há associação sem aceite do convidado. Não é permitido convidar `SYSTEM`. Cada identidade global possui no máximo um vínculo por tenant; promoção ou troca de papel não acontece implicitamente.

Rotas (todas com prefixo `/api`):
- `GET /tenants/:tenantId/employees`: ADMIN, lista colaboradores.
- `GET /tenants/:tenantId/clients`: ADMIN e EMPLOYEE, lista clientes vinculados.
- `POST /tenants/:tenantId/invitations`: ADMIN, corpo `{"email":"pessoa@example.com","role":"EMPLOYEE"}` (ou CLIENT).
- `GET /tenants/:tenantId/invitations`: ADMIN, lista convites sem revelar tokens.
- `PATCH /tenants/:tenantId/invitations/:invitationId/revoke`: ADMIN, revoga convite pendente.
- `POST /invitations/accept`: usuário autenticado, corpo `{"token":"..."}`; e-mail deve coincidir.
- `PATCH /tenants/:tenantId/employees/:membershipId/deactivate`: ADMIN.
- `PATCH /tenants/:tenantId/clients/:membershipId/deactivate`: ADMIN.

Token aleatório de uso único, válido por **7 dias**; somente seu SHA-256 é salvo. A API o devolve ao administrador **uma vez** durante a criação, para envio manual seguro. Compartilhe somente com a pessoa convidada: um token exposto pode ser usado por qualquer sessão autenticada com o e-mail correspondente. A entrega SMTP automática e a interface web de convites são próximas etapas.

A criação de agendamentos internos agora exige que o cliente tenha vínculo CLIENT ativo com a barbearia. Histórico não é excluído ao desativar vínculos.

**Migration obrigatória:** `pnpm db:migrate` (nome sugerido: `people_invitations`), depois `pnpm db:generate`. Nenhuma conta SYSTEM ou membership existente deve ser recriado.

## Agenda 1.0

Horários semanais são registrados como dia da semana (0=domingo a 6=sábado), minuto de início e fim desde 00:00. Exemplo segunda-feira de 09:00 a 12:00: `{"weekday":1,"startMinute":540,"endMinute":720}`. O expediente da barbearia e o do profissional devem conter **ambos** o serviço; sem configuração, não há horários. Turnos atravessando a meia-noite ficam para outro patch. Fuso horário é obtido do Tenant (IANA, padrão America/Sao_Paulo). Datas de agendamento persistem em UTC.

Rotas (prefixo `/api/tenants/:tenantId/agenda`):
- `GET /hours` e `PUT /hours`: expediente semanal da barbearia, ADMIN.
- `GET /professionals/:memberId/hours` e `PUT /professionals/:memberId/hours`: jornada semanal, ADMIN.
- `GET /professionals/:memberId/services` e `PUT /professionals/:memberId/services`: serviços habilitados, ADMIN.
- `POST /time-off`: intervalos de folga em UTC, ADMIN.
- `GET /professionals/:memberId/time-off`: ADMIN ou próprio funcionário.
- `GET /availability?serviceId=...&membershipId=...&date=AAAA-MM-DD`: horários disponíveis, ADMIN ou EMPLOYEE.

`PUT /hours` recebe `{"windows":[{"weekday":1,"startMinute":540,"endMinute":1080}]}` e substitui a grade inteira, validando sobreposição. `PUT /professionals/:memberId/services` recebe `{"serviceIds":["uuid"]}`. `POST /time-off` recebe `{"membershipId":"uuid","startsAt":"2026-12-01T12:00:00Z","endsAt":"2026-12-01T15:00:00Z"}`.

A rota de criação de agendamentos internos usa **pg_advisory_xact_lock** por tenant+profissional e confere expediente, folga, serviço e conflito sob o mesmo lock, inclusive entre réplicas da API. Todos os agendamentos que escrevem no banco devem usar o mesmo protocolo transacional; escritas diretas no banco não são protegidas pelo lock. Uma exclusion constraint de PostgreSQL e testes E2E de concorrência são necessários antes de agendamento público.

Aplicar migration local: `pnpm db:migrate` (nome: `agenda_1_0`), depois `pnpm db:generate`. Não altera registros SYSTEM existentes.

## Booking 1.0 — fluxo público por slug

- Página pública: `/b/:slug` (catálogo, profissionais e horários disponíveis).
- Área do cliente: `/meus-agendamentos` (consultar, cancelar e remarcar).
- `GET /api/b/:slug`: catálogo e profissionais da barbearia ativa.
- `GET /api/b/:slug/slots?serviceId=...&membershipId=...&date=AAAA-MM-DD`: disponibilidade pública.
- `POST /api/b/:slug/bookings`: **sessão autenticada**; body com `serviceId`, `employeeMembershipId`, `startsAt` em ISO UTC. O backend usa o usuário logado como cliente e cria vínculo CLIENT somente se ainda não houver outro papel no estabelecimento.
- `GET /api/my/bookings`: reservas do cliente logado.
- `PATCH /api/b/:slug/bookings/:id/cancel`: cancela a própria reserva (mínimo 2h de antecedência); ADMIN também pode cancelar pela API.
- `PATCH /api/b/:slug/bookings/:id/reschedule`: remarca a própria reserva mantendo serviço e profissional; exige 2h de antecedência, valida expediente e conflito, volta ao estado PENDING.
- `PATCH /api/tenants/:tenantId/appointments/:appointmentId/confirm`: equipe confirma reservas pendentes.

### Proteção adicional contra dupla reserva

O lock transacional por profissional continua obrigatório nos fluxos de criação e remarcação. A proteção **independente no PostgreSQL** está em `apps/api/sql/booking_exclusion.sql` e deve ser aplicada **após todas as migrations Prisma e antes de liberar agendamentos públicos**:

```bash
pnpm db:migrate
pnpm db:generate
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U aicorta -d aicorta < apps/api/sql/booking_exclusion.sql
```

**Atenção:** o SQL instala uma exclusão GiST para reservas PENDING e CONFIRMED, bloqueando sobreposições por tenant/profissional. Verifique e corrija conflitos preexistentes antes de executá-lo; falhará se já houver reservas sobrepostas. Não execute duas vezes sem remover/verificar a constraint. Isso ainda não está integrado às migrations versionadas do Prisma — na fase de deploy consolidaremos a migration após revisar o histórico local.

Reservas iniciam como PENDING. Os horários são confirmados somente pelo estabelecimento; futuras integrações poderão notificar o cliente. A disponibilidade pode mudar entre consulta e confirmação e será revalidada no momento da gravação. Ainda faltam testes E2E com concorrência real, verificação do workflow completo em navegadores, política de cancelamento configurável e gateway de pagamentos.

## Cadastro de barbearias por convite SYSTEM (Onboarding 1.0)

A criação de barbearias deixa de ser aberta. O operador SYSTEM entra em `/system/convites`, informa **nome de referência do destinatário** e **dia mensal de vencimento** (1 a 31), gera um link de uso único e o envia manualmente ao futuro proprietário. O nome de referência não é o nome de usuário nem o nome da barbearia; é usado no histórico administrativo.

- `POST /api/auth/owner-invites` (SYSTEM): `{"referenceName":"João Miguel","billingDueDay":10}`.
- `GET /api/auth/owner-invites` (SYSTEM): histórico sem tokens.
- `PATCH /api/auth/owner-invites/:id/revoke` (SYSTEM): revogação antes do uso.
- `GET /api/auth/owner-invites/verify?token=...`: validação pública do token.
- `POST /api/auth/register`: exige `inviteToken`; consumo atômico em transação com criação de usuário ADMIN e tenant. Cadastros sem convite são recusados também na API.

O link expira em sete dias, só pode ser usado uma vez e contém segredo gerado aleatoriamente; somente o hash SHA-256 é salvo. O sistema exibe o link uma única vez ao emissor. Não existe envio automático nesse patch.

**Validação:** username novo somente `[a-z0-9]` (3–30 caracteres), sem espaços, acentos ou pontuação. O WhatsApp é exibido com máscara `(DD) 9XXXX-XXXX`, mas persistido como 11 dígitos brasileiros. O endereço curto/slug não é solicitado no cadastro: é gerado temporariamente e depois pode ser editado pelo ADMIN em `/painel/barbearias/:tenantId/configuracoes` (API `GET/PATCH /api/tenants/:tenantId/settings`).

**Financeiro:** `Tenant.billingDueDay` é preenchido pelo SYSTEM e não pode ser alterado pelo proprietário nessa tela. Não existem cobranças ou suspensões automáticas ainda. Para vencimentos 29–31 em meses curtos, a política prevista é usar o último dia do mês.

**Migração obrigatória:** `pnpm db:migrate` (nome sugerido: `owner_invites`) e `pnpm db:generate`. Tenants existentes recebem `billingDueDay=10` como valor provisório até configuração financeira. Não execute novamente o bootstrap SYSTEM.

## Dashboards 1.0 — design system preto e branco-gelo

Frontend migrado para **Tailwind CSS v4** com PostCSS e ícones Lucide. O layout dos painéis utiliza sidebar escura, conteúdo branco-gelo, navegação responsiva e um único shell reutilizável. Os dados são consultados diretamente na API autenticada, com cookies HttpOnly e refresh de sessão; números fictícios não são utilizados.

**Painel SYSTEM**
- `/system` — métricas globais reais: barbearias, acessos suspensos, usuários e convites em aberto.
- `/system/barbearias` — busca, filtro por status e suspensão/reativação manual de acesso.
- `/system/convites` — emissão e acompanhamento de convites de uso único.

**Painel da barbearia**
- `/painel/barbearias/:tenantId` — reservas de hoje, pendências, clientes, faturamento de serviços concluídos no mês e próximos agendamentos.
- `.../agenda` — lista de reservas, filtros e ação de confirmação.
- `.../servicos` — cadastro, edição, ativação e desativação de serviços.
- `.../equipe` — funcionários, convites e desativação de vínculos.
- `.../clientes` — consulta e busca de clientes vinculados.
- `.../configuracoes` — nome, endereço público e informações do estabelecimento.

**Endpoints adicionados**
- `GET /api/system/dashboard` — apenas SYSTEM.
- `GET /api/system/tenants` — apenas SYSTEM.
- `PATCH /api/system/tenants/:tenantId/status` com `{"status":"ACTIVE"}` ou `SUSPENDED` — apenas SYSTEM.
- `GET /api/tenants/:tenantId/dashboard` — ADMIN ou EMPLOYEE ativo no tenant.

O faturamento resumido soma apenas agendamentos `COMPLETED` no mês corrente da barbearia; **não** equivale a receita recebida/conciliada. A suspensão é manual e não há automação de cobrança ainda. A agenda lista os 100 primeiros agendamentos do endpoint atual; paginação e filtros por intervalo serão um patch posterior.

Instalação e verificação:
```bash
pnpm install
pnpm --filter @aicorta/api test
pnpm --filter @aicorta/api build
pnpm --filter @aicorta/web build
pnpm dev
```
