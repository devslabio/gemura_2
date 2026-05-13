-- Align seeded demo supplier (USER_SUP_001) with canonical credentials documented in seed.ts
-- (email supplier@gemura.rw, phone 250788409034). Older DBs still had jean@supplier.rw / 250788111222.

UPDATE "users"
SET
  "email" = 'supplier@gemura.rw',
  "phone" = '250788409034',
  "first_name" = 'Demo',
  "last_name" = 'Supplier',
  "name" = 'Demo Supplier',
  "updated_at" = CURRENT_TIMESTAMP
WHERE "code" = 'USER_SUP_001';

UPDATE "accounts"
SET
  "name" = 'Demo Supplier - Supplier',
  "updated_at" = CURRENT_TIMESTAMP
WHERE "code" = 'A_SUP_001';
