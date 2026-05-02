-- Phase 2: cost-pool metadata for accounting transactions
ALTER TABLE "accounting_transactions"
ADD COLUMN "dairy_share_pct" DECIMAL(5,2),
ADD COLUMN "cost_tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

