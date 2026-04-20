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
  faCog,
  faUserShield,
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
  faIdCard,
} from '@/app/components/Icon';

/** Account types that see user/operations menu (filtered by role + permissions) */
export const BUSINESS_ACCOUNT_TYPES = ['mcc', 'owner', 'agent', 'tenant', 'branch'] as const;
export const ADMIN_ROLES = ['owner', 'admin'] as const;
export const OPERATIONS_ROLES = ['manager', 'accountant', 'collector', 'viewer', 'employee', 'agent'] as const;
export const EXTERNAL_ACCOUNT_TYPES = ['supplier', 'customer', 'farmer'] as const;

export type Section = 'admin' | 'operations' | 'external_supplier' | 'external_customer';

export interface NavItem {
  icon: IconDefinition;
  label: string;
  href: string;
  section: Section;
  /** Permission key required (for operations section). Owner/admin bypass. */
  requiresPermission?: string;
  /** Optional submenu items (e.g. Inventory → Items, Movements). */
  children?: { label: string; href: string }[];
}

/**
 * Admin section navigation items.
 * Visibility is enforced in the sidebar/layout using `role + permissions`.
 */
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { icon: faHome, label: 'Dashboard', href: '/admin/dashboard', section: 'admin' },
  { icon: faUsers, label: 'Users', href: '/admin/users', section: 'admin' },
  { icon: faCog, label: 'Settings', href: '/settings', section: 'admin' },
];

/**
 * Operations section: for role in [manager, collector, viewer, employee] (and optionally owner/admin if we allow both).
 * account_type in [mcc, owner, agent]. Permission checks apply.
 */
export const OPERATIONS_NAV_ITEMS: NavItem[] = [
  { icon: faHome, label: 'Dashboard', href: '/dashboard', section: 'operations', requiresPermission: 'dashboard.view' },
  { icon: faReceipt, label: 'Sales', href: '/sales', section: 'operations', requiresPermission: 'view_sales' },
  { icon: faBox, label: 'Collections', href: '/collections', section: 'operations', requiresPermission: 'view_collections' },
  { icon: faBuilding, label: 'Suppliers', href: '/suppliers', section: 'operations', requiresPermission: 'view_suppliers' },
  { icon: faStore, label: 'Customers', href: '/customers', section: 'operations', requiresPermission: 'view_customers' },
  { icon: faWarehouse, label: 'Inventory', href: '/inventory/items', section: 'operations', requiresPermission: 'view_inventory', children: [{ label: 'Items', href: '/inventory/items' }, { label: 'Movements', href: '/inventory/movements' }] },
  { icon: faClipboardList, label: 'Payroll', href: '/payroll', section: 'operations', requiresPermission: 'view_analytics' },
  { icon: faTag, label: 'Charges', href: '/charges', section: 'operations', requiresPermission: 'view_analytics' },
  { icon: faHandHoldingDollar, label: 'Loans', href: '/loans', section: 'operations', requiresPermission: 'view_analytics' },
  { icon: faChartLine, label: 'Finance', href: '/finance', section: 'operations', requiresPermission: 'view_analytics' },
  { icon: faDollarSign, label: 'Accounts', href: '/accounts', section: 'operations', requiresPermission: 'view_analytics' },
  { icon: faIdCard, label: 'IMMIS', href: '/immis', section: 'operations' },
  { icon: faCog, label: 'Settings', href: '/settings', section: 'operations' },
];

/**
 * External (supplier account): Dashboard, Accounts, Settings.
 */
export const EXTERNAL_SUPPLIER_NAV_ITEMS: NavItem[] = [
  { icon: faHome, label: 'Dashboard', href: '/dashboard', section: 'external_supplier' },
  { icon: faDollarSign, label: 'Accounts', href: '/accounts', section: 'external_supplier' },
  { icon: faCog, label: 'Settings', href: '/settings', section: 'external_supplier' },
];

/**
 * External (customer / farmer): Dashboard, Accounts, Settings.
 */
export const EXTERNAL_CUSTOMER_NAV_ITEMS: NavItem[] = [
  { icon: faHome, label: 'Dashboard', href: '/dashboard', section: 'external_customer' },
  { icon: faDollarSign, label: 'Accounts', href: '/accounts', section: 'external_customer' },
  { icon: faCog, label: 'Settings', href: '/settings', section: 'external_customer' },
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
  const r = (role || '').toLowerCase();
  return OPERATIONS_ROLES.some((a) => a === r);
}

export function isExternalSupplier(accountType: string): boolean {
  return (accountType || '').toLowerCase() === 'supplier';
}

export function isExternalCustomer(accountType: string): boolean {
  const t = (accountType || '').toLowerCase();
  return t === 'customer' || t === 'farmer';
}
