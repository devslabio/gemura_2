#!/bin/bash
# Deploy Gemura UAT stack to Kwezi as a parallel environment.
# - Default ports: UI 3024, API 3025 (checked on server before first deploy)
# - Deploy path: /opt/gemura-uat
# - Database: gemura_uat_db (isolated from production)
#
# Usage (from repo root):
#   ./scripts/gemura/deployment/deploy-gemura-uat.sh
# Optional:
#   UAT_PUBLIC_HOST=uat.gemura.rw UAT_PUBLIC_SCHEME=https ./scripts/gemura/deployment/deploy-gemura-uat.sh
#   SKIP_PORT_CHECK=1 ./scripts/gemura/deployment/deploy-gemura-uat.sh
#   SEED_UAT=1 … — after API is healthy, run `npx prisma db seed` in the UAT API container (demo users, same as local seed).
#     Use once (or when UAT DB is empty). Re-running duplicates some sample rows (e.g. milk sales); safe for demo users upsert.
#   Full copy of local Postgres → UAT DB: CONFIRM_REPLACE_UAT_DB=yes ./scripts/gemura/deployment/sync-local-db-to-gemura-uat.sh
#
# When users open https://uat.gemura.rw, you MUST set UAT_PUBLIC_HOST (or NEXT_PUBLIC bakes http://<IP>:3025
# and the browser blocks API calls as mixed content — login appears as "Login failed").

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CREDS_FILE="$REPO_ROOT/scripts/shared/deployment/server-credentials.sh"
_DEPLOY_SERVER_PASS_FROM_ENV="${SERVER_PASS-}"
[ -f "$CREDS_FILE" ] && source "$CREDS_FILE"
if [ -n "$_DEPLOY_SERVER_PASS_FROM_ENV" ]; then
  SERVER_PASS="$_DEPLOY_SERVER_PASS_FROM_ENV"
fi
unset _DEPLOY_SERVER_PASS_FROM_ENV

SERVER_IP="${SERVER_IP:-209.74.80.195}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_PASS="${SERVER_PASS:-}"
DEPLOY_UAT_PATH="${DEPLOY_UAT_PATH:-/opt/gemura-uat}"
UI_UAT_PORT="${UI_UAT_PORT:-3024}"
API_UAT_PORT="${API_UAT_PORT:-3025}"

if [ -z "$SERVER_PASS" ]; then
  echo "❌ SERVER_PASS not set. Configure scripts/shared/deployment/server-credentials.sh or export SERVER_PASS."
  exit 1
fi

SSH_OPTS="-o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=6 -o ConnectTimeout=15"
SSH_CONTROL_PATH="/tmp/gemura-uat-deploy-$$"
SSH_MASTER_OPTS="$SSH_OPTS -o ControlMaster=auto -o ControlPath=$SSH_CONTROL_PATH -o ControlPersist=300"
cleanup_ssh() { ssh -O exit -o ControlPath="$SSH_CONTROL_PATH" $SERVER_USER@$SERVER_IP 2>/dev/null || true; }
trap cleanup_ssh EXIT

echo "🚀 Gemura UAT Deployment"
echo "================================================"
echo "   Server:     $SERVER_USER@$SERVER_IP"
echo "   Path:       $DEPLOY_UAT_PATH"
echo "   UI Port:    $UI_UAT_PORT"
echo "   API Port:   $API_UAT_PORT"
echo "   Database:   gemura_uat_db"
echo ""

UAT_PUBLIC_HOST="${UAT_PUBLIC_HOST:-}"
UAT_PUBLIC_SCHEME="${UAT_PUBLIC_SCHEME:-https}"
if [ -n "$UAT_PUBLIC_HOST" ]; then
  NEXT_PUBLIC_API_URL_VALUE="${UAT_PUBLIC_SCHEME}://${UAT_PUBLIC_HOST}/api"
else
  NEXT_PUBLIC_API_URL_VALUE="http://${SERVER_IP}:${API_UAT_PORT}/api"
  echo "   ⚠️  No UAT_PUBLIC_HOST — NEXT_PUBLIC_API_URL will be HTTP on server IP."
  echo "      For https://uat.gemura.rw use: UAT_PUBLIC_HOST=uat.gemura.rw UAT_PUBLIC_SCHEME=https …"
fi

# Include public UAT hostnames (Orora/Cursor hit https://uat.orora.rw/api with Origin: https://uat.orora.rw — must be allowed).
UAT_CORS_ORIGIN="http://localhost:${UI_UAT_PORT},http://localhost:${API_UAT_PORT},http://${SERVER_IP}:${UI_UAT_PORT},http://${SERVER_IP}:${API_UAT_PORT},http://${SERVER_IP}:3026,https://uat.gemura.rw,https://admin-uat.gemura.rw,https://uat.orora.rw,https://app.gemura.rw,https://app.orora.rw,https://admin.gemura.rw"
if [ -n "$UAT_PUBLIC_HOST" ]; then
  UAT_CORS_ORIGIN="${UAT_CORS_ORIGIN},http://${UAT_PUBLIC_HOST},${UAT_PUBLIC_SCHEME}://${UAT_PUBLIC_HOST}"
fi
[ -n "${EXTRA_CORS_ORIGINS_UAT:-}" ] && UAT_CORS_ORIGIN="${UAT_CORS_ORIGIN},${EXTRA_CORS_ORIGINS_UAT}"

echo "   NEXT_PUBLIC_API_URL (baked in gemura-uat-ui): $NEXT_PUBLIC_API_URL_VALUE"
echo ""

echo "🔌 Checking server connectivity..."
sshpass -p "$SERVER_PASS" ssh $SSH_MASTER_OPTS -o ControlPersist=0 $SERVER_USER@$SERVER_IP "mkdir -p $DEPLOY_UAT_PATH" 2>/dev/null || true
sshpass -p "$SERVER_PASS" ssh $SSH_MASTER_OPTS -N -f $SERVER_USER@$SERVER_IP || { echo "❌ Failed to open SSH master connection."; exit 1; }
echo "   ✅ Server reachable"

echo ""
echo "🔌 Step 0: Checking if UAT ports are available on server..."
if [ "${SKIP_PORT_CHECK:-}" = "1" ]; then
  echo "   ⏭️  SKIP_PORT_CHECK=1 (redeploy with existing ports)"
else
  ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH $SERVER_USER@$SERVER_IP \
    "python3 -c \"
import socket
for p in ($UI_UAT_PORT, $API_UAT_PORT):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        s.bind(('', p))
    except OSError as e:
        print(f'Port {p} is not available: {e}')
        exit(1)
    finally:
        s.close()
print('Ports $UI_UAT_PORT and $API_UAT_PORT are available')
\"" || { echo "❌ Port check failed. Pick different ports or use SKIP_PORT_CHECK=1 for redeploy."; exit 1; }
  echo "   ✅ Port check passed"
fi

echo ""
echo "📤 Step 1: Syncing files..."
cd "$REPO_ROOT"
ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH $SERVER_USER@$SERVER_IP "mkdir -p $DEPLOY_UAT_PATH/backend $DEPLOY_UAT_PATH/apps/gemura-web $DEPLOY_UAT_PATH/docker"
rsync -avz --delete \
  --exclude='node_modules' --exclude='dist' --exclude='.git' \
  -e "ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH" \
  backend/ \
  $SERVER_USER@$SERVER_IP:$DEPLOY_UAT_PATH/backend/
rsync -avz --delete \
  --exclude='node_modules' --exclude='.next' --exclude='.git' \
  -e "ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH" \
  apps/gemura-web/ \
  $SERVER_USER@$SERVER_IP:$DEPLOY_UAT_PATH/apps/gemura-web/
rsync -avz \
  -e "ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH" \
  docker/docker-compose.gemura-uat.yml \
  $SERVER_USER@$SERVER_IP:$DEPLOY_UAT_PATH/docker/
echo "   ✅ Sync complete"

echo ""
echo "🗄️  Step 2: Ensuring UAT database exists..."
ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH $SERVER_USER@$SERVER_IP << 'ENDSSH'
set -e
if ! docker ps | grep -q kwezi-postgres; then
  echo "❌ kwezi-postgres is not running!"
  exit 1
fi
docker exec kwezi-postgres psql -U kwezi -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'gemura_uat_db'" | grep -q 1 || \
docker exec kwezi-postgres psql -U kwezi -d postgres -c "CREATE DATABASE gemura_uat_db;"
echo "   ✅ Database gemura_uat_db ready"
ENDSSH

echo ""
echo "🔧 Step 3: Creating .env.uat..."
ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH $SERVER_USER@$SERVER_IP bash -s << ENDSSH
set -e
cd $DEPLOY_UAT_PATH
POSTGRES_PASSWORD=\$(grep -E '^POSTGRES_PASSWORD=' /opt/kwezi/.env 2>/dev/null | cut -d= -f2- || true)
[ -z "\$POSTGRES_PASSWORD" ] && POSTGRES_PASSWORD="KweziPg2025!"

cat > .env.uat << ENVEOF
UI_UAT_PORT=$UI_UAT_PORT
API_UAT_PORT=$API_UAT_PORT
DATABASE_URL=postgresql://kwezi:\$POSTGRES_PASSWORD@kwezi-postgres:5432/gemura_uat_db?schema=public
JWT_SECRET=gemura_jwt_secret_uat_2026
JWT_EXPIRES_IN=7d
NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL_VALUE
CORS_ORIGIN=$UAT_CORS_ORIGIN
ENVEOF

echo "   ✅ Created .env.uat"
ENDSSH

echo ""
echo "🔨 Step 4a: Building and starting gemura-uat-api (sequential to protect memory)..."
ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH $SERVER_USER@$SERVER_IP bash -s << ENDSSH
set -e
export LC_ALL=C.UTF-8
cd $DEPLOY_UAT_PATH
COMPOSE="docker compose -f docker/docker-compose.gemura-uat.yml --env-file .env.uat"

echo "   Stopping any previous UAT containers (not other services)..."
\$COMPOSE stop gemura-uat-api gemura-uat-ui 2>/dev/null || true
\$COMPOSE rm -f gemura-uat-api gemura-uat-ui 2>/dev/null || true

echo "   Building and starting gemura-uat-api only..."
\$COMPOSE up -d --build gemura-uat-api

echo "   Waiting for gemura-uat-api to be healthy..."
for i in \$(seq 1 20); do
  if curl -sf http://localhost:3025/api/health > /dev/null 2>&1; then
    echo "   ✅ gemura-uat-api is healthy"
    break
  fi
  [ "\$i" -eq 20 ] && echo "   ⚠️  gemura-uat-api not healthy yet, continuing anyway" || sleep 8
done
ENDSSH

if [ "${SEED_UAT:-}" = "1" ]; then
  echo ""
  echo "🌱 Step 4a-seed: Running prisma db seed in gemura-uat-api (demo accounts)..."
  ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH $SERVER_USER@$SERVER_IP \
    "docker exec gemura-uat-api npx prisma db seed"
  echo "   ✅ UAT database seed finished (demo password is in seed output on server)"
fi

echo ""
echo "🔨 Step 4b: Building and starting gemura-uat-ui..."
ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH $SERVER_USER@$SERVER_IP bash -s << ENDSSH
set -e
export LC_ALL=C.UTF-8
cd $DEPLOY_UAT_PATH
COMPOSE="docker compose -f docker/docker-compose.gemura-uat.yml --env-file .env.uat"

echo "   Building and starting gemura-uat-ui only..."
\$COMPOSE up -d --build gemura-uat-ui

echo "   Waiting for gemura-uat-ui to be ready..."
for i in \$(seq 1 20); do
  if curl -sf http://localhost:3024/auth/login > /dev/null 2>&1; then
    echo "   ✅ gemura-uat-ui is healthy"
    break
  fi
  [ "\$i" -eq 20 ] && echo "   ⚠️  gemura-uat-ui not healthy yet" || sleep 8
done
\$COMPOSE ps
ENDSSH

echo ""
echo "🔍 Step 5: Health checks..."
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://$SERVER_IP:$API_UAT_PORT/api/health" 2>/dev/null || echo "000")
UI_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://$SERVER_IP:$UI_UAT_PORT/auth/login" 2>/dev/null || echo "000")

echo ""
echo "✅ Gemura UAT deployment complete"
echo "================================================"
echo "   UAT UI:      http://$SERVER_IP:$UI_UAT_PORT (HTTP $UI_STATUS)"
echo "   UAT API:     http://$SERVER_IP:$API_UAT_PORT/api (HTTP $API_STATUS)"
echo "   UAT Swagger: http://$SERVER_IP:$API_UAT_PORT/api/docs"
if [ -n "$UAT_PUBLIC_HOST" ]; then
  PUB_UI_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${UAT_PUBLIC_SCHEME}://${UAT_PUBLIC_HOST}/" 2>/dev/null || echo "000")
  PUB_API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${UAT_PUBLIC_SCHEME}://${UAT_PUBLIC_HOST}/api/health" 2>/dev/null || echo "000")
  echo "   Public UI:   ${UAT_PUBLIC_SCHEME}://${UAT_PUBLIC_HOST}/ (HTTP $PUB_UI_STATUS)"
  echo "   Public API:  ${UAT_PUBLIC_SCHEME}://${UAT_PUBLIC_HOST}/api/health (HTTP $PUB_API_STATUS)"
fi
echo ""
