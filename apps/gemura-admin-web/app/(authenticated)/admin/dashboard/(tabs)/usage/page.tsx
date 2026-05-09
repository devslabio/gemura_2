'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

import { adminApi, type UsageDashboardData } from '@/lib/api/admin';
import { useAuthStore } from '@/store/auth';

import StatCard from '@/app/components/StatCard';
import DashboardPanel from '@/app/components/DashboardPanel';
import { DashboardSkeleton } from '@/app/components/SkeletonLoader';
import Icon, {
  faBriefcase,
  faClipboardList,
  faFileAlt,
  faShoppingCart,
  faTruck,
  faUserFriends,
  faUserPlus,
  faUsers,
  faWarehouse,
} from '@/app/components/Icon';

import { useDashboardPeriod } from '../../dashboard-period-context';
import { ADMIN_CHART_COLORS, mergeAdminChartOptions } from '@/lib/dashboard/admin-chart-theme';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const SLATE = { iconBgColor: '#f1f5f9', iconColor: '#475569' };
const BLUE = { iconBgColor: '#eff6ff', iconColor: '#2563eb' };
const TEAL = { iconBgColor: '#ccfbf1', iconColor: '#0f766e' };
const VIOLET = { iconBgColor: '#f5f3ff', iconColor: '#6d28d9' };

export default function AdminDashboardUsagePage() {
  const { currentAccount } = useAuthStore();
  const { dateRange, periodLabel } = useDashboardPeriod();

  const [loading, setLoading] = useState(true);
  const [apiData, setApiData] = useState<UsageDashboardData | null>(null);
  const [error, setError] = useState('');

  const tzOffsetMinutes = useMemo(() => -(typeof window !== 'undefined' ? new Date().getTimezoneOffset() : 0), []);

  const data = apiData;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    adminApi
      .getUsageDashboardStats(currentAccount?.account_id, {
        date_from: dateRange.date_from,
        date_to: dateRange.date_to,
        tz_offset_minutes: tzOffsetMinutes,
      })
      .then((res) => {
        if (cancelled) return;
        if (res.code === 200 && res.data) setApiData(res.data);
        else setError(res.message || 'Failed to load usage metrics');
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg =
            err && typeof err === 'object' && 'response' in err
              ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
              : undefined;
          setError(msg || (err instanceof Error ? err.message : null) || 'Failed to load usage metrics');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentAccount?.account_id, dateRange.date_from, dateRange.date_to, tzOffsetMinutes]);

  const breakdownSlice = useMemo(() => {
    const rows = data?.breakdown ?? [];
    const lastN = 21;
    return rows.length <= lastN ? rows : rows.slice(-lastN);
  }, [data?.breakdown]);

  const hasVolumeData = useMemo(
    () =>
      breakdownSlice.some(
        (d) =>
          d.audit_events > 0 ||
          d.milk_transactions > 0 ||
          d.gate_deliveries > 0 ||
          d.audit_users > 0 ||
          d.milk_operators > 0,
      ),
    [breakdownSlice],
  );

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-sm p-4">
        <p className="text-sm text-amber-900 font-medium">Could not load usage metrics</p>
        <p className="text-sm text-amber-800 mt-1">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const s = data.summary;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active users"
          value={s.users.active_platform_total}
          icon={faUsers}
          {...SLATE}
        />
        <StatCard
          label="Last login in period"
          value={s.users.last_login_in_period}
          icon={faUsers}
          {...BLUE}
        />
        <StatCard
          label="New registrations"
          value={s.users.registered_in_period}
          icon={faUserPlus}
          {...TEAL}
        />
        <StatCard
          label="Audit events"
          value={s.audit.events}
          icon={faClipboardList}
          {...VIOLET}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Milk transactions"
          value={s.milk.transactions}
          icon={faTruck}
          {...TEAL}
        />
        <StatCard
          label="Gate deliveries (MCC)"
          value={s.mcc_gate_deliveries}
          icon={faWarehouse}
          {...BLUE}
        />
        <StatCard
          label="Payroll runs started"
          value={s.payroll_runs_created}
          icon={faBriefcase}
          {...VIOLET}
        />
        <StatCard
          label="New supplier–customer links"
          value={s.supplier_customer_links_created}
          icon={faUserFriends}
          {...SLATE}
        />
        <StatCard
          label="Feed posts"
          value={s.feed_posts_created}
          icon={faFileAlt}
          {...BLUE}
        />
        <StatCard
          label="Inventory sales created"
          value={s.inventory_sales_created}
          icon={faShoppingCart}
          {...TEAL}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DashboardPanel
          title={`Activity volume · ${periodLabel}${
            breakdownSlice.length < (data.breakdown?.length ?? 0) ? ` · ${breakdownSlice.length}d` : ''
          }`}
          leadIcon={faClipboardList}
        >
          {!hasVolumeData ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-gray-500">
              No usage signals in this range.
            </div>
          ) : (
            <Chart
              type="bar"
              height={270}
              options={mergeAdminChartOptions({
                chart: { type: 'bar', stacked: false },
                dataLabels: { enabled: false },
                plotOptions: { bar: { borderRadius: 5, columnWidth: '72%' } },
                colors: [ADMIN_CHART_COLORS.slate, ADMIN_CHART_COLORS.green, ADMIN_CHART_COLORS.blue],
                xaxis: {
                  categories: breakdownSlice.map((d) => d.label || d.date),
                  labels: { rotate: -38, rotateAlways: breakdownSlice.length > 10, style: { fontSize: '10px' } },
                },
                legend: { position: 'top' },
                responsive: [
                  {
                    breakpoint: 768,
                    options: {
                      xaxis: { labels: { rotate: -24, style: { fontSize: '9px' } } },
                      legend: { fontSize: '10px' },
                    },
                  },
                ],
              })}
              series={[
                { name: 'Audit events', data: breakdownSlice.map((d) => d.audit_events) },
                { name: 'Milk txns', data: breakdownSlice.map((d) => d.milk_transactions) },
                { name: 'Gate deliveries', data: breakdownSlice.map((d) => d.gate_deliveries) },
              ]}
            />
          )}
        </DashboardPanel>

        <DashboardPanel
          title={`People intensity · ${periodLabel}${
            breakdownSlice.length < (data.breakdown?.length ?? 0) ? ` · ${breakdownSlice.length}d` : ''
          }`}
          leadIcon={faUsers}
        >
          {!hasVolumeData ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-gray-500">
              No usage signals in this range.
            </div>
          ) : (
            <Chart
              type="area"
              height={270}
              options={mergeAdminChartOptions({
                chart: { type: 'area' },
                dataLabels: { enabled: false },
                stroke: { curve: 'smooth', width: 2 },
                fill: {
                  type: 'gradient',
                  gradient: { shadeIntensity: 1, opacityFrom: 0.48, opacityTo: 0.06, stops: [0, 90, 100] },
                },
                colors: [ADMIN_CHART_COLORS.violet, ADMIN_CHART_COLORS.tealBright],
                xaxis: {
                  categories: breakdownSlice.map((d) => d.label || d.date),
                  labels: { rotate: -38, rotateAlways: breakdownSlice.length > 10, style: { fontSize: '10px' } },
                },
                yaxis: { labels: { formatter: (v: number) => String(Math.round(v)) } },
                legend: { position: 'top' },
                responsive: [
                  {
                    breakpoint: 768,
                    options: {
                      xaxis: { labels: { rotate: -24, style: { fontSize: '9px' } } },
                      yaxis: { labels: { show: false } },
                      legend: { fontSize: '10px' },
                    },
                  },
                ],
              })}
              series={[
                { name: 'Distinct audit users / day', data: breakdownSlice.map((d) => d.audit_users) },
                { name: 'Distinct milk operators / day', data: breakdownSlice.map((d) => d.milk_operators) },
              ]}
            />
          )}
        </DashboardPanel>
      </div>
    </div>
  );
}
