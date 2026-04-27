-- Species lookup (cattle, goat, poultry, pig). All existing breeds/animals default to cattle.

CREATE TABLE "species" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "species_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "species_code_key" ON "species"("code");
CREATE INDEX "species_code_idx" ON "species"("code");

INSERT INTO "species" ("id", "code", "name", "description", "sort_order") VALUES
  ('11111111-1111-4111-8111-111111111101', 'cattle', 'Cattle', 'Bovine (dairy and beef)', 10),
  ('11111111-1111-4111-8111-111111111102', 'goat', 'Goats', 'Caprine', 20),
  ('11111111-1111-4111-8111-111111111103', 'poultry', 'Poultry', 'Chickens, turkeys, and other poultry', 30),
  ('11111111-1111-4111-8111-111111111104', 'pig', 'Pigs', 'Swine', 40);

ALTER TABLE "breeds" ADD COLUMN "species_id" UUID;

UPDATE "breeds" SET "species_id" = '11111111-1111-4111-8111-111111111101';

ALTER TABLE "breeds" ALTER COLUMN "species_id" SET NOT NULL;

ALTER TABLE "breeds" ADD CONSTRAINT "breeds_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "breeds_species_id_idx" ON "breeds"("species_id");

ALTER TABLE "animals" ADD COLUMN "species_id" UUID;

UPDATE "animals" SET "species_id" = (
  SELECT b."species_id" FROM "breeds" b WHERE b."id" = "animals"."breed_id"
);

ALTER TABLE "animals" ALTER COLUMN "species_id" SET NOT NULL;

ALTER TABLE "animals" ADD CONSTRAINT "animals_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "animals_species_id_idx" ON "animals"("species_id");
