#!/bin/bash
#
# Deploy Gemura Admin Web UAT to Kwezi as a standalone UI service.
# - Container: gemura-admin-uat-ui
# - Default host port: 3027 (override with ADMIN_UAT_PORT)
# - Deploy path: /opt/gemura-uat (same UAT workspace)
# - API baked into build: https://uat.gemura.rw/api (override NEXT_PUBLIC_API_URL_ADMIN_UAT)
#
# Usage (from project root):
#   ./scripts/gemura/deployment/deploy-gemura-admin-uat.sh
#
# Optional:
#   ADMIN_UAT_PORT=3030 ./scripts/gemura/deployment/deploy-gemura-admin-uat.sh
#   NEXT_PUBLIC_API_URL_ADMIN_UAT=https://uat.gemura.rw/api ./scripts/gemura/deployment/deploy-gemura-admin-uat.sh
#   SKIP_PORT_CHECK=1 ./scripts/gemura/deployment/deploy-gemura-admin-uat.sh
#
# Credentials:
#   source scripts/shared/deployment/server-credentials.sh
#   (or export SERVER_PASS, optionally SERVER_IP/SERVER_USER)
#
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
ADMIN_UAT_PORT="${ADMIN_UAT_PORT:-3027}"
NEXT_PUBLIC_API_URL_ADMIN_UAT="${NEXT_PUBLIC_API_URL_ADMIN_UAT:-https://uat.gemura.rw/api}"

if [ -z "$SERVER_PASS" ]; then
  echo "❌ SERVER_PASS not set. Configure scripts/shared/deployment/server-credentials.sh or export SERVER_PASS."
  exit 1
fi

SSH_OPTS="-o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=6 -o ConnectTimeout=15"
SSH_CONTROL_PATH="/tmp/gemura-admin-uat-deploy-$$"
SSH_MASTER_OPTS="$SSH_OPTS -o ControlMaster=auto -o ControlPath=$SSH_CONTROL_PATH -o ControlPersist=300"
cleanup_ssh() { ssh -O exit -o ControlPath="$SSH_CONTROL_PATH" $SERVER_USER@$SERVER_IP 2>/dev/null || true; }
trap cleanup_ssh EXIT

echo "🚀 Gemura Admin UAT deployment"
echo "================================================"
echo "   Server:       $SERVER_USER@$SERVER_IP"
echo "   Path:         $DEPLOY_UAT_PATH"
echo "   Host port:    $ADMIN_UAT_PORT (→ container 3005)"
echo "   API baked in: $NEXT_PUBLIC_API_URL_ADMIN_UAT"
echo ""

echo "🔌 Checking server connectivity..."
if ! sshpass -p "$SERVER_PASS" ssh $SSH_MASTER_OPTS -o ControlPersist=0 $SERVER_USER@$SERVER_IP "echo OK" 2>/dev/null; then
  echo "❌ Cannot reach the server."
  exit 1
fi
echo "   ✅ Server reachable"

echo ""
echo "🛡  Validating host port :$ADMIN_UAT_PORT..."
if [ "${SKIP_PORT_CHECK:-}" = "1" ]; then
  echo "   ⏭️  SKIP_PORT_CHECK=1"
else
  sshpass -p "$SERVER_PASS" ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH $SERVER_USER@$SERVER_IP bash -s "$ADMIN_UAT_PORT" << 'ENDCHECK'
set -e
PORT="$1"
INFO=$(ss -tlnp 2>/dev/null | awk -v p=":$PORT" '$4 ~ p {print; exit}')
if [ -z "$INFO" ]; then
  echo "   ✅ Port $PORT is free"
  exit 0
fi
OWNER=$(docker ps --format '{{.Names}}\t{{.Ports}}' 2>/dev/null | awk -v p=":$PORT->" '$0 ~ p {print $1; exit}')
if [ "$OWNER" = "gemura-admin-uat-ui" ]; then
  echo "   ✅ Port $PORT currently used by gemura-admin-uat-ui (redeploy allowed)"
  exit 0
fi
echo "   ❌ Port $PORT is already used by: ${OWNER:-<non-docker process>}"
echo "$INFO"
exit 2
ENDCHECK
fi

echo ""
echo "📤 Syncing admin app + compose file..."
cd "$REPO_ROOT"
sshpass -p "$SERVER_PASS" ssh $SSH_MASTER_OPTS -N -f $SERVER_USER@$SERVER_IP || { echo "❌ Failed to open SSH master."; exit 1; }
ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH $SERVER_USER@$SERVER_IP \
  "mkdir -p $DEPLOY_UAT_PATH/apps/gemura-admin-web $DEPLOY_UAT_PATH/docker"

rsync -avz --delete \
  --exclude='node_modules' --exclude='.next' --exclude='.git' --exclude='.env*' \
  -e "ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH" \
  apps/gemura-admin-web/ \
  $SERVER_USER@$SERVER_IP:$DEPLOY_UAT_PATH/apps/gemura-admin-web/

rsync -avz \
  -e "ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH" \
  docker/docker-compose.gemura-admin-uat.yml \
  $SERVER_USER@$SERVER_IP:$DEPLOY_UAT_PATH/docker/
echo "   ✅ Sync complete"

echo ""
echo "🔧 Ensuring $DEPLOY_UAT_PATH/.env.uat has required ADMIN_UAT vars..."
ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH $SERVER_USER@$SERVER_IP bash -s \
  "$DEPLOY_UAT_PATH" "$ADMIN_UAT_PORT" "$NEXT_PUBLIC_API_URL_ADMIN_UAT" << 'ENDENV'
set -e
DEPLOY_PATH="$1"
ADMIN_PORT="$2"
API_URL="$3"
mkdir -p "$DEPLOY_PATH"
touch "$DEPLOY_PATH/.env.uat"
if grep -q '^ADMIN_UAT_PORT=' "$DEPLOY_PATH/.env.uat"; then
  sed -i "s|^ADMIN_UAT_PORT=.*|ADMIN_UAT_PORT=$ADMIN_PORT|" "$DEPLOY_PATH/.env.uat"
else
  printf "\nADMIN_UAT_PORT=%s\n" "$ADMIN_PORT" >> "$DEPLOY_PATH/.env.uat"
fi
if grep -q '^NEXT_PUBLIC_API_URL_ADMIN_UAT=' "$DEPLOY_PATH/.env.uat"; then
  sed -i "s|^NEXT_PUBLIC_API_URL_ADMIN_UAT=.*|NEXT_PUBLIC_API_URL_ADMIN_UAT=$API_URL|" "$DEPLOY_PATH/.env.uat"
else
  printf "NEXT_PUBLIC_API_URL_ADMIN_UAT=%s\n" "$API_URL" >> "$DEPLOY_PATH/.env.uat"
fi
ENDENV
echo "   ✅ .env.uat updated"

echo ""
echo "🔨 Building and starting gemura-admin-uat-ui..."
sshpass -p "$SERVER_PASS" ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH $SERVER_USER@$SERVER_IP \
  "cd $DEPLOY_UAT_PATH && docker compose -f docker/docker-compose.gemura-admin-uat.yml --env-file .env.uat up -d --build gemura-admin-uat-ui"

echo ""
echo "⏳ Waiting for admin UAT UI on :$ADMIN_UAT_PORT..."
sshpass -p "$SERVER_PASS" ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH $SERVER_USER@$SERVER_IP bash -s \
  "$DEPLOY_UAT_PATH" "$ADMIN_UAT_PORT" << 'ENDWAIT'
set -e
DEPLOY_PATH="$1"
PORT="$2"
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if curl -s -m 3 "http://localhost:$PORT/auth/login" > /dev/null 2>&1; then
    echo "   ✅ Admin UAT UI is healthy on :$PORT"
    break
  fi
  if [ "$i" -eq 12 ]; then
    echo "   ⚠️  Admin UAT UI not responding yet on :$PORT"
  else
    sleep 5
  fi
done
docker compose -f "$DEPLOY_PATH/docker/docker-compose.gemura-admin-uat.yml" --env-file "$DEPLOY_PATH/.env.uat" ps gemura-admin-uat-ui
ENDWAIT

echo ""
UI_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://$SERVER_IP:$ADMIN_UAT_PORT/auth/login" 2>/dev/null || echo "000")
echo "✅ Gemura Admin UAT deployment complete"
echo "================================================"
echo "   URL:        http://$SERVER_IP:$ADMIN_UAT_PORT/auth/login  (HTTP $UI_STATUS)"
echo "   API baked:  $NEXT_PUBLIC_API_URL_ADMIN_UAT"
echo ""
