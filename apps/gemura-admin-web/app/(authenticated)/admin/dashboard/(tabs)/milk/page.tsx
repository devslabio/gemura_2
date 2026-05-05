'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

import { statsApi, type StatsOverviewData } from '@/lib/api/stats';
import { useAuthStore } from '@/store/auth';

import StatCard from '@/app/components/StatCard';
import { DashboardSkeleton } from '@/app/components/SkeletonLoader';
import Icon, { faHandHoldingDollar, faReceipt, faTruck, faUserFriends } from '@/app/components/Icon';

import { useDashboardPeriod } from '../../dashboard-period-context';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const PURPLE_ICON = { iconBgColor: '#f5f3ff', iconColor: '#6d28d9' };
const GREEN_ICON = { iconBgColor: '#dcfce7', iconColor: '#059669' };
const BLUE_ICON = { iconBgColor: '#eff6ff', iconColor: '#1d4ed8' };

export default function AdminDashboardMilkPage() {
  const { currentAccount } = useAuthStore();
  const { dateRange, periodLabel } = useDashboardPeriod();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StatsOverviewData | null>(null);
  const [error, setError] = useState('');

  const tzOffsetMinutes = useMemo(() => -(typeof window !== 'undefined' ? new Date().getTimezoneOffset() : 0), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    const body = {
      account_id: currentAccount?.account_id,
      date_from: dateRange.date_from,
      date_to: dateRange.date_to,
      tz_offset_minutes: tzOffsetMinutes,
    };

    statsApi
      .postOverview(body)
      .then((res) => {
        if (cancelled) return;
        if (res.code === 200 && res.data) setData(res.data);
        else setError(res.message || 'Failed to load milk overview');
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg =
            err && typeof err === 'object' && 'response' in err
              ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
              : undefined;
          setError(msg || (err instanceof Error ? err.message : null) || 'Failed to load milk overview');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentAccount?.account_id, dateRange.date_from, dateRange.date_to, tzOffsetMinutes]);

  const formatCurrency = (amount: number) => {
    return `RF ${new Intl.NumberFormat('en-RW', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)}`;
  };

  const breakdownSlice = useMemo(() => {
    const rows = data?.breakdown ?? [];
    const lastN = 21;
    return rows.length <= lastN ? rows : rows.slice(-lastN);
  }, [data?.breakdown]);

  const hasMixData = useMemo(
    () =>
      breakdownSlice.some(
        (d) => Number(d.collection?.liters || 0) > 0 || Number(d.sales?.liters || 0) > 0,
      ),
    [breakdownSlice],
  );

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-sm p-4">
        <p className="text-sm text-amber-900 font-medium">Could not load milk & collections</p>
        <p className="text-sm text-amber-800 mt-1">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { summary } = data;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Milk sales and collections for the default account, scoped to <span className="font-medium text-gray-800">{periodLabel}</span>{' '}
        ({data.date_range?.from ?? dateRange.date_from} → {data.date_range?.to ?? dateRange.date_to}). Supplier/customer counts reflect
        relationships (not restricted to this window).
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Collections"
          value={`${Math.round(summary.collection.liters)} L`}
          subtitle={`${formatCurrency(summary.collection.value)} · ${summary.collection.transactions} txns · ${periodLabel}`}
          icon={faHandHoldingDollar}
          {...GREEN_ICON}
        />
        <StatCard
          label="Sales"
          value={`${Math.round(summary.sales.liters)} L`}
          subtitle={`${formatCurrency(summary.sales.value)} · ${summary.sales.transactions} txns · ${periodLabel}`}
          icon={faReceipt}
          {...BLUE_ICON}
        />
        <StatCard
          label="Suppliers"
          value={summary.suppliers.active + summary.suppliers.inactive}
          subtitle={`${summary.suppliers.active} active · ${summary.suppliers.inactive} inactive`}
          icon={faTruck}
          {...PURPLE_ICON}
        />
        <StatCard
          label="Customers"
          value={summary.customers.active + summary.customers.inactive}
          subtitle={`${summary.customers.active} active · ${summary.customers.inactive} inactive`}
          icon={faUserFriends}
          {...PURPLE_ICON}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-sm p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Icon icon={faHandHoldingDollar} size="sm" className="text-[var(--primary)]" />
          Daily liters — collections vs sales ({periodLabel}
          {breakdownSlice.length < (data.breakdown?.length ?? 0) ? ` · last ${breakdownSlice.length} buckets` : ''})
        </h3>
        {!hasMixData ? (
          <div className="h-[300px] flex items-center justify-center text-gray-500 text-sm">
            No milk movements in this range.
          </div>
        ) : (
          <Chart
            type="bar"
            height={300}
            options={{
              chart: { type: 'bar', toolbar: { show: false }, stacked: false },
              plotOptions: { bar: { borderRadius: 4, columnWidth: '70%' } },
              colors: ['#059669', '#2563eb'],
              xaxis: {
                categories: breakdownSlice.map((d) => d.label || d.date),
                labels: { rotate: -45, rotateAlways: breakdownSlice.length > 10 },
              },
              yaxis: { title: { text: 'Liters' }, labels: { formatter: (v: number) => String(Math.round(v)) } },
              legend: { position: 'top', fontSize: '12px' },
              dataLabels: { enabled: false },
              grid: { strokeDashArray: 3 },
              tooltip: { y: { formatter: (v: number) => `${Math.round(v)} L` } },
            }}
            series={[
              { name: 'Collections (L)', data: breakdownSlice.map((d) => Number(d.collection?.liters ?? 0)) },
              { name: 'Sales (L)', data: breakdownSlice.map((d) => Number(d.sales?.liters ?? 0)) },
            ]}
          />
        )}
      </div>
    </div>
  );
}
