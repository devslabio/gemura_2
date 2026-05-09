-- Account geography for regional supervision (village + denormalized district for indexing).
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "operational_location_id" UUID;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "operational_district_id" UUID;

CREATE INDEX IF NOT EXISTS "accounts_operational_location_id_idx" ON "accounts"("operational_location_id");
CREATE INDEX IF NOT EXISTS "accounts_operational_district_id_idx" ON "accounts"("operational_district_id");

ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "accounts_operational_location_id_fkey";
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_operational_location_id_fkey"
  FOREIGN KEY ("operational_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "accounts_operational_district_id_fkey";
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_operational_district_id_fkey"
  FOREIGN KEY ("operational_district_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Which districts each user may supervise (platform regional_supervisor role).
CREATE TABLE IF NOT EXISTS "regional_supervisor_districts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "district_location_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regional_supervisor_districts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "regional_supervisor_districts_user_id_district_location_id_key"
  ON "regional_supervisor_districts"("user_id", "district_location_id");

CREATE INDEX IF NOT EXISTS "regional_supervisor_districts_user_id_idx" ON "regional_supervisor_districts"("user_id");
CREATE INDEX IF NOT EXISTS "regional_supervisor_districts_district_location_id_idx" ON "regional_supervisor_districts"("district_location_id");

ALTER TABLE "regional_supervisor_districts" DROP CONSTRAINT IF EXISTS "regional_supervisor_districts_user_id_fkey";
ALTER TABLE "regional_supervisor_districts" ADD CONSTRAINT "regional_supervisor_districts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "regional_supervisor_districts" DROP CONSTRAINT IF EXISTS "regional_supervisor_districts_district_location_id_fkey";
ALTER TABLE "regional_supervisor_districts" ADD CONSTRAINT "regional_supervisor_districts_district_location_id_fkey"
  FOREIGN KEY ("district_location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
