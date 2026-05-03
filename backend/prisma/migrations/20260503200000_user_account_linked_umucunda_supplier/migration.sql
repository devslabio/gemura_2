-- Umucunda operators: scope MCC gate/manifest APIs to this supplier (hub/route) account.
ALTER TABLE "user_accounts" ADD COLUMN "linked_umucunda_supplier_account_id" UUID;

ALTER TABLE "user_accounts"
  ADD CONSTRAINT "user_accounts_linked_umucunda_supplier_account_id_fkey"
  FOREIGN KEY ("linked_umucunda_supplier_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "user_accounts_linked_umucunda_supplier_account_id_idx" ON "user_accounts"("linked_umucunda_supplier_account_id");
