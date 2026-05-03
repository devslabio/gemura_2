-- CreateTable
CREATE TABLE "mcc_staff_shifts" (
    "id" UUID NOT NULL,
    "mcc_account_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "role_label_snapshot" VARCHAR(64),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcc_staff_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mcc_staff_shifts_mcc_account_id_started_at_idx" ON "mcc_staff_shifts"("mcc_account_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "mcc_staff_shifts_user_id_ended_at_idx" ON "mcc_staff_shifts"("user_id", "ended_at");

-- AddForeignKey
ALTER TABLE "mcc_staff_shifts" ADD CONSTRAINT "mcc_staff_shifts_mcc_account_id_fkey" FOREIGN KEY ("mcc_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcc_staff_shifts" ADD CONSTRAINT "mcc_staff_shifts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
