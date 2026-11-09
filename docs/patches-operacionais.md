# Patches operacionais 06 a 12

Este documento e o checklist oficial do ciclo operacional. Um item so recebe `[x]` quando existe evidencia no repositorio ou homologacao registrada. Implementacao parcial nao conclui um patch.

## Criterios de aceite comuns

- [ ] Fluxo principal coberto por teste automatizado no backend
- [ ] Isolamento entre tenants e permissoes cobertos por teste
- [ ] Interface desktop e mobile homologada manualmente
- [ ] Estados de carregamento, vazio, erro e nova tentativa validados
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` aprovados
- [ ] Testes PostgreSQL (`test:db` e `test:e2e`) aprovados em banco isolado
- [ ] Documentacao de operacao e criterios de rollback atualizados

## Patch 06 - Estabilizacao da operacao existente (P0)

Estado: **em andamento**. A base funcional existe, mas a homologacao completa ainda nao foi executada.

### Agenda e disponibilidade

- [x] Expediente do estabelecimento e dos profissionais
- [x] Servicos atribuidos aos profissionais
- [x] Folgas e bloqueios de horario
- [x] Consulta de disponibilidade por data
- [x] Persistencia em UTC e exibicao no fuso do tenant
- [x] Bloqueio transacional por profissional
- [x] Restricao PostgreSQL contra sobreposicao de reservas ativas
- [ ] Homologar virada de dia, horario de verao e limites de expediente

### Reserva, cancelamento e remarcacao

- [x] Reserva autenticada pelo cliente
- [x] Listagem de reservas do cliente
- [x] Confirmacao pela equipe
- [x] Cancelamento pelo cliente com antecedencia minima
- [x] Remarcacao com revalidacao de disponibilidade
- [x] Liberacao do horario apos cancelamento
- [x] Tratamento HTTP de disputa simultanea pelo mesmo horario
- [x] Cobrir cancelamento e remarcacao em E2E HTTP, incluindo limites de permissao
- [ ] Homologar a jornada completa em navegadores com usuarios distintos

### Permissoes e qualidade

- [x] Guardas por tenant e papeis ADMIN/EMPLOYEE/CLIENT
- [x] Testes unitarios de permissoes e transicoes existentes
- [x] Typecheck aprovado localmente em 09/11/2026
- [x] Build API e web aprovado localmente em 09/11/2026
- [x] Suite unitaria aprovada localmente: 61/61 em 09/11/2026
- [x] Lint aprovado localmente apos as correcoes deste patch em 09/11/2026
- [ ] `test:db` aprovado localmente (requer `TEST_DATABASE_URL` isolada)
- [ ] `test:e2e` aprovado localmente (requer `TEST_DATABASE_URL` isolada)
- [ ] Checklist manual de `docs/demo-roteiro.md` concluido

Entrega: fluxo de reservas validado do inicio ao fim.

## Patch 07 - Atendimento e comandas (P0)

Estado: **em andamento**. O fluxo principal de comanda foi implementado e aguarda validacao E2E com PostgreSQL e homologacao manual.

- [x] Definir estados de atendimento: check-in, em atendimento, encerrado e cancelado
- [x] Criar modelo de comanda separado da reserva
- [x] Criar itens da comanda com snapshot de descricao, quantidade e valor
- [ ] Permitir adicionar/remover servicos e produtos durante o atendimento
- [x] Aplicar descontos com motivo, autor e limites de permissao
- [x] Calcular subtotal, descontos e valor final no backend
- [x] Registrar historico imutavel das operacoes da comanda
- [x] Implementar check-in e inicio do atendimento
- [x] Implementar encerramento idempotente da comanda
- [x] Criar interface operacional responsiva
- [ ] Cobrir concorrencia, permissoes, auditoria e isolamento entre tenants

Entrega: execucao completa do servico dentro do sistema.

## Patch 08 - Caixa e registro de pagamentos presenciais (P0)

Estado: **em andamento**. Caixa, registros divididos, movimentos, estorno e fechamento foram implementados; falta homologacao E2E com PostgreSQL e validacao manual. O sistema nao processa pagamentos: PIX e maquininha pertencem ao estabelecimento.

- [x] Criar sessao de caixa por tenant e operador
- [x] Abrir caixa com saldo inicial
- [x] Impedir mais de um caixa aberto por tenant com indice parcial e lock transacional
- [x] Registrar pagamentos presenciais ja realizados e vinculados a comandas
- [x] Registrar dinheiro, PIX do estabelecimento, debito/credito na maquininha e outros meios presenciais
- [x] Registrar divisao entre diferentes meios usados no comercio
- [ ] Registrar troco e taxas informados pelo comercio (referencias externas ja rejeitam numeros validos de cartao)
- [x] Registrar sangria e suprimento com motivo e autor
- [x] Fechar caixa com saldo contado e divergencia
- [x] Produzir extrato cronologico e trilha de auditoria
- [x] Tratar estorno sem apagar pagamentos ou lancamentos
- [ ] Cobrir idempotencia, concorrencia, permissoes e isolamento entre tenants

Entrega: controle financeiro operacional confiavel.

## Patch 09 - Mensalidades e suspensao automatica (P0)

Estado: **implementado e validado**.

- [x] Cadastrar valor mensal, dia de vencimento e inicio contratual por barbearia
- [x] Gerar competencias mensais sem cobranca bancaria ou gateway de pagamento
- [x] Permitir confirmacao de pagamento somente ao SYSTEM
- [x] Manter historico de competencias, pagamentos confirmados e atrasos
- [x] Executar verificacao diaria no servidor, independente do dashboard
- [x] Suspender automaticamente estabelecimentos inadimplentes
- [x] Reativar apos regularizacao sem remover dados
- [x] Exibir avisos de pendencia e suspensao no painel da barbearia
- [x] Auditar configuracoes, confirmacoes e mudancas automaticas de situacao
- [x] Considerar atraso somente apos o fim do dia em `America/Sao_Paulo`
- [x] Ajustar vencimentos 29, 30 e 31 ao ultimo dia do mes
- [x] Impedir competencias anteriores ao inicio do contrato
- [x] Reconciliar a situacao financeira tambem durante a verificacao de acesso
- [x] Manter suspensoes manuais separadas das suspensoes financeiras

Entrega: gestao administrativa da mensalidade SaaS, sem processar pagamentos no sistema.

## Patch 10 - Gestao completa de clientes (P1)

Estado: **parcial**. Ja existem cadastro/vinculo e busca simples por clientes.

- [x] Cadastro e vinculo de cliente ao tenant
- [x] Busca/listagem basica de clientes vinculados
- [ ] Criar perfil operacional do cliente
- [ ] Exibir historico de reservas, atendimentos, comandas e pagamentos
- [ ] Criar observacoes internas com autor e data
- [ ] Definir permissao para leitura e edicao de observacoes
- [ ] Calcular frequencia, ticket, ultima visita e previsao de retorno
- [ ] Implementar filtros e paginacao
- [ ] Tratar unificacao/duplicidade de identidade sem vazar dados entre tenants
- [ ] Criar interface responsiva de perfil e historico
- [ ] Cobrir LGPD, permissoes e isolamento entre tenants

## Patch 11 - Relatorios gerenciais (P1)

Estado: **parcial**. O dashboard atual possui contagens e soma de agendamentos concluidos, que ainda nao representam receita recebida.

- [ ] Faturamento efetivo baseado nos pagamentos presenciais registrados pela equipe
- [ ] Receitas, estornos, descontos e divergencias por periodo
- [ ] Servicos mais vendidos por quantidade e valor
- [ ] Produtividade por profissional
- [ ] Comissoes geradas, ajustadas e pagas
- [ ] Comparecimento, cancelamento e ausencia
- [ ] Filtros por periodo, profissional, servico e meio de pagamento
- [ ] Totais coerentes com caixa, comandas e pagamentos
- [ ] Exportacao CSV com timezone e formatacao documentados
- [ ] Paginacao e limites para consultas extensas
- [ ] Cobrir permissoes, performance e isolamento entre tenants

## Patch 12 - Comunicacao e automacoes (P2)

Estado: **nao iniciado**. Recuperacao de senha por SMTP nao conta como mensagem transacional da operacao.

- [ ] Criar outbox transacional para eventos de reserva e atendimento
- [ ] Criar fila duravel com retentativas e backoff
- [ ] Garantir idempotencia e evitar mensagens duplicadas
- [ ] Enviar confirmacao de reserva
- [ ] Enviar lembretes configuraveis
- [ ] Enviar aviso de cancelamento e remarcacao
- [ ] Criar templates por canal e tenant
- [ ] Registrar status, tentativas e erro final de entrega
- [ ] Respeitar consentimento, opt-out, LGPD e limites do provedor
- [ ] Criar painel de consulta e reprocessamento autorizado
- [ ] Cobrir falhas do provedor, concorrencia e isolamento entre tenants

## Ordem de execucao

1. Concluir o gate e a homologacao do Patch 06.
2. Modelar Patch 07 antes do Patch 08, pois o pagamento deve liquidar uma comanda fechada.
3. Implementar Patch 08 antes dos relatorios financeiros.
4. Executar o Patch 10 sobre os eventos operacionais consolidados.
5. Construir Patch 11 sobre pagamentos presenciais, evitando relatorios baseados apenas em status de agenda.
6. Adicionar Patch 12 com outbox transacional para nao perder mensagens em falhas ou deploys.
