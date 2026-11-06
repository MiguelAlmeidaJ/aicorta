# Roadmap beta

- [x] Monorepo pnpm + Nest + Next + Prisma + Postgres
- [x] Schema inicial de usuários, tenants, memberships, serviços e agendamentos
- [x] Cadastro de estabelecimento e autenticação por 3 identificadores (API)
- [x] Endpoint de catálogo e endpoints internos iniciais de agenda
- [ ] Migration versionada, CI e testes com banco
- [x] Cookies HttpOnly, refresh rotativo, logout e painel de sessão inicial
- [x] Bootstrap operacional de usuário SYSTEM por script de ambiente
- [x] Auth 1.1: rate limiting por IP e recuperação de senha por token de uso único via SMTP
- [ ] Verificação de e-mail/WhatsApp, testes E2E integrados e gestão de dispositivos
- [ ] Rate limiting compartilhado (Redis) para múltiplas réplicas e proteção adicional por identidade
- [x] Permissions 1.0: guard tenant-scoped com papéis explícitos e CRUD inicial de serviços
- [ ] Gestão de equipe, convites e clientes
- [ ] Testes E2E de isolamento multi-tenant e motor anti-conflito de agenda
- [ ] Agenda semanal, horários, folgas e bloqueio de concorrência
- [ ] Agendamento público via slug, remarcação e cancelamento
- [ ] Notificações WhatsApp/e-mail e fila de tarefas
- [ ] Pagamentos, assinaturas SaaS e relatórios
- [ ] Política LGPD, auditoria, observabilidade e deploy
