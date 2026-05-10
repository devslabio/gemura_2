# Gemura PostgreSQL DDL (reference)

This folder mirrors the **documented DDL layout** used in Umucyo v2 (`/Applications/AMPPS/www/RPPA/umucyo/workspace/v2/schema/README.md`): Flyway-style `V###__description.sql` filenames, a short index here, and SQL you can open in reviews or external tooling.

## Source of truth

| Layer | Location |
|-------|----------|
| **Logical model** | `backend/prisma/schema.prisma` |
| **Incremental migrations (what ships to prod/UAT)** | `backend/prisma/migrations/*/migration.sql` |
| **Full greenfield DDL (regenerated)** | `V000__full_public_schema_from_prisma.generated.sql` |

Gemura uses a **single PostgreSQL schema** (`public`) and Prisma Migrate. Umucyo v2 splits DDL per microservice schema (`iam`, `bidding`, …); here everything lives in `public`, so one consolidated script matches the current datamodel.

## Files

| File | Purpose |
|------|---------|
| `V000__full_public_schema_from_prisma.generated.sql` | **Greenfield** script: enums → tables → indexes → FKs, as emitted by `prisma migrate diff --from-empty --to-schema-datamodel`. Use for documentation, diffing against a live DB, or bootstrapping an empty cluster. It is **not** idempotent on a non-empty database (contrast Umucyo’s guarded `DO $$ … $$` style). |

## Regenerate `V000`

From repo root:

```bash
./scripts/gemura/database/regenerate-gemura-ddl.sh
```

Or manually:

```bash
cd backend
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script \
  > ../docs/gemura/schema/V000__full_public_schema_from_prisma.generated.sql
```

## Conventions (aligned with Umucyo v2 where applicable)

- **Naming:** Prisma `@@map("snake_case")` → physical table/column names in PostgreSQL.
- **Enums:** Native `CREATE TYPE … AS ENUM` in `public` (Prisma default).
- **Keys:** UUID primary keys (`gen_random_uuid()` at application layer unless defaults are added in SQL).
- **No secrets in DDL:** connection strings and credentials stay in env / secret stores only.

When you need **idempotent, hand-curated** DDL blocks (like Umucyo’s `DO $$ BEGIN … EXCEPTION WHEN duplicate_object` pattern), add new numbered files under this folder or under `database/` and wire them through your migration process explicitly—Prisma Migrate remains the authoritative path for the running app.
