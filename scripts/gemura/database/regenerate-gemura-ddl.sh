#!/usr/bin/env bash
# Regenerate docs/gemura/schema/V000__full_public_schema_from_prisma.generated.sql
# from backend/prisma/schema.prisma (Prisma "empty → datamodel" diff).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
OUT="$ROOT/docs/gemura/schema/V000__full_public_schema_from_prisma.generated.sql"
HDR="$ROOT/docs/gemura/schema/.V000_header.sql.tmp"

cat > "$HDR" << 'EOSQL'
-- =============================================================================
-- V000 - Gemura: full public schema (generated)
-- =============================================================================
-- Project:     Gemura / Orora platform (NestJS + Prisma)
-- Source:      backend/prisma/schema.prisma
-- Generator:   npx prisma migrate diff --from-empty --to-schema-datamodel
-- Reference:   Umucyo v2 schema layout & conventions (Flyway-style filenames)
--               /Applications/AMPPS/www/RPPA/umucyo/workspace/v2/schema/README.md
-- =============================================================================
-- This file is documentation / greenfield bootstrap SQL. For incremental,
-- authoritative migrations use backend/prisma/migrations/.
--
-- Not idempotent: running against a database that already has objects will
-- fail unless you target an empty database or adapt with DROP / IF NOT EXISTS.
-- =============================================================================

EOSQL

mkdir -p "$(dirname "$OUT")"
(
  cd "$ROOT/backend"
  npx prisma migrate diff \
    --from-empty \
    --to-schema-datamodel prisma/schema.prisma \
    --script 2>/dev/null
) >> "$HDR"

mv "$HDR" "$OUT"
echo "Wrote $OUT ($(wc -l < "$OUT" | tr -d ' ') lines)"
