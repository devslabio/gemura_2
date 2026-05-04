-- Add structured name fields; backfill from legacy `name`; keep `name` as denormalized full string.

ALTER TABLE "users" ADD COLUMN "first_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "users" ADD COLUMN "last_name" TEXT NOT NULL DEFAULT '';

UPDATE "users"
SET
  "first_name" = CASE
    WHEN trim(coalesce("name", '')) = '' THEN ''
    WHEN position(' ' in trim("name")) = 0 THEN trim("name")
    ELSE split_part(trim("name"), ' ', 1)
  END,
  "last_name" = CASE
    WHEN trim(coalesce("name", '')) = '' THEN ''
    WHEN position(' ' in trim("name")) = 0 THEN ''
    ELSE trim(substring(trim("name") from position(' ' in trim("name")) + 1))
  END;

ALTER TABLE "users" ALTER COLUMN "first_name" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "last_name" DROP DEFAULT;
