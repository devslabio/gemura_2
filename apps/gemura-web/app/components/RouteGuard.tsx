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

/** Path -> required permission */
const OPERATIONS_PATH_PERMISSION: Record<string, string> = {
  '/dashboard': 'dashboard.view',
  '/sales': 'view_sales',
  '/collections': 'view_collections',
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
  const { hasPermission, isAdmin } = usePermission();
  const accountType = currentAccount?.account_type ?? '';
  const role = (currentAccount?.role ?? '').toLowerCase();
  const accountId = currentAccount?.account_id ?? '';
  const deniedRedirect = role === 'collector' || role === 'agent' ? '/collections' : '/dashboard';

  const pathKey = useMemo(
    () => Object.keys(OPERATIONS_PATH_PERMISSION).find((p) => pathname === p || pathname.startsWith(p + '/')),
    [pathname],
  );
  const requiredPermission = pathKey ? OPERATIONS_PATH_PERMISSION[pathKey] : undefined;
  const needsCheck = Boolean(requiredPermission);
  const [allowed, setAllowed] = useState<boolean | null>(() => (needsCheck ? null : true));
  const prevPathKeyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!pathname) return;
    if (!requiredPermission) {
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
      router.replace('/dashboard');
      return;
    }

    if ((pathname === '/settings' || pathname.startsWith('/settings/')) && (role === 'collector' || role === 'agent' || role === 'accountant')) {
      router.replace(deniedRedirect);
      return;
    }

    if (pathname.startsWith('/accounts') && role === 'accountant') {
      router.replace('/dashboard');
      return;
    }

    if (isBusinessAccount(accountType) && !hasPermission(requiredPermission)) {
      router.replace(deniedRedirect);
      return;
    }
    setAllowed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fixed deps; accountId covers permission changes
  }, [pathname, requiredPermission, accountType, accountId, isAdmin]);

  if (allowed === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return <>{children}</>;
}
