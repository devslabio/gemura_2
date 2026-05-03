#!/bin/bash
# Install Let's Encrypt SSL certificate for uat.gemura.rw on Kwezi.
# Prerequisite: DNS A/AAAA for uat.gemura.rw must point to the server.
#
# Usage:
#   ./scripts/gemura/deployment/install-uat-gemura-ssl.sh

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
DOMAIN="${UAT_DOMAIN:-uat.gemura.rw}"
EMAIL="${LETSENCRYPT_EMAIL:-admin@gemura.rw}"

if [ -z "$SERVER_PASS" ]; then
  echo "❌ SERVER_PASS not set. Configure scripts/shared/deployment/server-credentials.sh or export SERVER_PASS."
  exit 1
fi

echo "🔐 Installing SSL certificate for $DOMAIN on $SERVER_USER@$SERVER_IP"
echo "   Email: $EMAIL"

sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 "$SERVER_USER@$SERVER_IP" 'bash -s' << ENDSSH
set -e
DOMAIN="$DOMAIN"
EMAIL="$EMAIL"

mkdir -p /var/www/html/.well-known/acme-challenge

if ! command -v certbot >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y certbot python3-certbot-nginx
fi

nginx -t
systemctl reload nginx

certbot --nginx \
  -d "$DOMAIN" \
  --non-interactive \
  --agree-tos \
  -m "$EMAIL" \
  --redirect

nginx -t
systemctl reload nginx
ENDSSH

echo "✅ SSL installed for https://$DOMAIN"
