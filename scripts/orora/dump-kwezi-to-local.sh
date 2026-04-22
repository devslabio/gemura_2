#!/bin/bash
# Dump PostgreSQL from Kwezi server and restore to local PostgreSQL (native Mac install).
# Requires: sshpass, psql (PostgreSQL client tools).
#
# Usage (from project root):
#   ./scripts/orora/dump-kwezi-to-local.sh
#
# Optional env (for local Mac Postgres):
#   LOCAL_PG_HOST=localhost
#   LOCAL_PG_PORT=5432
#   LOCAL_PG_USER=postgres   (or your Mac username for peer auth)
#   LOCAL_PG_PASS=           (leave empty if using peer/trust auth)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CREDS_FILE="$REPO_ROOT/scripts/shared/deployment/server-credentials.sh"
[ -f "$CREDS_FILE" ] && source "$CREDS_FILE"

SERVER_IP="${SERVER_IP:-209.74.80.195}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_PASS="${SERVER_PASS:-}"
BACKUP_DIR="${REPO_ROOT}/backups"
STAMP=$(date +%Y%m%d-%H%M%S)
DUMP_FILE="${BACKUP_DIR}/gemura_db_kwezi_${STAMP}.sql"

LOCAL_PG_HOST="${LOCAL_PG_HOST:-localhost}"
LOCAL_PG_PORT="${LOCAL_PG_PORT:-5432}"
LOCAL_PG_USER="${LOCAL_PG_USER:-postgres}"
LOCAL_PG_PASS="${LOCAL_PG_PASS:-}"
LOCAL_DB="${LOCAL_DB:-gemura_db}"

echo "🔄 Kwezi DB → Local PostgreSQL (native)"
echo "=========================================="
echo "   Server: $SERVER_USER@$SERVER_IP (kwezi-postgres)"
echo "   Local:  $LOCAL_PG_HOST:$LOCAL_PG_PORT/$LOCAL_DB (user: $LOCAL_PG_USER)"
echo "   Dump:   $DUMP_FILE"
echo ""

if [ -z "$SERVER_PASS" ]; then
  echo "❌ SERVER_PASS not set. Source scripts/shared/deployment/server-credentials.sh or set SERVER_PASS."
  exit 1
fi

if ! command -v sshpass &>/dev/null; then
  echo "❌ sshpass required. Install with: brew install sshpass"
  exit 1
fi

if ! command -v psql &>/dev/null; then
  echo "❌ psql not found. Install PostgreSQL client: brew install libpq && brew link --force libpq"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# Step 0: Ensure production has latest migrations (vet/heat columns) so dump is complete
echo "🔧 Step 0: Ensuring production DB has latest migrations (vet/heat)..."
if sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" \
  "docker exec gemura-api npx prisma migrate deploy" 2>/dev/null; then
  echo "   ✅ Production migrations up to date"
else
  echo "   ⚠️  Could not run migrate deploy on server (gemura-api may be stopped). Dump may lack vet/heat columns; restore will apply migrations locally."
fi

# Step 1: Dump from Kwezi (pg_dump inside container; user kwezi, db gemura_db)
echo ""
echo "📤 Step 1: Dumping from Kwezi (kwezi-postgres → gemura_db)..."
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" \
  "docker exec kwezi-postgres pg_dump -U kwezi --no-owner --no-acl gemura_db" \
  > "$DUMP_FILE"
# Strip \restrict/\unrestrict (pg_dump 16.12+) so older psql can restore
sed -i.bak -e '/^\\restrict /d' -e '/^\\unrestrict /d' "$DUMP_FILE" 2>/dev/null || true
[ -f "${DUMP_FILE}.bak" ] && rm -f "${DUMP_FILE}.bak"
echo "   ✅ Dump saved ($(du -h "$DUMP_FILE" | cut -f1))"

# Step 2: Check local Postgres is reachable
echo ""
echo "📦 Step 2: Checking local PostgreSQL..."
if [ -n "$LOCAL_PG_PASS" ]; then
  export PGPASSWORD="$LOCAL_PG_PASS"
fi
if ! psql -h "$LOCAL_PG_HOST" -p "$LOCAL_PG_PORT" -U "$LOCAL_PG_USER" -d postgres -c "SELECT 1" &>/dev/null; then
  echo "   ❌ Cannot connect to local Postgres at $LOCAL_PG_HOST:$LOCAL_PG_PORT as $LOCAL_PG_USER"
  echo "   Ensure Postgres is running (e.g. brew services start postgresql) and user/port match."
  [ -n "$LOCAL_PG_PASS" ] && unset PGPASSWORD
  exit 1
fi
echo "   ✅ Local Postgres is running"

# Step 3: Drop and recreate local DB, restore dump
echo ""
echo "📥 Step 3: Restoring to local $LOCAL_DB..."
psql -h "$LOCAL_PG_HOST" -p "$LOCAL_PG_PORT" -U "$LOCAL_PG_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$LOCAL_DB' AND pid <> pg_backend_pid();" 2>/dev/null || true
psql -h "$LOCAL_PG_HOST" -p "$LOCAL_PG_PORT" -U "$LOCAL_PG_USER" -d postgres -c "DROP DATABASE IF EXISTS $LOCAL_DB;"
psql -h "$LOCAL_PG_HOST" -p "$LOCAL_PG_PORT" -U "$LOCAL_PG_USER" -d postgres -c "CREATE DATABASE $LOCAL_DB;"
psql -h "$LOCAL_PG_HOST" -p "$LOCAL_PG_PORT" -U "$LOCAL_PG_USER" -d "$LOCAL_DB" -f "$DUMP_FILE" -v ON_ERROR_STOP=1 2>&1 | grep -v "^NOTICE:" | grep -v "^$" || true
[ -n "$LOCAL_PG_PASS" ] && unset PGPASSWORD
echo "   ✅ Restore completed"

# Step 4: Apply any missing migrations locally (e.g. vet/heat if dump was from before)
echo ""
echo "🔧 Step 4: Applying any missing migrations (vet/heat if needed)..."
cd "$REPO_ROOT/backend"
if [ -n "$LOCAL_PG_PASS" ]; then
  export DATABASE_URL="postgresql://${LOCAL_PG_USER}:${LOCAL_PG_PASS}@${LOCAL_PG_HOST}:${LOCAL_PG_PORT}/${LOCAL_DB}?schema=public"
else
  export DATABASE_URL="postgresql://${LOCAL_PG_USER}@${LOCAL_PG_HOST}:${LOCAL_PG_PORT}/${LOCAL_DB}?schema=public"
fi
npx prisma migrate deploy
npx prisma generate
echo "   ✅ Migrations applied"

# Step 5: Verify vet/heat columns exist
echo ""
echo "🔍 Step 5: Verifying vet/heat columns..."
if [ -n "$LOCAL_PG_PASS" ]; then export PGPASSWORD="$LOCAL_PG_PASS"; fi
HEAT_COL=$(psql -h "$LOCAL_PG_HOST" -p "$LOCAL_PG_PORT" -U "$LOCAL_PG_USER" -d "$LOCAL_DB" -t -A -c "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='animal_breeding' AND column_name='heat_date';" 2>/dev/null || true)
VET_COL=$(psql -h "$LOCAL_PG_HOST" -p "$LOCAL_PG_PORT" -U "$LOCAL_PG_USER" -d "$LOCAL_DB" -t -A -c "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='animal_health' AND column_name='vet_user_id';" 2>/dev/null || true)
[ -n "$LOCAL_PG_PASS" ] && unset PGPASSWORD
if [ -n "$HEAT_COL" ] && [ -n "$VET_COL" ]; then
  echo "   ✅ animal_breeding.heat_date and animal_health.vet_user_id present"
else
  echo "   ⚠️  Some columns missing (heat_date: ${HEAT_COL:-none}, vet_user_id: ${VET_COL:-none}). Run: cd backend && npx prisma migrate deploy"
fi

echo ""
echo "=========================================="
echo "✅ Done. Next steps:"
echo ""
if [ -n "$LOCAL_PG_PASS" ]; then
  echo "   1. In backend/.env set: DATABASE_URL=\"postgresql://${LOCAL_PG_USER}:${LOCAL_PG_PASS}@${LOCAL_PG_HOST}:${LOCAL_PG_PORT}/${LOCAL_DB}?schema=public\""
else
  echo "   1. In backend/.env set: DATABASE_URL=\"postgresql://${LOCAL_PG_USER}@${LOCAL_PG_HOST}:${LOCAL_PG_PORT}/${LOCAL_DB}?schema=public\""
fi
echo "   2. Start backend:   cd backend && npm run start:dev"
echo "   3. Start Orora Web: cd apps/orora-web && npm run dev"
echo "   4. Open Orora Web: http://localhost:3006  (API: http://localhost:3004)"
echo ""
