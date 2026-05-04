#!/usr/bin/env bash
# Restore a plain-SQL Gemura dump into local PostgreSQL (replaces the target database).
#
# Use when you already have a file under backups/ (or anywhere), e.g. from a previous
# `./scripts/orora/dump-kwezi-to-local.sh` run or a manual pg_dump.
#
# For a fresh dump from Kwezi production (gemura_db inside kwezi-postgres), prefer:
#   ./scripts/orora/dump-kwezi-to-local.sh
#
# From repo root:
#   CONFIRM_RESTORE_LOCAL_DB=yes RESTORE_SQL_FILE=backups/gemura_db_kwezi_20260427-204309.sql \
#     ./scripts/gemura/deployment/restore-gemura-sql-backup-to-local.sh
#
# Optional:
#   LOCAL_PG_HOST=localhost LOCAL_PG_PORT=5432 LOCAL_PG_USER=postgres LOCAL_PG_PASS=...
#   LOCAL_DB=gemura_db
#   SKIP_MIGRATE=1  — skip `npx prisma migrate deploy` after restore

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

RESTORE_SQL_FILE="${RESTORE_SQL_FILE:-${1:-}}"
LOCAL_PG_HOST="${LOCAL_PG_HOST:-localhost}"
LOCAL_PG_PORT="${LOCAL_PG_PORT:-5432}"
LOCAL_PG_USER="${LOCAL_PG_USER:-postgres}"
LOCAL_PG_PASS="${LOCAL_PG_PASS:-}"
LOCAL_DB="${LOCAL_DB:-gemura_db}"

if [ "${CONFIRM_RESTORE_LOCAL_DB:-}" != "yes" ]; then
  echo "This will DROP and recreate local database \"$LOCAL_DB\" on $LOCAL_PG_HOST:$LOCAL_PG_PORT."
  echo "Run with: CONFIRM_RESTORE_LOCAL_DB=yes RESTORE_SQL_FILE=path/to/dump.sql $0"
  exit 1
fi

if [ -z "$RESTORE_SQL_FILE" ]; then
  echo "❌ Set RESTORE_SQL_FILE or pass the .sql path as the first argument."
  exit 1
fi

if [[ "$RESTORE_SQL_FILE" != /* ]]; then
  RESTORE_SQL_FILE="$REPO_ROOT/$RESTORE_SQL_FILE"
fi

if [ ! -f "$RESTORE_SQL_FILE" ]; then
  echo "❌ File not found: $RESTORE_SQL_FILE"
  exit 1
fi

if ! command -v psql &>/dev/null; then
  echo "❌ psql not found. Install PostgreSQL client (e.g. brew install libpq && brew link --force libpq)."
  exit 1
fi

echo "📥 Restore Gemura SQL → local Postgres"
echo "=========================================="
echo "   SQL file: $RESTORE_SQL_FILE ($(du -h "$RESTORE_SQL_FILE" | cut -f1))"
echo "   Target:   $LOCAL_PG_USER@$LOCAL_PG_HOST:$LOCAL_PG_PORT / $LOCAL_DB"
echo ""

TMP_SQL="$(mktemp "${TMPDIR:-/tmp}/gemura-restore.XXXXXX.sql")"
cleanup() { rm -f "$TMP_SQL"; }
trap cleanup EXIT

# Strip pg_dump 16+ meta commands that break older psql
grep -v '^\\restrict ' "$RESTORE_SQL_FILE" | grep -v '^\\unrestrict ' > "$TMP_SQL" || cp "$RESTORE_SQL_FILE" "$TMP_SQL"

if [ -n "$LOCAL_PG_PASS" ]; then
  export PGPASSWORD="$LOCAL_PG_PASS"
fi

if ! psql -h "$LOCAL_PG_HOST" -p "$LOCAL_PG_PORT" -U "$LOCAL_PG_USER" -d postgres -c "SELECT 1" &>/dev/null; then
  echo "❌ Cannot connect to local Postgres."
  [ -n "${PGPASSWORD:-}" ] && unset PGPASSWORD
  exit 1
fi

echo "🛑 Terminating connections and recreating database..."
psql -h "$LOCAL_PG_HOST" -p "$LOCAL_PG_PORT" -U "$LOCAL_PG_USER" -d postgres -v ON_ERROR_STOP=1 <<EOF
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$LOCAL_DB' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS $LOCAL_DB;
CREATE DATABASE $LOCAL_DB;
EOF

echo "📥 Restoring (this may take several minutes)..."
psql -h "$LOCAL_PG_HOST" -p "$LOCAL_PG_PORT" -U "$LOCAL_PG_USER" -d "$LOCAL_DB" -v ON_ERROR_STOP=1 -f "$TMP_SQL"

[ -n "${PGPASSWORD:-}" ] && unset PGPASSWORD

if [ "${SKIP_MIGRATE:-}" != "1" ]; then
  echo ""
  echo "🔧 prisma migrate deploy (align schema if dump is slightly behind repo)..."
  cd "$REPO_ROOT/backend"
  if [ -n "$LOCAL_PG_PASS" ]; then
    export DATABASE_URL="postgresql://${LOCAL_PG_USER}:${LOCAL_PG_PASS}@${LOCAL_PG_HOST}:${LOCAL_PG_PORT}/${LOCAL_DB}?schema=public"
  else
    export DATABASE_URL="postgresql://${LOCAL_PG_USER}@${LOCAL_PG_HOST}:${LOCAL_PG_PORT}/${LOCAL_DB}?schema=public"
  fi
  npx prisma migrate deploy
  npx prisma generate
  echo "   ✅ Migrations applied"
fi

echo ""
echo "=========================================="
echo "✅ Restore complete."
echo "   Ensure backend/.env DATABASE_URL matches this database, then restart the API."
