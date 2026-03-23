'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermission } from '@/hooks/usePermission';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { canManageUsers, isAdmin, canViewDashboard } = usePermission();
  const allowed = canViewDashboard() || canManageUsers() || isAdmin();

  useEffect(() => {
    if (!allowed) router.replace('/dashboard');
  }, [allowed, router]);

  if (!allowed) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-gray-500">Redirecting...</p>
      </div>
    );
  }

  return <>{children}</>;
}

