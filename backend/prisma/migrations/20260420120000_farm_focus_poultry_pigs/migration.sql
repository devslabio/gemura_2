-- CreateEnum
CREATE TYPE "FarmProductionMode" AS ENUM ('dairy', 'meat', 'eggs', 'breeding');

-- CreateEnum
CREATE TYPE "PoultryFlockStatus" AS ENUM ('active', 'closed', 'archived');

-- CreateEnum
CREATE TYPE "FlockMovementType" AS ENUM ('intake', 'sale', 'transfer_out', 'transfer_in', 'adjustment');

-- CreateEnum
CREATE TYPE "PigBatchStatus" AS ENUM ('active', 'closed', 'archived');

-- CreateTable
CREATE TABLE "farm_species_focus" (
    "farm_id" UUID NOT NULL,
    "species_id" UUID NOT NULL,
    "modes" "FarmProductionMode"[],

    CONSTRAINT "farm_species_focus_pkey" PRIMARY KEY ("farm_id","species_id")
);

-- CreateTable
CREATE TABLE "poultry_flocks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "farm_id" UUID,
    "breed_id" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "started_at" DATE NOT NULL,
    "opening_head_count" INTEGER NOT NULL,
    "current_head_count" INTEGER NOT NULL,
    "status" "PoultryFlockStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "poultry_flocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flock_daily_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "flock_id" UUID NOT NULL,
    "record_date" DATE NOT NULL,
    "eggs_collected" INTEGER NOT NULL DEFAULT 0,
    "mortality_count" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flock_daily_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flock_movements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "flock_id" UUID NOT NULL,
    "movement_date" DATE NOT NULL,
    "type" "FlockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "flock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pig_batches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "farm_id" UUID,
    "breed_id" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "started_at" DATE NOT NULL,
    "opening_head_count" INTEGER NOT NULL,
    "current_head_count" INTEGER NOT NULL,
    "status" "PigBatchStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "pig_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pig_batch_weights" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "batch_id" UUID NOT NULL,
    "weighed_date" DATE NOT NULL,
    "avg_weight_kg" DECIMAL(8,2) NOT NULL,
    "min_weight_kg" DECIMAL(8,2),
    "max_weight_kg" DECIMAL(8,2),
    "animals_weighed" INTEGER,
    "weight_band" VARCHAR(64),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pig_batch_weights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pig_farrowings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "farm_id" UUID,
    "pig_batch_id" UUID,
    "sow_animal_id" UUID,
    "farrowing_date" DATE NOT NULL,
    "live_born" INTEGER NOT NULL DEFAULT 0,
    "stillborn" INTEGER NOT NULL DEFAULT 0,
    "mummified" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "pig_farrowings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "farm_species_focus_species_id_idx" ON "farm_species_focus"("species_id");

-- CreateIndex
CREATE INDEX "poultry_flocks_account_id_idx" ON "poultry_flocks"("account_id");

-- CreateIndex
CREATE INDEX "poultry_flocks_farm_id_idx" ON "poultry_flocks"("farm_id");

-- CreateIndex
CREATE UNIQUE INDEX "flock_daily_records_flock_id_record_date_key" ON "flock_daily_records"("flock_id", "record_date");

-- CreateIndex
CREATE INDEX "flock_daily_records_record_date_idx" ON "flock_daily_records"("record_date");

-- CreateIndex
CREATE INDEX "flock_movements_flock_id_idx" ON "flock_movements"("flock_id");

-- CreateIndex
CREATE INDEX "flock_movements_movement_date_idx" ON "flock_movements"("movement_date");

-- CreateIndex
CREATE INDEX "pig_batches_account_id_idx" ON "pig_batches"("account_id");

-- CreateIndex
CREATE INDEX "pig_batches_farm_id_idx" ON "pig_batches"("farm_id");

-- CreateIndex
CREATE UNIQUE INDEX "pig_batch_weights_batch_id_weighed_date_key" ON "pig_batch_weights"("batch_id", "weighed_date");

-- CreateIndex
CREATE INDEX "pig_farrowings_account_id_idx" ON "pig_farrowings"("account_id");

-- CreateIndex
CREATE INDEX "pig_farrowings_farm_id_idx" ON "pig_farrowings"("farm_id");

-- CreateIndex
CREATE INDEX "pig_farrowings_pig_batch_id_idx" ON "pig_farrowings"("pig_batch_id");

-- AddForeignKey
ALTER TABLE "farm_species_focus" ADD CONSTRAINT "farm_species_focus_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_species_focus" ADD CONSTRAINT "farm_species_focus_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "species"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poultry_flocks" ADD CONSTRAINT "poultry_flocks_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poultry_flocks" ADD CONSTRAINT "poultry_flocks_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poultry_flocks" ADD CONSTRAINT "poultry_flocks_breed_id_fkey" FOREIGN KEY ("breed_id") REFERENCES "breeds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flock_daily_records" ADD CONSTRAINT "flock_daily_records_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "poultry_flocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flock_movements" ADD CONSTRAINT "flock_movements_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "poultry_flocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pig_batches" ADD CONSTRAINT "pig_batches_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pig_batches" ADD CONSTRAINT "pig_batches_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pig_batches" ADD CONSTRAINT "pig_batches_breed_id_fkey" FOREIGN KEY ("breed_id") REFERENCES "breeds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pig_batch_weights" ADD CONSTRAINT "pig_batch_weights_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "pig_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pig_farrowings" ADD CONSTRAINT "pig_farrowings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pig_farrowings" ADD CONSTRAINT "pig_farrowings_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pig_farrowings" ADD CONSTRAINT "pig_farrowings_pig_batch_id_fkey" FOREIGN KEY ("pig_batch_id") REFERENCES "pig_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pig_farrowings" ADD CONSTRAINT "pig_farrowings_sow_animal_id_fkey" FOREIGN KEY ("sow_animal_id") REFERENCES "animals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
