/**
 * Navigation and sectioning.
 *
 * Admin portal visibility is determined by role + permissions (UserAccount.role + permissions),
 * not by a special `account_type === 'admin'` system account. This keeps "Admin portal" separate from
 * "admin account_type" which may not exist / may differ across deployments.
 *
 * Backend still returns `account_type` + `role` (UserAccount.role), but the UI should use `role/permissions`
 * when deciding whether to show/protect `/admin/*`.
 */

import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faHome,
  faUsers,
  faReceipt,
  faBox,
  faBuilding,
  faStore,
  faWarehouse,
  faDollarSign,
  faChartLine,
  faClipboardList,
  faHandHoldingDollar,
  faTag,
  faList,
  faTruck,
  faEye,
  faClock,
  faArrowsRotate,
  faRightFromBracket,
  faChartBar,
  faUserFriends,
} from '@/app/components/Icon';

/** Account types that see user/operations menu (filtered by role + permissions) */
export const BUSINESS_ACCOUNT_TYPES = ['mcc', 'owner', 'agent', 'tenant', 'branch'] as const;
/** Portal “admin section” roles; includes legacy `owner` slug until all tokens are migrated. */
export const ADMIN_ROLES = ['system_admin', 'admin', 'owner'] as const;
export const OPERATIONS_ROLES = [
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
  'employee',
  'agent',
  'veterinary',
  'veterinarian',
  'veternary',
  'milkreceptionist',
  'milk_receptionist',
] as const;
export const EXTERNAL_ACCOUNT_TYPES = ['supplier', 'customer', 'farmer'] as const;

export type Section = 'admin' | 'operations' | 'external_supplier' | 'external_customer';

export interface NavItem {
  icon: IconDefinition;
  label: string;
  href: string;
  section: Section;
  /** Sidebar section heading (items with the same title render under one heading). */
  navGroup?: string;
  /** Permission key required (for operations section). Owner/admin bypass. */
  requiresPermission?: string;
  /** User needs at least one of these (for operations section). Takes precedence over `requiresPermission` when set. */
  requiresAnyPermission?: string[];
  /** When true, sidebar shows this link only for veterinary-style roles that see the dashboard Quality desk. */
  vetQualityDeskOnly?: boolean;
}

/** Sub-views for the dashboard “Operations” tab (also used at `/operations/*` via sidebar). */
export type MccOperationsSubPanel = 'gate' | 'manifests' | 'traceability' | 'staff' | 'shifts';

export const MCC_OPERATIONS_SUB_PANELS: {
  id: MccOperationsSubPanel;
  label: string;
  href: string;
  description: string;
  /** If set, user needs one of these (e.g. full MCC ops, not Umucunda scoped). */
  requiresAnyPermission?: string[];
}[] = [
  {
    id: 'gate',
    label: 'Gate arrivals',
    href: '/operations/gate',
    description: 'Gate intake log. Link arrivals when posting a collection.',
  },
  {
    id: 'manifests',
    label: 'Manifests',
    href: '/operations/manifests',
    description: 'Umucunda manifests and per-farmer lines.',
  },
  {
    id: 'traceability',
    label: 'Milk tests',
    href: '/operations/traceability',
    description: 'Milk tests, manifest lines, and rejection resolution.',
    requiresAnyPermission: ['mcc_view_operations', 'mcc_manage_operations'],
  },
  {
    id: 'staff',
    label: 'Staff',
    href: '/operations/staff',
    description: 'Roster, roles on duty, and shift actions.',
    requiresAnyPermission: ['mcc_view_operations'],
  },
  {
    id: 'shifts',
    label: 'Shifts',
    href: '/operations/shifts',
    description: 'Shift history and handovers.',
    requiresAnyPermission: ['mcc_view_operations'],
  },
];

/** Display order for operations sidebar group titles. */
export const OPERATIONS_NAV_GROUP_ORDER = [
  'Overview',
  'Sales & milk',
  'MCC operations',
  'Contacts',
  'Inventory',
  'Finance & payroll',
  'System',
] as const;

/** Cooperative Members menu + `/members` RouteGuard (parity with backend `ACCOUNT_MEMBERSHIP_LIST_PERMISSIONS`). */
export const MEMBERS_NAV_PERMISSIONS: readonly string[] = [
  'manage_users',
  'create_suppliers',
  'update_suppliers',
  'view_suppliers',
];

/**
 * Admin section navigation items.
 * Visibility is enforced in the sidebar/layout using `role + permissions`.
 */
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { icon: faHome, label: 'Dashboard', href: '/admin/dashboard', section: 'admin', navGroup: 'Administration' },
  { icon: faUsers, label: 'Users', href: '/admin/users', section: 'admin', navGroup: 'Administration' },
];

export const ADMIN_NAV_GROUP_ORDER = ['Administration'] as const;

/**
 * Operations section: for role in [manager, collector, viewer, employee] (and optionally system_admin/admin).
 * account_type in [mcc, owner, agent]. Permission checks apply.
 */
export const OPERATIONS_NAV_ITEMS: NavItem[] = [
  { icon: faHome, label: 'Dashboard', href: '/dashboard', section: 'operations', navGroup: 'Overview', requiresPermission: 'dashboard.view' },
  { icon: faReceipt, label: 'Sales', href: '/sales', section: 'operations', navGroup: 'Sales & milk', requiresPermission: 'view_sales' },
  {
    icon: faBox,
    label: 'Milk collection',
    href: '/collections',
    section: 'operations',
    navGroup: 'Sales & milk',
    requiresAnyPermission: ['view_collections', 'mcc_view_operations'],
  },
  {
    icon: faTruck,
    label: 'Gate deliveries',
    href: '/operations/gate',
    section: 'operations',
    navGroup: 'Sales & milk',
    requiresAnyPermission: [
      'mcc_view_operations',
      'mcc_view_own_operations',
      'view_collections',
      'mcc_floor_operations',
    ],
  },
  {
    icon: faRightFromBracket,
    label: 'Incoming transfers',
    href: '/transfers/incoming',
    section: 'operations',
    navGroup: 'Sales & milk',
    requiresPermission: 'view_collections',
  },
  {
    icon: faList,
    label: 'Manifests',
    href: '/operations/manifests',
    section: 'operations',
    navGroup: 'MCC operations',
    requiresAnyPermission: [
      'mcc_view_operations',
      'mcc_view_own_operations',
      'view_collections',
      'mcc_floor_operations',
    ],
  },
  {
    icon: faEye,
    label: 'Milk tests',
    href: '/operations/traceability',
    section: 'operations',
    navGroup: 'MCC operations',
    requiresAnyPermission: ['mcc_view_operations', 'mcc_manage_operations'],
  },
  {
    icon: faChartBar,
    label: 'Quality desk',
    href: '/dashboard?tab=quality',
    section: 'operations',
    navGroup: 'MCC operations',
    requiresAnyPermission: ['mcc_view_operations', 'mcc_manage_operations'],
    vetQualityDeskOnly: true,
  },
  {
    icon: faUsers,
    label: 'Staff',
    href: '/operations/staff',
    section: 'operations',
    navGroup: 'MCC operations',
    requiresPermission: 'mcc_view_operations',
  },
  {
    icon: faClock,
    label: 'Shifts',
    href: '/operations/shifts',
    section: 'operations',
    navGroup: 'MCC operations',
    requiresPermission: 'mcc_view_operations',
  },
  { icon: faBuilding, label: 'Suppliers', href: '/suppliers', section: 'operations', navGroup: 'Contacts', requiresPermission: 'view_suppliers' },
  {
    icon: faUserFriends,
    label: 'Members',
    href: '/members',
    section: 'operations',
    navGroup: 'Contacts',
    requiresAnyPermission: [...MEMBERS_NAV_PERMISSIONS],
  },
  { icon: faStore, label: 'Customers', href: '/customers', section: 'operations', navGroup: 'Contacts', requiresPermission: 'view_customers' },
  {
    icon: faWarehouse,
    label: 'Inventory items',
    href: '/inventory/items',
    section: 'operations',
    navGroup: 'Inventory',
    requiresPermission: 'view_inventory',
  },
  {
    icon: faArrowsRotate,
    label: 'Stock movements',
    href: '/inventory/movements',
    section: 'operations',
    navGroup: 'Inventory',
    requiresPermission: 'view_inventory',
  },
  { icon: faClipboardList, label: 'Payroll', href: '/payroll', section: 'operations', navGroup: 'Finance & payroll', requiresPermission: 'view_analytics' },
  { icon: faTag, label: 'Charges', href: '/charges', section: 'operations', navGroup: 'Finance & payroll', requiresPermission: 'view_analytics' },
  { icon: faHandHoldingDollar, label: 'Loans', href: '/loans', section: 'operations', navGroup: 'Finance & payroll', requiresPermission: 'view_analytics' },
  { icon: faChartLine, label: 'Finance', href: '/finance', section: 'operations', navGroup: 'Finance & payroll', requiresPermission: 'view_analytics' },
  { icon: faDollarSign, label: 'Accounts', href: '/accounts', section: 'operations', navGroup: 'Finance & payroll', requiresPermission: 'view_analytics' },
];

/**
 * External (supplier account): Dashboard, supplier tools, Accounts.
 */
export const EXTERNAL_SUPPLIER_NAV_ITEMS: NavItem[] = [
  { icon: faHome, label: 'Dashboard', href: '/dashboard', section: 'external_supplier', navGroup: 'Account' },
  { icon: faWarehouse, label: 'Farms', href: '/supplier/farms', section: 'external_supplier', navGroup: 'Supplier' },
  { icon: faClipboardList, label: 'Collections', href: '/supplier/collections', section: 'external_supplier', navGroup: 'Supplier' },
  { icon: faChartLine, label: 'Production', href: '/supplier/production', section: 'external_supplier', navGroup: 'Supplier' },
  { icon: faReceipt, label: 'Transfers', href: '/supplier/transfers', section: 'external_supplier', navGroup: 'Supplier' },
  { icon: faDollarSign, label: 'Accounts', href: '/accounts', section: 'external_supplier', navGroup: 'Account' },
];

export const EXTERNAL_NAV_GROUP_ORDER = ['Account', 'Supplier', 'Farmer'] as const;

/**
 * External (customer / farmer): Dashboard, Accounts.
 */
export const EXTERNAL_CUSTOMER_NAV_ITEMS: NavItem[] = [
  { icon: faHome, label: 'Dashboard', href: '/dashboard', section: 'external_customer', navGroup: 'Account' },
  { icon: faDollarSign, label: 'Accounts', href: '/accounts', section: 'external_customer', navGroup: 'Account' },
];

/** External farmer (direct or farmer-collector) tools */
export const EXTERNAL_FARMER_NAV_ITEMS: NavItem[] = [
  { icon: faHome, label: 'Dashboard', href: '/dashboard', section: 'external_customer', navGroup: 'Account' },
  { icon: faWarehouse, label: 'Farms', href: '/supplier/farms', section: 'external_customer', navGroup: 'Farmer' },
  { icon: faClipboardList, label: 'Collections', href: '/supplier/collections', section: 'external_customer', navGroup: 'Farmer' },
  { icon: faChartLine, label: 'Production', href: '/supplier/production', section: 'external_customer', navGroup: 'Farmer' },
  { icon: faReceipt, label: 'Transfers', href: '/supplier/transfers', section: 'external_customer', navGroup: 'Farmer' },
  { icon: faDollarSign, label: 'Accounts', href: '/accounts', section: 'external_customer', navGroup: 'Account' },
];

export function isBusinessAccount(accountType: string): boolean {
  const t = (accountType || '').toLowerCase();
  return BUSINESS_ACCOUNT_TYPES.some((a) => a === t);
}

export function isAdminRole(role: string): boolean {
  const r = (role || '').toLowerCase();
  return ADMIN_ROLES.some((a) => a === r);
}

export function isOperationsRole(role: string): boolean {
  const r = (role || '').trim().toLowerCase().replace(/\s+/g, '_');
  return OPERATIONS_ROLES.some((a) => a === r);
}

export function isExternalSupplier(accountType: string): boolean {
  return (accountType || '').toLowerCase() === 'supplier';
}

export function isExternalCustomer(accountType: string): boolean {
  const t = (accountType || '').toLowerCase();
  return t === 'customer' || t === 'farmer';
}

export interface NavSidebarGroup {
  title: string;
  items: NavItem[];
}

/** Group flat nav items under headings; respects `groupOrder`, then any remaining groups. */
export function buildNavSidebarGroups(
  items: NavItem[],
  groupOrder: readonly string[],
): NavSidebarGroup[] {
  const map = new Map<string, NavItem[]>();
  for (const item of items) {
    const g = item.navGroup ?? 'Other';
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(item);
  }
  const seen = new Set<string>();
  const out: NavSidebarGroup[] = [];
  for (const title of groupOrder) {
    const list = map.get(title);
    if (list?.length) {
      out.push({ title, items: list });
      seen.add(title);
    }
  }
  for (const [title, list] of map) {
    if (!seen.has(title) && list.length) out.push({ title, items: list });
  }
  return out;
}
