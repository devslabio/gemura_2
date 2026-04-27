#!/bin/bash
#
# Check if SMS notification feature is deployed on production
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CREDS_FILE="$SCRIPT_DIR/server-credentials.sh"
[ -f "$CREDS_FILE" ] && source "$CREDS_FILE"

SERVER_IP="${SERVER_IP:-209.74.80.195}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_PASS="${SERVER_PASS:-}"

if [ -z "$SERVER_PASS" ]; then
  echo "❌ SERVER_PASS not set"
  exit 1
fi

echo "🔍 Checking SMS notification deployment on production..."
echo "   Server: $SERVER_IP"
echo ""

# Check if sms.service.ts exists on server
echo "1️⃣ Checking if SMS service code is deployed..."
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP 'bash -s' << 'ENDSSH'
if [ -f /opt/gemura/backend/src/common/services/sms.service.ts ]; then
  echo "   ✅ SMS service code exists"
  echo "   Path: /opt/gemura/backend/src/common/services/sms.service.ts"
else
  echo "   ❌ SMS service code NOT found"
  exit 1
fi
ENDSSH

echo ""
echo "2️⃣ Checking if Mista API key exists in database..."
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP 'bash -s' << 'ENDSSH'
cd /opt/gemura
POSTGRES_PASSWORD=$(grep -E '^POSTGRES_PASSWORD=' /opt/kwezi/.env 2>/dev/null | cut -d= -f2- || echo "KweziPg2025!")
DB_URL="postgresql://kwezi:${POSTGRES_PASSWORD}@kwezi-postgres:5432/gemura_db?schema=public"

# Use docker exec to run query inside the backend container (has Prisma client)
RESULT=$(docker exec gemura-backend npx tsx -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.apiKey.findFirst({
  where: { name: { contains: 'mista', mode: 'insensitive' } }
}).then(key => {
  if (key) {
    console.log('FOUND');
    console.log('ID:' + key.id);
    console.log('NAME:' + key.name);
    console.log('ACTIVE:' + key.is_active);
    console.log('KEY:' + key.key.substring(0, 20) + '...');
  } else {
    console.log('NOT_FOUND');
  }
  prisma.\$disconnect();
}).catch(e => {
  console.log('ERROR:' + e.message);
  prisma.\$disconnect();
});
" 2>&1)

if echo "$RESULT" | grep -q "FOUND"; then
  echo "   ✅ Mista API key exists in production database"
  echo "$RESULT" | grep -E "ID:|NAME:|ACTIVE:|KEY:" | sed 's/^/      /'
elif echo "$RESULT" | grep -q "NOT_FOUND"; then
  echo "   ❌ Mista API key NOT found in production database"
  echo "   💡 SMS notifications will NOT work"
else
  echo "   ⚠️  Could not check (error or container not running)"
  echo "$RESULT" | head -5 | sed 's/^/      /'
fi
ENDSSH

echo ""
echo "3️⃣ Checking backend container status..."
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP 'bash -s' << 'ENDSSH'
CONTAINER_STATUS=$(docker ps --filter "name=gemura-backend" --format "{{.Status}}" 2>/dev/null || echo "not found")
if echo "$CONTAINER_STATUS" | grep -q "Up"; then
  echo "   ✅ Backend container is running"
  echo "      Status: $CONTAINER_STATUS"
else
  echo "   ❌ Backend container not running"
  echo "      Status: $CONTAINER_STATUS"
fi
ENDSSH

echo ""
echo "✅ Check complete"
