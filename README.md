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
