'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { usePermission } from '@/hooks/usePermission';
import {
  isBusinessAccount,
  isExternalSupplier,
  isExternalCustomer,
} from '@/lib/config/nav.config';

/** Path -> required permission */
const OPERATIONS_PATH_PERMISSION: Record<string, string> = {
  '/sales': 'view_sales',
  '/collections': 'view_collections',
  '/suppliers': 'view_suppliers',
  '/customers': 'view_customers',
  '/inventory': 'view_inventory',
  '/analytics': 'view_analytics',
};

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
  const accountId = currentAccount?.account_id ?? '';

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
    if (isAdmin()) {
      router.replace('/admin/dashboard');
      return;
    }
    if (isExternalSupplier(accountType) || isExternalCustomer(accountType)) {
      router.replace('/dashboard');
      return;
    }
    if (isBusinessAccount(accountType) && !hasPermission(requiredPermission)) {
      router.replace('/dashboard');
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
