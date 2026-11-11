# Permissões de administração da plataforma

## Papéis globais

- `USER`: cliente, proprietário ou colaborador; acessa apenas seus recursos e os tenants aos quais pertence.
- `MANAGER`: operador administrativo da plataforma; dispõe de **Visão Geral, Barbearias, Mensalidades e Convites** no painel `/system`. Não pode alterar branding, imagens padrão, FAQ, managers, auditoria ou acessar rotas exclusivas de SYSTEM.
- `SYSTEM`: administrador principal, com acesso completo e exclusivo a **Identidade Visual, Padronização de Imagens, FAQ, Managers e Auditoria**, além das quatro áreas operacionais.

| Área do SYSTEM | USER | MANAGER | SYSTEM |
| --- | :---: | :---: | :---: |
| Visão Geral `/system` | Não | Sim | Sim |
| Barbearias `/system/barbearias` | Não | Sim | Sim |
| Mensalidades `/system/mensalidades` | Não | Sim | Sim |
| Convites `/system/convites` | Não | Sim | Sim |
| Identidade visual `/system/configuracoes` | Não | Não | Sim |
| Imagens padrão `/system/configuracoes/imagens` | Não | Não | Sim |
| Perguntas frequentes `/system/faq` | Não | Não | Sim |
| Gerenciar managers `/system/managers` | Não | Não | Sim |
| Auditoria `/system/auditoria` | Não | Não | Sim |

## Configuração e criação de managers

1. Entre como `SYSTEM`, acesse **Managers** e preencha nome, usuário, e-mail, WhatsApp e senha inicial.
2. O cadastro é exclusivo do SYSTEM; não existe inscrição pública no papel MANAGER.
3. O manager entra em `/admin/login`, com o mesmo fluxo de autenticação do SYSTEM, e é enviado a `/system`.
4. O SYSTEM pode desativar ou reativar o acesso. Ao desativar, as sessões são revogadas e tokens anteriores são invalidados.
5. Contas `MANAGER` não podem ser vinculadas às equipes de barbearias; privilégios globais e papéis de tenant são isolados.

## Auditoria

O histórico `/system/auditoria` reúne eventos operacionais registrados a partir da implantação e eventos de mensalidades já existentes. Entre os eventos estão cadastro e suspensão de barbearias, emissão e revogação de convites, criação/ativação/desativação de managers, alterações de mensalidades, confirmações de pagamento e suspensões automáticas. Os registros incluem ator e data, sem senhas nem tokens dos convites.

A rota `GET /api/system/audit` usa `JwtAuthGuard` e `SystemGuard`, de modo que o bloqueio não depende apenas de esconder o menu no navegador.

## Migração

Depois de atualizar `beta`, faça backup do banco e execute:

```bash
pnpm db:generate
pnpm --filter @aicorta/api exec prisma migrate deploy
pnpm build
pnpm pm2:reload
pnpm pm2:save
```

A migration `20261111170000_manager_platform_audit` adiciona o valor `MANAGER` ao enum global e a tabela `PlatformAudit`. Não altera os perfis existentes e nenhuma conta é promovida automaticamente.

## Validação

- Faça login como MANAGER: quatro menus visíveis e funcionais; rotas do SYSTEM retornam **403** na API.
- Crie/suspenda um estabelecimento e confirme o registro na Auditoria com o SYSTEM.
- Crie e revogue um convite como MANAGER e confira o registro na Auditoria.
- Desative o MANAGER pelo SYSTEM e confirme que a sessão perde acesso.
- Faça login como SYSTEM e confira acesso a todos os menus.

**Atenção:** enquanto o recurso estiver apenas na branch `beta`, não atualize a instalação em `main` de homologação sem o merge e a migration correspondente.
