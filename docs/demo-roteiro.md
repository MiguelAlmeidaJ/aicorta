# AICorta — roteiro de demonstração do MVP

Esta demonstração usa dados de teste e **não representa homologação de produção**. O objetivo é mostrar uma jornada real sem Prisma Studio nem requisições manuais.

## Preparação

1. Faça `git checkout beta && git pull origin beta`; execute `pnpm install` e `pnpm db:generate`.
2. Aplique migrations do ambiente de desenvolvimento com `pnpm db:migrate`. **Não use banco de produção**.
3. Execute `pnpm --filter @aicorta/api test`, `pnpm --filter @aicorta/api build` e `pnpm --filter @aicorta/web build`.
4. Execute `pnpm dev`. A web estará em `http://localhost:3000` e a API em `http://localhost:3001/api` no padrão local.
5. Use uma conta SYSTEM própria do ambiente de demonstração. Nunca compartilhe credenciais reais nem links de convite expirados.

## Apresentação em 10 etapas

| Etapa | Ação | Resultado esperado |
| --- | --- | --- |
| 1 | Entrar como SYSTEM e visitar `/system` | Métricas globais e menu funcional |
| 2 | Abrir `/system/configuracoes` | Identidade visual, favicon e logos exibidos |
| 3 | Abrir `/system/convites`; criar convite para o dono | Link único emitido, vencimento mensal registrado |
| 4 | Abrir o convite em aba anônima; cadastrar proprietário | Novo tenant ADMIN criado e acesso ao painel |
| 5 | Abrir o painel do tenant | Checklist de preparação inicial exibido |
| 6 | Cadastrar serviço com duração e preço | Serviço aparece na gestão |
| 7 | Configurar expediente, jornada do profissional e atribuir serviço | Checklist concluído, horários disponibilizados |
| 8 | Abrir `/b/:slug`; criar cliente pelo link de cadastro | Cliente volta à barbearia após cadastro |
| 9 | Escolher serviço, profissional e horário; confirmar reserva | Nova reserva aparece em `/meus-agendamentos` |
| 10 | Entrar como ADMIN; confirmar na agenda, navegar por dia/semana | Status atualizado e reserva visível no calendário |

Para concluir um atendimento na demonstração, utilize uma reserva com horário **já iniciado**. Não altere dados de produção para simular atendimento. Cancelamento e remarcação pelo cliente exigem pelo menos duas horas de antecedência.

## Checklist de homologação manual

- [ ] Desktop: páginas SYSTEM, configurações, painel do tenant, agenda, formulário público e minhas reservas
- [ ] Mobile (390px): navegação sem elementos cortados, menu recolhível, reserva e remarcação
- [ ] Acessibilidade: navegação por teclado, foco visível, mensagens de erro e status legíveis
- [ ] Login/expiração: login `?next=`, refresh de sessão, logout e volta à tela esperada
- [ ] Permissões: SYSTEM não administra tenant diretamente; cliente não acessa ações ADMIN
- [ ] Isolamento: usuário do tenant A não pode editar/visualizar dados internos do tenant B
- [ ] Concorrência: duas contas disputam o mesmo horário; apenas uma reserva é aceita
- [ ] Recuperação: se conexão cair, ações mostram falha e permitem nova tentativa
- [ ] Verificar link público, fotos/logos, horários e contatos antes de apresentar

## Execução automatizada

A CI `Beta quality gate` em GitHub Actions executa migrations PostgreSQL 16, testes unitários e SQL, HTTP E2E, build API e build web. Verifique se o commit apresentado está verde na aba **Actions**.

Localmente, os testes que criam e removem registros exigem **`TEST_DATABASE_URL` apontando para banco isolado contendo `test` ou `verify` no nome**.

```bash
pnpm --filter @aicorta/api test:db
pnpm --filter @aicorta/api test:e2e
```

Os testes integrados não substituem a verificação manual dos navegadores. Faça uma execução completa com usuários separados antes de uma apresentação a terceiros.
