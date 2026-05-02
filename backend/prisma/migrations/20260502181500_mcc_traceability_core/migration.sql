-- MCC traceability primitives: gate delivery, Umucunda manifest + lines, lab test row, farmer credit ledger; optional bridge from milk_sales (§spec 12.x).

CREATE TYPE "MccDeliverySourceType" AS ENUM ('direct', 'umucunda_a', 'umucunda_b');

CREATE TYPE "MccMilkManifestStatus" AS ENUM ('draft', 'submitted', 'accepted', 'rejected', 'superseded');

CREATE TYPE "MccMilkTestOutcome" AS ENUM ('pending', 'accepted', 'rejected');

CREATE TYPE "MccSourceResolutionStatus" AS ENUM ('unresolved', 'resolved', 'secondary_test', 'frozen', 'auto_zero');

-- CreateTable
CREATE TABLE "mcc_gate_deliveries" (
    "id" UUID NOT NULL,
    "mcc_account_id" UUID NOT NULL,
    "source_type" "MccDeliverySourceType" NOT NULL,
    "source_account_id" UUID NOT NULL,
    "gate_volume_litres" DECIMAL(12,3) NOT NULL,
    "arrived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by_user_id" UUID NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcc_gate_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcc_milk_manifests" (
    "id" UUID NOT NULL,
    "gate_delivery_id" UUID NOT NULL,
    "mcc_account_id" UUID NOT NULL,
    "umucunda_supplier_account_id" UUID NOT NULL,
    "manifest_ref" VARCHAR(40) NOT NULL,
    "status" "MccMilkManifestStatus" NOT NULL DEFAULT 'draft',
    "route_metadata" JSONB,
    "gps_metadata" JSONB,
    "submitted_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcc_milk_manifests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcc_manifest_lines" (
    "id" UUID NOT NULL,
    "manifest_id" UUID NOT NULL,
    "farmer_supplier_account_id" UUID NOT NULL,
    "declared_litres" DECIMAL(12,3) NOT NULL,
    "container_id" VARCHAR(64),

    CONSTRAINT "mcc_manifest_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcc_milk_test_results" (
    "id" UUID NOT NULL,
    "mcc_gate_delivery_id" UUID NOT NULL,
    "manifest_line_id" UUID,
    "outcome" "MccMilkTestOutcome" NOT NULL DEFAULT 'pending',
    "rejection_cause" TEXT,
    "source_resolution_status" "MccSourceResolutionStatus",
    "detail" JSONB,
    "tested_by_user_id" UUID,
    "tested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcc_milk_test_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcc_credit_events" (
    "id" UUID NOT NULL,
    "farmer_account_id" UUID NOT NULL,
    "mcc_account_id" UUID NOT NULL,
    "mcc_gate_delivery_id" UUID NOT NULL,
    "mcc_milk_manifest_id" UUID,
    "mcc_milk_test_result_id" UUID,
    "volume_credited_litres" DECIMAL(12,3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcc_credit_events_pkey" PRIMARY KEY ("id")
);

-- AlterTable milk_sales optional link to gate delivery (at most one milk sale row per delivery)
ALTER TABLE "milk_sales" ADD COLUMN "mcc_gate_delivery_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "mcc_milk_manifests_gate_delivery_id_key" ON "mcc_milk_manifests"("gate_delivery_id");

-- CreateIndex
CREATE UNIQUE INDEX "mcc_milk_manifests_manifest_ref_key" ON "mcc_milk_manifests"("manifest_ref");

-- CreateIndex
CREATE INDEX "mcc_milk_manifests_mcc_account_id_status_idx" ON "mcc_milk_manifests"("mcc_account_id", "status");

-- CreateIndex
CREATE INDEX "mcc_milk_manifests_umucunda_supplier_account_id_idx" ON "mcc_milk_manifests"("umucunda_supplier_account_id");

-- CreateIndex
CREATE INDEX "mcc_manifest_lines_manifest_id_idx" ON "mcc_manifest_lines"("manifest_id");

-- CreateIndex
CREATE INDEX "mcc_manifest_lines_farmer_supplier_account_id_idx" ON "mcc_manifest_lines"("farmer_supplier_account_id");

-- CreateIndex
CREATE INDEX "mcc_milk_test_results_mcc_gate_delivery_id_tested_at_idx" ON "mcc_milk_test_results"("mcc_gate_delivery_id", "tested_at" DESC);

-- CreateIndex
CREATE INDEX "mcc_credit_events_farmer_account_id_created_at_idx" ON "mcc_credit_events"("farmer_account_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "mcc_credit_events_mcc_gate_delivery_id_idx" ON "mcc_credit_events"("mcc_gate_delivery_id");

-- CreateIndex
CREATE INDEX "mcc_gate_deliveries_mcc_account_id_arrived_at_idx" ON "mcc_gate_deliveries"("mcc_account_id", "arrived_at" DESC);

-- CreateIndex
CREATE INDEX "mcc_gate_deliveries_source_account_id_arrived_at_idx" ON "mcc_gate_deliveries"("source_account_id", "arrived_at" DESC);

CREATE UNIQUE INDEX "milk_sales_mcc_gate_delivery_id_key" ON "milk_sales"("mcc_gate_delivery_id");

-- CreateIndex
CREATE INDEX "milk_sales_mcc_gate_delivery_id_idx" ON "milk_sales"("mcc_gate_delivery_id");

-- AddForeignKey
ALTER TABLE "mcc_gate_deliveries" ADD CONSTRAINT "mcc_gate_deliveries_mcc_account_id_fkey" FOREIGN KEY ("mcc_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcc_gate_deliveries" ADD CONSTRAINT "mcc_gate_deliveries_source_account_id_fkey" FOREIGN KEY ("source_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcc_gate_deliveries" ADD CONSTRAINT "mcc_gate_deliveries_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcc_milk_manifests" ADD CONSTRAINT "mcc_milk_manifests_gate_delivery_id_fkey" FOREIGN KEY ("gate_delivery_id") REFERENCES "mcc_gate_deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcc_milk_manifests" ADD CONSTRAINT "mcc_milk_manifests_mcc_account_id_fkey" FOREIGN KEY ("mcc_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcc_milk_manifests" ADD CONSTRAINT "mcc_milk_manifests_umucunda_supplier_account_id_fkey" FOREIGN KEY ("umucunda_supplier_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcc_manifest_lines" ADD CONSTRAINT "mcc_manifest_lines_manifest_id_fkey" FOREIGN KEY ("manifest_id") REFERENCES "mcc_milk_manifests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcc_manifest_lines" ADD CONSTRAINT "mcc_manifest_lines_farmer_supplier_account_id_fkey" FOREIGN KEY ("farmer_supplier_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcc_milk_test_results" ADD CONSTRAINT "mcc_milk_test_results_mcc_gate_delivery_id_fkey" FOREIGN KEY ("mcc_gate_delivery_id") REFERENCES "mcc_gate_deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcc_milk_test_results" ADD CONSTRAINT "mcc_milk_test_results_manifest_line_id_fkey" FOREIGN KEY ("manifest_line_id") REFERENCES "mcc_manifest_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcc_milk_test_results" ADD CONSTRAINT "mcc_milk_test_results_tested_by_user_id_fkey" FOREIGN KEY ("tested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcc_credit_events" ADD CONSTRAINT "mcc_credit_events_farmer_account_id_fkey" FOREIGN KEY ("farmer_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcc_credit_events" ADD CONSTRAINT "mcc_credit_events_mcc_account_id_fkey" FOREIGN KEY ("mcc_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcc_credit_events" ADD CONSTRAINT "mcc_credit_events_mcc_gate_delivery_id_fkey" FOREIGN KEY ("mcc_gate_delivery_id") REFERENCES "mcc_gate_deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcc_credit_events" ADD CONSTRAINT "mcc_credit_events_mcc_milk_manifest_id_fkey" FOREIGN KEY ("mcc_milk_manifest_id") REFERENCES "mcc_milk_manifests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcc_credit_events" ADD CONSTRAINT "mcc_credit_events_mcc_milk_test_result_id_fkey" FOREIGN KEY ("mcc_milk_test_result_id") REFERENCES "mcc_milk_test_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milk_sales" ADD CONSTRAINT "milk_sales_mcc_gate_delivery_id_fkey" FOREIGN KEY ("mcc_gate_delivery_id") REFERENCES "mcc_gate_deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
