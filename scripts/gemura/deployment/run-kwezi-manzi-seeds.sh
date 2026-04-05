#!/bin/bash
#
# Run Manzi/Kwezi demo Prisma seeds inside the gemura-api container on Kwezi.
#
# Prerequisites:
#   1. gemura-api is running and healthy on the server.
#   2. Seed TypeScript files are inside the container at /app/prisma/ (normally
#      after: ./scripts/gemura/deployment/deploy-gemura-backend-only.sh).
#      If you skipped a full deploy, rsync backend/prisma to /opt/gemura/backend/prisma
#      on the server, rebuild gemura-api, or docker cp the *.ts files into /app/prisma/.
#
# Usage (from repo root):
#   export SERVER_PASS='...'
#   ./scripts/gemura/deployment/run-kwezi-manzi-seeds.sh
#
# Or: source scripts/shared/deployment/server-credentials.sh (with SERVER_PASS set).
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CREDS_FILE="$REPO_ROOT/scripts/shared/deployment/server-credentials.sh"
[ -f "$CREDS_FILE" ] && source "$CREDS_FILE"

SERVER_IP="${SERVER_IP:-209.74.80.195}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_PASS="${SERVER_PASS:-}"
CONTAINER="${GEMURA_API_CONTAINER:-gemura-api}"

if [ -z "$SERVER_PASS" ]; then
  echo "❌ SERVER_PASS not set. Export it or add it to scripts/shared/deployment/server-credentials.sh"
  exit 1
fi

SSH_OPTS="-o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ConnectTimeout=15"

SEEDS=(
  seed-kwezi-test-manzi.ts
  seed-manzi-dummy-customers.ts
  seed-manzi-dummy-suppliers.ts
  seed-manzi-milk-history.ts
  seed-manzi-inventory-sales.ts
  seed-manzi-employees-payroll.ts
  seed-manzi-charges-loans.ts
)

echo "🌱 Manzi/Kwezi seeds → $SERVER_USER@$SERVER_IP ($CONTAINER)"
echo "================================================"

for seed in "${SEEDS[@]}"; do
  echo ""
  echo "▶ prisma/$seed"
  sshpass -p "$SERVER_PASS" ssh $SSH_OPTS "$SERVER_USER@$SERVER_IP" bash <<EOF
set -e
docker exec -w /app \\
  -e TS_NODE_SKIP_PROJECT=true \\
  -e TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node","target":"ES2021","esModuleInterop":true}' \\
  $CONTAINER node -r ts-node/register prisma/$seed
EOF
done

echo ""
echo "✅ All Manzi seeds finished on $CONTAINER"
