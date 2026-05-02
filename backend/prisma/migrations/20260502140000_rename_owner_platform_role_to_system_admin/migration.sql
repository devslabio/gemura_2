-- Rename top platform role slug `owner` → `system_admin` (display: System admin).

UPDATE "platform_roles"
SET
  "slug" = 'system_admin',
  "name" = 'System admin',
  "description" = 'Full platform access; all permissions'
WHERE "slug" = 'owner';

UPDATE "user_accounts"
SET "role" = 'system_admin'
WHERE LOWER(TRIM("role")) = 'owner';
