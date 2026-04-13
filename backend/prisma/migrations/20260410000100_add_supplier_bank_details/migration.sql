-- Add optional bank details on supplier accounts
ALTER TABLE "public"."accounts"
ADD COLUMN IF NOT EXISTS "bank_name" TEXT,
ADD COLUMN IF NOT EXISTS "bank_account_number" TEXT;
