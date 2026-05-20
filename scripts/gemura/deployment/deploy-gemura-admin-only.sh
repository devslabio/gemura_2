#!/bin/bash
#
# Deploy Gemura admin web (UI) only to Kwezi. Does not touch gemura-api or gemura-ui.
# Publishes host :3021 → container :3005 (override with ADMIN_PUBLIC_PORT env).
#
# Usage (from project root):
#   ./scripts/gemura/deployment/deploy-gemura-admin-only.sh
#
# Credentials: set SERVER_PASS (and optionally SERVER_IP, SERVER_USER) or
#   source scripts/shared/deployment/server-credentials.sh
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
CREDS_FILE="$REPO_ROOT/scripts/shared/deployment/server-credentials.sh"
[ -f "$CREDS_FILE" ] && source "$CREDS_FILE"

SERVER_IP="${SERVER_IP:-209.74.80.195}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_PASS="${SERVER_PASS:-}"
DEPLOY_PATH="${GEMURA_DEPLOY_PATH:-/opt/gemura}"
ADMIN_PUBLIC_PORT="${ADMIN_PUBLIC_PORT:-3021}"
# Kwezi backend port for the admin UI bake-in. Use production hostname if nginx
# already proxies /api for admin.gemura.rw; otherwise the direct API port works too.
NEXT_PUBLIC_API_URL_ADMIN_DEFAULT="${NEXT_PUBLIC_API_URL_ADMIN:-https://admin.gemura.rw/api}"

if [ -z "$SERVER_PASS" ]; then
  echo "❌ SERVER_PASS not set. Export it or configure server-credentials.sh."
  exit 1
fi

SSH_OPTS="-o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=6 -o ConnectTimeout=15"
SSH_CONTROL_PATH="/tmp/gemura-admin-deploy-$$"
SSH_MASTER_OPTS="$SSH_OPTS -o ControlMaster=auto -o ControlPath=$SSH_CONTROL_PATH -o ControlPersist=300"
cleanup_ssh() { ssh -O exit -o ControlPath="$SSH_CONTROL_PATH" $SERVER_USER@$SERVER_IP 2>/dev/null || true; }
trap cleanup_ssh EXIT

echo "🚀 Gemura admin-only deployment"
echo "================================================"
echo "   Server:       $SERVER_IP"
echo "   Host port:    $ADMIN_PUBLIC_PORT (→ container 3005)"
echo "   API baked in: $NEXT_PUBLIC_API_URL_ADMIN_DEFAULT"
echo ""

echo "🔌 Checking connectivity..."
if ! sshpass -p "$SERVER_PASS" ssh $SSH_MASTER_OPTS -o ControlPersist=0 $SERVER_USER@$SERVER_IP "echo OK" 2>/dev/null; then
  echo "❌ Cannot reach the server."
  exit 1
fi
echo "   ✅ Server reachable"

echo ""
echo "🛡  Checking that host port $ADMIN_PUBLIC_PORT is free or used only by our own container..."
sshpass -p "$SERVER_PASS" ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH $SERVER_USER@$SERVER_IP bash -s "$ADMIN_PUBLIC_PORT" << 'ENDCHECK'
set -e
PORT="$1"
INFO=$(ss -tlnp 2>/dev/null | awk -v p=":$PORT" '$4 ~ p {print; exit}')
if [ -z "$INFO" ]; then
  echo "   ✅ Port $PORT is free on host"
  exit 0
fi
# Inspect which container (if any) owns it
OWNER=$(docker ps --format '{{.Names}}\t{{.Ports}}' 2>/dev/null | awk -v p=":$PORT->" '$0 ~ p {print $1; exit}')
if [ "$OWNER" = "gemura-admin-ui" ]; then
  echo "   ✅ Port $PORT currently used by gemura-admin-ui (will be replaced by this deploy)"
  exit 0
fi
echo "   ❌ Port $PORT is already used by: ${OWNER:-<non-docker process>}"
echo "$INFO"
exit 2
ENDCHECK

echo ""
echo "📤 Syncing gemura-admin-web + docker compose..."
cd "$REPO_ROOT"
sshpass -p "$SERVER_PASS" ssh $SSH_MASTER_OPTS -N -f $SERVER_USER@$SERVER_IP || { echo "❌ Failed to open SSH master."; exit 1; }
ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH $SERVER_USER@$SERVER_IP "mkdir -p $DEPLOY_PATH/apps/gemura-admin-web $DEPLOY_PATH/docker"
rsync -avz --delete \
  --exclude='node_modules' --exclude='.next' --exclude='.git' --exclude='.env*' \
  -e "ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH" \
  apps/gemura-admin-web/ \
  $SERVER_USER@$SERVER_IP:$DEPLOY_PATH/apps/gemura-admin-web/
rsync -avz \
  -e "ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH" \
  docker/docker-compose.kwezi.yml \
  $SERVER_USER@$SERVER_IP:$DEPLOY_PATH/docker/
echo "   ✅ Sync complete"

echo ""
echo "🔨 Building and starting gemura-admin-ui only..."
sshpass -p "$SERVER_PASS" ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH $SERVER_USER@$SERVER_IP \
  "cd $DEPLOY_PATH && NEXT_PUBLIC_API_URL_ADMIN='$NEXT_PUBLIC_API_URL_ADMIN_DEFAULT' docker compose -f docker/docker-compose.kwezi.yml --env-file .env --profile admin up -d --build gemura-admin-ui"

echo ""
echo "⏳ Waiting for admin UI (host :$ADMIN_PUBLIC_PORT)..."
sshpass -p "$SERVER_PASS" ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH $SERVER_USER@$SERVER_IP bash -s "$ADMIN_PUBLIC_PORT" << 'ENDWAIT'
set -e
PORT="$1"
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if curl -s -m 3 "http://localhost:$PORT/auth/login" > /dev/null 2>&1; then
    echo "   ✅ Admin UI is healthy on :$PORT"
    break
  fi
  if [ "$i" -eq 12 ]; then
    echo "   ⚠️  Admin UI not responding yet on :$PORT"
  else
    sleep 5
  fi
done
docker compose -f /opt/gemura/docker/docker-compose.kwezi.yml ps gemura-admin-ui
ENDWAIT

echo ""
echo "✅ Gemura admin deployment complete"
echo "   URL: https://admin.gemura.rw  (or http://$SERVER_IP:$ADMIN_PUBLIC_PORT)"
echo ""
