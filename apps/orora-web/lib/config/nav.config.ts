/**
 * Navigation: admin vs user is based on account type (active/default account).
 * Menus are grouped by main modules; 2- and 3-level submenus supported.
 * Unimplemented features link to /coming-soon/[slug].
 */

import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { showCollections, showSuppliers } from './features';
import {
  faHome,
  faUsers,
  faCog,
  faUserShield,
  faLock,
  faReceipt,
  faBox,
  faBuilding,
  faStore,
  faWarehouse,
  faDollarSign,
  faChartLine,
  faChartBar,
  faClipboardList,
  faHandHoldingDollar,
  faTag,
  faPaw,
  faBook,
  faChartPie,
  faSackDollar,
  faMapLocationDot,
  faLeaf,
  faEgg,
  faWeightScale,
} from '@/app/components/Icon';

/** Account type that sees only admin menu/features */
export const ADMIN_ACCOUNT_TYPE = 'admin' as const;

/** Account types that see user/operations menu (filtered by role + permissions) */
export const BUSINESS_ACCOUNT_TYPES = ['mcc', 'owner', 'agent', 'tenant', 'branch'] as const;
/** Portal “admin section” roles; includes legacy `owner` slug until all tokens are migrated. */
export const ADMIN_ROLES = ['system_admin', 'admin', 'owner'] as const;
export const OPERATIONS_ROLES = ['manager', 'accountant', 'collector', 'viewer', 'employee', 'agent'] as const;
export const EXTERNAL_ACCOUNT_TYPES = ['supplier', 'customer', 'farmer'] as const;

export type Section = 'admin' | 'operations' | 'external_supplier' | 'external_customer';

/** When set, item is shown only if the capability passes for the selected farm (see farmCapabilities). */
export type FarmNavGate = 'milk' | 'poultry' | 'pigs';

/** Recursive submenu item (2nd and 3rd level) */
export interface NavItemChild {
  label: string;
  href: string;
  comingSoon?: boolean;
  children?: NavItemChild[];
}

export interface NavItem {
  icon: IconDefinition;
  label: string;
  href: string;
  section: Section;
  /** Permission key required (for operations section). Owner/admin bypass. */
  requiresPermission?: string;
  /** When true, link goes to Coming Soon page (href used as path, e.g. /coming-soon/asset-register). */
  comingSoon?: boolean;
  /** 2nd level; items can have children for 3rd level. */
  children?: NavItemChild[];
  /** Narrow nav when a farm with species focus is selected; omitted = always show. */
  farmGate?: FarmNavGate;
}

/** Group of nav items under a section header (e.g. "Livestock", "Finance") */
export interface NavGroup {
  groupLabel: string;
  items: NavItem[];
}

/** Admin menu: flat list (no groups). */
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { icon: faHome, label: 'Dashboard', href: '/admin/dashboard', section: 'admin' },
  { icon: faUsers, label: 'Users', href: '/admin/users', section: 'admin' },
  { icon: faUserShield, label: 'Roles', href: '/admin/roles', section: 'admin' },
  { icon: faLock, label: 'Permissions', href: '/admin/permissions', section: 'admin' },
  { icon: faCog, label: 'Settings', href: '/settings', section: 'admin' },
];

/** Operations menu: grouped by main modules, with submenus and coming-soon links. */
export const OPERATIONS_NAV_GROUPS: NavGroup[] = [
  {
    groupLabel: 'Overview',
    items: [{ icon: faHome, label: 'Dashboard', href: '/dashboard', section: 'operations' }],
  },
  {
    groupLabel: 'Livestock',
    items: [
      { icon: faPaw, label: 'Animals', href: '/animals', section: 'operations' },
      { icon: faMapLocationDot, label: 'Farms', href: '/farms', section: 'operations' },
      { icon: faEgg, label: 'Poultry flocks', href: '/poultry-flocks', section: 'operations', farmGate: 'poultry' },
      {
        icon: faWeightScale,
        label: 'Pig batches',
        href: '/pig-batches',
        section: 'operations',
        farmGate: 'pigs',
      },
      { icon: faLeaf, label: 'Feeds', href: '/feeds', section: 'operations' },
    ],
  },
  {
    groupLabel: 'Production',
    items: [
      {
        icon: faChartBar,
        label: 'Milk production',
        href: '/production',
        section: 'operations',
        farmGate: 'milk',
      },
      { icon: faReceipt, label: 'Sales', href: '/sales', section: 'operations', requiresPermission: 'view_sales' },
      ...(showCollections
        ? [{ icon: faBox, label: 'Collections', href: '/collections', section: 'operations' as const, requiresPermission: 'view_collections' }]
        : []),
    ],
  },
  {
    groupLabel: 'People',
    items: [
      ...(showSuppliers
        ? [{ icon: faBuilding, label: 'Suppliers', href: '/suppliers', section: 'operations' as const, requiresPermission: 'view_suppliers' }]
        : []),
      { icon: faStore, label: 'Customers', href: '/customers', section: 'operations', requiresPermission: 'view_customers' },
    ],
  },
  {
    groupLabel: 'Inventory',
    items: [
      {
        icon: faWarehouse,
        label: 'Inventory',
        href: '/inventory/items',
        section: 'operations',
        requiresPermission: 'view_inventory',
        children: [
          { label: 'Items', href: '/inventory/items' },
          { label: 'Movements', href: '/inventory/movements' },
        ],
      },
    ],
  },
  {
    groupLabel: 'Finance',
    items: [
      {
        icon: faChartLine,
        label: 'Finance',
        href: '/finance',
        section: 'operations',
        children: [
          { label: 'Overview', href: '/finance' },
          { label: 'Transactions', href: '/finance/transactions' },
          { label: 'Receivables', href: '/finance/receivables' },
          { label: 'Payables', href: '/finance/payables' },
          { label: 'Chart of accounts', href: '/coming-soon/chart-of-accounts', comingSoon: true },
          { label: 'Reports', href: '/coming-soon/accounting-reports', comingSoon: true },
        ],
      },
    ],
  },
  {
    groupLabel: 'Payroll',
    items: [
      {
        icon: faClipboardList,
        label: 'Payroll',
        href: '/payroll',
        section: 'operations',
        children: [
          { label: 'Overview', href: '/payroll' },
          { label: 'History', href: '/payroll/history' },
        ],
      },
    ],
  },
  {
    groupLabel: 'Loans & charges',
    items: [
      { icon: faHandHoldingDollar, label: 'Loans', href: '/loans', section: 'operations' },
      { icon: faTag, label: 'Charges', href: '/charges', section: 'operations' },
    ],
  },
  {
    groupLabel: 'Assets & accounting',
    items: [
      { icon: faSackDollar, label: 'Asset register', href: '/coming-soon/asset-register', section: 'operations', comingSoon: true },
    ],
  },
  {
    groupLabel: 'Analytics',
    items: [
      { icon: faChartPie, label: 'Analytics & reports', href: '/coming-soon/analytics', section: 'operations', comingSoon: true },
    ],
  },
  {
    groupLabel: 'Organization',
    items: [
      { icon: faDollarSign, label: 'Accounts', href: '/accounts', section: 'operations' },
      { icon: faCog, label: 'Settings', href: '/settings', section: 'operations' },
    ],
  },
];

/** Flattened operations list (for RouteGuard / backward compat). No groups, no 3-level; top-level + first child level only. */
export const OPERATIONS_NAV_ITEMS: NavItem[] = OPERATIONS_NAV_GROUPS.flatMap((g) => g.items);

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

export function isAdminAccount(accountType: string): boolean {
  return (accountType || '').toLowerCase() === ADMIN_ACCOUNT_TYPE;
}

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
