-- CreateEnum
CREATE TYPE "SupplierTransferStatus" AS ENUM ('submitted', 'accepted', 'partially_accepted', 'rejected');

-- CreateTable
CREATE TABLE "supplier_transfers" (
    "id" UUID NOT NULL,
    "supplier_user_id" UUID NOT NULL,
    "mcc_account_id" UUID NOT NULL,
    "own_liters" DECIMAL(10,2) NOT NULL,
    "external_liters" DECIMAL(10,2) NOT NULL,
    "total_liters" DECIMAL(10,2) NOT NULL,
    "status" "SupplierTransferStatus" NOT NULL DEFAULT 'submitted',
    "rejection_reason" TEXT,
    "accepted_liters" DECIMAL(10,2),
    "rejected_liters" DECIMAL(10,2),
    "milk_sale_id" UUID,
    "notes" TEXT,
    "supplier_notes" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3),
    "processed_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_transfers_mcc_account_id_status_idx" ON "supplier_transfers"("mcc_account_id", "status");

-- CreateIndex
CREATE INDEX "supplier_transfers_supplier_user_id_idx" ON "supplier_transfers"("supplier_user_id");

-- CreateIndex
CREATE INDEX "supplier_transfers_submitted_at_idx" ON "supplier_transfers"("submitted_at");

-- AddForeignKey
ALTER TABLE "supplier_transfers" ADD CONSTRAINT "supplier_transfers_supplier_user_id_fkey" FOREIGN KEY ("supplier_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_transfers" ADD CONSTRAINT "supplier_transfers_mcc_account_id_fkey" FOREIGN KEY ("mcc_account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_transfers" ADD CONSTRAINT "supplier_transfers_milk_sale_id_fkey" FOREIGN KEY ("milk_sale_id") REFERENCES "milk_sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
