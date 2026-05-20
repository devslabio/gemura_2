'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ApexOptions } from 'apexcharts';
import type { OverviewResponse, OverviewRecentTransaction } from '@/lib/api/stats';
import type { MccManagerOverviewData } from '@/lib/api/mcc-manager';
import { mccManagerApi } from '@/lib/api/mcc-manager';
import { MccOnboardingProfilePanel } from '@/app/components/manager/MccOnboardingProfilePanel';
import { employeesApi } from '@/lib/api/employees';
import { useToastStore } from '@/store/toast';
import { usePermission } from '@/hooks/usePermission';
import Icon, {
  faBox,
  faArrowRight,
  faChartLine,
  faCheck,
  faClipboardList,
  faClock,
  faTriangleExclamation,
  faUserFriends,
  faWallet,
  faPlus,
  faReceipt,
  faUsers,
  faCog,
  faFileAlt,
} from '@/app/components/Icon';

type OverviewData = OverviewResponse['data'];
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

/** Matches dashboard chart / donut: sales-style green, collections-style blue */
const SPLIT_DIRECT = '#059669';
const SPLIT_UMUCUNDA = '#004AAD';

const PANEL =
  'bg-white border border-gray-200 rounded-sm p-6 sm:p-7 min-h-0 h-full flex flex-col';
/** Equal-height analytics / ops cards in a row */
const PANEL_ROW = `${PANEL} min-h-[300px]`;
const PANEL_TITLE = 'text-base font-semibold text-gray-900';
const PANEL_DESC = 'text-sm text-gray-500 mt-1.5 mb-5';
const TH = 'text-left py-2 px-3 text-[11px] font-medium text-gray-700 border-b border-gray-200 whitespace-nowrap';
const TD = 'py-2.5 px-3 text-[13px] text-gray-900 border-b border-gray-100 align-middle whitespace-nowrap';
const TD_MUTED = 'py-2.5 px-3 text-[13px] text-gray-600 border-b border-gray-100 align-middle whitespace-nowrap';
const EMPTY = 'text-sm text-gray-500 py-10 text-center';

const GATE_ROLE_OPTIONS = [
  { value: 'casual_laborer', label: 'Casual laborer' },
  { value: 'collector', label: 'Collector' },
  { value: 'agent', label: 'Agent' },
];

type OpsPeriodKey = 'day' | 'month' | 'week' | 'quarter' | 'year' | 'custom';

function parseYMDLocal(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function daysInclusiveLocal(fromStr: string, toStr: string): number {
  const a = parseYMDLocal(fromStr);
  const b = parseYMDLocal(toStr);
  return Math.floor((b.getTime() - a.getTime()) / 86400000) + 1;
}

function txDateKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Calendar-date inclusion using YYYY-MM-DD keys (matches overview period filters). */
function isDateInRangeLocal(txIso: string, fromStr: string, toStr: string): boolean {
  const k = txDateKey(txIso);
  return k >= fromStr && k <= toStr;
}

function collectionsStatLabel(pk: OpsPeriodKey): string {
  switch (pk) {
    case 'day':
      return 'Collections today (L)';
    case 'week':
      return 'Collections this week (L)';
    case 'month':
      return 'Collections this month (L)';
    case 'quarter':
      return 'Collections this quarter (L)';
    case 'year':
      return 'Collections this year (L)';
    case 'custom':
      return 'Collections in range (L)';
    default:
      return 'Collections (L)';
  }
}

function rejectionsStatLabel(pk: OpsPeriodKey): string {
  switch (pk) {
    case 'day':
      return 'Rejections today';
    default:
      return 'Rejections in period';
  }
}

function classifyCollectionSource(tx: OverviewRecentTransaction): 'umucunda' | 'direct' {
  const name = (tx.supplier_account?.name ?? '').toLowerCase();
  const code = (tx.supplier_account?.code ?? '').toLowerCase();
  const notes = (tx.notes ?? '').toLowerCase();
  if (
    name.includes('umucunda') ||
    code.includes('umu') ||
    code.includes('umucunda') ||
    notes.includes('umucunda') ||
    notes.includes('manifest')
  ) {
    return 'umucunda';
  }
  return 'direct';
}

function formatL(n: number): string {
  return `${n.toFixed(1)} L`;
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function resolutionLabel(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'resolved') return 'Resolved';
  if (s === 'secondary_test') return 'Secondary test pending';
  if (s === 'frozen') return 'Frozen';
  if (s === 'auto_zero') return 'Auto zero';
  return 'Unresolved';
}

function staffRoleLabel(role: string): string {
  const match = GATE_ROLE_OPTIONS.find((opt) => opt.value === role);
  if (match) return match.label;
  return role
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function badgeSubmitted(on: boolean) {
  return on
    ? 'inline-flex rounded-sm bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800'
    : 'inline-flex rounded-sm bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900';
}

function badgeNeutral() {
  return 'inline-flex rounded-sm bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800';
}

export type ManagerQuickAction =
  | 'sale'
  | 'collection'
  | 'transaction'
  | 'staff'
  | 'supplier'
  | 'report'
  | 'payments';

function formatTimeAgo(iso: string): string {
  const h = (Date.now() - new Date(iso).getTime()) / 3600000;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`;
  if (h < 24) return `${Math.round(h)}h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}

function KpiTile({
  label,
  value,
  sub,
  icon,
  accent,
  href,
  progressPct,
}: {
  label: string;
  value: string;
  sub: string;
  icon: Parameters<typeof Icon>[0]['icon'];
  accent: 'blue' | 'green' | 'amber' | 'red' | 'slate';
  href?: string;
  progressPct?: number | null;
}) {
  const iconAccents = {
    blue: { bg: '#eff6ff', fg: '#004AAD' },
    green: { bg: '#dcfce7', fg: '#059669' },
    amber: { bg: '#fef3c7', fg: '#b45309' },
    red: { bg: '#fee2e2', fg: '#b91c1c' },
    slate: { bg: '#f3f4f6', fg: '#4b5563' },
  };

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{label}</p>
          <p className="text-2xl sm:text-3xl font-bold leading-tight text-gray-900 tabular-nums break-words">
            {value}
          </p>
          <p className="mt-2 text-[11px] font-normal leading-snug text-gray-500 line-clamp-2">{sub}</p>
          {progressPct != null && progressPct >= 0 ? (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-sm bg-gray-100">
              <div
                className="h-full rounded-sm bg-[var(--primary)]"
                style={{ width: `${Math.min(100, progressPct)}%` }}
              />
            </div>
          ) : null}
        </div>
        <div
          className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl border border-black/5"
          style={{ backgroundColor: iconAccents[accent].bg, color: iconAccents[accent].fg }}
        >
          <Icon icon={icon} size="lg" />
        </div>
      </div>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-sm border border-gray-200 bg-white p-6 min-h-[128px] min-w-0 h-full transition-colors hover:border-gray-300"
      >
        {content}
      </Link>
    );
  }
  return (
    <div className="rounded-sm border border-gray-200 bg-white p-6 min-h-[128px] min-w-0 h-full transition-colors hover:border-gray-300">
      {content}
    </div>
  );
}

function SectionHeader({ number, title }: { number: number; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-[var(--primary)] text-[10px] font-bold text-white">
        {number}
      </span>
      <h3 className="text-[13px] font-semibold text-gray-900">{title}</h3>
    </div>
  );
}

export interface MccManagerDashboardSectionProps {
  accountId: string;
  today: OverviewData | null;
  last7: OverviewData | null;
  loading: boolean;
  refreshKey?: number;
  periodKey: OpsPeriodKey;
  rangeDateFrom: string;
  rangeDateTo: string;
  onQuickAction?: (action: ManagerQuickAction) => void;
  canCreateSales?: boolean;
  canCreateCollections?: boolean;
  canViewAnalytics?: boolean;
  canManageUsers?: boolean;
}

export default function MccManagerDashboardSection({
  accountId,
  today,
  last7,
  loading,
  refreshKey = 0,
  periodKey,
  rangeDateFrom,
  rangeDateTo,
  onQuickAction,
  canCreateSales = false,
  canCreateCollections = false,
  canViewAnalytics = false,
  canManageUsers = false,
}: MccManagerDashboardSectionProps) {
  const toast = useToastStore();
  const { hasPermission, hasAnyPermission } = usePermission();
  const canReassignGateStaff = hasPermission('manage_users');
  const canApproveTraceability = hasAnyPermission(['mcc_manage_operations', 'update_collections']);
  const [mcc, setMcc] = useState<MccManagerOverviewData | null>(null);
  const [mccLoading, setMccLoading] = useState(true);
  const [mccError, setMccError] = useState('');

  const gateDayIso = rangeDateTo;

  useEffect(() => {
    let cancelled = false;
    setMccLoading(true);
    setMccError('');
    mccManagerApi
      .getOverview(accountId, gateDayIso)
      .then((res) => {
        if (cancelled) return;
        if (res.code === 200 && res.data) setMcc(res.data);
        else {
          setMcc(null);
          setMccError(res.message || 'Could not load gate data.');
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setMcc(null);
          const msg =
            (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            (e as { message?: string })?.message ||
            'Could not load gate data.';
          setMccError(msg);
        }
      })
      .finally(() => {
        if (!cancelled) setMccLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, gateDayIso, refreshKey]);

  const periodCollections = useMemo(() => {
    const txs = today?.recent_transactions ?? [];
    return txs.filter(
      (t) => t.type === 'collection' && isDateInRangeLocal(t.transaction_at, rangeDateFrom, rangeDateTo),
    );
  }, [today, rangeDateFrom, rangeDateTo]);

  const heuristicSplit = useMemo(() => {
    let direct = 0;
    let umucunda = 0;
    for (const t of periodCollections) {
      const q = Number(t.quantity) || 0;
      if (classifyCollectionSource(t) === 'umucunda') umucunda += q;
      else direct += q;
    }
    const total = direct + umucunda;
    return { direct, umucunda, total };
  }, [periodCollections]);

  const gate = mcc?.gate;
  const useGateSplit = !!(gate && gate.total_litres > 0);
  const directL = useGateSplit ? gate!.direct_litres : heuristicSplit.direct;
  const umucundaL = useGateSplit ? gate!.umucunda_litres : heuristicSplit.umucunda;
  const splitTotal = directL + umucundaL;

  const rejectedMilkInPeriod = useMemo(() => {
    return periodCollections.filter((t) => (t.status ?? '').toLowerCase() === 'rejected');
  }, [periodCollections]);

  const gateRejections = mcc?.rejections ?? [];
  const manifestRows = mcc?.manifests ?? [];

  const litresPeriod = today?.summary.collection.liters ?? 0;
  const periodDays = Math.max(1, daysInclusiveLocal(rangeDateFrom, rangeDateTo));
  const periodAvgDaily = litresPeriod / periodDays;

  const litres7Avg = useMemo(() => {
    const lit = last7?.summary.collection.liters ?? 0;
    return lit / 7;
  }, [last7]);

  const intakeVsAvg = useMemo(() => {
    if (!litres7Avg || litres7Avg < 0.01) return 'neutral' as const;
    const ratio = periodAvgDaily / litres7Avg;
    if (ratio >= 0.95) return 'good' as const;
    if (ratio >= 0.75) return 'amber' as const;
    return 'bad' as const;
  }, [periodAvgDaily, litres7Avg]);

  const alerts = mcc?.alerts ?? [];

  const reassignRole = useCallback(
    async (userAccountId: string, newRole: string) => {
      try {
        const res = await employeesApi.updateEmployee(userAccountId, { role: newRole }, accountId);
        if (res.code === 200) {
          toast.success('Role updated');
          setMcc((prev) =>
            prev
              ? {
                  ...prev,
                  staff: prev.staff.map((s) =>
                    s.user_account_id === userAccountId ? { ...s, role: newRole } : s,
                  ),
                }
              : prev,
          );
        } else {
          toast.error(res.message || 'Update failed');
        }
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          (e as { message?: string })?.message ||
          'Update failed';
        toast.error(msg);
      }
    },
    [accountId, toast],
  );

  const approveResolution = useCallback(
    async (testResultId: string) => {
      try {
        const res = await mccManagerApi.updateTestResolution(testResultId, {
          source_resolution_status: 'resolved',
          account_id: accountId,
        });
        if (res.code === 200) {
          toast.success('Resolution marked resolved');
          setMcc((prev) =>
            prev
              ? {
                  ...prev,
                  rejections: prev.rejections.map((r) =>
                    r.test_result_id === testResultId ? { ...r, resolution_status: 'resolved' } : r,
                  ),
                }
              : prev,
          );
        } else {
          toast.error((res as { message?: string }).message || 'Update failed');
        }
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          (e as { message?: string })?.message ||
          'Update failed';
        toast.error(msg);
      }
    },
    [accountId, toast],
  );

  if (loading && !today) {
    return (
      <div className="rounded-sm border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        Loading manager operations…
      </div>
    );
  }

  const pctDirect = splitTotal > 0 ? Math.round((directL / splitTotal) * 100) : 0;
  const pctUmu = splitTotal > 0 ? 100 - pctDirect : 0;
  const submittedCount = manifestRows.filter((m) => m.submitted).length;
  const staffRows = mcc?.staff ?? [];
  const onDutyCount = staffRows.filter((s) => s.on_duty).length;
  const unresolvedGateRejections = gateRejections.filter((r) => (r.resolution_status || '').toLowerCase() !== 'resolved');
  const gateRejectionLitres = gateRejections.reduce((sum, r) => sum + (Number(r.volume_litres) || 0), 0);
  const rejectedSaleLitres = rejectedMilkInPeriod.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0);
  const rejectedLitres = gateRejectionLitres + rejectedSaleLitres;
  const deliveryLogged = gate?.delivery_count ?? 0;
  const profileExpectedDeliveries = mcc?.profile?.expected_daily_deliveries ?? null;
  const deliveryExpected =
    profileExpectedDeliveries && profileExpectedDeliveries > 0
      ? profileExpectedDeliveries
      : Math.max(manifestRows.length, deliveryLogged);
  const deliveryPct = deliveryExpected > 0 ? Math.round((deliveryLogged / deliveryExpected) * 100) : 0;
  const manifestPct = manifestRows.length > 0 ? Math.round((submittedCount / manifestRows.length) * 100) : 100;
  const profileTankCapacity = mcc?.profile?.cooling_tank_total_capacity_litres ?? null;
  const tankCapacityLitres = profileTankCapacity && profileTankCapacity > 0 ? profileTankCapacity : 0;
  const snapshotTankLitres = mcc?.facility_snapshot?.tank_used_litres;
  const tankLitresUsed =
    snapshotTankLitres != null && Number(snapshotTankLitres) >= 0
      ? Number(snapshotTankLitres)
      : Number(gate?.total_litres ?? litresPeriod ?? 0);
  const tankPctRaw =
    tankCapacityLitres > 0 ? (tankLitresUsed / tankCapacityLitres) * 100 : null;
  const tankPct: number | null =
    tankPctRaw != null ? Math.max(0, Math.min(100, Math.round(tankPctRaw * 10) / 10)) : null;
  const tankPctLabel =
    tankPct == null
      ? '—'
      : tankPct < 1 && tankPct > 0
        ? `${tankPct}%`
        : `${Math.round(tankPct)}%`;
  const tankTone: 'green' | 'amber' | 'red' | 'slate' =
    tankPct == null ? 'slate' : tankPct >= 85 ? 'red' : tankPct >= 70 ? 'amber' : 'green';
  const tankRingVisualPct =
    tankPct != null && tankPct > 0 && tankPct < 1 ? 1 : tankPct ?? 0;
  const litresTrend = (today?.breakdown?.length ? today.breakdown : last7?.breakdown ?? [])
    .slice(-14)
    .map((d) => ({
      label: d.label || d.date.slice(5),
      litres: Number(d.collection.liters) || 0,
    }));
  const maxTrend = Math.max(1, ...litresTrend.map((d) => d.litres));
  const walletValue = mcc?.wallet ? formatMoney(mcc.wallet.balance, mcc.wallet.currency) : 'RWF —';
  const snapshotTemperature = mcc?.facility_snapshot?.cooling_temperature_c;
  const temperatureValue = snapshotTemperature != null ? `${snapshotTemperature.toFixed(1)}°C` : '—';
  const powerStatusRaw = (mcc?.facility_snapshot?.power_status ?? '').toLowerCase();
  const generatorStatusRaw = (mcc?.facility_snapshot?.generator_status ?? '').toLowerCase();
  const powerStatusLabel = powerStatusRaw
    ? powerStatusRaw
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    : mcc?.profile?.power_supply_sources?.[0] ?? 'Unknown';
  const generatorLabel = generatorStatusRaw
    ? generatorStatusRaw
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    : 'Unknown';
  const tankTitle =
    tankCapacityLitres > 0
      ? `Bulk milk tank (${Math.round(tankCapacityLitres).toLocaleString()} L)`
      : 'Bulk milk tank';
  const isSingleDay = rangeDateFrom === rangeDateTo;
  const totalLitresDisplay = isSingleDay && gate ? gate.total_litres : litresPeriod;
  const changePct = isSingleDay ? mcc?.litres_change_pct ?? null : null;
  const trend7 = mcc?.trend_7d ?? [];
  const quality = mcc?.quality_summary;
  const recentDeliveries = mcc?.recent_deliveries ?? [];
  const routes = mcc?.collection_by_route ?? [];
  const topFarmers = mcc?.top_farmers_month ?? [];
  const topCollectors = mcc?.top_collectors_month ?? [];
  const payments = mcc?.payments_overview;
  const coolingTanks = mcc?.cooling_tanks ?? [];
  const onboardingProfile = mcc?.profile;
  const onboardingCompletion = mcc?.onboarding_completion ?? null;
  const accountLabel = mcc?.account_context?.name;
  const hasOnboardingProfile =
    Boolean(onboardingProfile?.source_submission_code) ||
    coolingTanks.length > 0 ||
    (onboardingProfile?.total_farmers_supplying != null && onboardingProfile.total_farmers_supplying > 0);
  const rejectionCauses = mcc?.rejection_causes_top ?? [];
  const fuelPct = mcc?.facility_snapshot?.generator_fuel_pct;
  const rejectedPctOfTotal =
    totalLitresDisplay > 0 ? Math.round((rejectedLitres / totalLitresDisplay) * 1000) / 10 : null;
  const donutSeries = splitTotal > 0 ? [directL, umucundaL] : [0, 0];
  const deliveryShareOptions: ApexOptions = {
    chart: { type: 'donut', toolbar: { show: false }, fontFamily: 'inherit' },
    labels: ['Direct farmer deliveries', 'Umucunda (via collector)'],
    colors: [SPLIT_DIRECT, SPLIT_UMUCUNDA],
    legend: { position: 'bottom', fontSize: '11px', horizontalAlign: 'center' },
    stroke: { width: 0 },
    dataLabels: { enabled: true, formatter: (v: number) => `${Math.round(v)}%` },
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            value: { show: true, formatter: (v: string) => `${Math.round(Number(v)).toLocaleString()} L` },
            total: {
              show: true,
              label: 'Total',
              formatter: () => formatL(splitTotal),
            },
          },
        },
      },
    },
  };
  const trend7Options: ApexOptions = {
    chart: { type: 'area', toolbar: { show: false }, fontFamily: 'inherit', zoom: { enabled: false } },
    colors: ['#004AAD'],
    stroke: { curve: 'smooth', width: 2 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05, stops: [0, 90, 100] } },
    dataLabels: { enabled: false },
    xaxis: {
      categories: trend7.map((t) => t.label),
      labels: { rotate: -25, style: { fontSize: '10px', colors: '#6b7280' } },
    },
    yaxis: {
      labels: {
        formatter: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v))),
      },
    },
    grid: { borderColor: '#f3f4f6', strokeDashArray: 4 },
    tooltip: { y: { formatter: (v: number) => `${Math.round(v).toLocaleString()} L` } },
  };
  const trend7Series = [{ name: 'Litres', data: trend7.map((t) => Math.round(t.litres)) }];
  const buildOpsHref = (path: string, extra?: Record<string, string>) => {
    const params = new URLSearchParams({
      from: rangeDateFrom,
      to: rangeDateTo,
      ...(extra ?? {}),
    });
    return `${path}?${params.toString()}`;
  };
  const buildCollectionsHref = (extra?: Record<string, string>) => {
    const params = new URLSearchParams({
      date_from: rangeDateFrom,
      date_to: rangeDateTo,
      ...(extra ?? {}),
    });
    return `/collections?${params.toString()}`;
  };

  return (
    <div className="space-y-4 mb-4">
      {mccError ? (
        <div className="rounded-sm border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900">
          {mccError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile
          label={isSingleDay ? 'Total litres today' : collectionsStatLabel(periodKey)}
          value={formatL(totalLitresDisplay)}
          sub={
            changePct != null
              ? `${changePct >= 0 ? '+' : ''}${changePct}% vs yesterday`
              : litres7Avg > 0.01
                ? `7d avg ${formatL(litres7Avg)}/d`
                : 'No history yet'
          }
          icon={faBox}
          accent={changePct != null && changePct >= 0 ? 'green' : changePct != null ? 'red' : 'blue'}
          href={buildCollectionsHref()}
        />
        <KpiTile
          label="Deliveries logged"
          value={String(deliveryLogged)}
          sub={deliveryExpected > 0 ? `of ${deliveryExpected} expected` : 'Set expected deliveries'}
          icon={faClipboardList}
          accent={deliveryPct >= 95 ? 'green' : deliveryPct >= 80 ? 'amber' : 'red'}
          href={buildOpsHref('/operations/gate')}
          progressPct={deliveryExpected > 0 ? deliveryPct : null}
        />
        <KpiTile
          label="Direct farmer"
          value={formatL(directL)}
          sub={splitTotal > 0 ? `${pctDirect}% of total` : 'No intake yet'}
          icon={faCheck}
          accent="green"
          href={buildCollectionsHref()}
        />
        <KpiTile
          label="Via collectors"
          value={formatL(umucundaL)}
          sub={splitTotal > 0 ? `${pctUmu}% of total` : 'No intake yet'}
          icon={faChartLine}
          accent="blue"
          href={buildOpsHref('/operations/gate')}
        />
        <KpiTile
          label="Rejected today"
          value={formatL(rejectedLitres)}
          sub={rejectedPctOfTotal != null ? `${rejectedPctOfTotal}% of total` : `${gateRejections.length} gate tests`}
          icon={faTriangleExclamation}
          accent={rejectedLitres > 0 ? 'amber' : 'green'}
          href={buildOpsHref('/operations/traceability', { outcome: 'rejected' })}
        />
        <KpiTile
          label="Tank capacity used"
          value={tankPctLabel}
          sub={
            tankCapacityLitres > 0
              ? `${Math.round(tankLitresUsed).toLocaleString()} / ${tankCapacityLitres.toLocaleString()} L`
              : 'Set tank capacity'
          }
          icon={faClock}
          accent={tankTone}
          href={buildOpsHref('/operations/gate')}
        />
        <KpiTile
          label="Staff on shift"
          value={String(onDutyCount)}
          sub={`of ${staffRows.length} scheduled`}
          icon={faUserFriends}
          accent={onDutyCount > 0 ? 'green' : 'amber'}
          href={buildOpsHref('/operations/staff')}
        />
        <KpiTile
          label="Wallet balance"
          value={walletValue}
          sub="Available"
          icon={faWallet}
          accent="slate"
          href="/finance"
        />
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          <section className={`${PANEL} lg:col-span-2 min-h-[320px]`}>
            <SectionHeader number={1} title="Daily collection trend (litres)" />
            <p className={PANEL_DESC}>Last 7 days ending {rangeDateTo}.</p>
            <div className="flex-1 min-h-[220px]">
              {trend7.length === 0 ? (
                <p className={EMPTY}>{mccLoading ? 'Loading…' : 'No gate intake in this window.'}</p>
              ) : (
                <div className="h-full min-h-[220px]">
                  <Chart options={trend7Options} series={trend7Series} type="area" height="100%" />
                </div>
              )}
            </div>
          </section>

          <section className={`${PANEL} min-h-[320px]`}>
            <SectionHeader number={2} title="Collection source mix (today)" />
            <p className={PANEL_DESC}>Direct farmers vs collectors.</p>
            <div className="flex-1 flex items-center justify-center min-h-[220px] w-full">
              {splitTotal <= 0 ? (
                <p className={EMPTY}>{mccLoading ? 'Loading…' : `No gate intake (${rangeDateTo}).`}</p>
              ) : (
                <div className="w-full max-w-[280px] mx-auto">
                  <Chart options={deliveryShareOptions} series={donutSeries} type="donut" height={240} />
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
          <section className={PANEL_ROW}>
            <SectionHeader number={3} title="Quality summary (today)" />
            <p className={PANEL_DESC}>Gate milk test outcomes.</p>
            <div className="flex-1 flex flex-col justify-center">
              {quality && (quality.accepted_pct != null || quality.rejected_pct != null) ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-medium text-gray-600 mb-1">
                      <span>Accepted ({quality.accepted_pct ?? 0}%)</span>
                      <span>Rejected ({quality.rejected_pct ?? 0}%)</span>
                    </div>
                    <div className="h-3 flex overflow-hidden rounded-sm bg-gray-100">
                      <div
                        className="bg-emerald-500"
                        style={{ width: `${quality.accepted_pct ?? 0}%` }}
                      />
                      <div
                        className="bg-amber-500"
                        style={{ width: `${quality.rejected_pct ?? 0}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">Top rejection causes</p>
                    <ul className="space-y-1.5 text-sm text-gray-700">
                      {rejectionCauses.length === 0 ? (
                        <li className="text-gray-500">None recorded today</li>
                      ) : (
                        rejectionCauses.map((c) => (
                          <li key={c.cause} className="flex justify-between gap-2">
                            <span className="truncate">{c.cause}</span>
                            <span className="tabular-nums text-gray-500 shrink-0">{c.count}</span>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className={EMPTY}>No completed milk tests today.</p>
              )}
            </div>
          </section>

          <section className={PANEL_ROW}>
            <SectionHeader number={4} title="Tank & cooling status" />
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-2">
              <div
                className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full border-4 border-gray-100"
                style={{
                  background: `conic-gradient(${tankTone === 'red' ? '#ef4444' : tankTone === 'amber' ? '#f59e0b' : '#10b981'} ${tankRingVisualPct}%, #f3f4f6 0)`,
                }}
              >
                <span className="rounded-full bg-white px-3 py-1 text-xl font-bold text-gray-900">
                  {tankPctLabel}
                </span>
              </div>
              <div className="grid w-full grid-cols-2 gap-2 text-sm">
                <div className="rounded-sm border border-gray-200 p-2.5 text-center sm:text-left">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">Temperature</p>
                  <p className="font-semibold text-emerald-700 mt-0.5">{temperatureValue}</p>
                </div>
                <div className="rounded-sm border border-gray-200 p-2.5 text-center sm:text-left">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">Generator</p>
                  <p className="font-semibold text-gray-900 mt-0.5">{generatorLabel}</p>
                </div>
                <div className="rounded-sm border border-gray-200 p-2.5 text-center sm:text-left">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">Fuel level</p>
                  <p className="font-semibold text-gray-900 mt-0.5">{fuelPct != null ? `${Math.round(fuelPct)}%` : '—'}</p>
                </div>
                <div className="rounded-sm border border-gray-200 p-2.5 text-center sm:text-left">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">Power</p>
                  <p className="font-semibold text-gray-900 mt-0.5">{powerStatusLabel}</p>
                </div>
              </div>
            </div>
          </section>

          <section className={PANEL_ROW}>
            <SectionHeader number={5} title="Recent deliveries" />
            <p className={PANEL_DESC}>Latest gate arrivals.</p>
            <div className="flex-1 flex flex-col min-h-0">
              {recentDeliveries.length === 0 ? (
                <p className={EMPTY}>No deliveries logged.</p>
              ) : (
                <ul className="space-y-2 flex-1 overflow-y-auto max-h-[200px] pr-0.5">
                  {recentDeliveries.map((d) => (
                    <li key={d.id} className="rounded-sm border border-gray-100 bg-gray-50/80 px-3 py-2">
                      <div className="flex justify-between gap-2 text-sm font-medium text-gray-900">
                        <span className="truncate">{d.source_name}</span>
                        <span className="tabular-nums shrink-0">{formatL(d.litres)}</span>
                      </div>
                      <div className="mt-0.5 flex justify-between text-xs text-gray-500">
                        <span>{d.source_type_label}</span>
                        <span>{formatTimeAgo(d.arrived_at)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Link
              href={buildOpsHref('/operations/gate')}
              className="mt-auto pt-4 inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline"
            >
              All gate deliveries
              <Icon icon={faArrowRight} size="xs" />
            </Link>
          </section>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <section className={`${PANEL_ROW} min-h-[360px]`}>
          <SectionHeader number={6} title="MCC profile (from onboarding)" />
          <p className={PANEL_DESC}>Wizard completion and operational baseline.</p>
          <div className="flex-1 flex flex-col min-h-[240px]">
            <MccOnboardingProfilePanel
              variant="compact"
              profile={onboardingProfile ?? null}
              coolingTanks={coolingTanks}
              completion={onboardingCompletion}
              accountName={accountLabel}
            />
          </div>
          <Link
            href="/operations/mcc-profile"
            className="mt-auto pt-4 inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline"
          >
            Full MCC profile
            <Icon icon={faArrowRight} size="xs" />
          </Link>
        </section>

        <section className={PANEL_ROW}>
          <SectionHeader number={7} title="Cooling tanks (from onboarding)" />
          <p className={PANEL_DESC}>
            {onboardingProfile?.source_submission_code
              ? `Synced from submission ${onboardingProfile.source_submission_code}.`
              : 'Tank inventory declared during MCC onboarding.'}
          </p>
          {coolingTanks.length === 0 ? (
            <p className={EMPTY}>
              {hasOnboardingProfile
                ? 'No individual tanks recorded.'
                : 'No onboarding data synced yet. In admin, link this account to the MCC onboarding submission.'}
            </p>
          ) : (
            <div className="flex-1 min-h-0 overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse">
                <thead>
                  <tr>
                    <th className={TH}>Tank</th>
                    <th className={TH}>Capacity (L)</th>
                    <th className={TH}>Year / age</th>
                    <th className={TH}>Condition</th>
                  </tr>
                </thead>
                <tbody>
                  {coolingTanks.map((t, idx) => (
                    <tr key={`${t.tank_number ?? 'tank'}-${idx}`}>
                      <td className={TD}>{t.tank_number?.trim() || `Tank ${idx + 1}`}</td>
                      <td className={TD}>
                        {t.capacity_litres != null ? Math.round(t.capacity_litres).toLocaleString() : '—'}
                      </td>
                      <td className={TD_MUTED}>{t.year_or_age?.trim() || '—'}</td>
                      <td className={TD_MUTED}>{t.condition?.trim() || '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className={`${TD} font-semibold`} colSpan={1}>
                      Total
                    </td>
                    <td className={`${TD} font-semibold`} colSpan={3}>
                      {tankCapacityLitres > 0
                        ? `${Math.round(tankCapacityLitres).toLocaleString()} L`
                        : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
        <section className={PANEL}>
          <SectionHeader number={8} title="Top farmers (this month)" />
          {topFarmers.length === 0 ? (
            <p className={EMPTY}>No farmer collections this month.</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full min-w-[280px]">
                <thead>
                  <tr>
                    <th className={TH}>Farmer</th>
                    <th className={`${TH} text-right`}>Litres</th>
                    <th className={`${TH} text-right`}>Del.</th>
                    <th className={TH}>Quality</th>
                  </tr>
                </thead>
                <tbody>
                  {topFarmers.map((f) => (
                    <tr key={f.supplier_account_id} className="hover:bg-gray-50/80">
                      <td className={TD}>{f.name}</td>
                      <td className={`${TD} text-right tabular-nums`}>{f.litres.toLocaleString()}</td>
                      <td className={`${TD} text-right tabular-nums`}>{f.deliveries}</td>
                      <td className={TD_MUTED}>
                        {f.quality_grade !== '—' && f.quality_score_pct != null
                          ? `${f.quality_grade} (${f.quality_score_pct}%)`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={PANEL}>
          <SectionHeader number={9} title="Top collectors (this month)" />
          {topCollectors.length === 0 ? (
            <p className={EMPTY}>No collector intake this month.</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full min-w-[280px]">
                <thead>
                  <tr>
                    <th className={TH}>Collector</th>
                    <th className={`${TH} text-right`}>Litres</th>
                    <th className={`${TH} text-right`}>Farms</th>
                    <th className={TH}>Compliance</th>
                  </tr>
                </thead>
                <tbody>
                  {topCollectors.map((c, i) => (
                    <tr key={`${c.name}-${i}`} className="hover:bg-gray-50/80">
                      <td className={TD}>{c.name}</td>
                      <td className={`${TD} text-right tabular-nums`}>{c.litres.toLocaleString()}</td>
                      <td className={`${TD} text-right tabular-nums`}>{c.farms_served}</td>
                      <td className={TD_MUTED}>{c.compliance_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={PANEL}>
          <SectionHeader number={10} title="Staff on shift" />
          {mccLoading && staffRows.length === 0 ? (
            <p className={EMPTY}>Loading roster…</p>
          ) : staffRows.length === 0 ? (
            <p className={EMPTY}>No gate staff linked.</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full min-w-[300px]">
                <thead>
                  <tr>
                    <th className={TH}>Name</th>
                    <th className={TH}>Role</th>
                    <th className={TH}>Shift</th>
                    <th className={TH}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {staffRows.slice(0, 6).map((row) => (
                    <tr key={row.user_account_id} className="hover:bg-gray-50/80">
                      <td className={TD}>{row.name}</td>
                      <td className={TD_MUTED}>{staffRoleLabel(row.role)}</td>
                      <td className={TD_MUTED}>Day</td>
                      <td className={TD}>
                        <span className={row.on_duty ? badgeSubmitted(true) : badgeNeutral()}>
                          {row.on_duty ? 'On shift' : 'Off'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Link href={buildOpsHref('/operations/staff')} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline">
            View staff
            <Icon icon={faArrowRight} size="xs" />
          </Link>
        </section>

        <section className={PANEL}>
          <SectionHeader number={11} title="Quick actions" />
          <div className="grid grid-cols-2 gap-2">
            {canViewAnalytics && onQuickAction ? (
              <button
                type="button"
                onClick={() => onQuickAction('transaction')}
                className="flex flex-col items-center gap-2 rounded-sm border border-gray-200 p-3 text-center hover:border-[var(--primary)] hover:bg-[var(--primary)]/5"
              >
                <Icon icon={faReceipt} className="text-[var(--primary)]" />
                <span className="text-xs font-semibold text-gray-800">Record expense</span>
              </button>
            ) : null}
            {canManageUsers ? (
              <Link
                href={buildOpsHref('/operations/staff')}
                className="flex flex-col items-center gap-2 rounded-sm border border-gray-200 p-3 text-center no-underline hover:border-[var(--primary)] hover:bg-[var(--primary)]/5"
              >
                <Icon icon={faUsers} className="text-[var(--primary)]" />
                <span className="text-xs font-semibold text-gray-800">Staff</span>
              </Link>
            ) : null}
            {canCreateCollections && onQuickAction ? (
              <button
                type="button"
                onClick={() => onQuickAction('collection')}
                className="flex flex-col items-center gap-2 rounded-sm border border-gray-200 p-3 text-center hover:border-[var(--primary)] hover:bg-[var(--primary)]/5"
              >
                <Icon icon={faPlus} className="text-[var(--primary)]" />
                <span className="text-xs font-semibold text-gray-800">New collection</span>
              </button>
            ) : null}
            <Link
              href="/finance"
              className="flex flex-col items-center gap-2 rounded-sm border border-gray-200 p-3 text-center no-underline hover:border-[var(--primary)] hover:bg-[var(--primary)]/5"
            >
              <Icon icon={faWallet} className="text-[var(--primary)]" />
              <span className="text-xs font-semibold text-gray-800">Payments</span>
            </Link>
            <Link
              href={buildOpsHref('/operations/manifests')}
              className="flex flex-col items-center gap-2 rounded-sm border border-gray-200 p-3 text-center no-underline hover:border-[var(--primary)] hover:bg-[var(--primary)]/5"
            >
              <Icon icon={faFileAlt} className="text-[var(--primary)]" />
              <span className="text-xs font-semibold text-gray-800">Manifests</span>
            </Link>
            {canCreateSales && onQuickAction ? (
              <button
                type="button"
                onClick={() => onQuickAction('sale')}
                className="flex flex-col items-center gap-2 rounded-sm border border-gray-200 p-3 text-center hover:border-[var(--primary)] hover:bg-[var(--primary)]/5"
              >
                <Icon icon={faChartLine} className="text-[var(--primary)]" />
                <span className="text-xs font-semibold text-gray-800">New sale</span>
              </button>
            ) : null}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <section className={`${PANEL} lg:col-span-4`}>
          <SectionHeader number={10} title="Collection by route (today)" />
          {routes.length === 0 ? (
            <p className={EMPTY}>No routes for {rangeDateTo}.</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full min-w-[400px]">
                <thead>
                  <tr>
                    <th className={TH}>Route</th>
                    <th className={TH}>Collector</th>
                    <th className={`${TH} text-right`}>Farms</th>
                    <th className={`${TH} text-right`}>Litres</th>
                    <th className={TH}>Compliance</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((r) => (
                    <tr key={r.route_label} className="hover:bg-gray-50/80">
                      <td className={TD}>{r.route_label}</td>
                      <td className={TD_MUTED}>{r.collector_name}</td>
                      <td className={`${TD} text-right tabular-nums`}>{r.farms_count}</td>
                      <td className={`${TD} text-right tabular-nums`}>{r.litres.toLocaleString()}</td>
                      <td className={TD_MUTED}>{r.compliance_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={`${PANEL} lg:col-span-5`}>
          <SectionHeader number={11} title="Rejections requiring follow-up" />
          {gateRejections.length === 0 ? (
            <p className={EMPTY}>No rejections for {rangeDateTo}.</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr>
                    <th className={TH}>Delivered by</th>
                    <th className={`${TH} text-right`}>Vol (L)</th>
                    <th className={TH}>Cause</th>
                    <th className={TH}>Elapsed</th>
                    <th className={TH}>Status</th>
                    <th className={`${TH} text-right`}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {gateRejections.map((r) => (
                    <tr key={r.test_result_id} className="hover:bg-gray-50/80">
                      <td className={TD}>{r.source_label}</td>
                      <td className={`${TD} text-right tabular-nums`}>{r.volume_litres}</td>
                      <td className={TD}>
                        <span className="line-clamp-1" title={r.rejection_cause}>
                          {r.rejection_cause}
                        </span>
                      </td>
                      <td className={TD_MUTED}>
                        {r.hours_elapsed != null ? `${r.hours_elapsed}h` : '—'}
                      </td>
                      <td className={TD}>
                        <span className={badgeNeutral()}>{r.follow_up_status ?? resolutionLabel(r.resolution_status)}</span>
                      </td>
                      <td className={`${TD} text-right`}>
                        {r.resolution_status === 'resolved' ? (
                          <span className="text-xs text-gray-400">Done</span>
                        ) : canApproveTraceability ? (
                          <button
                            type="button"
                            onClick={() => approveResolution(r.test_result_id)}
                            className="rounded-sm border border-[var(--primary)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary)]/5"
                          >
                            Review
                          </button>
                        ) : (
                          <Link
                            href={buildOpsHref('/operations/traceability', { outcome: 'rejected' })}
                            className="text-xs font-semibold text-[var(--primary)] hover:underline"
                          >
                            View
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={`${PANEL} lg:col-span-3`}>
          <SectionHeader number={14} title="Payments overview" />
          {payments ? (
            <ul className="space-y-3 text-sm flex-1">
              <li className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-600">Payments this week</span>
                <span className="font-semibold text-gray-900">
                  {formatMoney(payments.payments_week_amount, mcc?.wallet?.currency ?? 'RWF')}
                  <span className="text-gray-500 font-normal"> ({payments.payments_week_count})</span>
                </span>
              </li>
              <li className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-600">Payments yesterday</span>
                <span className="font-semibold text-gray-900">
                  {formatMoney(payments.payments_yesterday_amount, mcc?.wallet?.currency ?? 'RWF')}
                </span>
              </li>
              <li className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-600">Pending payments</span>
                <span className="font-semibold text-amber-800">
                  {formatMoney(payments.pending_payments_amount, mcc?.wallet?.currency ?? 'RWF')}
                  <span className="font-normal text-gray-500"> ({payments.pending_payments_count})</span>
                </span>
              </li>
              <li className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-600">Holds (quality)</span>
                <span className="font-semibold text-gray-900">{payments.holds_quality_count}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-600">Holds (other)</span>
                <span className="font-semibold text-gray-900">{payments.holds_other_count}</span>
              </li>
              <li className="flex justify-between pt-2 border-t border-gray-200">
                <span className="text-gray-700 font-medium">Wallet balance</span>
                <span className="font-bold text-gray-900">{walletValue}</span>
              </li>
            </ul>
          ) : (
            <p className={EMPTY}>Payment summary unavailable.</p>
          )}
          <Link href="/finance" className="mt-auto pt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline">
            View payments
            <Icon icon={faArrowRight} size="xs" />
          </Link>
        </section>
      </div>

      {alerts.length > 0 ? (
        <section className={PANEL}>
          <SectionHeader number={15} title="Alerts" />
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {alerts.slice(0, 4).map((a) => (
              <li
                key={a.id}
                className={`rounded-sm border px-3 py-2 text-sm ${
                  a.tone === 'critical'
                    ? 'border-red-200 bg-red-50/90'
                    : a.tone === 'warn'
                      ? 'border-amber-200 bg-amber-50/80'
                      : 'border-gray-200 bg-gray-50/90'
                }`}
              >
                <span className="font-semibold text-gray-900">{a.title}</span>
                <p className="text-gray-600 mt-0.5 text-xs">{a.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
