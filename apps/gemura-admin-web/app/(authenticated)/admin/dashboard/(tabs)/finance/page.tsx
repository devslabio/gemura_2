'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

import { adminApi, type FinanceDashboardData } from '@/lib/api/admin';
import { useAuthStore } from '@/store/auth';

import StatCard from '@/app/components/StatCard';
import DashboardPanel from '@/app/components/DashboardPanel';
import { DashboardSkeleton } from '@/app/components/SkeletonLoader';
import Icon, {
  faBriefcase,
  faChartLine,
  faCreditCard,
  faHandHoldingDollar,
  faReceipt,
  faWallet,
} from '@/app/components/Icon';

import { useDashboardPeriod } from '../../dashboard-period-context';
import { ADMIN_CHART_COLORS, mergeAdminChartOptions } from '@/lib/dashboard/admin-chart-theme';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const TEAL = { iconBgColor: '#ccfbf1', iconColor: '#0f766e' };
const BLUE = { iconBgColor: '#eff6ff', iconColor: '#2563eb' };
const VIOLET = { iconBgColor: '#f5f3ff', iconColor: '#6d28d9' };
const AMBER = { iconBgColor: '#fffbeb', iconColor: '#b45309' };

export default function AdminDashboardFinancePage() {
  const { currentAccount } = useAuthStore();
  const { dateRange, periodLabel } = useDashboardPeriod();

  const [loading, setLoading] = useState(true);
  const [apiData, setApiData] = useState<FinanceDashboardData | null>(null);
  const [error, setError] = useState('');

  const tzOffsetMinutes = useMemo(() => -(typeof window !== 'undefined' ? new Date().getTimezoneOffset() : 0), []);

  const data = apiData;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    adminApi
      .getFinanceDashboardStats(currentAccount?.account_id, {
        date_from: dateRange.date_from,
        date_to: dateRange.date_to,
        tz_offset_minutes: tzOffsetMinutes,
      })
      .then((res) => {
        if (cancelled) return;
        if (res.code === 200 && res.data) setApiData(res.data);
        else setError(res.message || 'Failed to load finance dashboard');
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg =
            err && typeof err === 'object' && 'response' in err
              ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
              : undefined;
          setError(msg || (err instanceof Error ? err.message : null) || 'Failed to load finance dashboard');
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

  const hasFlowData = useMemo(
    () =>
      breakdownSlice.some(
        (d) =>
          Number(d.disbursements) > 0 ||
          Number(d.repayments) > 0 ||
          Number(d.payroll) > 0 ||
          Number(d.inventory_sales) > 0,
      ),
    [breakdownSlice],
  );

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-sm p-4">
        <p className="text-sm text-amber-900 font-medium">Could not load finance metrics</p>
        <p className="text-sm text-amber-800 mt-1">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { summary } = data;
  const showStatusDonut = data.loans_by_status.length > 0 && data.loans_by_status.some((s) => s.count > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Loan disbursements"
          value={formatCurrency(summary.disbursements.amount)}
          icon={faWallet}
          {...TEAL}
        />
        <StatCard
          label="Loan repayments"
          value={formatCurrency(summary.repayments.amount)}
          icon={faHandHoldingDollar}
          {...BLUE}
        />
        <StatCard
          label="Payroll (completed)"
          value={formatCurrency(summary.payroll.amount)}
          icon={faBriefcase}
          {...VIOLET}
        />
        <StatCard
          label="Milk payments recorded"
          value={formatCurrency(summary.milk_payments_recorded.amount)}
          icon={faReceipt}
          {...TEAL}
        />
        <StatCard
          label="Inventory sales"
          value={formatCurrency(summary.inventory_sales.amount)}
          icon={faCreditCard}
          {...AMBER}
        />
        <StatCard
          label="Active loan book"
          value={formatCurrency(summary.portfolio_active.principal_outstanding)}
          icon={faChartLine}
          {...BLUE}
        />
      </div>

      <DashboardPanel
        title={`Daily flows (RF) · ${periodLabel}${
          breakdownSlice.length < (data.breakdown?.length ?? 0) ? ` · ${breakdownSlice.length}d` : ''
        }`}
        leadIcon={faWallet}
      >
        {!hasFlowData ? (
          <div className="flex h-[270px] items-center justify-center text-sm text-gray-500">
            No finance movements in this range.
          </div>
        ) : (
          <Chart
            type="bar"
            height={270}
            options={mergeAdminChartOptions({
              chart: { type: 'bar', stacked: false },
              dataLabels: { enabled: false },
              plotOptions: { bar: { borderRadius: 5, columnWidth: '72%' } },
              colors: [
                ADMIN_CHART_COLORS.teal,
                ADMIN_CHART_COLORS.blue,
                ADMIN_CHART_COLORS.violet,
                ADMIN_CHART_COLORS.amber,
              ],
              xaxis: {
                categories: breakdownSlice.map((d) => d.label || d.date),
                labels: { rotate: -38, rotateAlways: breakdownSlice.length > 10, style: { fontSize: '10px' } },
              },
              yaxis: {
                labels: {
                  formatter: (v: number) =>
                    new Intl.NumberFormat('en-RW', { notation: 'compact', maximumFractionDigits: 1 }).format(v),
                },
              },
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
              tooltip: {
                y: {
                  formatter: (v: number) => formatCurrency(v),
                },
              },
            })}
            series={[
              { name: 'Disbursements', data: breakdownSlice.map((d) => Number(d.disbursements ?? 0)) },
              { name: 'Repayments', data: breakdownSlice.map((d) => Number(d.repayments ?? 0)) },
              { name: 'Payroll', data: breakdownSlice.map((d) => Number(d.payroll ?? 0)) },
              { name: 'Inventory sales', data: breakdownSlice.map((d) => Number(d.inventory_sales ?? 0)) },
            ]}
          />
        )}
      </DashboardPanel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {showStatusDonut && (
          <DashboardPanel title="Loan status">
            <Chart
              type="donut"
              height={260}
              options={mergeAdminChartOptions({
                chart: { type: 'donut' },
                labels: data.loans_by_status.map((s) =>
                  s.status.charAt(0).toUpperCase() + s.status.slice(1),
                ),
                colors: [
                  ADMIN_CHART_COLORS.green,
                  ADMIN_CHART_COLORS.gray500,
                  ADMIN_CHART_COLORS.amber,
                  ADMIN_CHART_COLORS.danger,
                ],
                legend: { position: 'bottom' },
                dataLabels: { enabled: true, formatter: (val: number) => `${Math.round(val)}%` },
                plotOptions: {
                  pie: {
                    donut: {
                      size: '65%',
                      labels: {
                        show: true,
                        total: {
                          show: true,
                          label: 'Loans',
                          formatter: () =>
                            String(data.loans_by_status.reduce((a, s) => a + s.count, 0)),
                        },
                      },
                    },
                  },
                },
                responsive: [
                  {
                    breakpoint: 768,
                    options: {
                      legend: { fontSize: '10px' },
                      plotOptions: { pie: { donut: { size: '58%' } } },
                    },
                  },
                ],
              })}
              series={data.loans_by_status.map((s) => s.count)}
            />
          </DashboardPanel>
        )}

        {data.recent_disbursements.length > 0 && (
          <DashboardPanel
            className={!showStatusDonut ? 'lg:col-span-2' : ''}
            title="Recent disbursements"
          >
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80">
                    <th className="px-2 py-2 text-left font-medium text-gray-700">Date</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-700">Borrower</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-700">Lender</th>
                    <th className="px-2 py-2 text-right font-medium text-gray-700">Principal</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_disbursements.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 transition-colors hover:bg-gray-50/90">
                      <td className="whitespace-nowrap px-2 py-2 text-gray-600">
                        {new Date(row.disbursement_date).toLocaleDateString()}
                      </td>
                      <td className="px-2 py-2 text-gray-900">{row.borrower_label}</td>
                      <td className="px-2 py-2 text-gray-600">{row.lender_name ?? '—'}</td>
                      <td className="px-2 py-2 text-right font-medium tabular-nums text-gray-900">
                        {formatCurrency(row.principal)}
                      </td>
                      <td className="px-2 py-2">
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DashboardPanel>
        )}
      </div>
    </div>
  );
}
