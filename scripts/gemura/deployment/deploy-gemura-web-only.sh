#!/bin/bash
#
# Deploy Gemura web (UI) only to Kwezi. Does not touch gemura-api.
#
# Usage (from project root):
#   ./scripts/gemura/deployment/deploy-gemura-web-only.sh
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
GEMURA_UI_PORT="3006"

if [ -z "$SERVER_PASS" ]; then
  echo "❌ SERVER_PASS not set. Export it or configure server-credentials.sh."
  exit 1
fi

SSH_OPTS="-o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=6 -o ConnectTimeout=15"
SSH_CONTROL_PATH="/tmp/gemura-web-deploy-$$"
SSH_MASTER_OPTS="$SSH_OPTS -o ControlMaster=auto -o ControlPath=$SSH_CONTROL_PATH -o ControlPersist=300"
cleanup_ssh() { ssh -O exit -o ControlPath="$SSH_CONTROL_PATH" $SERVER_USER@$SERVER_IP 2>/dev/null || true; }
trap cleanup_ssh EXIT

echo "🚀 Gemura web-only deployment"
echo "================================================"
echo "   Server: $SERVER_IP"
echo "   UI Port: $GEMURA_UI_PORT"
echo ""

echo "🔌 Checking connectivity..."
if ! sshpass -p "$SERVER_PASS" ssh $SSH_MASTER_OPTS -o ControlPersist=0 $SERVER_USER@$SERVER_IP "echo OK" 2>/dev/null; then
  echo "❌ Cannot reach the server."
  exit 1
fi
echo "   ✅ Server reachable"

echo ""
echo "📤 Syncing gemura-web + docker compose..."
cd "$REPO_ROOT"
sshpass -p "$SERVER_PASS" ssh $SSH_MASTER_OPTS -N -f $SERVER_USER@$SERVER_IP || { echo "❌ Failed to open SSH master."; exit 1; }
ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH $SERVER_USER@$SERVER_IP "mkdir -p $DEPLOY_PATH/apps/gemura-web $DEPLOY_PATH/docker"
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
echo "🔨 Building and starting gemura-ui only..."
ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH $SERVER_USER@$SERVER_IP 'bash -s' << 'ENDSSH'
set -e
export LC_ALL=C.UTF-8
cd /opt/gemura
[ -f .env ] || true
if [ ! -f .env ] || ! grep -q "NEXT_PUBLIC_API_URL" .env 2>/dev/null; then
  POSTGRES_PASSWORD=$(grep -E '^POSTGRES_PASSWORD=' /opt/kwezi/.env 2>/dev/null | cut -d= -f2- || echo "KweziPg2025!")
  if [ ! -f .env ]; then
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
fi
# Build and start only gemura-ui (leave gemura-api as-is)
docker compose -f docker/docker-compose.kwezi.yml --env-file .env up -d --build gemura-ui
echo ""
echo "   ⏳ Waiting for frontend..."
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if curl -s -m 3 http://localhost:3006/auth/login > /dev/null 2>&1; then
    echo "   ✅ Frontend is healthy"
    break
  fi
  [ "$i" -eq 12 ] && echo "   ⚠️  Frontend may still be starting" || sleep 5
done
docker compose -f docker/docker-compose.kwezi.yml ps gemura-ui
ENDSSH

echo ""
echo "✅ Gemura web deployment complete"
echo "   UI: https://app.gemura.rw  (or http://$SERVER_IP:$GEMURA_UI_PORT)"
echo ""
