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
