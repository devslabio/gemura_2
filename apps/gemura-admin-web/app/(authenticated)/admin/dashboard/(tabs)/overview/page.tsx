'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { adminApi, type DashboardStats, type FinanceDashboardData, type UsageDashboardData } from '@/lib/api/admin';
import { useAuthStore } from '@/store/auth';

import { DashboardSkeleton } from '@/app/components/SkeletonLoader';
import SystemAdminOverview from '../../SystemAdminOverview';

import { useDashboardPeriod } from '../../dashboard-period-context';

function AdminDashboardOverviewContent() {
  const { currentAccount } = useAuthStore();
  const { dateRange, periodLabel } = useDashboardPeriod();
  const searchParams = useSearchParams();
  const tzOffsetMinutes = useMemo(() => -(typeof window !== 'undefined' ? new Date().getTimezoneOffset() : 0), []);

  const querySuffix = useMemo(() => {
    const p = new URLSearchParams(searchParams.toString());
    if (dateRange.date_from) p.set('date_from', dateRange.date_from);
    if (dateRange.date_to) p.set('date_to', dateRange.date_to);
    p.set('tz_offset_minutes', String(tzOffsetMinutes));
    const s = p.toString();
    return s ? `?${s}` : '';
  }, [searchParams, dateRange.date_from, dateRange.date_to, tzOffsetMinutes]);

  const [loading, setLoading] = useState(true);
  const [apiStats, setApiStats] = useState<DashboardStats | null>(null);
  const [financeData, setFinanceData] = useState<FinanceDashboardData | null>(null);
  const [usageData, setUsageData] = useState<UsageDashboardData | null>(null);
  const [error, setError] = useState('');

  const stats = apiStats;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    const q = {
      date_from: dateRange.date_from,
      date_to: dateRange.date_to,
      tz_offset_minutes: tzOffsetMinutes,
    };

    adminApi
      .getDashboardStats(currentAccount?.account_id, q)
      .then((res) => {
        if (cancelled) return;
        if (res.code === 200 && res.data) setApiStats(res.data);
        else setError('Failed to load dashboard');
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg =
            err && typeof err === 'object' && 'response' in err
              ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
              : undefined;
          setError(msg || (err instanceof Error ? err.message : null) || 'Failed to load dashboard');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentAccount?.account_id, dateRange.date_from, dateRange.date_to, tzOffsetMinutes]);

  useEffect(() => {
    let cancelled = false;
    const q = {
      date_from: dateRange.date_from,
      date_to: dateRange.date_to,
      tz_offset_minutes: tzOffsetMinutes,
    };

    Promise.all([
      adminApi.getFinanceDashboardStats(currentAccount?.account_id, q),
      adminApi.getUsageDashboardStats(currentAccount?.account_id, q),
    ])
      .then(([fr, ur]) => {
        if (cancelled) return;
        setFinanceData(fr.code === 200 && fr.data ? fr.data : null);
        setUsageData(ur.code === 200 && ur.data ? ur.data : null);
      })
      .catch(() => {
        if (!cancelled) {
          setFinanceData(null);
          setUsageData(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentAccount?.account_id, dateRange.date_from, dateRange.date_to, tzOffsetMinutes]);

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-sm border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
        <Link href="/admin/users" className="btn btn-secondary">
          Back to Users
        </Link>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-3">
      <SystemAdminOverview
        periodLabel={periodLabel}
        querySuffix={querySuffix}
        stats={stats}
        finance={financeData}
        usage={usageData}
      />
    </div>
  );
}

export default function AdminDashboardOverviewPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <AdminDashboardOverviewContent />
    </Suspense>
  );
}
