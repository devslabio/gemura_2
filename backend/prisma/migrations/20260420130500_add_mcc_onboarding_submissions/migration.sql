-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."mcc_onboarding_submissions" (
    "id" UUID NOT NULL,
    "submission_code" VARCHAR(64) NOT NULL,
    "business_name" VARCHAR(255) NOT NULL,
    "common_name" VARCHAR(255),
    "manager_first_name" VARCHAR(120) NOT NULL,
    "manager_last_name" VARCHAR(120) NOT NULL,
    "manager_phone" VARCHAR(50) NOT NULL,
    "manager_id_number" VARCHAR(120) NOT NULL,
    "location_province_id" VARCHAR(120),
    "location_district_id" VARCHAR(120),
    "location_sector_id" VARCHAR(120),
    "location_cell_id" VARCHAR(120),
    "location_village_id" VARCHAR(120),
    "final_decision" VARCHAR(32) NOT NULL,
    "pass_count" INTEGER NOT NULL DEFAULT 0,
    "section_payload" JSONB NOT NULL,
    "google_sheet_status" VARCHAR(40) NOT NULL DEFAULT 'not_configured',
    "google_sheet_response" JSONB,
    "google_sheet_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcc_onboarding_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "mcc_onboarding_submissions_submission_code_key"
ON "public"."mcc_onboarding_submissions"("submission_code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mcc_onboarding_submissions_submission_code_idx"
ON "public"."mcc_onboarding_submissions"("submission_code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mcc_onboarding_submissions_created_at_idx"
ON "public"."mcc_onboarding_submissions"("created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mcc_onboarding_submissions_final_decision_idx"
ON "public"."mcc_onboarding_submissions"("final_decision");
