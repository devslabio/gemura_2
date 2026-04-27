#!/bin/bash
# Push updated docker/nginx/gemura-orora.conf to Kwezi, test, reload.
# No apt installs — for quick updates after changing the repo file.
# Requires: server-credentials.sh with SERVER_PASS.
#
# From repo root:
#   ./scripts/gemura/deployment/apply-nginx-gemura-orora-kwezi.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CREDS_FILE="$REPO_ROOT/scripts/shared/deployment/server-credentials.sh"
NGINX_CONF_SRC="$REPO_ROOT/docker/nginx/gemura-orora.conf"
CONF_NAME="gemura-orora.conf"

[ -f "$CREDS_FILE" ] && source "$CREDS_FILE"
SERVER_IP="${SERVER_IP:-209.74.80.195}"
SERVER_USER="${SERVER_USER:-root}"
SITES_AVAILABLE="/etc/nginx/sites-available"
SITES_ENABLED="/etc/nginx/sites-enabled"

[ -n "$SERVER_PASS" ] || { echo "❌ Set SERVER_PASS in $CREDS_FILE"; exit 1; }
[ -f "$NGINX_CONF_SRC" ] || { echo "❌ Missing $NGINX_CONF_SRC"; exit 1; }

echo "📤 $NGINX_CONF_SRC → $SERVER_USER@$SERVER_IP:$SITES_AVAILABLE/$CONF_NAME"
sshpass -p "$SERVER_PASS" scp -o StrictHostKeyChecking=no -o ConnectTimeout=15 \
  "$NGINX_CONF_SRC" "$SERVER_USER@$SERVER_IP:/tmp/$CONF_NAME"

sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 \
  "$SERVER_USER@$SERVER_IP" "cp /tmp/$CONF_NAME $SITES_AVAILABLE/$CONF_NAME && rm -f /tmp/$CONF_NAME && \
  ln -sf $SITES_AVAILABLE/$CONF_NAME $SITES_ENABLED/$CONF_NAME && \
  nginx -t && systemctl reload nginx && \
  echo '✅ Nginx reloaded. admin.gemura.rw → :3021, /api/ → :3007'"
