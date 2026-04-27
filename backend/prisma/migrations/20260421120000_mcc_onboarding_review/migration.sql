-- MCC onboarding admin review workflow (link approved submission → user + account)

CREATE TYPE "MccOnboardingReviewStatus" AS ENUM ('pending', 'approved', 'rejected', 'needs_changes');

ALTER TABLE "mcc_onboarding_submissions"
ADD COLUMN "review_status" "MccOnboardingReviewStatus" NOT NULL DEFAULT 'pending';

ALTER TABLE "mcc_onboarding_submissions"
ADD COLUMN "review_notes" TEXT;

ALTER TABLE "mcc_onboarding_submissions"
ADD COLUMN "reviewed_at" TIMESTAMP(3);

ALTER TABLE "mcc_onboarding_submissions"
ADD COLUMN "reviewed_by_user_id" UUID;

ALTER TABLE "mcc_onboarding_submissions"
ADD COLUMN "linked_user_id" UUID;

ALTER TABLE "mcc_onboarding_submissions"
ADD COLUMN "linked_account_id" UUID;

CREATE INDEX "mcc_onboarding_submissions_review_status_idx"
ON "mcc_onboarding_submissions"("review_status");

CREATE INDEX "mcc_onboarding_submissions_linked_user_id_idx"
ON "mcc_onboarding_submissions"("linked_user_id");

CREATE INDEX "mcc_onboarding_submissions_reviewed_by_user_id_idx"
ON "mcc_onboarding_submissions"("reviewed_by_user_id");

ALTER TABLE "mcc_onboarding_submissions"
ADD CONSTRAINT "mcc_onboarding_submissions_reviewed_by_user_id_fkey"
FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "mcc_onboarding_submissions"
ADD CONSTRAINT "mcc_onboarding_submissions_linked_user_id_fkey"
FOREIGN KEY ("linked_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "mcc_onboarding_submissions"
ADD CONSTRAINT "mcc_onboarding_submissions_linked_account_id_fkey"
FOREIGN KEY ("linked_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
