'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ApexOptions } from 'apexcharts';
import type { OverviewResponse, OverviewRecentTransaction } from '@/lib/api/stats';
import type { MccManagerOverviewData } from '@/lib/api/mcc-manager';
import { mccManagerApi } from '@/lib/api/mcc-manager';
import { employeesApi } from '@/lib/api/employees';
import { useToastStore } from '@/store/toast';
import { usePermission } from '@/hooks/usePermission';
import Icon, {
  faBell,
  faBox,
  faArrowRight,
  faChartLine,
  faCheck,
  faClipboardList,
  faClock,
  faTriangleExclamation,
  faUserFriends,
  faWallet,
} from '@/app/components/Icon';

type OverviewData = OverviewResponse['data'];
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

/** Matches dashboard chart / donut: sales-style green, collections-style blue */
const SPLIT_DIRECT = '#059669';
const SPLIT_UMUCUNDA = '#004AAD';

const PANEL =
  'bg-white border border-gray-200 rounded-sm p-5 min-h-0 h-full flex flex-col';
const PANEL_TITLE = 'text-sm font-semibold text-gray-900';
const PANEL_DESC = 'text-xs text-gray-500 mt-1 mb-4';
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

function KpiTile({
  label,
  value,
  sub,
  icon,
  accent,
  href,
}: {
  label: string;
  value: string;
  sub: string;
  icon: Parameters<typeof Icon>[0]['icon'];
  accent: 'blue' | 'green' | 'amber' | 'red' | 'slate';
  href?: string;
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
          <p className="mb-1 text-[11px] font-semibold text-gray-500 truncate">{label}</p>
          <p className="text-[52px] sm:text-[60px] font-black leading-none text-slate-950 tracking-tight whitespace-nowrap">{value}</p>
          <p className="mt-1.5 text-[8px] font-normal leading-tight text-gray-500 line-clamp-2">{sub}</p>
        </div>
        <div
          className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg border border-black/5"
          style={{ backgroundColor: iconAccents[accent].bg, color: iconAccents[accent].fg }}
        >
          <Icon icon={icon} size="sm" />
        </div>
      </div>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="block rounded-sm border border-gray-200 bg-white p-4 min-h-[96px] min-w-0 transition-colors hover:border-gray-300">
        {content}
      </Link>
    );
  }
  return (
    <div className="rounded-sm border border-gray-200 bg-white p-4 min-h-[96px] min-w-0 transition-colors hover:border-gray-300">
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
  const tankLitres = snapshotTankLitres ?? gate?.total_litres ?? litresPeriod;
  const snapshotTankPct = mcc?.facility_snapshot?.tank_used_pct;
  const tankPct: number | null =
    snapshotTankPct != null
      ? Math.max(0, Math.min(100, Math.round(snapshotTankPct)))
      : tankCapacityLitres > 0
        ? Math.max(0, Math.min(100, Math.round((tankLitres / tankCapacityLitres) * 100)))
        : null;
  const tankTone: 'green' | 'amber' | 'red' | 'slate' =
    tankPct == null ? 'slate' : tankPct >= 85 ? 'red' : tankPct >= 70 ? 'amber' : 'green';
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
  const donutSeries = splitTotal > 0 ? [directL, umucundaL] : [0, 0];
  const deliveryShareOptions: ApexOptions = {
    chart: { type: 'donut', toolbar: { show: false }, fontFamily: 'inherit' },
    labels: ['Direct farmer deliveries', 'Umucunda (via collector)'],
    colors: [SPLIT_DIRECT, SPLIT_UMUCUNDA],
    legend: { position: 'right', fontSize: '11px', offsetY: 8 },
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
  const trendCategories = litresTrend.map((t) => t.label);
  const trendExpected = litresTrend.map(() => Math.round(litres7Avg || 0));
  const dailyTrendOptions: ApexOptions = {
    chart: { type: 'line', toolbar: { show: false }, fontFamily: 'inherit' },
    colors: ['#2563eb', '#9ca3af'],
    stroke: { width: [0, 2], curve: 'smooth' },
    plotOptions: { bar: { borderRadius: 4, columnWidth: '52%' } },
    dataLabels: { enabled: false },
    legend: { position: 'top', fontSize: '11px' },
    xaxis: { categories: trendCategories, labels: { rotate: -30, style: { fontSize: '10px', colors: '#6b7280' } } },
    yaxis: {
      labels: {
        formatter: (v: number) => `${Math.round(v / 100) / 10}k`,
      },
    },
    grid: { borderColor: '#f3f4f6', strokeDashArray: 4 },
    tooltip: { y: { formatter: (v: number) => `${Math.round(v).toLocaleString()} L` } },
  };
  const dailyTrendSeries = [
    { name: 'Actual (L)', type: 'column', data: litresTrend.map((t) => Math.round(t.litres)) },
    { name: 'Expected (L)', type: 'line', data: trendExpected },
  ];
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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        <KpiTile
          label={collectionsStatLabel(periodKey)}
          value={formatL(litresPeriod)}
          sub={
            litres7Avg > 0.01
              ? `7d avg ${formatL(litres7Avg)}/d`
              : 'No history yet'
          }
          icon={faBox}
          accent={intakeVsAvg === 'good' ? 'green' : intakeVsAvg === 'amber' ? 'amber' : intakeVsAvg === 'bad' ? 'red' : 'blue'}
          href={buildCollectionsHref()}
        />
        <KpiTile
          label="Deliveries logged / expected"
          value={deliveryExpected > 0 ? `${deliveryLogged}/${deliveryExpected}` : '0/0'}
          sub={
            deliveryExpected > 0
              ? `${deliveryPct}% of expected`
              : profileExpectedDeliveries == null
                ? 'Set expected deliveries'
                : 'No expected routes'
          }
          icon={faClipboardList}
          accent={deliveryPct >= 95 ? 'green' : deliveryPct >= 80 ? 'amber' : 'red'}
          href={buildOpsHref('/operations/gate')}
        />
        <KpiTile
          label="Via Umucunda"
          value={formatL(umucundaL)}
          sub={splitTotal > 0 ? `${pctUmu}% of intake` : 'No split yet'}
          icon={faChartLine}
          accent="blue"
          href={buildOpsHref('/operations/gate', { source_type: 'umucunda' })}
        />
        <KpiTile
          label="Direct Farmer"
          value={formatL(directL)}
          sub={splitTotal > 0 ? `${pctDirect}% of intake` : 'No split yet'}
          icon={faCheck}
          accent="green"
          href={buildCollectionsHref()}
        />
        <KpiTile
          label={rejectionsStatLabel(periodKey)}
          value={formatL(rejectedLitres)}
          sub={`${gateRejections.length} gate • ${rejectedMilkInPeriod.length} sale`}
          icon={faTriangleExclamation}
          accent={rejectedLitres > 0 ? 'amber' : 'green'}
          href={buildOpsHref('/operations/traceability', { outcome: 'rejected' })}
        />
        <KpiTile
          label="Unresolved Sources"
          value={String(unresolvedGateRejections.length)}
          sub={unresolvedGateRejections.length > 0 ? 'Needs follow-up' : 'No pending approvals'}
          icon={faTriangleExclamation}
          accent={unresolvedGateRejections.length > 0 ? 'red' : 'green'}
          href={buildOpsHref('/operations/traceability', { outcome: 'rejected' })}
        />
        <KpiTile
          label="Tank Capacity Used"
          value={tankPct == null ? '—' : `${tankPct}%`}
          sub={
            tankCapacityLitres > 0
              ? `${Math.round(tankLitres).toLocaleString()} / ${tankCapacityLitres.toLocaleString()} L`
              : 'Set tank capacity'
          }
          icon={faClock}
          accent={tankTone}
          href={buildOpsHref('/operations/gate')}
        />
        <KpiTile
          label="Manifest Compliance"
          value={manifestRows.length ? `${manifestPct}%` : mccLoading ? '…' : '100%'}
          sub={manifestRows.length ? `${submittedCount}/${manifestRows.length} submitted` : 'No manifests'}
          icon={faClipboardList}
          accent={manifestPct >= 90 ? 'green' : manifestPct >= 80 ? 'amber' : 'red'}
          href={buildOpsHref('/operations/manifests')}
        />
        <KpiTile
          label="Wallet balance"
          value={walletValue}
          sub="Available"
          icon={faWallet}
          accent="slate"
          href={buildOpsHref('/finance/transactions')}
        />
        <KpiTile
          label="Staff on shift"
          value={String(onDutyCount)}
          sub={`${staffRows.length} scheduled`}
          icon={faUserFriends}
          accent={onDutyCount > 0 ? 'green' : 'amber'}
          href={buildOpsHref('/operations/staff')}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
        <section className={PANEL}>
          <SectionHeader number={1} title="Delivery source breakdown (litres)" />
          <p className={PANEL_DESC}>Direct vs Umucunda (gate day).</p>
          {splitTotal <= 0 ? (
            <p className={EMPTY}>
              {mccLoading
                ? 'Loading…'
                : `No gate intake (${rangeDateTo}).`}
            </p>
          ) : (
            <div>
              <Chart options={deliveryShareOptions} series={donutSeries} type="donut" height={240} />
              <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <span>{formatL(directL)} direct</span>
                <span>{formatL(umucundaL)} Umucunda</span>
              </div>
            </div>
          )}
        </section>

        <section className={PANEL}>
          <SectionHeader number={2} title="Manifest compliance tracker" />
          <p className={PANEL_DESC}>Expected, submitted, payment hold.</p>
          {manifestRows.length === 0 ? (
            <p className={EMPTY}>No manifests ({rangeDateTo}).</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full min-w-[420px]">
                <thead>
                  <tr>
                    <th className={TH}>Collector / route</th>
                    <th className={`${TH} text-right`}>Expected (L)</th>
                    <th className={TH}>Submitted</th>
                    <th className={TH}>Payment hold</th>
                    <th className={TH}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {manifestRows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/80">
                      <td className={TD}>
                        <div className="font-medium text-gray-900">{row.route_label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{row.manifest_ref}</div>
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>{Math.round(row.expected_litres).toLocaleString()}</td>
                      <td className={TD}>
                        <span className={badgeSubmitted(row.submitted)}>
                          {row.submitted ? 'On time' : 'Not submitted'}
                        </span>
                      </td>
                      <td className={TD_MUTED}>
                        {row.payment_hold ? <span className="text-amber-700 font-medium">On hold</span> : 'No'}
                      </td>
                      <td className={TD_MUTED}>
                        {row.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-auto pt-3 flex justify-center">
            <Link href={buildOpsHref('/operations/manifests')} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline">
              All manifests
              <Icon icon={faArrowRight} size="xs" />
            </Link>
          </div>
        </section>

        <section className={PANEL}>
          <SectionHeader number={3} title="Rejection events & traceability status" />
          <p className={PANEL_DESC}>Rejected gate tests ({rangeDateTo}).</p>
          {gateRejections.length === 0 ? (
            <p className={EMPTY}>No gate rejections.</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full min-w-[460px]">
                <thead>
                  <tr>
                    <th className={TH}>Source</th>
                    <th className={`${TH} text-right`}>Vol (L)</th>
                    <th className={TH}>Cause</th>
                    <th className={TH}>Farms</th>
                    <th className={TH}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {gateRejections.slice(0, 6).map((r) => (
                    <tr key={r.test_result_id} className="hover:bg-gray-50/80">
                      <td className={TD}>{r.source_label}</td>
                      <td className={`${TD} text-right tabular-nums`}>{r.volume_litres}</td>
                      <td className={TD}>
                        <span title={r.rejection_cause}>
                          {r.rejection_cause}
                        </span>
                      </td>
                      <td className={TD}>
                        <span className="text-gray-600" title={r.farms_summary}>
                          {r.farms_summary}
                        </span>
                      </td>
                      <td className={TD}>
                        <span className={badgeNeutral()}>{resolutionLabel(r.resolution_status)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-auto pt-3 flex justify-center">
            <Link href={buildOpsHref('/operations/traceability', { outcome: 'rejected' })} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline">
              Rejection log
              <Icon icon={faArrowRight} size="xs" />
            </Link>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
        <section className={PANEL}>
          <SectionHeader number={4} title="Tank capacity & cooling status" />
          <div className="space-y-4">
            <div className="rounded-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{tankTitle}</span>
                <span className="text-sm font-semibold text-gray-900">{tankPct == null ? '—' : `${tankPct}%`}</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-sm bg-gray-100">
                <div
                  className={`h-full rounded-sm ${tankTone === 'red' ? 'bg-red-500' : tankTone === 'amber' ? 'bg-amber-500' : tankTone === 'green' ? 'bg-emerald-500' : 'bg-gray-300'}`}
                  style={{ width: `${tankPct ?? 0}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {tankCapacityLitres > 0
                  ? `${Math.round(tankLitres).toLocaleString()} / ${tankCapacityLitres.toLocaleString()} L`
                  : 'Tank capacity not set'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-sm border border-gray-200 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Temperature</p>
                <p className="mt-1 text-sm font-semibold text-emerald-700">{temperatureValue}</p>
              </div>
              <div className="rounded-sm border border-gray-200 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Power status</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{powerStatusLabel}</p>
              </div>
              <div className="rounded-sm border border-gray-200 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Generator</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{generatorLabel}</p>
              </div>
              <div className="rounded-sm border border-gray-200 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Capacity status</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {tankPct == null ? 'Not set' : tankTone === 'red' ? 'Critical' : tankTone === 'amber' ? 'Watch' : 'Safe'}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              {tankCapacityLitres > 0
                ? 'Target: keep below 85% by evening intake close.'
                : 'Set tank capacity in operational profile to enable utilization targets.'}
            </p>
          </div>
        </section>

        <section className={PANEL}>
          <SectionHeader number={5} title="Staff on shift" />
          <p className={PANEL_DESC}>Gate-facing roles. Changes sync to employee access.</p>
          {mccLoading && staffRows.length === 0 ? (
            <p className={EMPTY}>Loading roster…</p>
          ) : staffRows.length === 0 ? (
            <p className={EMPTY}>No gate-role staff on this account.</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full min-w-[360px]">
                <thead>
                  <tr>
                    <th className={TH}>Name</th>
                    <th className={TH}>Role</th>
                    <th className={`${TH} text-right`}>Task completion</th>
                    <th className={TH}>Hours</th>
                    <th className={`${TH} text-right`}>Reassign</th>
                  </tr>
                </thead>
                <tbody>
                  {staffRows.map((row) => (
                    <tr key={row.user_account_id} className="hover:bg-gray-50/80">
                      <td className={`${TD} font-medium`}>{row.name}</td>
                      <td className={TD}>
                        <span className="inline-flex rounded-sm border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-700">
                          {staffRoleLabel(row.role)}
                        </span>
                      </td>
                      <td className={`${TD} text-right`}>
                        <div className="inline-flex items-center gap-2 min-w-[78px]">
                          <div className="h-1.5 w-14 rounded-sm bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-sm bg-emerald-500"
                              style={{ width: `${Math.max(6, Math.min(100, row.tasks_done))}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-gray-700">{row.tasks_done}%</span>
                        </div>
                      </td>
                      <td className={TD_MUTED}>
                        {row.shift_started_at
                          ? `${((Date.now() - new Date(row.shift_started_at).getTime()) / 3600000).toFixed(1)}h`
                          : '—'}
                      </td>
                      <td className={`${TD} text-right`}>
                        {canReassignGateStaff ? (
                          <button
                            type="button"
                            className="rounded-sm border border-gray-300 bg-white px-2.5 py-1 text-xs text-[var(--primary)] hover:bg-[var(--primary)]/5"
                          >
                            Reassign
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-auto pt-3 flex justify-start">
            <Link href={buildOpsHref('/operations/staff')} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline">
              View full staff schedule
              <Icon icon={faArrowRight} size="xs" />
            </Link>
          </div>
        </section>

        <section className={PANEL}>
          <SectionHeader number={6} title="Alerts queue" />
          <ul className="space-y-2 flex-1">
            {alerts.map((a) => (
              <li
                key={a.id}
                className={`flex gap-3 rounded-sm border px-3 py-2.5 text-sm ${
                  a.tone === 'critical'
                    ? 'border-red-200 bg-red-50/90'
                    : a.tone === 'warn'
                      ? 'border-amber-200 bg-amber-50/80'
                      : 'border-gray-200 bg-gray-50/90'
                }`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-white/80 text-xs font-semibold text-gray-500 border border-gray-200">
                  {a.priority}
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900">{a.title}</div>
                  <div className="text-gray-600 mt-0.5 leading-snug">{a.detail}</div>
                </div>
              </li>
            ))}
          </ul>
          <Link href="/alerts" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline">
            View all alerts
            <Icon icon={faArrowRight} size="xs" />
          </Link>
        </section>
      </div>

      <section className={PANEL}>
        <SectionHeader number={7} title="Daily litres trend (last 14 days)" />
        {litresTrend.length === 0 ? (
          <p className={EMPTY}>No trend data available for current period.</p>
        ) : (
          <div className="h-64">
            <Chart options={dailyTrendOptions} series={dailyTrendSeries} type="line" height="100%" />
          </div>
        )}
      </section>

      <section className={PANEL}>
        <SectionHeader number={8} title="Rejection source resolution actions" />
        <p className={PANEL_DESC}>Manager action queue for unresolved gate test sources.</p>
        {gateRejections.length === 0 ? (
          <p className={EMPTY}>No actionable gate rejections for {rangeDateTo}.</p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr>
                  <th className={TH}>Source</th>
                  <th className={`${TH} text-right`}>Vol (L)</th>
                  <th className={TH}>Cause</th>
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
                      <span title={r.rejection_cause}>
                        {r.rejection_cause}
                      </span>
                    </td>
                    <td className={TD}>
                      <span className={badgeNeutral()}>{resolutionLabel(r.resolution_status)}</span>
                    </td>
                    <td className={`${TD} text-right`}>
                      {r.resolution_status === 'resolved' ? (
                        <span className="text-sm text-gray-400">Done</span>
                      ) : canApproveTraceability ? (
                        <button
                          type="button"
                          onClick={() => approveResolution(r.test_result_id)}
                          className="rounded-sm border border-[var(--primary)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary)]/5 transition-colors"
                        >
                          Approve
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">View only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
