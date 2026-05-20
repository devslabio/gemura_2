'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermission } from '@/hooks/usePermission';

/** Platform operator dashboard — only role `operator`. */
export default function OperatorDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { canViewOperatorDashboard } = usePermission();

  useEffect(() => {
    if (!canViewOperatorDashboard()) {
      router.replace('/dashboard');
    }
  }, [canViewOperatorDashboard, router]);

  if (!canViewOperatorDashboard()) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-gray-500">Redirecting…</p>
      </div>
    );
  }

  return <>{children}</>;
}
