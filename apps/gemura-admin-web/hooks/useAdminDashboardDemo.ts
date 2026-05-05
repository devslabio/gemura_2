'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

export function useAdminDashboardDemo(): boolean {
  const searchParams = useSearchParams();

  return useMemo(() => {
    if (process.env.NEXT_PUBLIC_ADMIN_DASHBOARD_DEMO === 'true') return true;
    const raw = searchParams.get('demo');
    return raw === '1' || raw === 'true';
  }, [searchParams]);
}
