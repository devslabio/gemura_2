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
    if (PermissionService.canViewDashboard() || PermissionService.isAdmin()) {
      router.replace('/admin/dashboard');
    }
  }, [hasHydrated, router]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
      <p className="text-sm text-gray-600">
        If you have <span className="font-medium">dashboard.view</span> permission, the admin dashboard is at{' '}
        <span className="font-medium">/admin/dashboard</span>.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/dashboard" className="btn btn-primary">
          Admin Dashboard
        </Link>
        <Link href="/admin/users" className="btn btn-secondary">
          Users
        </Link>
      </div>
    </div>
  );
}

