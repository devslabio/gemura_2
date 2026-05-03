/**
 * Single source of truth for permissions and default permissions per role.
 * ResolveIT-style: list permissions with code/name/description; each role has a set of default permissions.
 * System admin and admin are treated as having all permissions in guards; other roles use this matrix or user-level overrides.
 * Legacy stored/API slug `owner` is normalized to `system_admin`.
 */

export const ROLES = [
  'system_admin',
  'admin',
  'manager',
  'veterinary_officer',
  'casual_laborer',
  'leadership',
  'regulator',
  'umucunda_a',
  'umucunda_b',
  'accountant',
  'collector',
  'viewer',
  'agent',
  'supplier',
  'customer',
] as const;

export type RoleCode = (typeof ROLES)[number];

/** Canonical slug for persistence (aliases + legacy spellings → platform `ROLES` slugs). */
export function canonicalPlatformRoleSlug(slug: string | null | undefined): string {
  let raw = (slug ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  raw = raw.replace(/-/g, '_');
  if (!raw) return '';
  if (raw === 'owner') return 'system_admin';
  if (raw === 'veterinary' || raw === 'veterinarian' || raw === 'veternary') return 'veterinary_officer';
  if (raw === 'milkreceptionist' || raw === 'milk_receptionist') return 'collector';
  return raw.slice(0, 64);
}

/** Full platform access tiers (accepts legacy `owner` stored on tokens/rows). */
export function isPlatformSuperAdminRole(role: string | null | undefined): boolean {
  const r = (role || '').toLowerCase();
  return r === 'system_admin' || r === 'admin' || r === 'owner';
}

export interface PermissionDef {
  code: string;
  name: string;
  description: string;
  category?: string;
}

/** All permission codes used in the app (guards, nav, etc.) with labels and descriptions */
export const PERMISSIONS: PermissionDef[] = [
  { code: 'dashboard.view', name: 'View dashboard', description: 'Access admin/overview dashboard', category: 'Admin' },
  { code: 'manage_users', name: 'Manage users', description: 'Create, edit, and manage users and roles', category: 'Admin' },
  { code: 'view_sales', name: 'View sales', description: 'View sales list and details', category: 'Sales' },
  { code: 'create_sales', name: 'Create sales', description: 'Create new sales', category: 'Sales' },
  { code: 'update_sales', name: 'Update sales', description: 'Edit and update sales', category: 'Sales' },
  { code: 'view_collections', name: 'View collections', description: 'View collections list and details', category: 'Collections' },
  { code: 'create_collections', name: 'Create collections', description: 'Create new collections', category: 'Collections' },
  {
    code: 'update_collections',
    name: 'Update collections',
    description: 'Edit, cancel, delete collections and record payments on them',
    category: 'Collections',
  },
  { code: 'view_suppliers', name: 'View suppliers', description: 'View suppliers list and details', category: 'Suppliers' },
  { code: 'create_suppliers', name: 'Create suppliers', description: 'Add new suppliers', category: 'Suppliers' },
  {
    code: 'update_suppliers',
    name: 'Update suppliers',
    description: 'Edit supplier records and deactivate or remove supplier links',
    category: 'Suppliers',
  },
  { code: 'view_customers', name: 'View customers', description: 'View customers list and details', category: 'Customers' },
  { code: 'create_customers', name: 'Create customers', description: 'Add new customers', category: 'Customers' },
  {
    code: 'update_customers',
    name: 'Update customers',
    description: 'Edit customer records and deactivate or remove customer links',
    category: 'Customers',
  },
  { code: 'view_inventory', name: 'View inventory', description: 'View inventory list and details', category: 'Inventory' },
  { code: 'manage_inventory', name: 'Manage inventory', description: 'Create, edit, sell inventory items', category: 'Inventory' },
  { code: 'view_analytics', name: 'View analytics', description: 'Access analytics and reports', category: 'Analytics' },
  {
    code: 'mcc_view_operations',
    name: 'View MCC operations',
    description: 'View gate deliveries, manifests, milk tests, shifts, and the MCC manager overview',
    category: 'MCC',
  },
  {
    code: 'mcc_manage_operations',
    name: 'Manage MCC operations',
    description:
      'Record gate deliveries; create, edit, and submit manifests; record and update milk tests; start and end staff shifts (manifest reject uses Accept MCC manifests)',
    category: 'MCC',
  },
  {
    code: 'mcc_floor_operations',
    name: 'MCC floor / gate operations',
    description:
      'Gate intake work: record deliveries; create/submit manifest drafts; start/end own shift; supplier list for intake. Excludes milk-test traceability, roster admin, and manifest accept/reject.',
    category: 'MCC',
  },
  {
    code: 'mcc_accept_manifests',
    name: 'Accept MCC manifests',
    description: 'Accept submitted Umucunda manifests (releases payment-hold workflow)',
    category: 'MCC',
  },
  {
    code: 'mcc_view_own_operations',
    name: 'View own Umucunda MCC operations',
    description:
      'View gate deliveries, manifests, and milk tests only for the Umucunda hub/route supplier linked to this user',
    category: 'MCC',
  },
  {
    code: 'mcc_manage_own_operations',
    name: 'Manage own Umucunda MCC operations',
    description:
      'Record gate deliveries and create/submit manifest drafts only for the linked Umucunda supplier; start/end own shift only',
    category: 'MCC',
  },
];

/** Default permissions per role (system_admin/admin have all in guards; this is for display and for non-admin roles) */
export const ROLE_DEFAULT_PERMISSIONS: Record<RoleCode, string[]> = {
  system_admin: PERMISSIONS.map((p) => p.code),
  admin: PERMISSIONS.map((p) => p.code),
  manager: [
    'dashboard.view',
    'manage_users',
    'view_sales',
    'create_sales',
    'update_sales',
    'view_collections',
    'create_collections',
    'update_collections',
    'mcc_view_operations',
    'mcc_manage_operations',
    'mcc_accept_manifests',
    'view_suppliers',
    'create_suppliers',
    'update_suppliers',
    'view_customers',
    'create_customers',
    'update_customers',
    'view_inventory',
    'manage_inventory',
    'view_analytics',
  ],
  veterinary_officer: [
    'dashboard.view',
    'view_collections',
    'create_collections',
    'update_collections',
    'mcc_view_operations',
    'mcc_manage_operations',
    'view_suppliers',
    'view_inventory',
    'manage_inventory',
    'view_analytics',
  ],
  casual_laborer: [
    'dashboard.view',
    'mcc_floor_operations',
    'view_inventory',
  ],
  leadership: [
    'dashboard.view',
    'view_sales',
    'view_collections',
    'mcc_view_operations',
    'view_inventory',
    'view_analytics',
  ],
  regulator: [
    'dashboard.view',
    'view_collections',
    'mcc_view_operations',
    'view_inventory',
    'view_analytics',
  ],
  umucunda_a: [
    'dashboard.view',
    'view_collections',
    'create_collections',
    'update_collections',
    'mcc_view_own_operations',
    'mcc_manage_own_operations',
    'view_sales',
    'create_sales',
  ],
  umucunda_b: [
    'dashboard.view',
    'view_collections',
    'create_collections',
    'update_collections',
    'mcc_view_own_operations',
    'mcc_manage_own_operations',
    'view_sales',
    'create_sales',
  ],
  accountant: [
    'dashboard.view',
    'view_analytics',
  ],
  collector: [
    'dashboard.view',
    'view_sales',
    'create_sales',
    'update_sales',
    'view_collections',
    'create_collections',
    'update_collections',
    'mcc_view_operations',
    'mcc_manage_operations',
    'view_suppliers',
    'view_customers',
    'view_inventory',
    'manage_inventory',
  ],
  viewer: [
    'view_sales',
    'view_collections',
    'mcc_view_operations',
    'view_suppliers',
    'view_customers',
    'view_inventory',
    'view_analytics',
  ],
  agent: [
    'view_sales',
    'create_sales',
    'update_sales',
    'view_collections',
    'create_collections',
    'update_collections',
    'mcc_view_operations',
    'mcc_manage_operations',
    'view_suppliers',
    'view_customers',
    'view_inventory',
    'manage_inventory',
  ],
  supplier: [],
  customer: [],
};

export const ROLE_LABELS: Record<RoleCode, string> = {
  system_admin: 'System admin',
  admin: 'Admin',
  manager: 'Manager',
  veterinary_officer: 'Veterinary officer',
  casual_laborer: 'Casual laborer',
  leadership: 'MCC leadership',
  regulator: 'Regulator',
  umucunda_a: 'Umucunda Type A',
  umucunda_b: 'Umucunda Type B',
  accountant: 'Accountant',
  collector: 'Collector',
  viewer: 'Viewer',
  agent: 'Agent',
  supplier: 'Supplier',
  customer: 'Customer',
};

export const ROLE_DESCRIPTIONS: Record<RoleCode, string> = {
  system_admin: 'Full platform access; all permissions',
  admin: 'Administrative access; manage users and settings',
  manager: 'Full operational access; sales, collections, inventory, analytics; can manage team members',
  veterinary_officer: 'Quality testing and collection intake supervision with inventory visibility',
  casual_laborer:
    'Floor tasks at intake: gate deliveries, manifest drafts, own shift, supplier picker at gate, inventory read for tank monitoring — no full collections UI, traceability tests, or roster screens',
  leadership: 'Governance view with aggregate analytics and operational monitoring',
  regulator: 'Read-only compliance and traceability oversight access',
  umucunda_a:
    'Umucunda route operator: own gate deliveries & manifests (linked supplier), sales/collections; no site-wide MCC roster or inventory',
  umucunda_b:
    'Umucunda route operator (manifest-first): same scoped MCC visibility as Type A; linked supplier required for gate/manifest APIs',
  accountant: 'Finance access only; dashboard, payroll, loans, charges and finance reporting',
  collector: 'Milk receptionist access; sales and collections with supplier/customer views and inventory item management',
  viewer: 'Read-only access to main modules',
  agent: 'Veterinary access; same operational scope as milk receptionist with inventory item management',
  supplier: 'Supplier account access',
  customer: 'Customer account access',
};
