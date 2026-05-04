#!/usr/bin/env bash
# Replace Kwezi UAT database `gemura_uat_db` with a full copy of your local Gemura DB.
# Destroys all current UAT data in that database. Production `gemura_db` is not touched.
#
# Prerequisites (local machine):
#   - pg_dump in PATH (Postgres client tools)
#   - sshpass + ssh (same as deploy-gemura-uat.sh)
#   - Local Postgres reachable at DATABASE_URL
#
# From repo root:
#   CONFIRM_REPLACE_UAT_DB=yes ./scripts/gemura/deployment/sync-local-db-to-gemura-uat.sh
#
# Optional:
#   LOCAL_DATABASE_URL="postgresql://user:pass@127.0.0.1:5432/gemura_db?schema=public" CONFIRM_REPLACE_UAT_DB=yes ./scripts/...
#   SKIP_STOP_UAT=1  — do not stop gemura-uat-* containers first (not recommended)
#
# After restore, UAT API/UI are started again (same compose as deploy). Prisma migrations in the
# dump match your local DB; the API still runs `migrate deploy` on boot (should be a no-op).

set -euo pipefail

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
REMOTE_DB_NAME="${REMOTE_DB_NAME:-gemura_uat_db}"
REMOTE_PG_CONTAINER="${REMOTE_PG_CONTAINER:-kwezi-postgres}"
REMOTE_PG_USER="${REMOTE_PG_USER:-kwezi}"

if [ -z "$SERVER_PASS" ]; then
  echo "❌ SERVER_PASS not set. Configure scripts/shared/deployment/server-credentials.sh or export SERVER_PASS."
  exit 1
fi

if [ "${CONFIRM_REPLACE_UAT_DB:-}" != "yes" ]; then
  echo "❌ This will DROP and recreate ${REMOTE_DB_NAME} on ${SERVER_IP} (all UAT data in that DB is lost)."
  echo "   Run with: CONFIRM_REPLACE_UAT_DB=yes $0"
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "❌ pg_dump not found. Install PostgreSQL client tools (e.g. brew install libpq && brew link --force libpq)."
  exit 1
fi

if ! command -v sshpass >/dev/null 2>&1; then
  echo "❌ sshpass not found (required for non-interactive SSH)."
  exit 1
fi

resolve_local_database_url() {
  if [ -n "${LOCAL_DATABASE_URL:-}" ]; then
    printf '%s' "$LOCAL_DATABASE_URL"
    return 0
  fi
  local env_file="$REPO_ROOT/backend/.env"
  if [ ! -f "$env_file" ]; then
    echo "❌ Set LOCAL_DATABASE_URL or add DATABASE_URL to backend/.env"
    exit 1
  fi
  local line
  line="$(grep -E '^[[:space:]]*DATABASE_URL=' "$env_file" | head -1 | cut -d= -f2- || true)"
  line="${line%$'\r'}"
  line="${line#\"}"
  line="${line%\"}"
  line="${line#\'}"
  line="${line%\'}"
  if [ -z "$line" ]; then
    echo "❌ Could not read DATABASE_URL from backend/.env"
    exit 1
  fi
  printf '%s' "$line"
}

LOCAL_URL="$(resolve_local_database_url)"
if [ -n "${LOCAL_DATABASE_URL:-}" ]; then
  echo "📤 Source: LOCAL_DATABASE_URL from environment"
else
  echo "📤 Source: DATABASE_URL from backend/.env"
fi

SSH_OPTS="-o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=6 -o ConnectTimeout=30"

echo ""
echo "🛑 Stopping Gemura UAT app containers (releases DB connections)…"
if [ "${SKIP_STOP_UAT:-}" != "1" ]; then
  sshpass -p "$SERVER_PASS" ssh $SSH_OPTS "$SERVER_USER@$SERVER_IP" bash -s << REMOTE
set -e
if [ -f "$DEPLOY_UAT_PATH/.env.uat" ]; then
  cd "$DEPLOY_UAT_PATH"
  docker compose -f docker/docker-compose.gemura-uat.yml --env-file .env.uat stop gemura-uat-api gemura-uat-ui 2>/dev/null || true
fi
docker stop gemura-uat-api gemura-uat-ui 2>/dev/null || true
echo "   ✅ UAT app containers stopped (if they existed)"
REMOTE
else
  echo "   ⏭️  SKIP_STOP_UAT=1"
fi

echo ""
echo "🗄️  Recreating ${REMOTE_DB_NAME} on server…"
sshpass -p "$SERVER_PASS" ssh $SSH_OPTS "$SERVER_USER@$SERVER_IP" bash -s << REMOTE
set -e
if ! docker ps --format '{{.Names}}' | grep -q "^${REMOTE_PG_CONTAINER}\$"; then
  echo "❌ Container ${REMOTE_PG_CONTAINER} is not running."
  exit 1
fi
docker exec "${REMOTE_PG_CONTAINER}" psql -U "${REMOTE_PG_USER}" -d postgres -v ON_ERROR_STOP=1 <<'EOSQL'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'gemura_uat_db'
  AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS gemura_uat_db;
CREATE DATABASE gemura_uat_db OWNER kwezi;
EOSQL
echo "   ✅ Empty database ${REMOTE_DB_NAME} ready"
REMOTE

echo ""
echo "📥 pg_dump (local) → psql restore into ${REMOTE_DB_NAME} (this may take several minutes)…"
# Single schema used by Prisma; avoids noise from other schemas if any.
ERR_FILE="${TMPDIR:-/tmp}/gemura-uat-pgdump.$$"
if ! pg_dump "$LOCAL_URL" \
  --schema=public \
  --no-owner \
  --no-acl \
  --no-sync \
  2> "$ERR_FILE" \
  | sshpass -p "$SERVER_PASS" ssh $SSH_OPTS "$SERVER_USER@$SERVER_IP" \
    "docker exec -i ${REMOTE_PG_CONTAINER} psql -U ${REMOTE_PG_USER} -v ON_ERROR_STOP=1 -d ${REMOTE_DB_NAME}"
then
  echo "❌ pg_dump | restore failed. pg_dump stderr:"
  tail -40 "$ERR_FILE" || true
  rm -f "$ERR_FILE"
  exit 1
fi
rm -f "$ERR_FILE"

echo ""
echo "🚀 Starting Gemura UAT API + UI…"
sshpass -p "$SERVER_PASS" ssh $SSH_OPTS "$SERVER_USER@$SERVER_IP" bash -s << REMOTE
set -e
cd "$DEPLOY_UAT_PATH"
if [ ! -f .env.uat ]; then
  echo "❌ $DEPLOY_UAT_PATH/.env.uat missing. Run ./scripts/gemura/deployment/deploy-gemura-uat.sh once first."
  exit 1
fi
docker compose -f docker/docker-compose.gemura-uat.yml --env-file .env.uat up -d gemura-uat-api gemura-uat-ui
echo "   ✅ docker compose up -d"
REMOTE

echo ""
echo "✅ Local database has been copied into ${REMOTE_DB_NAME} on ${SERVER_IP}."
echo "   UAT UI: https://uat.gemura.rw (or http://${SERVER_IP}:3024)"
echo "   Logins/passwords are now whatever you had locally (e.g. seed users if you use seed locally)."
