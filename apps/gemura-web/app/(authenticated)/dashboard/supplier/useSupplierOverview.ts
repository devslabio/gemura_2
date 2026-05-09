'use client';

import { useEffect, useState, useMemo } from 'react';
import { statsApi, type OverviewResponse } from '@/lib/api/stats';
import { type PeriodKey, getPeriodRange } from '@/lib/utils/dashboardPeriod';

export function useSupplierOverview(
  accountId: string | undefined,
  period: PeriodKey,
  customFrom: string,
  customTo: string,
  refreshKey: number
) {
  const dateRange = useMemo(
    () => getPeriodRange(period, customFrom || undefined, customTo || undefined),
    [period, customFrom, customTo]
  );

  const [loading, setLoading] = useState(!!accountId);
  const [data, setData] = useState<OverviewResponse['data'] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!accountId) {
      setLoading(false);
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    statsApi
      .getOverview(accountId, {
        date_from: dateRange.date_from,
        date_to: dateRange.date_to,
      })
      .then((res) => {
        if (cancelled) return;
        if (res.code === 200 && res.data) setData(res.data);
        else setError(res.message || 'Failed to load');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg =
          (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
          (err as { message?: string })?.message ||
          'Failed to load';
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, dateRange.date_from, dateRange.date_to, refreshKey]);

  return { loading, data, error, dateRange };
}

export function formatSupplierCurrency(amount: number) {
  const n = Number(amount);
  if (Number.isNaN(n)) return 'RF 0';
  return `RF ${new Intl.NumberFormat('en-RW', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)}`;
}
