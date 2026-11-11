# Publicacao do AICorta no Linux Manager (homologacao)

## Dominios e processos

- Frontend: **https://www.aicorta.com.br** -> reverse proxy -> **127.0.0.1:3000** (Next.js, PM2 **aicorta-web**).
- API: **https://api.aicorta.com.br** -> reverse proxy -> **127.0.0.1:3001** (NestJS, PM2 **aicorta-api**).
- Opcional: **https://aicorta.com.br** -> redirecionamento 301 para www.
- A API permite CORS somente da origem `https://www.aicorta.com.br`.
- Node.js >= 22 e pnpm 10; instancias PM2 fazem parte do mesmo monorepo.
- Use PostgreSQL dedicado, com backup automatico. **NAO use o banco de desenvolvimento do docker-compose.yml**, cujo password e exposto e padrao.

## 1. DNS e TLS

Crie registros A/AAAA para `www`, `api` e, se necessario, `@` apontando ao **IP publico real** do servidor. O painel Linux Manager apresentado em `192.168.x.x` e um endereco de rede privada, nao deve ser publicado nem divulgado como endpoint da aplicacao.

Abra apenas 80/443 na borda. Configure Nginx ou o recurso de reverse proxy do painel para os dois destinos acima; exemplo em `deploy/nginx/aicorta.conf`. Instale certificados TLS validos para `www.aicorta.com.br` e `api.aicorta.com.br` (e apex, se utilizado) e habilite renovacao automatica. **Nao habilite o site sem HTTPS:** a autenticacao requer cookies Secure em producao.

## 2. Aplicacao no Linux Manager

A ficha atual do Linux Manager usa a branch `main` e porta 3000. Depois do merge de `beta` -> `main`:

1. Use `Git pull` para receber a nova `main`.
2. O projeto **nao** e um unico `node index.js`: precisa gerar o Next.js e o NestJS e iniciar **dois** processos no PM2 via `ecosystem.config.cjs`.
3. Use o Terminal do Linux Manager (ou SSH autorizado) na **raiz do repositorio**, onde ficam `pnpm-lock.yaml` e `ecosystem.config.cjs`, para executar o deploy documentado.
4. Evite iniciar ao mesmo tempo uma instancia automatica do Linux Manager *e* outra instancia PM2 na porta 3000, o que resultaria em `EADDRINUSE`. Se o Linux Manager administrar PM2 diretamente, configure nele os dois processos equivalentes; caso contrario deixe o PM2 deste repositorio responsavel pelo ciclo de vida.
5. `Aplicacoes -> Configurar`: confirme branch `main`, diretorio do repositorio, deploy/build e proxy. A UI pode oferecer os comandos, mas a tela fornecida nao confirma suporte a dois processos ou a dois dominios. Use proxy Nginx e PM2 pelo terminal quando nao houver essas opcoes.

## 3. Variaveis de ambiente e banco

No diretorio raiz, copie `.env.homolog.example` como `.env` e preencha **valores reais e fortes**. Nao publique o arquivo, nem capturas com credenciais, no GitHub.

Parametros fundamentais:

```dotenv
NODE_ENV=production
WEB_ORIGIN="https://www.aicorta.com.br"
NEXT_PUBLIC_API_URL="https://api.aicorta.com.br/api"
WEB_HOST=127.0.0.1
WEB_PORT=3000
API_HOST=127.0.0.1
API_PORT=3001
DATABASE_URL="postgresql://USUARIO:SENHA@127.0.0.1:5432/aicorta_homolog?schema=public"
JWT_SECRET="CHAVE_FORTE_COM_64_OU_MAIS_CARACTERES"
```

Configure `CONTACT_TO_EMAIL`, `SMTP_*`, e, se precisar, `GOOGLE_GEOCODING_API_KEY`. Nao e necessario expor secrets como `NEXT_PUBLIC_*`. O PM2 le as variaveis da raiz e so repassa os secrets necessarios para o processo da API.

**Importante:** `NEXT_PUBLIC_API_URL` e incorporada ao build. Toda mudanca nesse valor exige novo `pnpm build` e recarga PM2. O banco deve estar disponivel antes de aplicar migrations.

## 4. Primeiro deploy / deploy repetido

Faca backup do banco antes das migrations, especialmente se for reutilizar a base de testes anterior. No terminal Linux Manager, na raiz:

```bash
git switch main
git pull --ff-only origin main
cp .env.homolog.example .env
chmod 600 .env
# edite o .env com os segredos e valores corretos
bash scripts/deploy-homolog.sh
```

O script valida o ambiente, atualiza a main, instala dependencias congeladas, gera Prisma, aplica `prisma migrate deploy`, compila frontend/API e faz `pnpm pm2:reload`. Ele termina consultando `http://127.0.0.1:3001/api/health` e a pagina do frontend. Nao faz backup automaticamente nem configura DNS, TLS ou Nginx.

Na inicializacao do PM2 como servico, configure persistencia conforme o usuario e a distribuicao do servidor (`pm2 startup` e `pm2 save`) para que volte apos um reboot. Nao execute a aplicacao como root se puder utilizar usuario de servico.

## 5. Checklist antes de liberar para clientes

- `curl -I https://www.aicorta.com.br/` responde por TLS e `curl https://api.aicorta.com.br/api/health` responde sem falhas.
- `pm2 ls` mostra **aicorta-web** e **aicorta-api** online, sem repetidos crashes; confirme `pm2 logs`.
- A home carrega imagens/capas, favicon, mapa e FAQ.
- Cadastrar/login/logout, login de cliente, login de admin e recuperacao de senha funcionam.
- Crie um agendamento real de teste, confirme-o pelo painel e remarque usando apenas horario disponivel.
- Expire/limite as janelas de reservas segundo a configuracao e confira a seguranca entre tenants.
- O formulario `/contato` entrega um email de teste no `CONTACT_TO_EMAIL`.
- Garanta que a base seja de homologacao: se usar dominios definitivos, marque os testes como tais e nao anuncie o site ate validar. Dados de teste e contas temporarias devem ser removidos antes de producao.
- Teste desktop e mobile, revise Termos, Politica de Cookies e LGPD e monitore backups e erros.

## Diagnostico rapido

```bash
pnpm pm2:status
pnpm pm2:logs
curl -v http://127.0.0.1:3001/api/health
curl -I http://127.0.0.1:3000
sudo nginx -t
```

Se front funciona mas login falha, confira `WEB_ORIGIN`, `NEXT_PUBLIC_API_URL`, HTTPS, cookies e headers CORS. Se a pagina exibir `localhost:3001` nas requisicoes, refaca o build com o `.env` correto. Se uma porta estiver ocupada, remova o processo duplicado em vez de iniciar outra copia.


## Hotfix de navegação e favicon

- O React/Next.js gerencia os elementos `<head>`. Não remova ícones com `document.querySelectorAll(...).remove()` nem altere o DOM de metadata manualmente: isso pode provocar o erro `removeChild` e impedir a navegação.
- `INTERNAL_API_URL=http://127.0.0.1:3001/api` é usado **apenas** pelo Next.js no servidor para consultar a revisão atual da identidade visual e devolver a favicon publicada no SYSTEM.
- O HTML declara uma favicon versionada `/favicon?v=<updatedAt>`, e a rota de favicon nunca substitui silenciosamente uma imagem configurada quando a API está indisponível.
- No SYSTEM, publique a favicon em Configurações > Identidade visual. Recarregue a página após atualizar os processos. Verifique `https://www.aicorta.com.br/favicon` e `https://api.aicorta.com.br/api/branding/assets/favicon` em abas separadas: ambas devem exibir **a mesma** imagem.
- Se persistir uma favicon antiga no navegador, faça uma atualização forçada (Ctrl+Shift+R) e verifique se não há cache na CDN ou proxy. A nova revisão no URL da favicon evita reuso indevido de cache.
- Após atualizar o backend, confira o log de erros: `pm2 logs aicorta-api`; o proxy deve manter os dois processos online.
