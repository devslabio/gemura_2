'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PermissionService } from '@/lib/services/permission.service';

export default function AdminRootPage() {
  const router = useRouter();
  useEffect(() => {
    if (PermissionService.canViewOperatorDashboard()) {
      router.replace('/admin/operator');
    } else if (PermissionService.canViewSystemAdminDashboard() || PermissionService.isAdmin()) {
      router.replace('/admin/dashboard/overview');
    } else if (PermissionService.canManageUsers()) {
      router.replace('/admin/users');
    } else {
      router.replace('/dashboard');
    }
  }, [router]);
  return null;
}

