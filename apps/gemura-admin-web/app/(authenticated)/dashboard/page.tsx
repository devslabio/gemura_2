'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { PermissionService } from '@/lib/services/permission.service';
import { useAuthHydrated } from '@/store/auth';

export default function AdminDashboardPlaceholder() {
  const router = useRouter();
  const hasHydrated = useAuthHydrated();

  useEffect(() => {
    if (!hasHydrated) return;

    // The admin layout can redirect to `/dashboard` before permissions are available.
    // Once auth state is hydrated, send authorized users to the real dashboard.
    if (PermissionService.canViewOperatorDashboard()) {
      router.replace('/admin/operator');
    } else if (PermissionService.canViewSystemAdminDashboard() || PermissionService.isAdmin()) {
      router.replace('/admin/dashboard/overview');
    }
  }, [hasHydrated, router]);

  const isOperator = PermissionService.isPlatformOperator();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
      <p className="text-sm text-gray-600">
        {isOperator
          ? 'Opening your platform operator overview…'
          : 'If you have dashboard access, you will be redirected to the appropriate admin home.'}
      </p>
      <div className="flex flex-wrap gap-2">
        {isOperator ? (
          <Link href="/admin/operator" className="btn btn-primary">
            Platform operator dashboard
          </Link>
        ) : (
          <>
            <Link href="/admin/dashboard/overview" className="btn btn-primary">
              Admin dashboard
            </Link>
            <Link href="/admin/users" className="btn btn-secondary">
              Users
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

