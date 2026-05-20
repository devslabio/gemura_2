#!/bin/bash
#
# Fetch operator-dashboard baseline from production (SQL inside API container) or via public API.
#
# SQL on Kwezi prod (recommended — uses DB inside container):
#   ./scripts/gemura/ops/run-fetch-operator-dashboard-prod-baseline.sh
#   GEMURA_API_CONTAINER=gemura-uat-api ./scripts/gemura/ops/run-fetch-operator-dashboard-prod-baseline.sh
#
# API from your machine (needs prod admin credentials):
#   FETCH_MODE=api GEMURA_ADMIN_PHONE=... GEMURA_ADMIN_PASSWORD=... \\
#     ./scripts/gemura/ops/run-fetch-operator-dashboard-prod-baseline.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CREDS_FILE="$REPO_ROOT/scripts/shared/deployment/server-credentials.sh"
[ -f "$CREDS_FILE" ] && source "$CREDS_FILE"

MODE="${FETCH_MODE:-sql}"
CONTAINER="${GEMURA_API_CONTAINER:-gemura-api}"
FETCH_SCRIPT="prisma/fetch-operator-dashboard-prod-baseline.ts"
OUT_LOCAL="$REPO_ROOT/backend/prisma/data/operator-dashboard-prod-baseline.json"

if [ "$MODE" = "api" ]; then
  echo "📊 Operator dashboard baseline → API ($GEMURA_API_URL)"
  cd "$REPO_ROOT/backend"
  npx tsx "$FETCH_SCRIPT" --mode=api
  exit 0
fi

if [ -z "${SERVER_PASS:-}" ]; then
  echo "❌ SERVER_PASS not set (scripts/shared/deployment/server-credentials.sh) for SQL mode on Kwezi."
  echo "   Or run locally: cd backend && npx tsx prisma/fetch-operator-dashboard-prod-baseline.ts --mode=sql"
  exit 1
fi

SERVER_IP="${SERVER_IP:-209.74.80.195}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_PORT="${SERVER_PORT:-22}"
SSH_OPTS="-o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ConnectTimeout=15 -p $SERVER_PORT"
SCP_OPTS="-o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ConnectTimeout=15 -P $SERVER_PORT"

echo "📊 Operator dashboard baseline → $SERVER_USER@$SERVER_IP ($CONTAINER, SQL)"
echo "================================================"

sshpass -p "$SERVER_PASS" scp $SCP_OPTS \
  "$REPO_ROOT/backend/$FETCH_SCRIPT" \
  "$SERVER_USER@$SERVER_IP:/tmp/fetch-operator-dashboard-prod-baseline.ts"

sshpass -p "$SERVER_PASS" ssh $SSH_OPTS "$SERVER_USER@$SERVER_IP" bash <<EOF
set -e
docker cp /tmp/fetch-operator-dashboard-prod-baseline.ts $CONTAINER:/app/$FETCH_SCRIPT
docker exec -w /app \\
  -e TS_NODE_SKIP_PROJECT=true \\
  -e TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node","target":"ES2021","esModuleInterop":true}' \\
  $CONTAINER node -r ts-node/register $FETCH_SCRIPT --mode=sql
docker cp $CONTAINER:/app/prisma/data/operator-dashboard-prod-baseline.json /tmp/operator-dashboard-prod-baseline.json
EOF

mkdir -p "$(dirname "$OUT_LOCAL")"
sshpass -p "$SERVER_PASS" scp $SCP_OPTS \
  "$SERVER_USER@$SERVER_IP:/tmp/operator-dashboard-prod-baseline.json" \
  "$OUT_LOCAL"

echo ""
echo "✅ Baseline saved locally: $OUT_LOCAL"
