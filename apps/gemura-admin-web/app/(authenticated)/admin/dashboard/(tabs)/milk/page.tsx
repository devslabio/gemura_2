'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

import { statsApi, type StatsOverviewData } from '@/lib/api/stats';

import StatCard from '@/app/components/StatCard';
import DashboardPanel from '@/app/components/DashboardPanel';
import { DashboardSkeleton } from '@/app/components/SkeletonLoader';
import Icon, { faHandHoldingDollar, faTriangleExclamation, faTruck, faUserFriends } from '@/app/components/Icon';

import { useDashboardPeriod } from '../../dashboard-period-context';
import { ADMIN_CHART_COLORS, mergeAdminChartOptions } from '@/lib/dashboard/admin-chart-theme';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const PURPLE_ICON = { iconBgColor: '#f5f3ff', iconColor: '#6d28d9' };
const GREEN_ICON = { iconBgColor: '#dcfce7', iconColor: '#059669' };
const RED_ICON = { iconBgColor: '#fef2f2', iconColor: '#dc2626' };

export default function AdminDashboardMilkPage() {
  const { dateRange, periodLabel } = useDashboardPeriod();

  const [loading, setLoading] = useState(true);
  const [apiData, setApiData] = useState<StatsOverviewData | null>(null);
  const [error, setError] = useState('');
  const data = apiData;

  const tzOffsetMinutes = useMemo(() => -(typeof window !== 'undefined' ? new Date().getTimezoneOffset() : 0), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    const body = {
      aggregate_all_accounts: true,
      date_from: dateRange.date_from,
      date_to: dateRange.date_to,
      tz_offset_minutes: tzOffsetMinutes,
    };

    statsApi
      .postOverview(body)
      .then((res) => {
        if (cancelled) return;
        if (res.code === 200 && res.data) setApiData(res.data);
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
  }, [dateRange.date_from, dateRange.date_to, tzOffsetMinutes]);

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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Collections"
          value={`${Math.round(summary.collection.liters)} L`}
          icon={faHandHoldingDollar}
          {...GREEN_ICON}
        />
        <StatCard
          label="Rejections"
          value={`${Math.round(summary.rejections.liters)} L`}
          icon={faTriangleExclamation}
          {...RED_ICON}
        />
        <StatCard
          label="Suppliers"
          value={summary.suppliers.active + summary.suppliers.inactive}
          icon={faTruck}
          {...PURPLE_ICON}
        />
        <StatCard
          label="Customers"
          value={summary.customers.active + summary.customers.inactive}
          icon={faUserFriends}
          {...PURPLE_ICON}
        />
      </div>

      <DashboardPanel
        title={`Collections vs sales (L) · ${periodLabel}${
          breakdownSlice.length < (data.breakdown?.length ?? 0) ? ` · ${breakdownSlice.length}d` : ''
        }`}
        leadIcon={faHandHoldingDollar}
      >
        {!hasMixData ? (
          <div className="flex h-[270px] items-center justify-center text-sm text-gray-500">
            No milk movements in this range.
          </div>
        ) : (
          <Chart
            type="bar"
            height={270}
            options={mergeAdminChartOptions({
              chart: { type: 'bar', stacked: false },
              dataLabels: { enabled: false },
              plotOptions: { bar: { borderRadius: 5, columnWidth: '70%' } },
              colors: [ADMIN_CHART_COLORS.green, ADMIN_CHART_COLORS.blue],
              xaxis: {
                categories: breakdownSlice.map((d) => d.label || d.date),
                labels: { rotate: -38, rotateAlways: breakdownSlice.length > 10, style: { fontSize: '10px' } },
              },
              yaxis: {
                title: { text: 'Liters', style: { fontSize: '11px', fontWeight: 600, color: '#6b7280' } },
                labels: { formatter: (v: number) => String(Math.round(v)) },
              },
              legend: { position: 'top' },
              responsive: [
                {
                  breakpoint: 768,
                  options: {
                    xaxis: { labels: { rotate: -24, style: { fontSize: '9px' } } },
                    yaxis: { labels: { show: false }, title: { text: '' } },
                    legend: { fontSize: '10px' },
                  },
                },
              ],
              tooltip: { y: { formatter: (v: number) => `${Math.round(v)} L` } },
            })}
            series={[
              { name: 'Collections (L)', data: breakdownSlice.map((d) => Number(d.collection?.liters ?? 0)) },
              { name: 'Sales (L)', data: breakdownSlice.map((d) => Number(d.sales?.liters ?? 0)) },
            ]}
          />
        )}
      </DashboardPanel>
    </div>
  );
}
