#!/bin/bash
#
# Deploy Gemura backend (API) only to Kwezi. Does not rebuild or restart gemura-ui or
# gemura-admin-ui (use this when you want production web UIs left unchanged).
#
# Usage (from project root):
#   ./scripts/gemura/deployment/deploy-gemura-backend-only.sh
#
# Credentials: set SERVER_PASS (and optionally SERVER_IP, SERVER_USER) or
#   source scripts/shared/deployment/server-credentials.sh
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CREDS_FILE="$REPO_ROOT/scripts/shared/deployment/server-credentials.sh"
[ -f "$CREDS_FILE" ] && source "$CREDS_FILE"

SERVER_IP="${SERVER_IP:-209.74.80.195}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_PASS="${SERVER_PASS:-}"
DEPLOY_PATH="${GEMURA_DEPLOY_PATH:-/opt/gemura}"

if [ -z "$SERVER_PASS" ]; then
  echo "❌ SERVER_PASS not set. Export it or configure server-credentials.sh."
  exit 1
fi

SSH_OPTS="-o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=6 -o ConnectTimeout=15"
SSH_CONTROL_PATH="/tmp/gemura-backend-deploy-$$"
SSH_MASTER_OPTS="$SSH_OPTS -o ControlMaster=auto -o ControlPath=$SSH_CONTROL_PATH -o ControlPersist=300"
cleanup_ssh() { ssh -O exit -o ControlPath="$SSH_CONTROL_PATH" $SERVER_USER@$SERVER_IP 2>/dev/null || true; }
trap cleanup_ssh EXIT

echo "🚀 Gemura backend-only deployment"
echo "================================================"
echo "   Server: $SERVER_IP"
echo "   API Port: 3007"
echo ""

echo "🔌 Checking connectivity..."
if ! sshpass -p "$SERVER_PASS" ssh $SSH_MASTER_OPTS -o ControlPersist=0 $SERVER_USER@$SERVER_IP "echo OK" 2>/dev/null; then
  echo "❌ Cannot reach the server."
  exit 1
fi
echo "   ✅ Server reachable"

echo ""
echo "📤 Syncing backend + docker compose..."
cd "$REPO_ROOT"
sshpass -p "$SERVER_PASS" ssh $SSH_MASTER_OPTS -N -f $SERVER_USER@$SERVER_IP || { echo "❌ Failed to open SSH master."; exit 1; }
ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH $SERVER_USER@$SERVER_IP "mkdir -p $DEPLOY_PATH/backend $DEPLOY_PATH/docker"
rsync -avz --delete \
  --exclude='node_modules' --exclude='dist' --exclude='.git' \
  -e "ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH" \
  backend/ \
  $SERVER_USER@$SERVER_IP:$DEPLOY_PATH/backend/
rsync -avz \
  -e "ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH" \
  docker/docker-compose.kwezi.yml \
  $SERVER_USER@$SERVER_IP:$DEPLOY_PATH/docker/
echo "   ✅ Sync complete"

echo ""
echo "🔨 Building and starting gemura-api only..."
# Reuse the SSH master (same as rsync) — avoids a second TCP connection that often times out.
ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH $SERVER_USER@$SERVER_IP 'bash -s' << 'ENDSSH'
set -e
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
# Build and start only gemura-api (leave gemura-ui as-is)
docker compose -f docker/docker-compose.kwezi.yml --env-file .env up -d --build gemura-api
echo ""
echo "   ⏳ Waiting for backend..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -s -m 3 http://localhost:3007/api/health > /dev/null 2>&1; then
    echo "   ✅ Backend is healthy"
    break
  fi
  [ "$i" -eq 10 ] && echo "   ⚠️  Backend may still be starting" || sleep 3
done
docker compose -f docker/docker-compose.kwezi.yml ps gemura-api
ENDSSH

echo ""
echo "✅ Backend deployment complete"
echo "   API: http://$SERVER_IP:3007/api"
echo ""
