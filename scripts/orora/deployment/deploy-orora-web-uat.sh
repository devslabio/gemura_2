#!/bin/bash
#
# Deploy Orora Web UAT to Kwezi server.
# Container: orora-uat-ui  |  Port: 3026  |  API: https://uat.orora.rw/api (→ gemura-uat-api:3025)
#
# Usage (from project root):
#   ./scripts/orora/deployment/deploy-orora-web-uat.sh
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CREDS_FILE="$REPO_ROOT/scripts/shared/deployment/server-credentials.sh"
[ -f "$CREDS_FILE" ] && source "$CREDS_FILE"

SERVER_IP="${SERVER_IP:-209.74.80.195}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_PASS="${SERVER_PASS:-}"
DEPLOY_PATH="/opt/orora-uat"
ORORA_UAT_PORT="3026"
API_URL="https://uat.orora.rw/api"

if [ -z "$SERVER_PASS" ]; then
  echo "❌ SERVER_PASS not set. Configure scripts/shared/deployment/server-credentials.sh or export SERVER_PASS."
  exit 1
fi

SSH_OPTS="-o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=6 -o ConnectTimeout=15"
SSH_CONTROL_PATH="/tmp/orora-uat-deploy-$$"
SSH_MASTER_OPTS="$SSH_OPTS -o ControlMaster=auto -o ControlPath=$SSH_CONTROL_PATH -o ControlPersist=300"
cleanup_ssh() { ssh -O exit -o ControlPath="$SSH_CONTROL_PATH" $SERVER_USER@$SERVER_IP 2>/dev/null || true; }
trap cleanup_ssh EXIT

echo "🚀 Orora Web UAT Deployment"
echo "================================================"
echo "   Server : $SERVER_IP"
echo "   Port   : $ORORA_UAT_PORT"
echo "   API    : $API_URL"
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
sshpass -p "$SERVER_PASS" ssh $SSH_MASTER_OPTS -N -f $SERVER_USER@$SERVER_IP || { echo "❌ Failed to open SSH master."; exit 1; }
ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH $SERVER_USER@$SERVER_IP "mkdir -p $DEPLOY_PATH/apps $DEPLOY_PATH/docker"

rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='.env.local' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  -e "ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH" \
  apps/orora-web/ \
  $SERVER_USER@$SERVER_IP:$DEPLOY_PATH/apps/orora-web/

rsync -avz \
  -e "ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH" \
  docker/docker-compose.orora-web.uat.yml \
  $SERVER_USER@$SERVER_IP:$DEPLOY_PATH/docker/
echo "   ✅ Sync complete"

echo ""
echo "🔨 Building and starting UAT container (Docker cache used)..."
sshpass -p "$SERVER_PASS" ssh $SSH_OPTS $SERVER_USER@$SERVER_IP \
  "cd $DEPLOY_PATH && NEXT_PUBLIC_API_URL=$API_URL docker compose -f docker/docker-compose.orora-web.uat.yml up -d --build"

echo ""
echo "🌐 Updating nginx config..."
rsync -avz \
  -e "ssh $SSH_OPTS -o ControlPath=$SSH_CONTROL_PATH" \
  docker/nginx/gemura-orora.conf \
  $SERVER_USER@$SERVER_IP:/etc/nginx/sites-available/gemura-orora.conf

sshpass -p "$SERVER_PASS" ssh $SSH_OPTS $SERVER_USER@$SERVER_IP "
  ln -sf /etc/nginx/sites-available/gemura-orora.conf /etc/nginx/sites-enabled/gemura-orora.conf
  nginx -t && nginx -s reload && echo '  ✅ nginx reloaded'
"

echo ""
echo "🔐 Attempting SSL certificate for uat.orora.rw..."
sshpass -p "$SERVER_PASS" ssh $SSH_OPTS $SERVER_USER@$SERVER_IP "
  if certbot certonly --webroot -w /var/www/html -d uat.orora.rw --non-interactive --agree-tos -m admin@orora.rw 2>&1; then
    echo '  ✅ Certificate issued'
    nginx -t && nginx -s reload && echo '  ✅ nginx reloaded with SSL'
  else
    echo '  ⚠️  certbot failed — DNS for uat.orora.rw may not be set yet.'
    echo '     Once the DNS A record points to $SERVER_IP, run:'
    echo '     certbot --nginx -d uat.orora.rw'
  fi
" || true

echo ""
echo "⏳ Waiting for Orora UAT Web to be ready..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  STATUS=$(curl -s -m 3 -o /dev/null -w "%{http_code}" "http://$SERVER_IP:$ORORA_UAT_PORT/" 2>/dev/null || echo "000")
  if [[ "$STATUS" == "200" || "$STATUS" == "308" || "$STATUS" == "307" ]]; then
    echo "   ✅ Orora UAT Web is healthy (HTTP $STATUS)"
    break
  fi
  [ "$i" -eq 10 ] && echo "   ⚠️  Orora UAT Web may still be starting" || sleep 3
done

echo ""
echo "✅ Deployment complete"
echo "================================================"
echo "   Orora UAT : https://uat.orora.rw  (or http://$SERVER_IP:$ORORA_UAT_PORT)"
echo "   API (UAT) : $API_URL  (→ gemura-uat-api:3025)"
echo ""
