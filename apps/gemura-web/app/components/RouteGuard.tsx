'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { usePermission } from '@/hooks/usePermission';
import {
  isBusinessAccount,
  isAdminRole,
  isExternalSupplier,
  isExternalCustomer,
} from '@/lib/config/nav.config';

/** Path prefix -> user needs this permission */
const OPERATIONS_PATH_PERMISSION: Record<string, string> = {
  '/dashboard': 'dashboard.view',
  '/sales': 'view_sales',
  '/suppliers': 'view_suppliers',
  '/customers': 'view_customers',
  '/inventory': 'view_inventory',
  '/payroll': 'view_analytics',
  '/loans': 'view_analytics',
  '/charges': 'view_analytics',
  '/finance': 'view_analytics',
  '/accounts': 'view_analytics',
  '/analytics': 'view_analytics',
};

/** Path prefix -> user needs at least one of these */
const OPERATIONS_PATH_ANY_PERMISSION: Record<string, string[]> = {
  /** Matches OPERATIONS_NAV_ITEMS for Milk collection / Gate deliveries (gate tab vs records tab handled in-page). */
  '/collections': ['mcc_view_operations', 'mcc_view_own_operations', 'view_collections'],
  '/operations/traceability': ['mcc_view_operations'],
  '/operations/staff': ['mcc_view_operations'],
  '/operations/shifts': ['mcc_view_operations'],
  '/operations': [
    'mcc_view_operations',
    'mcc_view_own_operations',
    'view_collections',
    'mcc_floor_operations',
  ],
};

const FORCE_OPERATIONS_DASHBOARD =
  (process.env.NEXT_PUBLIC_FORCE_OPERATIONS_DASHBOARD || '').toLowerCase() === 'true';

/**
 * Operations paths: only for non-admin accounts; visibility by role/permissions.
 * Does not render children for protected paths until access is confirmed (avoids flicker).
 */
export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentAccount } = useAuthStore();
  const { hasPermission, hasAnyPermission, isAdmin } = usePermission();
  const accountType = currentAccount?.account_type ?? '';
  const role = (currentAccount?.role ?? '').toLowerCase();
  const accountId = currentAccount?.account_id ?? '';
  const isVeterinaryRole = ['veterinary', 'veterinarian', 'veternary', 'agent', 'veterinary_officer'].includes(role);
  const isLimitedOpsRole =
    role === 'agent' ||
    role === 'collector' ||
    role === 'veterinary_officer' ||
    role === 'casual_laborer' ||
    role === 'veterinary' ||
    role === 'veterinarian' ||
    role === 'veternary' ||
    role === 'milkreceptionist' ||
    role === 'milk_receptionist' ||
    role === 'umucunda_a' ||
    role === 'umucunda_b';
  const isLimitedOpsPath = [
    '/dashboard',
    '/sales',
    '/collections',
    '/inventory',
    '/suppliers',
    '/customers',
    '/operations',
  ].some((p) => pathname === p || pathname.startsWith(p + '/'));

  const pathKey = useMemo(() => {
    const keys = [
      ...new Set([...Object.keys(OPERATIONS_PATH_PERMISSION), ...Object.keys(OPERATIONS_PATH_ANY_PERMISSION)]),
    ].sort((a, b) => b.length - a.length);
    return keys.find((p) => pathname === p || pathname.startsWith(p + '/'));
  }, [pathname]);
  const requiredAnyPermission = pathKey ? OPERATIONS_PATH_ANY_PERMISSION[pathKey] : undefined;
  const requiredPermission =
    pathKey && !requiredAnyPermission?.length ? OPERATIONS_PATH_PERMISSION[pathKey] : undefined;
  const needsCheck = Boolean(requiredAnyPermission?.length || requiredPermission);
  const [allowed, setAllowed] = useState<boolean | null>(() => (needsCheck ? null : true));
  const prevPathKeyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!pathname) return;
    if (!requiredPermission && !requiredAnyPermission?.length) {
      setAllowed(true);
      prevPathKeyRef.current = undefined;
      return;
    }
    if (prevPathKeyRef.current !== pathKey) {
      prevPathKeyRef.current = pathKey;
      setAllowed(null);
    }
    if (!accountId) return;
    // Same rule as Sidebar: farm owner/admin are not "portal-only" admins; they use operations routes.
    // FORCE_OPERATIONS_DASHBOARD env flag (from feature/fix) forces all admins to operations too.
    const portalOnlyAdmin =
      isAdmin() && !(isBusinessAccount(accountType) && isAdminRole(role));
    if (portalOnlyAdmin && !FORCE_OPERATIONS_DASHBOARD) {
      router.replace('/admin/dashboard');
      return;
    }
    if (isExternalSupplier(accountType) || isExternalCustomer(accountType)) {
      const externalAllowed = ['/dashboard', '/accounts', '/settings', '/profile', '/supplier'].some(
        (p) => pathname === p || pathname.startsWith(`${p}/`)
      );
      if (!externalAllowed) {
        router.replace('/dashboard');
        return;
      }
      setAllowed(true);
      return;
    }

    if (
      (pathname === '/settings' || pathname.startsWith('/settings/')) &&
      (role === 'collector' || role === 'agent' || role === 'veterinary_officer' || role === 'casual_laborer' || role === 'accountant')
    ) {
      router.replace('/dashboard');
      return;
    }

    if (pathname.startsWith('/accounts') && (role === 'accountant' || isLimitedOpsRole)) {
      router.replace('/dashboard');
      return;
    }

    if (role === 'manager') {
      setAllowed(true);
      return;
    }

    if (role === 'accountant') {
      setAllowed(true);
      return;
    }

    if (isLimitedOpsRole) {
      if (!isLimitedOpsPath) {
        router.replace('/dashboard');
        return;
      }
      const mccCollectionsOrOpsPath =
        pathname === '/operations' ||
        pathname.startsWith('/operations/') ||
        pathname === '/collections' ||
        pathname.startsWith('/collections/');
      if (
        mccCollectionsOrOpsPath &&
        !hasAnyPermission([
          'mcc_view_operations',
          'mcc_view_own_operations',
          'view_collections',
          'mcc_floor_operations',
        ])
      ) {
        router.replace('/dashboard');
        return;
      }
      // Stricter sub-routes (traceability, staff, shifts): full MCC ops only — scoped Umucunda must not bypass via /operations wildcard.
      const pathSpecificAny =
        pathKey && pathKey !== '/operations'
          ? OPERATIONS_PATH_ANY_PERMISSION[pathKey]
          : undefined;
      if (pathSpecificAny?.length) {
        if (isBusinessAccount(accountType) && !hasAnyPermission(pathSpecificAny)) {
          router.replace('/dashboard');
          return;
        }
      }
      setAllowed(true);
      return;
    }

    // Veterinary users are allowed to access dashboard even without explicit dashboard.view.
    if (pathname === '/dashboard' && isVeterinaryRole) {
      setAllowed(true);
      return;
    }

    if (requiredAnyPermission?.length) {
      if (isBusinessAccount(accountType) && !hasAnyPermission(requiredAnyPermission)) {
        router.replace('/dashboard');
        return;
      }
    } else if (requiredPermission) {
      if (isBusinessAccount(accountType) && !hasPermission(requiredPermission)) {
        router.replace('/dashboard');
        return;
      }
    }
    setAllowed(true);
  }, [
    pathname,
    pathKey,
    requiredPermission,
    requiredAnyPermission,
    accountType,
    accountId,
    isAdmin,
    hasPermission,
    hasAnyPermission,
  ]);

  if (allowed === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return <>{children}</>;
}
