'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBuilding,
  faChartLine,
  faClipboardList,
  faDroplet,
  faHandHoldingDollar,
  faHeartPulse,
  faStore,
  faTriangleExclamation,
  faTruck,
  faUsers,
  faWallet,
} from '@fortawesome/free-solid-svg-icons';
import Icon from '@/app/components/Icon';
import DashboardPanel from '@/app/components/DashboardPanel';
import { DashboardSkeleton } from '@/app/components/SkeletonLoader';
import { ADMIN_CHART_COLORS, mergeAdminChartOptions } from '@/lib/dashboard/admin-chart-theme';
import { useDashboardPeriod } from '@/app/(authenticated)/admin/dashboard/dashboard-period-context';
import AdminPagePeriodBar from '@/app/components/AdminPagePeriodBar';
import { adminApi, type DashboardStats, type FinanceDashboardData, type UsageDashboardData } from '@/lib/api/admin';
import { useAuthStore } from '@/store/auth';
import { buildOperatorDashboardFromLive } from '@/lib/dashboard/operator-dashboard-live-data';
import { getPreviousPeriodRange } from '@/lib/dashboard/period-url';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const KPI_TILE =
  'rounded-sm border border-gray-200 bg-white p-3 min-h-[96px] hover:border-gray-300 transition-colors sm:p-3.5';

const KPI_VISUAL: Record<string, { icon: IconDefinition; iconBg: string; iconFg: string }> = {
  mccs: { icon: faBuilding, iconBg: '#eff6ff', iconFg: '#004AAD' },
  farmers: { icon: faUsers, iconBg: '#dcfce7', iconFg: '#059669' },
  collectors: { icon: faTruck, iconBg: '#f5f3ff', iconFg: '#6d28d9' },
  suppliers: { icon: faStore, iconBg: '#fef3c7', iconFg: '#b45309' },
  litres: { icon: faDroplet, iconBg: '#e0f2fe', iconFg: '#0369a1' },
  rejection: { icon: faTriangleExclamation, iconBg: '#fef2f2', iconFg: '#dc2626' },
  rejected_litres: { icon: faDroplet, iconBg: '#fee2e2', iconFg: '#b91c1c' },
  payments: { icon: faWallet, iconBg: '#ecfdf5', iconFg: '#047857' },
  gate_deliveries: { icon: faClipboardList, iconBg: '#ede9fe', iconFg: '#5b21b6' },
  loans: { icon: faHandHoldingDollar, iconBg: '#fff7ed', iconFg: '#c2410c' },
};

function TrendBadge({ text, up }: { text: string; up?: boolean }) {
  if (!text) return null;
  const positive = up !== false;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
        positive ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'
      }`}
    >
      {text}
    </span>
  );
}

function SummaryList({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="space-y-2.5">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start justify-between gap-3 text-sm">
          <dt className="text-gray-600">{row.label}</dt>
          <dd className="font-semibold tabular-nums text-gray-900 text-right">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-gray-500">{children}</p>;
}

function apiErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
    if (msg) return msg;
  }
  if (err instanceof Error) return err.message;
  return 'Failed to load dashboard';
}

export default function PlatformOperatorDashboard() {
  const { currentAccount } = useAuthStore();
  const { period, customFrom, customTo, dateRange } = useDashboardPeriod();
  const tzOffsetMinutes = useMemo(
    () => -(typeof window !== 'undefined' ? new Date().getTimezoneOffset() : 0),
    [],
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [finance, setFinance] = useState<FinanceDashboardData | null>(null);
  const [usage, setUsage] = useState<UsageDashboardData | null>(null);
  const [priorStats, setPriorStats] = useState<DashboardStats | null>(null);
  const [priorFinance, setPriorFinance] = useState<FinanceDashboardData | null>(null);
  const [priorUsage, setPriorUsage] = useState<UsageDashboardData | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    const priorRange = getPreviousPeriodRange(period, customFrom, customTo);
    const q = {
      date_from: dateRange.date_from,
      date_to: dateRange.date_to,
      tz_offset_minutes: tzOffsetMinutes,
    };
    const priorQ = {
      date_from: priorRange.date_from,
      date_to: priorRange.date_to,
      tz_offset_minutes: tzOffsetMinutes,
    };
    const accountId = currentAccount?.account_id;

    Promise.all([
      adminApi.getDashboardStats(accountId, q),
      adminApi.getFinanceDashboardStats(accountId, q),
      adminApi.getUsageDashboardStats(accountId, q),
      adminApi.getDashboardStats(accountId, priorQ),
      adminApi.getFinanceDashboardStats(accountId, priorQ),
      adminApi.getUsageDashboardStats(accountId, priorQ),
    ])
      .then(([statsRes, financeRes, usageRes, priorStatsRes, priorFinanceRes, priorUsageRes]) => {
        if (cancelled) return;
        if (statsRes.code === 200 && statsRes.data) {
          setStats(statsRes.data);
        } else {
          setStats(null);
          setError(statsRes.message || 'Failed to load dashboard stats');
        }

        setFinance(financeRes.code === 200 && financeRes.data ? financeRes.data : null);
        setUsage(usageRes.code === 200 && usageRes.data ? usageRes.data : null);
        setPriorStats(priorStatsRes.code === 200 && priorStatsRes.data ? priorStatsRes.data : null);
        setPriorFinance(priorFinanceRes.code === 200 && priorFinanceRes.data ? priorFinanceRes.data : null);
        setPriorUsage(priorUsageRes.code === 200 && priorUsageRes.data ? priorUsageRes.data : null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(apiErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    currentAccount?.account_id,
    dateRange.date_from,
    dateRange.date_to,
    period,
    customFrom,
    customTo,
    tzOffsetMinutes,
    reloadKey,
  ]);

  const m = useMemo(
    () =>
      buildOperatorDashboardFromLive(
        period,
        customFrom,
        customTo,
        stats,
        finance,
        usage,
        priorStats,
        priorFinance,
        priorUsage,
      ),
    [period, customFrom, customTo, stats, finance, usage, priorStats, priorFinance, priorUsage],
  );

  const collectionsChart = useMemo(
    () =>
      mergeAdminChartOptions({
        chart: { type: 'bar', toolbar: { show: false } },
        plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
        colors: [ADMIN_CHART_COLORS.primary],
        dataLabels: { enabled: false },
        xaxis: { categories: m.collectionsTrend.categories },
        yaxis: {
          labels: {
            formatter: (v: number) =>
              new Intl.NumberFormat('en-RW', { notation: 'compact', maximumFractionDigits: 1 }).format(v),
          },
        },
        tooltip: {
          y: {
            formatter: (v: number) => `${new Intl.NumberFormat('en-RW').format(Math.round(v))} L`,
          },
        },
      }),
    [m.collectionsTrend.categories, m.collectionsTrend.litres],
  );

  const deliveryDonut = useMemo(
    () =>
      mergeAdminChartOptions({
        chart: { type: 'donut' },
        labels: m.deliveryType.labels,
        colors: [ADMIN_CHART_COLORS.primary, ADMIN_CHART_COLORS.green, '#f59e0b', '#dc2626'],
        legend: { position: 'bottom', fontSize: '11px' },
        dataLabels: { enabled: true, formatter: (val: number) => `${Math.round(val)}%` },
        tooltip: {
          y: {
            formatter: (_v: number, opts?: { seriesIndex?: number }) => {
              const idx = opts?.seriesIndex ?? 0;
              const l = m.deliveryType.litres[idx] ?? 0;
              return `${new Intl.NumberFormat('en-RW').format(l)} L`;
            },
          },
        },
      }),
    [m.deliveryType.labels, m.deliveryType.litres],
  );

  const performanceDonut = useMemo(
    () =>
      mergeAdminChartOptions({
        chart: { type: 'donut' },
        labels: m.mccPerformance.labels,
        colors: [ADMIN_CHART_COLORS.green, ADMIN_CHART_COLORS.primary, '#f59e0b', '#dc2626', '#6b7280'],
        legend: { position: 'bottom', fontSize: '11px' },
        plotOptions: { pie: { donut: { size: '62%' } } },
      }),
    [m.mccPerformance.labels],
  );

  const rejectionBar = useMemo(() => {
    const maxVal = Math.max(...m.rejectionCauses.values, 1);
    return mergeAdminChartOptions({
      chart: { type: 'bar', toolbar: { show: false } },
      plotOptions: { bar: { horizontal: true, borderRadius: 3, barHeight: '70%' } },
      colors: [ADMIN_CHART_COLORS.amber ?? '#f59e0b'],
      dataLabels: { enabled: true, formatter: (v: number) => String(Math.round(v)) },
      xaxis: {
        categories: m.rejectionCauses.labels,
        max: maxVal * 1.15,
      },
      grid: { padding: { left: 8 } },
    });
  }, [m.rejectionCauses.labels, m.rejectionCauses.values]);

  const rejectionLine = useMemo(() => {
    const rates = m.rejectionTrend.rates;
    const min = rates.length ? Math.max(0, Math.min(...rates) - 0.2) : 0;
    const max = rates.length ? Math.max(...rates) + 0.2 : 2;
    return mergeAdminChartOptions({
      chart: { type: 'line', toolbar: { show: false } },
      stroke: { curve: 'smooth', width: 2.5 },
      colors: [ADMIN_CHART_COLORS.amber ?? '#d97706'],
      markers: { size: 3 },
      dataLabels: { enabled: false },
      xaxis: { categories: m.rejectionTrend.categories },
      yaxis: {
        labels: { formatter: (v: number) => `${v.toFixed(2)}%` },
        min,
        max,
      },
      tooltip: { y: { formatter: (v: number) => `${v.toFixed(2)}%` } },
    });
  }, [m.rejectionTrend.categories, m.rejectionTrend.rates]);

  if (loading) return <DashboardSkeleton />;

  if (error || !stats) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
          </div>
          <AdminPagePeriodBar />
        </div>
        <div className="rounded-sm border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{error || 'No dashboard data returned.'}</p>
          <button type="button" className="btn btn-secondary mt-3" onClick={() => setReloadKey((k) => k + 1)}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
          <p className="mt-1 text-sm text-gray-600">
            Live platform metrics (read-only). Change the period to refresh all widgets.
          </p>
        </div>
        <AdminPagePeriodBar />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-5">
        {m.kpis.map((k) => {
          const vis = KPI_VISUAL[k.id] ?? { icon: faChartLine, iconBg: '#f3f4f6', iconFg: '#6b7280' };
          return (
            <div key={k.id} className={KPI_TILE}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500 leading-tight">
                    {k.label}
                  </div>
                  <div className="mt-0.5 truncate font-bold tabular-nums text-gray-900 text-[clamp(0.9rem,1.6vw,1.2rem)]">
                    {k.value}
                  </div>
                  <div className="mt-0.5 text-[11px] text-gray-600 leading-snug">{k.sub}</div>
                  {k.trend ? (
                    <div className="mt-1.5">
                      <TrendBadge text={k.trend} up={k.trendUp} />
                    </div>
                  ) : null}
                </div>
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md sm:h-9 sm:w-9"
                  style={{ backgroundColor: vis.iconBg, color: vis.iconFg }}
                >
                  <Icon icon={vis.icon} size="xs" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <DashboardPanel title="Milk collections trend" subtitle={m.periodMeta.collectionsSubtitle}>
          {m.collectionsTrend.litres.some((v) => v > 0) ? (
            <Chart
              type="bar"
              height={240}
              series={[{ name: 'Litres', data: m.collectionsTrend.litres }]}
              options={collectionsChart}
            />
          ) : (
            <EmptyHint>No collections in this period.</EmptyHint>
          )}
        </DashboardPanel>
        <DashboardPanel title="Milk by status" subtitle={m.periodMeta.chartVolumeSubtitle}>
          {m.deliveryType.series.length > 0 ? (
            <Chart type="donut" height={240} series={m.deliveryType.series} options={deliveryDonut} />
          ) : (
            <EmptyHint>No milk sales in this period.</EmptyHint>
          )}
        </DashboardPanel>
        <DashboardPanel title="MCC performance" subtitle="Health band distribution">
          {m.mccPerformance.series.length > 0 && m.mccPerformance.labels[0] !== 'No data' ? (
            <Chart type="donut" height={240} series={m.mccPerformance.series} options={performanceDonut} />
          ) : (
            <EmptyHint>No MCC health data available.</EmptyHint>
          )}
        </DashboardPanel>
        <DashboardPanel title="System health" subtitle="Illustrative — not from live API">
          <ul className="space-y-2">
            {m.systemHealth.map((s) => (
              <li key={s.name} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 text-gray-800">
                  <Icon icon={faHeartPulse} size="sm" className="text-emerald-600" />
                  {s.name}
                </span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
        </DashboardPanel>

        <DashboardPanel title="Top MCCs by litres" subtitle={m.periodMeta.topMccSubtitle}>
          {m.topMccs.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                      <th className="pb-2 pr-2">#</th>
                      <th className="pb-2 pr-2">MCC</th>
                      <th className="pb-2 pr-2 text-right">Litres</th>
                      <th className="pb-2 text-right">Quality</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.topMccs.map((row) => (
                      <tr key={row.rank} className="border-b border-gray-100 last:border-0">
                        <td className="py-2 pr-2 text-gray-500">{row.rank}</td>
                        <td className="py-2 pr-2 font-medium text-gray-900">{row.name}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{row.litres}</td>
                        <td
                          className={`py-2 text-right text-xs font-medium tabular-nums ${
                            row.changeUp ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {row.change}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Link
                href="/admin/accounts"
                className="mt-3 inline-block text-xs font-medium text-[var(--primary)] hover:underline"
              >
                View all MCCs →
              </Link>
            </>
          ) : (
            <EmptyHint>No MCC collections in this period.</EmptyHint>
          )}
        </DashboardPanel>

        <DashboardPanel title="Rejections" subtitle="Transactions in period">
          {m.rejectionCauses.values.some((v) => v > 0) ? (
            <Chart
              type="bar"
              height={220}
              series={[{ name: 'Count', data: m.rejectionCauses.values }]}
              options={rejectionBar}
            />
          ) : (
            <EmptyHint>No rejections in this period.</EmptyHint>
          )}
        </DashboardPanel>

        <DashboardPanel title="Rejection rate" subtitle="Share of period volume">
          {m.rejectionTrend.rates.length > 0 ? (
            <Chart
              type="line"
              height={220}
              series={[{ name: 'Rejection %', data: m.rejectionTrend.rates }]}
              options={rejectionLine}
            />
          ) : (
            <EmptyHint>No trend data for this period.</EmptyHint>
          )}
        </DashboardPanel>

        <DashboardPanel title="Recent platform activity" subtitle="Latest events">
          {m.recentActivity.length > 0 ? (
            <>
              <ul className="space-y-3">
                {m.recentActivity.map((a) => (
                  <li key={a.id} className="border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                    <p className="text-sm text-gray-900">{a.text}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{a.time}</p>
                  </li>
                ))}
              </ul>
              <Link
                href="/admin/audit-log"
                className="mt-3 inline-block text-xs font-medium text-[var(--primary)] hover:underline"
              >
                View audit log →
              </Link>
            </>
          ) : (
            <EmptyHint>No recent activity in this period.</EmptyHint>
          )}
        </DashboardPanel>

        <DashboardPanel title="Top suppliers (recent)" subtitle={m.periodMeta.topMccSubtitle}>
          {m.topCollectors.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                      <th className="pb-2 pr-2">Supplier</th>
                      <th className="pb-2 pr-2 text-right">Litres</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.topCollectors.map((c) => (
                      <tr key={c.name} className="border-b border-gray-100 last:border-0">
                        <td className="py-2 pr-2 font-medium text-gray-900">{c.name}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{c.litres}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Link
                href="/admin/milk/collections"
                className="mt-3 inline-block text-xs font-medium text-[var(--primary)] hover:underline"
              >
                View milk collections →
              </Link>
            </>
          ) : (
            <EmptyHint>No recent sales to rank suppliers.</EmptyHint>
          )}
        </DashboardPanel>

        <DashboardPanel title="Credit portfolio" subtitle="Platform lending snapshot">
          <SummaryList rows={m.creditPortfolio} />
          <Link
            href="/admin/finance/active-loans"
            className="mt-3 inline-block text-xs font-medium text-[var(--primary)] hover:underline"
          >
            View active loans →
          </Link>
        </DashboardPanel>

        <DashboardPanel title="Payments overview" subtitle="Finance in period">
          <SummaryList rows={m.paymentsOverview} />
          <Link
            href="/admin/finance/loan-disbursements"
            className="mt-3 inline-block text-xs font-medium text-[var(--primary)] hover:underline"
          >
            View finance →
          </Link>
        </DashboardPanel>

        <DashboardPanel title="Alerts summary" subtitle="Open items from overview">
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ['High', m.alerts.high, 'bg-red-50 text-red-800 border-red-100'],
                ['Medium', m.alerts.medium, 'bg-amber-50 text-amber-900 border-amber-100'],
                ['Low', m.alerts.low, 'bg-sky-50 text-sky-900 border-sky-100'],
                ['Info', m.alerts.info, 'bg-emerald-50 text-emerald-900 border-emerald-100'],
              ] as const
            ).map(([label, count, cls]) => (
              <div key={label} className={`rounded-sm border p-3 text-center ${cls}`}>
                <div className="text-2xl font-bold tabular-nums">{count}</div>
                <div className="text-xs font-medium">{label}</div>
              </div>
            ))}
          </div>
          <Link
            href="/admin/milk/rejections"
            className="mt-3 inline-block text-xs font-medium text-[var(--primary)] hover:underline"
          >
            View rejections →
          </Link>
        </DashboardPanel>
      </div>
    </div>
  );
}
