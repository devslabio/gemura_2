ALTER TABLE "accounting_transactions"
ADD COLUMN "farm_id" UUID;

CREATE INDEX "accounting_transactions_farm_id_idx" ON "accounting_transactions"("farm_id");

