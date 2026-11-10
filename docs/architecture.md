# Arquitetura AICorta

## Multi-tenancy

Um único PostgreSQL com coluna `tenantId` nas entidades do negócio. Usuários e credenciais são globais; `Membership(userId, tenantId)` guarda papel e status em cada barbearia. O papel `SYSTEM` é global e reservado. O `ownerId` do tenant não substitui membership para autorização.

Toda query de dados de negócio precisa restringir `tenantId` e verificar autorização do ator no backend. Relações compostas em Appointment reforçam consistência de tenant entre agendamento, serviço e profissional. Futuramente habilitar PostgreSQL RLS como defesa em profundidade.

Identidade:
- username e email normalizados para minúsculas.
- WhatsApp é normalizado para DDD + celular (11 dígitos, sem +55) e único. Entradas com 55 ou +55 são aceitas; o login também reconhece registros E.164 legados.
- Hash bcrypt com custo 12; nunca armazenar senha em claro.
- A API de cadastro cria ADMIN e Tenant na mesma transação.

## Evolução necessária antes de produção

1. Sessões HttpOnly, refresh token rotativo, logout e revogação; rate limit, anti-enumeração e verificação de e-mail/WhatsApp.
2. Onboarding controlado de colaboradores/clientes, convite e autorização por papel.
3. Disponibilidade de horários, exceções, férias e timezone do tenant; armazenamento de datas em UTC.
4. Prevenção de conflitos concorrentes em agenda com restrição de exclusão PostgreSQL ou bloqueio transacional, além de validação da janela de serviço.
5. Endpoints públicos de agendamento com proteção contra abuso, confirmação e política de cancelamento.
6. Testes automatizados multi-tenant, integração, contrato e ponta a ponta; observabilidade e backups.
7. Auditar e proteger PII em conformidade com LGPD.

## Segurança

Não use `SYSTEM` automaticamente como superusuário de todos os tenants. Casos de suporte devem exigir autorização/auditoria explícitas. Não aceitar mudança de tenant apenas por parâmetro sem membership. Consultas públicas devem expor apenas dados de catálogo.
