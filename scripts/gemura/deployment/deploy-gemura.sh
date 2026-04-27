#!/bin/bash
#
# Deploy Gemura API + gemura-web to Kwezi (rsync + docker build with cache).
# Does NOT build gemura-admin-ui (Compose profile "admin"). For admin:
#   docker compose -f docker/docker-compose.kwezi.yml --profile admin up -d --build gemura-admin-ui
# For API-only (leaves gemura-ui container as-is): use deploy-gemura-backend-only.sh
#
# Usage (from project root):
#   ./scripts/gemura/deployment/deploy-gemura.sh
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CREDS_FILE="$REPO_ROOT/scripts/shared/deployment/server-credentials.sh"
[ -f "$CREDS_FILE" ] && source "$CREDS_FILE"

SERVER_IP="${SERVER_IP:-209.74.80.195}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_PASS="${SERVER_PASS:-}"
DEPLOY_PATH="/opt/gemura"
GEMURA_UI_PORT="3006"
GEMURA_API_PORT="3007"

if [ -z "$SERVER_PASS" ]; then
  echo "❌ SERVER_PASS not set. Configure scripts/shared/deployment/server-credentials.sh or export SERVER_PASS."
  exit 1
fi

SSH_OPTS="-o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=6 -o ConnectTimeout=15"

# Use a single SSH control socket so rsync reuses one connection (avoids multiple auth attempts;
# some servers or networks drop or throttle repeated password logins).
SSH_CONTROL_PATH="/tmp/gemura-deploy-$$"
SSH_MASTER_OPTS="$SSH_OPTS -o ControlMaster=auto -o ControlPath=$SSH_CONTROL_PATH -o ControlPersist=300"
cleanup_ssh() { ssh -O exit -o ControlPath="$SSH_CONTROL_PATH" $SERVER_USER@$SERVER_IP 2>/dev/null || true; }
trap cleanup_ssh EXIT

echo "🚀 Gemura Deployment (Kwezi-style: rsync + build with cache)"
echo "================================================"
echo "   Server: $SERVER_IP"
echo "   UI Port: $GEMURA_UI_PORT"
echo "   API Port: $GEMURA_API_PORT"
echo ""

echo "🔌 Checking connectivity to $SERVER_IP..."
if ! sshpass -p "$SERVER_PASS" ssh $SSH_MASTER_OPTS -o ControlPersist=0 $SERVER_USER@$SERVER_IP "echo OK" 2>/dev/null; then
  echo "❌ Cannot reach the server."
  exit 1
fi
echo "   ✅ Server reachable"

echo ""
echo "📤 Syncing files (rsync, incremental)..."
cd "$REPO_ROOT"
# Open one master SSH connection; rsync and mkdir reuse it (avoids repeated password auth)
sshpass -p "$SERVER_PASS" ssh $SSH_MASTER_OPTS -N -f $SERVER_USER@$SERVER_IP || { echo "❌ Failed to open SSH master connection."; exit 1; }
ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH $SERVER_USER@$SERVER_IP "mkdir -p $DEPLOY_PATH/backend $DEPLOY_PATH/apps/gemura-web $DEPLOY_PATH/docker"
rsync -avz --delete \
  --exclude='node_modules' --exclude='dist' --exclude='.git' \
  -e "ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH" \
  backend/ \
  $SERVER_USER@$SERVER_IP:$DEPLOY_PATH/backend/
rsync -avz --delete \
  --exclude='node_modules' --exclude='.next' --exclude='.git' \
  -e "ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH" \
  apps/gemura-web/ \
  $SERVER_USER@$SERVER_IP:$DEPLOY_PATH/apps/gemura-web/
rsync -avz \
  -e "ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH" \
  docker/docker-compose.kwezi.yml \
  $SERVER_USER@$SERVER_IP:$DEPLOY_PATH/docker/
echo "   ✅ Sync complete"

echo ""
echo "🔨 Building and starting containers (Docker cache used)..."
sshpass -p "$SERVER_PASS" ssh $SSH_OPTS $SERVER_USER@$SERVER_IP 'bash -s' << 'ENDSSH'
export LC_ALL=C.UTF-8
cd /opt/gemura
POSTGRES_PASSWORD=$(grep -E '^POSTGRES_PASSWORD=' /opt/kwezi/.env 2>/dev/null | cut -d= -f2- || echo "KweziPg2025!")
if [ ! -f .env ] || ! grep -q "DATABASE_URL" .env 2>/dev/null; then
  cat > .env << EOF
DATABASE_URL=postgresql://kwezi:${POSTGRES_PASSWORD}@kwezi-postgres:5432/gemura_db?schema=public
JWT_SECRET=gemura_jwt_secret_production_2026
JWT_EXPIRES_IN=7d
API_PORT=3007
UI_PORT=3006
NEXT_PUBLIC_API_URL=https://app.gemura.rw/api
CORS_ORIGIN=http://localhost:3006,http://209.74.80.195:3006,http://209.74.80.195:3007,http://209.74.80.195:3011,https://app.gemura.rw,https://app.orora.rw
EOF
fi
docker compose -f docker/docker-compose.kwezi.yml down --timeout 30 2>/dev/null || true
sleep 2
# API + main web only; gemura-admin-ui is opt-in via profile "admin" in compose file
docker compose -f docker/docker-compose.kwezi.yml --env-file .env up -d --build gemura-api gemura-ui
ENDSSH

echo ""
echo "⏳ Waiting for services to be ready..."
for i in 1 2 3 4 5 6 7 8; do
  sleep 5
  API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://$SERVER_IP:$GEMURA_API_PORT/api/health 2>/dev/null || echo "000")
  UI_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://$SERVER_IP:$GEMURA_UI_PORT/auth/login 2>/dev/null || echo "000")
  if [ "$API_STATUS" = "200" ] && [ "$UI_STATUS" = "200" ]; then
    echo "   ✅ Backend is healthy"
    echo "   ✅ Frontend is healthy"
    break
  fi
  [ "$i" -eq 8 ] && echo "   ⚠️  Services may still be starting (API: $API_STATUS, UI: $UI_STATUS)"
done

echo ""
echo "✅ Deployment complete"
echo "================================================"
echo "   Gemura Web: https://app.gemura.rw  (or http://$SERVER_IP:$GEMURA_UI_PORT)"
echo "   Gemura API: http://$SERVER_IP:$GEMURA_API_PORT/api"
echo ""
