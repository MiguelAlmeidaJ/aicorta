# Roadmap beta

O checklist detalhado do ciclo operacional esta em [`patches-operacionais.md`](./patches-operacionais.md).

- [x] Monorepo pnpm + Nest + Next + Prisma + Postgres
- [x] Schema inicial de usuários, tenants, memberships, serviços e agendamentos
- [x] Cadastro de estabelecimento e autenticação por 3 identificadores (API)
- [x] Endpoint de catálogo e endpoints internos iniciais de agenda
- [ ] Migration versionada, CI e testes com banco
- [x] Onboarding 1.0: convite SYSTEM de uso único, dia de vencimento e configuração de slug pelo ADMIN
- [ ] Entrega automática do convite, dashboard financeiro e regras de suspensão por inadimplência
- [x] Cookies HttpOnly, refresh rotativo, logout e painel de sessão inicial
- [x] Bootstrap operacional de usuário SYSTEM por script de ambiente
- [x] Auth 1.1: rate limiting por IP e recuperação de senha por token de uso único via SMTP
- [ ] Verificação de e-mail/WhatsApp, testes E2E integrados e gestão de dispositivos
- [ ] Rate limiting compartilhado (Redis) para múltiplas réplicas e proteção adicional por identidade
- [x] Permissions 1.0: guard tenant-scoped com papéis explícitos e CRUD inicial de serviços
- [x] People 1.0: convites de funcionários/clientes existentes, aceite autenticado e listagens por tenant
- [ ] Onboarding de convidados sem conta, entrega automática de convites e UI de gestão
- [x] Associação de serviços a profissionais
- [ ] Reativação controlada de vínculos
- [ ] Testes E2E de isolamento multi-tenant e motor anti-conflito de agenda
- [x] Agenda 1.0: horários da loja/profissionais, folgas, disponibilidade e bloqueio transacional por profissional
- [ ] Exclusion constraint no PostgreSQL, testes E2E com concorrência real e UI da agenda
- [x] Booking 1.0: catálogo e horários por slug, reserva autenticada, cancelamento e remarcação
- [ ] Testes E2E de concorrência com PostgreSQL real, migração SQL de exclusão validada e monitoramento
- [ ] Notificações WhatsApp/e-mail e fila de tarefas
- [x] Dashboard SYSTEM 1.0 e painel da barbearia com sidebar responsiva, Tailwind v4 e dados reais
- [ ] Relatórios financeiros, paginação da agenda e melhorias de gestão de equipe
- [x] Registro operacional de pagamentos presenciais e caixa (sem gateway ou processamento financeiro)
- [ ] Cobrança da assinatura SaaS e relatórios
- [x] Branding 1.0: identidade do manual oficial e configurações de logo/favicon/cores por SYSTEM
- [x] Branding UI 1.1: prévias amplas, crop visual de margens nas logos e sidebar refinada
- [ ] Licenciamento comercial das fontes especiais e CDN para ativos de marca
- [ ] Política LGPD, auditoria, observabilidade e deploy

## MVP Demo — verificação
- [x] Patch 4: suíte HTTP E2E com PostgreSQL e gate CI em beta (execução obrigatória para aprovação)
- [x] Patch 5: calendário semanal/diário, filtro por profissional e onboarding visual do ADMIN
- [ ] Homologar execução real da CI, responsividade e fluxo completo em navegador
- [ ] Testar reserva simultânea com múltiplas réplicas e monitorar erros operacionais

- [x] Patch 05.1: área de reservas do cliente com histórico, remarcação e identidade visual consistente
- [x] Patch 05.1: retorno ao agendamento após cadastro de cliente e tratamento de conflito com recarga de horários
- [ ] Patch 05: homologação visual manual em desktop/mobile com o roteiro `docs/demo-roteiro.md`
