#!/usr/bin/env bash
# Install Nginx on Kwezi server and configure:
#   app.gemura.rw   → Gemura Web (3006) + /api/ → 3007
#   app.orora.rw    → Orora Web (3011) + /api/ → 3007
#   admin.gemura.rw → Gemura Admin (3021) + /api/ → 3007
# Optionally obtain Let's Encrypt SSL (certbot). Requires DNS for domains pointing to the server.
#
# Prerequisites:
#   - server-credentials.sh (SERVER_PASS, SERVER_IP, SERVER_USER)
#   - DNS: app.gemura.rw, app.orora.rw, and admin.gemura.rw should A-record to SERVER_IP (209.74.80.195)
#
# Optional (for SSL):
#   - CERTBOT_EMAIL="your@email.com" in server-credentials.sh or env (to run certbot)
#
# Usage: ./scripts/shared/deployment/setup-nginx-domains.sh

set -e
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CREDS_FILE="$SCRIPT_DIR/server-credentials.sh"
NGINX_CONF_SRC="$REPO_ROOT/docker/nginx/gemura-orora.conf"
SITES_AVAILABLE="/etc/nginx/sites-available"
SITES_ENABLED="/etc/nginx/sites-enabled"
CONF_NAME="gemura-orora.conf"

if [ ! -f "$CREDS_FILE" ]; then
  echo "❌ Missing $CREDS_FILE. Copy from server-credentials.sh.example and set SERVER_PASS."
  exit 1
fi
source "$CREDS_FILE"
SERVER_IP="${SERVER_IP:-209.74.80.195}"
SERVER_USER="${SERVER_USER:-root}"
[ -n "$SERVER_PASS" ] || { echo "❌ SERVER_PASS not set in server-credentials.sh"; exit 1; }

if [ ! -f "$NGINX_CONF_SRC" ]; then
  echo "❌ Nginx config not found: $NGINX_CONF_SRC"
  exit 1
fi

echo "═══════════════════════════════════════════════════════════════"
echo "  Nginx setup: app.gemura.rw → :3006, app.orora.rw → :3011, admin.gemura.rw → :3021 (each /api/ → :3007)"
echo "  Server: $SERVER_USER@$SERVER_IP"
echo "═══════════════════════════════════════════════════════════════"

# Upload config and run install + enable on server
echo ""
echo "📤 Uploading Nginx config..."
sshpass -p "$SERVER_PASS" scp -o StrictHostKeyChecking=no "$NGINX_CONF_SRC" "$SERVER_USER@$SERVER_IP:/tmp/$CONF_NAME"

echo ""
echo "🔧 Installing Nginx (if needed), enabling site, reloading..."
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" 'bash -s' << ENDSSH
set -e
export DEBIAN_FRONTEND=noninteractive

# Open firewall for HTTP/HTTPS (if ufw is active)
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw status | head -5
fi

# Install nginx if not present
if ! command -v nginx >/dev/null 2>&1; then
  echo "Installing nginx..."
  apt-get update -qq
  apt-get install -y nginx
fi

# Ensure sites dirs exist
mkdir -p $SITES_AVAILABLE $SITES_ENABLED

# Install config
cp /tmp/$CONF_NAME $SITES_AVAILABLE/$CONF_NAME
rm -f /tmp/$CONF_NAME
ln -sf $SITES_AVAILABLE/$CONF_NAME $SITES_ENABLED/$CONF_NAME

# Remove default site if it would conflict (optional)
rm -f $SITES_ENABLED/default 2>/dev/null || true

# Test and reload
nginx -t && systemctl reload nginx
echo "Nginx config installed and reloaded."
ENDSSH

echo ""
echo "✅ Nginx is serving:"
echo "   http://app.gemura.rw   → Gemura Web (port 3006)"
echo "   http://app.orora.rw    → Orora Web (port 3011)"
echo "   http://admin.gemura.rw → Gemura Admin (port 3021)"
echo ""
echo "⚠️  Ensure DNS: app.gemura.rw, app.orora.rw, admin.gemura.rw A records point to $SERVER_IP"
echo ""

# Optional: run certbot for Let's Encrypt SSL
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
if [ -n "$CERTBOT_EMAIL" ]; then
  echo "🔐 Running certbot for SSL (CERTBOT_EMAIL is set)..."
  sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "CERTBOT_EMAIL='$CERTBOT_EMAIL' bash -s" << 'ENDCERT'
export DEBIAN_FRONTEND=noninteractive
if ! command -v certbot >/dev/null 2>&1; then
  echo "Installing certbot..."
  apt-get update -qq
  apt-get install -y certbot python3-certbot-nginx
fi
certbot --nginx -d app.gemura.rw -d app.orora.rw --non-interactive --agree-tos -m "$CERTBOT_EMAIL" --redirect
echo "Certbot finished. HTTPS should be active."
ENDCERT
  echo ""
  echo "✅ HTTPS enabled. Test: https://app.gemura.rw and https://app.orora.rw"
else
  echo "📌 To enable HTTPS with Let's Encrypt:"
  echo "   1. Set CERTBOT_EMAIL in server-credentials.sh (e.g. CERTBOT_EMAIL=\"admin@gemura.rw\")"
  echo "   2. Re-run this script, or on the server run:"
  echo "      certbot --nginx -d app.gemura.rw -d app.orora.rw --agree-tos -m YOUR_EMAIL"
  echo "   (DNS for both domains must point to this server first.)"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Backend CORS: ensure backend CORS_ORIGIN includes"
echo "  https://app.gemura.rw and https://app.orora.rw if you use HTTPS."
echo "  API is still at http://$SERVER_IP:3007/api (or add an api.* server block later)."
echo "═══════════════════════════════════════════════════════════════"
