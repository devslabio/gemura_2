-- Narrow Casual Laborer to floor/gate permission set (see ROLE_DEFAULT_PERMISSIONS casual_laborer).
-- Idempotent: upserts catalog row and replaces links for platform_roles.slug = casual_laborer only.

INSERT INTO platform_permissions (id, code, name, description, category, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'mcc_floor_operations',
  'MCC floor / gate operations',
  'Gate intake work: record deliveries; create/submit manifest drafts; start/end own shift; supplier list for intake. Excludes milk-test traceability, roster admin, and manifest accept/reject.',
  'MCC',
  NOW(),
  NOW()
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();

DELETE FROM platform_role_permissions
WHERE platform_role_id IN (SELECT id FROM platform_roles WHERE slug = 'casual_laborer');

INSERT INTO platform_role_permissions (platform_role_id, platform_permission_id)
SELECT pr.id, pp.id
FROM platform_roles pr
CROSS JOIN platform_permissions pp
WHERE pr.slug = 'casual_laborer'
  AND pp.code IN ('dashboard.view', 'mcc_floor_operations', 'view_inventory');
