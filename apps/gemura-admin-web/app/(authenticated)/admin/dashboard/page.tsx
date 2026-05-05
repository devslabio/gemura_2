'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { DashboardSkeleton } from '@/app/components/SkeletonLoader';

function RedirectToOverview() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams.toString();
    router.replace(`/admin/dashboard/overview${q ? `?${q}` : ''}`);
  }, [router, searchParams]);

  return <DashboardSkeleton />;
}

export default function AdminDashboardIndexPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <RedirectToOverview />
    </Suspense>
  );
}
