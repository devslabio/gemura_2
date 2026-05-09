'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faDroplet } from '@fortawesome/free-solid-svg-icons';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import type { DashboardStats, FinanceDashboardData, UsageDashboardData } from '@/lib/api/admin';
import Icon, {
  faBell,
  faBriefcase,
  faChartBar,
  faChartLine,
  faClipboardList,
  faClock,
  faDollarSign,
  faHandHoldingDollar,
  faHeart,
  faInfoCircle,
  faReceipt,
  faShoppingCart,
  faTriangleExclamation,
  faTruck,
  faUserPlus,
  faUsers,
  faWallet,
} from '@/app/components/Icon';
import { ADMIN_CHART_COLORS, mergeAdminChartOptions } from '@/lib/dashboard/admin-chart-theme';
import {
  emptyOverviewKpisForPeriod,
  mergeOverviewKpis,
  financeTilesFromLive,
  type MccHealthRow,
  type OnboardingRow,
} from '@/lib/dashboard/system-admin-overview-data';
import { WidgetPagination } from './widget-pagination';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const overviewCard =
  'rounded-sm border border-gray-200 bg-white p-4 sm:p-5';

/** KPI tiles — match gemura-web `StatCard` (`p-6`, `min-h-[120px]`, icon box `w-12 h-12`). */
const kpiTileClass =
  'rounded-sm border border-gray-200 bg-white p-6 min-h-[120px] hover:border-gray-300 transition-colors';

/** KPI strip — icon tile accents (Gemura blue + milk green + finance teal/amber) */
const KPI_VISUAL: Record<
  string,
  { icon: IconDefinition; iconBg: string; iconFg: string }
> = {
  mccs: { icon: faUsers, iconBg: '#eff6ff', iconFg: '#004AAD' },
  onboarding: { icon: faClipboardList, iconBg: '#fffbeb', iconFg: '#b45309' },
  collections: { icon: faDroplet, iconBg: '#dcfce7', iconFg: '#059669' },
  rejections: { icon: faTriangleExclamation, iconBg: '#fef2f2', iconFg: '#dc2626' },
  suppliers: { icon: faTruck, iconBg: '#f5f3ff', iconFg: '#6d28d9' },
  loans: { icon: faWallet, iconBg: '#e0f2fe', iconFg: '#0369a1' },
  inventory: { icon: faShoppingCart, iconBg: '#fff7ed', iconFg: '#c2410c' },
  payroll: { icon: faBriefcase, iconBg: '#eef2ff', iconFg: '#4338ca' },
  users: { icon: faUsers, iconBg: '#eff6ff', iconFg: '#004AAD' },
  audit: { icon: faBell, iconBg: '#f1f5f9', iconFg: '#475569' },
};

const KPI_FALLBACK = { icon: faChartBar, iconBg: '#f3f4f6', iconFg: '#6b7280' };

function WidgetHeader({
  title,
  subtitle,
  icon,
  iconBg,
  iconFg,
  right,
}: {
  title: string;
  subtitle?: ReactNode;
  icon: IconDefinition;
  iconBg: string;
  iconFg: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10"
          style={{ backgroundColor: iconBg, color: iconFg }}
        >
          <Icon icon={icon} size="sm" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-gray-900 sm:text-base">{title}</h2>
          {subtitle ? <div className="mt-0.5 text-xs text-gray-500">{subtitle}</div> : null}
        </div>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

function alertRowIcon(severity: 'high' | 'medium' | 'info'): IconDefinition {
  switch (severity) {
    case 'high':
      return faTriangleExclamation;
    case 'medium':
      return faBell;
    default:
      return faInfoCircle;
  }
}

function alertIconAccent(severity: 'high' | 'medium' | 'info'): { bg: string; fg: string } {
  switch (severity) {
    case 'high':
      return { bg: '#fef2f2', fg: '#dc2626' };
    case 'medium':
      return { bg: '#fffbeb', fg: '#b45309' };
    default:
      return { bg: '#eff6ff', fg: '#004AAD' };
  }
}

function activityAccent(label: string): { icon: IconDefinition; bg: string; fg: string } {
  const l = label.toLowerCase();
  if (l.includes('payroll')) return { icon: faBriefcase, bg: '#eff6ff', fg: '#004AAD' };
  if (l.includes('disburse')) return { icon: faHandHoldingDollar, bg: '#dcfce7', fg: '#059669' };
  if (l.includes('supplier')) return { icon: faTruck, bg: '#f5f3ff', fg: '#6d28d9' };
  return { icon: faClock, bg: '#f1f5f9', fg: '#475569' };
}

function financeMiniAccent(label: string): { icon: IconDefinition; iconBg: string; iconFg: string } {
  if (label.startsWith('Disburse')) return { icon: faWallet, iconBg: '#ccfbf1', iconFg: '#0f766e' };
  if (label.startsWith('Repayment')) return { icon: faHandHoldingDollar, iconBg: '#dbeafe', iconFg: '#2563eb' };
  if (label.includes('Milk')) return { icon: faReceipt, iconBg: '#dcfce7', iconFg: '#059669' };
  if (label.includes('Active loan')) return { icon: faChartLine, iconBg: '#e0e7ff', iconFg: '#4338ca' };
  return { icon: faDollarSign, iconBg: '#f3f4f6', iconFg: '#374151' };
}

function healthBadgeClass(h: MccHealthRow['health']): string {
  switch (h) {
    case 'Excellent':
      return 'bg-emerald-800 text-white';
    case 'Good':
      return 'bg-emerald-100 text-emerald-900';
    case 'Moderate':
      return 'bg-amber-100 text-amber-900';
    case 'At risk':
      return 'bg-orange-100 text-orange-900';
    case 'Critical':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function onboardingStatusClass(tone: OnboardingRow['statusTone']): string {
  switch (tone) {
    case 'review':
      return 'bg-sky-100 text-sky-900';
    default:
      return 'bg-amber-100 text-amber-900';
  }
}

function alertSeverityClass(sev: 'high' | 'medium' | 'info'): string {
  switch (sev) {
    case 'high':
      return 'bg-red-50 text-red-800';
    case 'medium':
      return 'bg-amber-50 text-amber-900';
    default:
      return 'bg-sky-50 text-sky-900';
  }
}

const ADOPTION_BAR_FILL: Record<'milk' | 'finance' | 'usage' | 'inventory' | 'loans', string> = {
  milk: 'bg-emerald-600',
  finance: 'bg-blue-600',
  usage: 'bg-violet-600',
  inventory: 'bg-amber-600',
  loans: 'bg-sky-600',
};

function AdoptionBar({ pct, variant }: { pct: number; variant: keyof typeof ADOPTION_BAR_FILL }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
      <div className={`h-full rounded-full ${ADOPTION_BAR_FILL[variant]} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

const WIDGET_PAGE_SIZE = 5;

/** Merge extra query params onto an href suffix (`?a=1` or ``). */
function mergeQuerySuffix(suffix: string, params: Record<string, string>): string {
  const trimmed = suffix.startsWith('?') ? suffix.slice(1) : suffix;
  const p = new URLSearchParams(trimmed);
  for (const [k, v] of Object.entries(params)) p.set(k, v);
  const out = p.toString();
  return out ? `?${out}` : '';
}

function kpiDetailHref(kpiId: string, suffix: string): string {
  const q = suffix || '';
  switch (kpiId) {
    case 'mccs':
      return `/admin/users${mergeQuerySuffix(q, { status: 'active' })}`;
    case 'onboarding':
      return `/admin/onboarding${mergeQuerySuffix(q, {})}`;
    case 'collections':
      return `/admin/milk/collections${mergeQuerySuffix(q, {})}`;
    case 'rejections':
      return `/admin/milk/rejections${mergeQuerySuffix(q, {})}`;
    case 'suppliers':
      return `/admin/users${mergeQuerySuffix(q, { account_type: 'supplier' })}`;
    case 'loans':
      return `/admin/finance/active-loans${mergeQuerySuffix(q, {})}`;
    case 'inventory':
      return `/admin/finance/inventory-sales${mergeQuerySuffix(q, {})}`;
    case 'payroll':
      return `/admin/finance/payroll-runs${mergeQuerySuffix(q, {})}`;
    case 'users':
      return `/admin/users${mergeQuerySuffix(q, {})}`;
    case 'audit':
      return `/admin/audit-log${mergeQuerySuffix(q, {})}`;
    default:
      return `/admin/dashboard/overview${mergeQuerySuffix(q, {})}`;
  }
}

function alertDetailHref(alertId: string, suffix: string): string | null {
  const q = suffix || '';
  if (alertId === 'onboarding-pending') return `/admin/onboarding${q}`;
  if (alertId.startsWith('rej-med-')) return `/admin/accounts/${alertId.slice('rej-med-'.length)}${q}`;
  if (alertId.startsWith('rej-')) return `/admin/accounts/${alertId.slice('rej-'.length)}${q}`;
  return null;
}

function activityDetailHref(activityId: string, suffix: string): string | null {
  const q = suffix || '';
  switch (activityId) {
    case 'payroll':
      return `/admin/finance/payroll-runs${mergeQuerySuffix(q, {})}`;
    case 'loan':
      return `/admin/finance/active-loans${mergeQuerySuffix(q, {})}`;
    case 'onboarding':
      return `/admin/onboarding${mergeQuerySuffix(q, {})}`;
    case 'milk':
      return `/admin/milk/collections${mergeQuerySuffix(q, {})}`;
    default:
      return null;
  }
}

function financeTileHref(tileLabel: string, suffix: string): string {
  const q = suffix || '';
  if (tileLabel.startsWith('Disbursements')) {
    return `/admin/finance/loan-disbursements${mergeQuerySuffix(q, {})}`;
  }
  if (tileLabel.startsWith('Repayments')) {
    return `/admin/finance/loan-repayments${mergeQuerySuffix(q, {})}`;
  }
  if (tileLabel.includes('Milk payments')) {
    return `/admin/milk/collections${mergeQuerySuffix(q, {})}`;
  }
  if (tileLabel.startsWith('Active loan')) {
    return `/admin/finance/active-loans${mergeQuerySuffix(q, {})}`;
  }
  return `/admin/finance/active-loans${mergeQuerySuffix(q, {})}`;
}

export type SystemAdminOverviewProps = {
  periodLabel: string;
  /** Preserve dashboard period query string when drilling down (e.g. `?period=month`). */
  querySuffix?: string;
  stats: DashboardStats | null;
  finance: FinanceDashboardData | null;
  usage: UsageDashboardData | null;
};

export default function SystemAdminOverview({
  periodLabel,
  querySuffix = '',
  stats,
  finance,
  usage,
}: SystemAdminOverviewProps) {
  const router = useRouter();

  const [healthPage, setHealthPage] = useState(1);
  const [onboardingPage, setOnboardingPage] = useState(1);
  const [adoptionPage, setAdoptionPage] = useState(1);

  useEffect(() => {
    setHealthPage(1);
    setOnboardingPage(1);
    setAdoptionPage(1);
  }, [periodLabel, stats]);

  const kpis = useMemo(
    () =>
      mergeOverviewKpis(emptyOverviewKpisForPeriod(periodLabel), {
        stats,
        finance,
        usage,
        periodLabel,
      }),
    [stats, finance, usage, periodLabel],
  );

  const collectionsByMcc = stats?.overview?.collectionsByMcc ?? [];
  const healthRows = stats?.overview?.healthRows ?? [];
  const onboardingRows = stats?.overview?.onboardingQueue ?? [];
  const alertsRows = stats?.overview?.alerts ?? [];
  const adoptionRows = stats?.overview?.adoption ?? [];
  const activityRows = stats?.overview?.activity ?? [];

  const financeTiles = useMemo(() => financeTilesFromLive(finance, periodLabel), [finance, periodLabel]);

  const healthPaged = useMemo(() => {
    const start = (healthPage - 1) * WIDGET_PAGE_SIZE;
    return healthRows.slice(start, start + WIDGET_PAGE_SIZE);
  }, [healthRows, healthPage]);

  const onboardingPaged = useMemo(() => {
    const start = (onboardingPage - 1) * WIDGET_PAGE_SIZE;
    return onboardingRows.slice(start, start + WIDGET_PAGE_SIZE);
  }, [onboardingRows, onboardingPage]);

  const adoptionPaged = useMemo(() => {
    const start = (adoptionPage - 1) * WIDGET_PAGE_SIZE;
    return adoptionRows.slice(start, start + WIDGET_PAGE_SIZE);
  }, [adoptionRows, adoptionPage]);

  const collectionsChartOptions = useMemo(
    () =>
      mergeAdminChartOptions({
        chart: { type: 'area', toolbar: { show: false } },
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 2.5 },
        fill: {
          type: 'gradient',
          gradient: { shadeIntensity: 1, opacityFrom: 0.34, opacityTo: 0.05, stops: [0, 90, 100] },
        },
        colors: [ADMIN_CHART_COLORS.primary, ADMIN_CHART_COLORS.green],
        xaxis: {
          categories: collectionsByMcc.map((row) => row.mcc),
          labels: { rotate: -38, rotateAlways: true, style: { fontSize: '10px' } },
        },
        responsive: [
          {
            breakpoint: 768,
            options: {
              xaxis: { labels: { rotate: -25, style: { fontSize: '9px' } } },
              yaxis: [{ labels: { show: false } }, { labels: { show: false } }],
              legend: { fontSize: '10px' },
            },
          },
        ],
        yaxis: [
          {
            seriesName: 'Collections (L)',
            title: { text: 'Collections (L)', style: { fontSize: '11px', color: '#6b7280' } },
            labels: {
              formatter: (v: number) =>
                new Intl.NumberFormat('en-RW', { notation: 'compact', maximumFractionDigits: 1 }).format(v),
            },
          },
          {
            opposite: true,
            seriesName: 'Sales (RF)',
            title: { text: 'Sales (RF)', style: { fontSize: '11px', color: '#6b7280' } },
            labels: {
              formatter: (v: number) =>
                new Intl.NumberFormat('en-RW', { notation: 'compact', maximumFractionDigits: 1 }).format(v),
            },
          },
        ],
        tooltip: {
          shared: true,
          intersect: false,
          y: {
            formatter(val: number, opts?: { seriesIndex?: number }) {
              if (opts?.seriesIndex === 1) {
                return `RF ${new Intl.NumberFormat('en-RW').format(Math.round(val))}`;
              }
              return `${new Intl.NumberFormat('en-RW').format(Math.round(val))} L`;
            },
          },
        },
      }),
    [collectionsByMcc],
  );

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5">
        {kpis.map((k) => {
          const meta = KPI_VISUAL[k.id] ?? KPI_FALLBACK;
          const isOnboardingKpi = k.id === 'onboarding';
          return (
            <Link
              key={k.id}
              href={kpiDetailHref(k.id, querySuffix)}
              className={`${kpiTileClass} block text-left text-inherit no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35 ${
                isOnboardingKpi ? 'hover:border-[var(--primary)]/35 hover:bg-blue-50/40' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{k.label}</div>
                  <div className="text-2xl font-bold tabular-nums text-gray-900">{k.value}</div>
                  {k.trend ? (
                    <div
                      className={`mt-1.5 text-[11px] font-medium leading-snug ${
                        k.trendUp === true ? 'text-emerald-700' : k.trendUp === false ? 'text-amber-800' : 'text-gray-600'
                      }`}
                    >
                      {k.trend}
                    </div>
                  ) : k.hint ? (
                    <div className="mt-1.5 text-[11px] leading-snug text-gray-600 truncate" title={k.hint}>
                      {k.hint}
                    </div>
                  ) : null}
                </div>
                <div
                  className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center self-start"
                  style={{ backgroundColor: meta.iconBg, color: meta.iconFg }}
                >
                  <Icon icon={meta.icon} size="lg" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className={`${overviewCard} lg:col-span-7 xl:col-span-5`}>
          <WidgetHeader
            title="Collections & sales by MCC"
            icon={faChartBar}
            iconBg="#dcfce7"
            iconFg="#059669"
            right={
              <Link
                href={`/admin/milk/collections${mergeQuerySuffix(querySuffix, {})}`}
                className="text-xs font-medium text-[var(--primary)] hover:underline"
              >
                Milk overview
              </Link>
            }
          />
          <div className="mt-1">
            {collectionsByMcc.length === 0 ? (
              <div className="flex h-[230px] items-center justify-center text-sm text-gray-500">
                No MCC collection data in this period.
              </div>
            ) : (
              <Chart
                type="area"
                height={230}
                options={collectionsChartOptions}
                series={[
                  { name: 'Collections (L)', data: collectionsByMcc.map((row) => row.collections_liters) },
                  { name: 'Sales (RF)', data: collectionsByMcc.map((row) => row.sales_rf) },
                ]}
              />
            )}
          </div>
        </div>

        <div className={`${overviewCard} lg:col-span-5 xl:col-span-4`}>
          <WidgetHeader
            title="MCC health score"
            icon={faHeart}
            iconBg="#fdf2f8"
            iconFg="#be185d"
            right={
              <Link
                href={`/admin/accounts${querySuffix}`}
                className="text-xs font-medium text-[var(--primary)] hover:underline"
              >
                All accounts
              </Link>
            }
          />
          <div className="mt-2 max-h-[280px] overflow-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <th className="pb-1.5 pr-2 w-10">#</th>
                  <th className="pb-1.5 pr-2">MCC</th>
                  <th className="pb-1.5 pr-2">Litres today</th>
                  <th className="pb-1.5 pr-2">Manifest %</th>
                  <th className="pb-1.5 pr-2">Reject %</th>
                  <th className="pb-1.5 pr-2">Tank %</th>
                  <th className="pb-1.5 pr-2">Alerts</th>
                  <th className="pb-1.5">Health</th>
                </tr>
              </thead>
              <tbody>
                {healthRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-sm text-gray-500">
                      No MCC health data in this period.
                    </td>
                  </tr>
                ) : (
                  healthPaged.map((row, idx) => {
                    const rowKey = row.userId ?? row.accountId ?? row.mcc;
                    const navigate =
                      row.accountId != null
                        ? () => router.push(`/admin/accounts/${row.accountId}${querySuffix}`)
                        : row.userId != null
                          ? () => router.push(`/admin/users/${row.userId}${querySuffix}`)
                          : undefined;
                    return (
                      <tr
                        key={rowKey}
                        className={`border-b border-gray-100 ${navigate ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                        onClick={navigate}
                      >
                        <td className="py-1.5 pr-2 tabular-nums text-gray-500">
                          {(healthPage - 1) * WIDGET_PAGE_SIZE + idx + 1}
                        </td>
                        <td className="py-1.5 pr-2 font-medium text-gray-900">{row.mcc}</td>
                        <td className="py-1.5 pr-2 tabular-nums text-gray-700">{row.litersToday}</td>
                        <td className="py-1.5 pr-2 tabular-nums text-gray-700">{row.manifestPct}%</td>
                        <td className="py-1.5 pr-2 tabular-nums text-gray-700">{row.rejectionPct}%</td>
                        <td className="py-1.5 pr-2 tabular-nums text-gray-700">{row.tankPct}%</td>
                        <td className="py-1.5 pr-2 tabular-nums text-gray-700">{row.alerts}</td>
                        <td className="py-1.5">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${healthBadgeClass(row.health)}`}
                          >
                            {row.health}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            <WidgetPagination
              page={healthPage}
              total={healthRows.length}
              pageSize={WIDGET_PAGE_SIZE}
              onPageChange={setHealthPage}
              itemLabel="MCCs"
            />
          </div>
        </div>

        <div className={`${overviewCard} lg:col-span-12 xl:col-span-3`}>
          <WidgetHeader
            title="Onboarding queue"
            icon={faUserPlus}
            iconBg="#fffbeb"
            iconFg="#b45309"
            right={
              <Link
                href={`/admin/onboarding${querySuffix}`}
                className="text-xs font-medium text-[var(--primary)] hover:underline"
              >
                Open queue
              </Link>
            }
          />
          <div className="mt-2 min-h-[180px] max-h-[260px] overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-[460px] text-sm">
              <colgroup>
                <col className="w-[6%]" />
                <col className="w-[42%]" />
                <col className="w-[24%]" />
                <col className="w-[18%]" />
                <col className="w-[16%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-200 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <th className="pb-1.5 pr-2">#</th>
                  <th className="pb-1.5 pr-2">Applicant</th>
                  <th className="pb-1.5 pr-2">Region</th>
                  <th className="pb-1.5 pr-2">Applied</th>
                  <th className="pb-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {onboardingRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-gray-500">
                      No onboarding records in this period.
                    </td>
                  </tr>
                ) : (
                  onboardingPaged.map((row, index) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
                      onClick={() => router.push(`/admin/onboarding/${row.id}${querySuffix}`)}
                    >
                      <td className="py-2 pr-2 align-top tabular-nums text-gray-500">
                        {(onboardingPage - 1) * WIDGET_PAGE_SIZE + index + 1}
                      </td>
                      <td className="py-2 pr-2 align-top font-medium leading-snug text-gray-900">{row.applicant}</td>
                      <td className="py-2 pr-2 align-top text-gray-600">{row.region}</td>
                      <td className="py-2 pr-2 align-top tabular-nums text-gray-600">{row.appliedOn}</td>
                      <td className="py-2 align-top">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${onboardingStatusClass(row.statusTone)}`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <WidgetPagination
              page={onboardingPage}
              total={onboardingRows.length}
              pageSize={WIDGET_PAGE_SIZE}
              onPageChange={setOnboardingPage}
              itemLabel="submissions"
            />
          </div>
        </div>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className={`${overviewCard} lg:col-span-6 xl:col-span-4`}>
          <WidgetHeader
            title="Critical alerts"
            icon={faTriangleExclamation}
            iconBg="#fef2f2"
            iconFg="#dc2626"
            right={
              <Link
                href={`/admin/audit-log${mergeQuerySuffix(querySuffix, {})}`}
                className="text-xs font-medium text-[var(--primary)] hover:underline"
              >
                Audit log
              </Link>
            }
          />
          <ul className="mt-2 space-y-2">
            {alertsRows.length === 0 ? (
              <li className="rounded-sm border border-gray-200 px-3 py-4 text-center text-sm text-gray-500">
                No critical alerts in this period.
              </li>
            ) : (
              alertsRows.map((a, alertIndex) => {
                const ia = alertIconAccent(a.severity);
                const ah = alertDetailHref(a.id, querySuffix);
                return (
                  <li
                    key={a.id}
                    role={ah ? 'button' : undefined}
                    tabIndex={ah ? 0 : undefined}
                    onClick={() => ah && router.push(ah)}
                    onKeyDown={(e) => {
                      if (!ah) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        router.push(ah);
                      }
                    }}
                    className={`flex gap-2.5 rounded-sm border border-gray-200 px-2.5 py-2 ${alertSeverityClass(a.severity)} ${
                      ah ? 'cursor-pointer hover:brightness-[0.98]' : ''
                    }`}
                  >
                    <span className="mt-0.5 shrink-0 tabular-nums text-[11px] font-semibold text-gray-500">
                      {alertIndex + 1}.
                    </span>
                    <div
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: ia.bg, color: ia.fg }}
                    >
                      <Icon icon={alertRowIcon(a.severity)} size="sm" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide opacity-90">
                          {a.severity === 'high' ? 'High' : a.severity === 'medium' ? 'Medium' : 'Info'}
                        </span>
                        <span className="text-[11px] text-gray-600">{a.when}</span>
                      </div>
                      <p className="mt-0.5 text-sm font-medium text-gray-900">{a.title}</p>
                      {ah ? (
                        <p className="mt-1 text-[11px] font-medium text-[var(--primary)]">Open detail →</p>
                      ) : null}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <div className={`${overviewCard} lg:col-span-6 xl:col-span-4`}>
          <WidgetHeader
            title="Module adoption by MCC"
            icon={faUsers}
            iconBg="#f5f3ff"
            iconFg="#6d28d9"
            right={
              <Link
                href={`/admin/users${querySuffix}`}
                className="text-xs font-medium text-[var(--primary)] hover:underline"
              >
                User directory
              </Link>
            }
          />
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[440px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <th className="pb-1.5 pr-2 w-10">#</th>
                  <th className="pb-1.5 pr-3">MCC</th>
                  <th className="pb-1.5 pr-2">Milk</th>
                  <th className="pb-1.5 pr-2">Finance</th>
                  <th className="pb-1.5 pr-2">Usage</th>
                  <th className="pb-1.5 pr-2">Inventory</th>
                  <th className="pb-1.5">Loans</th>
                </tr>
              </thead>
              <tbody>
                {adoptionRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-sm text-gray-500">
                      No module adoption data in this period.
                    </td>
                  </tr>
                ) : (
                  adoptionPaged.map((row, idx) => {
                    const rowKey = row.userId ?? row.accountId ?? row.mcc;
                    const navigate =
                      row.accountId != null
                        ? () => router.push(`/admin/accounts/${row.accountId}${querySuffix}`)
                        : row.userId != null
                          ? () => router.push(`/admin/users/${row.userId}${querySuffix}`)
                          : undefined;
                    return (
                      <tr
                        key={rowKey}
                        className={`border-b border-gray-100 ${navigate ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                        onClick={navigate}
                      >
                        <td className="py-1.5 pr-2 tabular-nums text-gray-500">
                          {(adoptionPage - 1) * WIDGET_PAGE_SIZE + idx + 1}
                        </td>
                        <td className="py-1.5 pr-3 font-medium text-gray-900">{row.mcc}</td>
                        <td className="py-1.5 pr-2">
                          <AdoptionBar pct={row.milk} variant="milk" />
                          <span className="mt-0.5 block text-[10px] tabular-nums text-gray-600">{row.milk}%</span>
                        </td>
                        <td className="py-1.5 pr-2">
                          <AdoptionBar pct={row.finance} variant="finance" />
                          <span className="mt-0.5 block text-[10px] tabular-nums text-gray-600">{row.finance}%</span>
                        </td>
                        <td className="py-1.5 pr-2">
                          <AdoptionBar pct={row.usage} variant="usage" />
                          <span className="mt-0.5 block text-[10px] tabular-nums text-gray-600">{row.usage}%</span>
                        </td>
                        <td className="py-1.5 pr-2">
                          <AdoptionBar pct={row.inventory} variant="inventory" />
                          <span className="mt-0.5 block text-[10px] tabular-nums text-gray-600">{row.inventory}%</span>
                        </td>
                        <td className="py-1.5">
                          <AdoptionBar pct={row.loans} variant="loans" />
                          <span className="mt-0.5 block text-[10px] tabular-nums text-gray-600">{row.loans}%</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            <WidgetPagination
              page={adoptionPage}
              total={adoptionRows.length}
              pageSize={WIDGET_PAGE_SIZE}
              onPageChange={setAdoptionPage}
              itemLabel="MCCs"
            />
          </div>
        </div>

        <div className={`${overviewCard} lg:col-span-12 xl:col-span-4`}>
          <WidgetHeader
            title="Recent platform activity"
            icon={faClock}
            iconBg="#eff6ff"
            iconFg="#004AAD"
          />
          <ul className="mt-2 space-y-2">
            {activityRows.length === 0 ? (
              <li className="py-4 text-sm text-gray-500">No recent platform activity in this period.</li>
            ) : (
              activityRows.map((item, activityIndex) => {
                const ac = activityAccent(item.label);
                const ah = activityDetailHref(item.id, querySuffix);
                return (
                  <li
                    key={item.id}
                    role={ah ? 'button' : undefined}
                    tabIndex={ah ? 0 : undefined}
                    onClick={() => ah && router.push(ah)}
                    onKeyDown={(e) => {
                      if (!ah) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        router.push(ah);
                      }
                    }}
                    className={`flex gap-2.5 rounded-sm border border-gray-100 px-2 py-2 ${
                      ah ? 'cursor-pointer hover:bg-gray-50 hover:border-gray-200' : ''
                    }`}
                  >
                    <span className="flex h-7 min-w-[1.5rem] items-center justify-center tabular-nums text-[11px] font-bold text-gray-500">
                      {activityIndex + 1}
                    </span>
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: ac.bg, color: ac.fg }}
                    >
                      <Icon icon={ac.icon} size="xs" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold leading-snug text-gray-900">{item.label}</div>
                      <div className="mt-0.5 text-xs text-gray-600">
                        {item.actor} · {item.when}
                      </div>
                      {ah ? (
                        <div className="mt-1 text-[11px] font-medium text-[var(--primary)]">View related →</div>
                      ) : null}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>

      {/* Finance summary */}
      <div className={overviewCard}>
        <WidgetHeader
          title="Finance summary"
          icon={faWallet}
          iconBg="#ccfbf1"
          iconFg="#0f766e"
          right={
            <Link
              href={`/admin/finance/active-loans${mergeQuerySuffix(querySuffix, {})}`}
              className="text-xs font-medium text-[var(--primary)] hover:underline"
            >
              Active loans
            </Link>
          }
        />
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {financeTiles.map((tile) => {
            const fm = financeMiniAccent(tile.label);
            return (
              <Link
                key={tile.label}
                href={financeTileHref(tile.label, querySuffix)}
                className="block rounded-sm border border-gray-200 bg-gray-50 p-3 text-inherit no-underline transition-colors hover:border-gray-300 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/25"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{tile.label}</div>
                    <div className="mt-2 text-xl font-bold tabular-nums text-gray-900">{tile.value}</div>
                    {tile.hint ? <div className="mt-1 text-xs text-gray-600">{tile.hint}</div> : null}
                    {tile.trend ? (
                      <div className={`mt-2 text-xs font-semibold ${tile.trendUp ? 'text-emerald-700' : 'text-gray-600'}`}>
                        {tile.trend}
                      </div>
                    ) : null}
                  </div>
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: fm.iconBg, color: fm.iconFg }}
                  >
                    <Icon icon={fm.icon} size="sm" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

    </div>
  );
}
