'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermission } from '@/hooks/usePermission';

/**
 * Admin portal gate:
 * - Requires at least `dashboard.view` (for admin overview) or `manage_users` (for users/roles/permissions).
 * - Owner/admin roles bypass via backend permission logic.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { canManageUsers, isAdmin, canViewDashboard } = usePermission();

  const allowed = canViewDashboard() || canManageUsers() || isAdmin();

  useEffect(() => {
    if (!allowed) router.replace('/dashboard');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  if (!allowed) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-gray-500">Redirecting...</p>
      </div>
    );
  }

  return <>{children}</>;
}
