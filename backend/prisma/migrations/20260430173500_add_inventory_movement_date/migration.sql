-- Add explicit business-effective date for inventory movements
ALTER TABLE "inventory_movements"
ADD COLUMN "movement_date" TIMESTAMPTZ(6);

-- Backfill historical rows using created_at
UPDATE "inventory_movements"
SET "movement_date" = "created_at"
WHERE "movement_date" IS NULL;

ALTER TABLE "inventory_movements"
ALTER COLUMN "movement_date" SET NOT NULL,
ALTER COLUMN "movement_date" SET DEFAULT NOW();

CREATE INDEX "inventory_movements_movement_date_idx" ON "inventory_movements"("movement_date");

