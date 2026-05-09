-- Optional platform user (regional_supervisor) assigned to each tenant account for admin routing / display.
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "regional_supervisor_user_id" UUID;

CREATE INDEX IF NOT EXISTS "accounts_regional_supervisor_user_id_idx" ON "accounts"("regional_supervisor_user_id");

ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "accounts_regional_supervisor_user_id_fkey";
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_regional_supervisor_user_id_fkey"
  FOREIGN KEY ("regional_supervisor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
