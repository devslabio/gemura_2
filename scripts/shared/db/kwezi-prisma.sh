#!/bin/bash
# Run Prisma commands against the Kwezi Gemura DB via SSH.
# This never touches devslab; it executes inside the gemura-api
# container on the Kwezi server (kwezi-postgres / gemura_db).
#
# Usage examples (from repo root):
#   ./scripts/shared/db/kwezi-prisma.sh db push
#   ./scripts/shared/db/kwezi-prisma.sh migrate deploy
#   ./scripts/shared/db/kwezi-prisma.sh db seed
#   ./scripts/shared/db/kwezi-prisma.sh studio
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
# Load SERVER_IP, SERVER_USER, SERVER_PASS, GEMURA_DEPLOY_PATH
# shellcheck source=/dev/null
source "$REPO_ROOT/scripts/shared/deployment/server-credentials.sh"

if ! command -v sshpass >/dev/null 2>&1; then
  echo "sshpass is required (brew install sshpass)." >&2
  exit 1
fi

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <prisma-subcommand> [args...]" >&2
  echo "Example: $0 db push" >&2
  exit 1
fi

PRISMA_ARGS="$*"
SSH_OPTS="-o StrictHostKeyChecking=no -p ${SERVER_PORT:-22}"

echo "Running Prisma on Kwezi (gemura-api): prisma $PRISMA_ARGS"
sshpass -p "$SERVER_PASS" ssh $SSH_OPTS "$SERVER_USER@$SERVER_IP" "cd $GEMURA_DEPLOY_PATH && docker compose -f docker/docker-compose.kwezi.yml exec -T gemura-api npx prisma $PRISMA_ARGS"
