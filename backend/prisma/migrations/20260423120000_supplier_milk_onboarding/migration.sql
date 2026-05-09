-- AlterTable
ALTER TABLE "users" ADD COLUMN     "supplier_segment" VARCHAR(32);

-- CreateTable
CREATE TABLE "supplier_milk_onboardings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "mcc_account_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_milk_onboardings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_milk_onboardings_user_id_key" ON "supplier_milk_onboardings"("user_id");

-- CreateIndex
CREATE INDEX "supplier_milk_onboardings_mcc_account_id_idx" ON "supplier_milk_onboardings"("mcc_account_id");

-- AddForeignKey
ALTER TABLE "supplier_milk_onboardings" ADD CONSTRAINT "supplier_milk_onboardings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
