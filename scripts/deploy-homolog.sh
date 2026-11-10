#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ "$(git branch --show-current)" != "main" ]]; then
  echo "Erro: este procedimento de homologacao deve ser executado a partir da branch main." >&2
  exit 1
fi
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "Erro: existem modificacoes locais nao commitadas. Preserve os dados antes do deploy." >&2
  exit 1
fi
if [[ ! -f .env ]]; then
  echo "Erro: crie o arquivo .env na raiz usando .env.homolog.example como referencia." >&2
  exit 1
fi

# Os NEXT_PUBLIC_* precisam existir ANTES do build do Next.js.
set -a
# shellcheck disable=SC1091
source .env
set +a

: "${DATABASE_URL:?DATABASE_URL nao configurada}"
: "${JWT_SECRET:?JWT_SECRET nao configurado}"
: "${WEB_ORIGIN:?WEB_ORIGIN nao configurado}"
: "${NEXT_PUBLIC_API_URL:?NEXT_PUBLIC_API_URL nao configurado}"

if [[ "$WEB_ORIGIN" != "https://www.aicorta.com.br" ||
      "$NEXT_PUBLIC_API_URL" != "https://api.aicorta.com.br/api" ]]; then
  echo "Erro: confira WEB_ORIGIN e NEXT_PUBLIC_API_URL nos dominios de homologacao." >&2
  exit 1
fi
if (( ${#JWT_SECRET} < 32 )); then
  echo "Erro: JWT_SECRET precisa ter no minimo 32 caracteres." >&2
  exit 1
fi

echo "1/6 - Atualizando main a partir do GitHub..."
git pull --ff-only origin main

echo "2/6 - Instalando dependencias versionadas..."
pnpm install --frozen-lockfile

echo "3/6 - Gerando cliente Prisma..."
pnpm db:generate

echo "4/6 - Aplicando migrations (faça backup ANTES de executar)..."
pnpm --filter @aicorta/api exec prisma migrate deploy

echo "5/6 - Gerando builds frontend e API..."
pnpm build

echo "6/6 - Atualizando os processos PM2..."
pnpm pm2:reload
pnpm pm2:save
pnpm pm2:status

echo "Conferindo health da API..."
curl --fail --silent --show-error --max-time 15 "http://127.0.0.1:${API_PORT:-3001}/api/health"
printf "\nConferindo servidor web...\n"
curl --fail --silent --show-error --max-time 15 --output /dev/null "http://127.0.0.1:${WEB_PORT:-3000}/"
printf "\nDeploy local concluido. Verifique HTTPS, DNS e fluxos de homologacao.\n"
