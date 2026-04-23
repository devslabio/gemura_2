/**
 * Single source of truth for permissions and default permissions per role.
 * ResolveIT-style: list permissions with code/name/description; each role has a set of default permissions.
 * Owner and admin are treated as having all permissions in guards; other roles use this matrix or user-level overrides.
 */

export const ROLES = [
  'owner',
  'admin',
  'manager',
  'accountant',
  'collector',
  'viewer',
  'agent',
  'supplier',
  'customer',
] as const;

export type RoleCode = (typeof ROLES)[number];

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
  { code: 'view_suppliers', name: 'View suppliers', description: 'View suppliers list and details', category: 'Suppliers' },
  { code: 'create_suppliers', name: 'Create suppliers', description: 'Add new suppliers', category: 'Suppliers' },
  { code: 'view_customers', name: 'View customers', description: 'View customers list and details', category: 'Customers' },
  { code: 'create_customers', name: 'Create customers', description: 'Add new customers', category: 'Customers' },
  { code: 'view_inventory', name: 'View inventory', description: 'View inventory list and details', category: 'Inventory' },
  { code: 'manage_inventory', name: 'Manage inventory', description: 'Create, edit, sell inventory items', category: 'Inventory' },
  { code: 'view_analytics', name: 'View analytics', description: 'Access analytics and reports', category: 'Analytics' },
];

/** Default permissions per role (owner/admin have all in guards; this is for display and for non-admin roles) */
export const ROLE_DEFAULT_PERMISSIONS: Record<RoleCode, string[]> = {
  owner: PERMISSIONS.map((p) => p.code),
  admin: PERMISSIONS.map((p) => p.code),
  manager: [
    'dashboard.view',
    'manage_users',
    'view_sales',
    'create_sales',
    'update_sales',
    'view_collections',
    'create_collections',
    'view_suppliers',
    'create_suppliers',
    'view_customers',
    'create_customers',
    'view_inventory',
    'manage_inventory',
    'view_analytics',
  ],
  accountant: [
    'dashboard.view',
    'view_analytics',
  ],
  collector: [
    'view_sales',
    'create_sales',
    'view_collections',
    'create_collections',
    'view_suppliers',
    'view_customers',
    'view_inventory',
    'manage_inventory',
  ],
  viewer: [
    'view_sales',
    'view_collections',
    'view_suppliers',
    'view_customers',
    'view_inventory',
    'view_analytics',
  ],
  agent: [
    'view_sales',
    'create_sales',
    'view_collections',
    'create_collections',
    'view_suppliers',
    'view_customers',
    'view_inventory',
    'manage_inventory',
  ],
  supplier: [],
  customer: [],
};

export const ROLE_LABELS: Record<RoleCode, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  accountant: 'Accountant',
  collector: 'Collector',
  viewer: 'Viewer',
  agent: 'Agent',
  supplier: 'Supplier',
  customer: 'Customer',
};

export const ROLE_DESCRIPTIONS: Record<RoleCode, string> = {
  owner: 'Full system access; all permissions',
  admin: 'Administrative access; manage users and settings',
  manager: 'Full operational access; sales, collections, inventory, analytics; can manage team members',
  accountant: 'Finance access only; dashboard, payroll, loans, charges and finance reporting',
  collector: 'Milk receptionist access; sales and collections with supplier/customer views and inventory item management',
  viewer: 'Read-only access to main modules',
  agent: 'Veterinary access; same operational scope as milk receptionist with inventory item management',
  supplier: 'Supplier account access',
  customer: 'Customer account access',
};
