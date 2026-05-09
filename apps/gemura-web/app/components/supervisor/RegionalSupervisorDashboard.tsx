'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Icon, {
  faBuilding,
  faChartLine,
  faClipboardList,
  faDownload,
  faTriangleExclamation,
  faUserFriends,
  faCheck,
  faClock,
  faChevronDown,
} from '@/app/components/Icon';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { supervisorApi, type SupervisorAccountRow, type SupervisorScope } from '@/lib/api/supervisor';
import { useAuthStore } from '@/store/auth';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const PANEL = 'bg-white border border-gray-200 rounded-sm p-5 flex flex-col min-h-0';
const SCROLL_MAX = 'max-h-[min(50vh,24rem)]';
const SCROLL_TABLE = `min-h-0 ${SCROLL_MAX} overflow-auto overscroll-y-contain rounded-sm border border-gray-100`;
const SCROLL_LIST = `min-h-0 ${SCROLL_MAX} overflow-y-auto overflow-x-hidden overscroll-y-contain space-y-2 pr-0.5`;
const TH =
  'text-left py-2 px-3 text-xs font-medium text-gray-500 border-b border-gray-200 bg-gray-50 sticky top-0 z-[1] shadow-[0_1px_0_0_rgb(229_231_235)]';
const TD = 'py-2.5 px-3 text-sm text-gray-900 border-b border-gray-100 align-middle';
const TD_MUTED = 'py-2.5 px-3 text-sm text-gray-500 border-b border-gray-100 align-middle';

const MCC_PORTFOLIO = [
  {
    id: '1',
    name: 'Gahengeri MCC',
    litres: 5842,
    spark: [42, 48, 52, 55, 58],
    manifestPct: 92,
    rejectPct: 1.4,
    tankPct: 68,
    status: 'good' as const,
  },
  {
    id: '2',
    name: 'Busoro MCC',
    litres: 6120,
    spark: [50, 52, 54, 56, 61],
    manifestPct: 88,
    rejectPct: 2.1,
    tankPct: 82,
    status: 'fair' as const,
  },
  {
    id: '3',
    name: 'Nyagatare MCC',
    litres: 4980,
    spark: [38, 40, 41, 44, 50],
    manifestPct: 85,
    rejectPct: 2.8,
    tankPct: 71,
    status: 'fair' as const,
  },
  {
    id: '4',
    name: 'Kirehe MCC',
    litres: 7210,
    spark: [55, 58, 62, 68, 72],
    manifestPct: 79,
    rejectPct: 4.2,
    tankPct: 91,
    status: 'at_risk' as const,
  },
  {
    id: '5',
    name: 'Rwamagana MCC',
    litres: 5490,
    spark: [44, 46, 48, 51, 55],
    manifestPct: 91,
    rejectPct: 1.9,
    tankPct: 64,
    status: 'good' as const,
  },
];

const MAP_PINS = [
  { id: '1', label: 'Gahengeri', top: '18%', left: '22%', tone: 'good' as const },
  { id: '2', label: 'Busoro', top: '35%', left: '38%', tone: 'fair' as const },
  { id: '3', label: 'Nyagatare', top: '28%', left: '58%', tone: 'fair' as const },
  { id: '4', label: 'Kirehe', top: '52%', left: '48%', tone: 'at_risk' as const },
  { id: '5', label: 'Rwamagana', top: '45%', left: '72%', tone: 'good' as const },
];

const INTERVENTIONS = [
  {
    id: '1',
    mcc: 'Kirehe MCC',
    issue: 'High rejection rate vs regional average',
    severity: 'high' as const,
    owner: 'R. Niyonzima',
    due: 'Today 16:00',
  },
  {
    id: '2',
    mcc: 'Nyagatare MCC',
    issue: 'Manifest compliance below 85% (3rd day)',
    severity: 'medium' as const,
    owner: 'J. Uwimana',
    due: 'Tomorrow 09:00',
  },
  {
    id: '3',
    mcc: 'Busoro MCC',
    issue: 'Tank capacity >85% — evening projection',
    severity: 'medium' as const,
    owner: 'P. Habimana',
    due: 'May 18 14:00',
  },
  {
    id: '4',
    mcc: 'Gahengeri MCC',
    issue: 'Staff coverage gap (morning shift)',
    severity: 'low' as const,
    owner: 'M. Mukamana',
    due: 'May 19',
  },
];

const SCOREBOARD = [
  { id: '1', mcc: 'Gahengeri MCC', tank: 68, power: 'Grid', gen: 'Ready', test: 94, staff: 88, buyer: 'ok', esc: 1 },
  { id: '2', mcc: 'Busoro MCC', tank: 82, power: 'Grid', gen: 'Ready', test: 88, staff: 82, buyer: 'watch', esc: 2 },
  { id: '3', mcc: 'Nyagatare MCC', tank: 71, power: 'Grid', gen: 'Fuel low', test: 81, staff: 79, buyer: 'ok', esc: 3 },
  { id: '4', mcc: 'Kirehe MCC', tank: 91, power: 'Grid', gen: 'Running', test: 72, staff: 70, buyer: 'hold', esc: 6 },
  { id: '5', mcc: 'Rwamagana MCC', tank: 64, power: 'Grid', gen: 'Ready', test: 90, staff: 92, buyer: 'ok', esc: 0 },
];

const VISIT_TABS = ['All', 'Site visits', 'Audits', 'Follow-ups'] as const;
const VISITS = [
  { id: '1', when: 'May 18 · 09:00', mcc: 'Kirehe MCC', type: 'Site visit', owner: 'R. Niyonzima', tab: 1 },
  { id: '2', when: 'May 18 · 14:30', mcc: 'Nyagatare MCC', type: 'Audit', owner: 'J. Uwimana', tab: 2 },
  { id: '3', when: 'May 19 · 10:00', mcc: 'Busoro MCC', type: 'Follow-up', owner: 'P. Habimana', tab: 3 },
  { id: '4', when: 'May 20 · 08:30', mcc: 'Gahengeri MCC', type: 'Site visit', owner: 'M. Mukamana', tab: 1 },
];

const NOTES = [
  { id: '1', tone: 'info' as const, author: 'Racheal N.', time: 'May 17 · 10:12', text: 'Eastern cluster: all MCCs submitted morning gate summaries on time.' },
  { id: '2', tone: 'warn' as const, author: 'J. Uwimana', time: 'May 17 · 09:40', text: 'Kirehe escalation — coordinating with MCC manager on rejection batch.' },
  { id: '3', tone: 'ok' as const, author: 'P. Habimana', time: 'May 16 · 16:05', text: 'Busoro tank sensor verified; projection revised down 4%.' },
];

const ESCALATIONS = [
  { id: '1', issue: 'Payment hold — manifest mismatch', mcc: 'Kirehe MCC', severity: 'high' as const, raised: 'May 16 11:20', status: 'open' as const },
  { id: '2', issue: 'Generator runtime exceeded policy', mcc: 'Nyagatare MCC', severity: 'medium' as const, raised: 'May 15 08:00', status: 'in_progress' as const },
  { id: '3', issue: 'Traceability audit finding', mcc: 'Busoro MCC', severity: 'low' as const, raised: 'May 14 15:45', status: 'resolved' as const },
];

const TREND_DATES = ['May 4', 'May 5', 'May 6', 'May 7', 'May 8', 'May 9', 'May 10', 'May 11', 'May 12', 'May 13', 'May 14', 'May 15', 'May 16', 'May 17'];
const TREND_SERIES = {
  Gahengeri: [4200, 4400, 4600, 4500, 4800, 5000, 4900, 5100, 5300, 5200, 5500, 5600, 5700, 5842],
  Busoro: [4800, 4900, 5000, 5200, 5100, 5300, 5400, 5500, 5600, 5800, 5900, 6000, 6050, 6120],
  Nyagatare: [3600, 3700, 3800, 3900, 4000, 4100, 4200, 4300, 4400, 4500, 4600, 4700, 4850, 4980],
  Kirehe: [6200, 6300, 6400, 6500, 6600, 6700, 6800, 6900, 7000, 7050, 7100, 7150, 7180, 7210],
  Rwamagana: [4000, 4100, 4200, 4300, 4400, 4500, 4600, 4700, 4800, 4900, 5000, 5200, 5350, 5490],
};

function SectionHeader({ number, title }: { number: number; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-[var(--primary)] text-[10px] font-bold text-white">
        {number}
      </span>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
    </div>
  );
}

function MiniSparkline({ values, color = '#004AAD' }: { values: number[]; color?: string }) {
  const w = 56;
  const h = 18;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1 || 1)) * (w - 2) + 1;
      const y = h - 1 - ((v - min) / span) * (h - 4);
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={pts} />
    </svg>
  );
}

function StatusPill({ kind }: { kind: 'good' | 'fair' | 'at_risk' }) {
  const map = {
    good: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    fair: 'bg-amber-50 text-amber-900 border-amber-200',
    at_risk: 'bg-red-50 text-red-800 border-red-200',
  };
  const label = kind === 'good' ? 'Good' : kind === 'fair' ? 'Fair' : 'At risk';
  return <span className={`inline-flex rounded-sm border px-2 py-0.5 text-xs font-semibold ${map[kind]}`}>{label}</span>;
}

function SeverityBadge({ s }: { s: 'high' | 'medium' | 'low' }) {
  const map = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-amber-100 text-amber-900',
    low: 'bg-gray-100 text-gray-700',
  };
  return <span className={`rounded-sm px-2 py-0.5 text-[10px] font-semibold capitalize ${map[s]}`}>{s}</span>;
}

function KpiStrip({
  label,
  value,
  sub,
  trend,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  trend?: string;
  icon: IconDefinition;
  accent: 'blue' | 'green' | 'amber' | 'red' | 'slate';
}) {
  const map = {
    blue: { bg: '#eff6ff', fg: '#004AAD' },
    green: { bg: '#dcfce7', fg: '#059669' },
    amber: { bg: '#fef3c7', fg: '#b45309' },
    red: { bg: '#fee2e2', fg: '#b91c1c' },
    slate: { bg: '#f1f5f9', fg: '#475569' },
  } as const;
  const accentMeta = map[accent];
  return (
    <div className="rounded-sm border border-gray-200 bg-white p-4 min-h-[104px] min-w-0 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-500 truncate">{label}</div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums text-gray-900 truncate">{value}</div>
          <div className="mt-1.5 text-xs text-gray-600 line-clamp-2">{sub}</div>
          {trend ? <div className="mt-1 text-xs font-medium text-emerald-700 truncate">{trend}</div> : null}
        </div>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: accentMeta.bg, color: accentMeta.fg }}
        >
          <Icon icon={icon} size="sm" />
        </div>
      </div>
    </div>
  );
}

function ProgressCell({ pct, color }: { pct: number; color?: 'blue' | 'amber' | 'red' }) {
  const bar =
    color === 'red' ? 'bg-red-500' : color === 'amber' ? 'bg-amber-500' : 'bg-[var(--primary)]';
  return (
    <div className="flex items-center gap-2 min-w-[72px]">
      <div className="flex-1 h-1.5 rounded-sm bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-sm ${bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-xs tabular-nums text-gray-700 w-8 text-right">{pct}%</span>
    </div>
  );
}

export interface RegionalSupervisorDashboardProps {
  regionName?: string; // legacy mock prop (ignored once dynamic)
  districtCount?: number; // legacy mock prop (ignored once dynamic)
  mccCount?: number; // legacy mock prop (ignored once dynamic)
}

export default function RegionalSupervisorDashboard({
  regionName: _regionName = 'Eastern Region',
  districtCount: _districtCount = 5,
  mccCount: _mccCount = 5,
}: RegionalSupervisorDashboardProps) {
  const searchParams = useSearchParams();
  const regionId = searchParams?.get('region_id')?.trim() || '';
  const districtId = searchParams?.get('district_id')?.trim() || '';
  const apiAccountId = useAuthStore((s) => s.currentAccount?.account_id?.trim()) || undefined;

  const [scope, setScope] = useState<SupervisorScope | null>(null);
  const [summary, setSummary] = useState<{
    mcc_count: number;
    members: number;
    suppliers: number;
    customers: number;
    farms: number;
    sales: number;
    collections: number;
  } | null>(null);
  const [accounts, setAccounts] = useState<SupervisorAccountRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [visitTab, setVisitTab] = useState(0);
  const filteredVisits = useMemo(() => {
    if (visitTab === 0) return VISITS;
    return VISITS.filter((v) => v.tab === visitTab);
  }, [visitTab]);

  const chartOptions: ApexCharts.ApexOptions = useMemo(
    () => ({
      chart: { type: 'line', toolbar: { show: false }, fontFamily: 'inherit', zoom: { enabled: false } },
      stroke: { curve: 'smooth', width: 2 },
      colors: ['#004AAD', '#059669', '#d97706', '#dc2626', '#7c3aed'],
      markers: { size: 0 },
      legend: { position: 'top', fontSize: '11px' },
      xaxis: { categories: TREND_DATES, labels: { rotate: -35, style: { fontSize: '9px', colors: '#6b7280' } } },
      yaxis: {
        labels: {
          formatter: (v) => `${(v / 1000).toFixed(1)}k`,
          style: { fontSize: '10px', colors: '#6b7280' },
        },
      },
      grid: { borderColor: '#f3f4f6', strokeDashArray: 4 },
      dataLabels: { enabled: false },
      tooltip: { y: { formatter: (v) => `${Math.round(v).toLocaleString()} L` } },
    }),
    [],
  );

  const chartSeries = useMemo(
    () => [
      { name: 'Gahengeri', data: TREND_SERIES.Gahengeri },
      { name: 'Busoro', data: TREND_SERIES.Busoro },
      { name: 'Nyagatare', data: TREND_SERIES.Nyagatare },
      { name: 'Kirehe', data: TREND_SERIES.Kirehe },
      { name: 'Rwamagana', data: TREND_SERIES.Rwamagana },
    ],
    [],
  );

  const pinColor = (tone: 'good' | 'fair' | 'at_risk') =>
    tone === 'good' ? 'bg-emerald-500' : tone === 'fair' ? 'bg-amber-500' : 'bg-red-500';

  const effectiveDistrictCount = useMemo(() => {
    if (!scope) return 0;
    if (districtId) return 1;
    if (regionId) return scope.districts.filter((d) => d.province_id === regionId).length;
    return scope.districts.length;
  }, [scope, regionId, districtId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const accountParams = apiAccountId ? { account_id: apiAccountId } : {};
    Promise.all([
      supervisorApi.getScope(accountParams),
      supervisorApi.getSummary({
        ...accountParams,
        region_id: regionId || undefined,
        district_location_id: districtId || undefined,
      }),
      supervisorApi.getAccounts({
        ...accountParams,
        limit: 50,
        account_type: 'tenant',
        region_id: regionId || undefined,
        district_location_id: districtId || undefined,
      }),
    ])
      .then(([scopeRes, summaryRes, accountsRes]) => {
        if (cancelled) return;
        setScope(scopeRes.code === 200 ? scopeRes.data : null);
        setSummary(summaryRes.code === 200 ? summaryRes.data : null);
        setAccounts(accountsRes.code === 200 ? accountsRes.data.rows : []);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg =
          (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ??
          (e as Error)?.message ??
          'Failed to load supervisor dashboard';
        setError(msg);
        setScope(null);
        setSummary(null);
        setAccounts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [regionId, districtId, apiAccountId]);

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-sm border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900">{error}</div>
      ) : null}

      {/* KPI strip */}
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiStrip
            label="MCCs in scope"
            value={loading ? '—' : String(summary?.mcc_count ?? 0)}
            sub={`${effectiveDistrictCount} districts`}
            icon={faBuilding}
            accent="blue"
          />
          <KpiStrip
            label="Members"
            value={loading ? '—' : String(summary?.members ?? 0)}
            sub="Active memberships"
            icon={faUserFriends}
            accent="slate"
          />
          <KpiStrip
            label="Milk sales (count)"
            value={loading ? '—' : String(summary?.sales ?? 0)}
            sub="Transactions as supplier"
            icon={faChartLine}
            accent="green"
          />
          <KpiStrip
            label="Milk collections (count)"
            value={loading ? '—' : String(summary?.collections ?? 0)}
            sub="Transactions as customer"
            icon={faClipboardList}
            accent="blue"
          />
          <KpiStrip label="Avg manifest compliance" value="—" sub="Mock" icon={faClipboardList} accent="amber" />
          <KpiStrip label="Avg rejection rate" value="—" sub="Mock" icon={faTriangleExclamation} accent="amber" />
          <KpiStrip label="Tank utilization" value="—" sub="Mock" icon={faBuilding} accent="amber" />
          <KpiStrip label="Open field actions" value="—" sub="Mock" icon={faClipboardList} accent="slate" />
        </div>
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 min-h-0">
        <section className={`${PANEL} xl:col-span-5 min-h-0`}>
          <SectionHeader number={1} title="MCC portfolio snapshot" />
          <div className={`min-h-0 -mx-1 ${SCROLL_TABLE}`}>
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <th className={`${TH} min-w-[14rem]`}>MCC</th>
                  <th className={`${TH} text-right`}>Members</th>
                  <th className={`${TH} text-right`}>Sales</th>
                  <th className={`${TH} text-right`}>Collections</th>
                  <th className={`${TH} text-right`}>Farms</th>
                  <th className={TH}>District</th>
                </tr>
              </thead>
              <tbody>
                {accounts.length === 0 ? (
                  <tr>
                    <td className={`${TD_MUTED}`} colSpan={6}>
                      {loading ? 'Loading…' : 'No MCCs found in this scope.'}
                    </td>
                  </tr>
                ) : (
                  accounts.map((row) => {
                    const m = row.stats ?? {
                      members: 0,
                      suppliers: 0,
                      customers: 0,
                      sales: 0,
                      collections: 0,
                      farms: 0,
                    };
                    return (
                    <tr key={row.id} className="hover:bg-gray-50/80">
                      <td className={`${TD} font-medium whitespace-nowrap`}>{row.name}</td>
                      <td className={`${TD} text-right tabular-nums`}>{m.members.toLocaleString()}</td>
                      <td className={`${TD} text-right tabular-nums`}>{m.sales.toLocaleString()}</td>
                      <td className={`${TD} text-right tabular-nums`}>{m.collections.toLocaleString()}</td>
                      <td className={`${TD} text-right tabular-nums`}>{m.farms.toLocaleString()}</td>
                      <td className={`${TD} text-gray-700`}>{row.operational_district_label || '—'}</td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <Link href="/suppliers" className="mt-3 text-xs font-semibold text-[var(--primary)] hover:underline">
            View all MCCs →
          </Link>
        </section>

        <section className={`${PANEL} xl:col-span-4 min-h-0`}>
          <div className="flex items-center justify-between gap-2">
            <SectionHeader number={2} title="Regional map / coverage" />
            <span className="inline-flex items-center rounded-sm border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
              Mock
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            {effectiveDistrictCount} districts · {summary?.mcc_count ?? 0} MCCs · status by location
          </p>
          <div className="relative h-56 rounded-sm border border-gray-200 bg-gradient-to-br from-sky-50 via-emerald-50/40 to-amber-50/30 overflow-hidden">
            <div className="absolute inset-2 rounded-sm border border-dashed border-gray-300/60" />
            {MAP_PINS.map((p) => (
              <div
                key={p.id}
                className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2"
                style={{ top: p.top, left: p.left }}
              >
                <span className={`h-3 w-3 rounded-full ring-2 ring-white shadow ${pinColor(p.tone)}`} title={p.label} />
                <span className="mt-0.5 max-w-[4.5rem] truncate text-[9px] font-medium text-gray-800 bg-white/90 px-1 rounded">{p.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-600">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Good
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Fair
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> At risk
            </span>
          </div>
        </section>

        <section className={`${PANEL} xl:col-span-3 min-h-0`}>
          <SectionHeader number={3} title="Priority intervention queue" />
          <div className={`min-h-0 -mx-1 ${SCROLL_TABLE}`}>
            <table className="w-full min-w-[300px]">
              <thead>
                <tr>
                  <th className={TH}>MCC</th>
                  <th className={TH}>Issue</th>
                  <th className={TH}>Sev.</th>
                  <th className={TH}>Owner</th>
                  <th className={TH}>Due</th>
                  <th className={`${TH} text-right`}></th>
                </tr>
              </thead>
              <tbody>
                {INTERVENTIONS.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/80">
                    <td className={`${TD} font-medium whitespace-nowrap`}>{r.mcc}</td>
                    <td className={`${TD} max-w-[10rem]`}>
                      <span className="line-clamp-2 text-sm">{r.issue}</span>
                    </td>
                    <td className={TD}>
                      <SeverityBadge s={r.severity} />
                    </td>
                    <td className={TD_MUTED}>{r.owner}</td>
                    <td className={`${TD_MUTED} text-xs whitespace-nowrap`}>{r.due}</td>
                    <td className={`${TD} text-right`}>
                      <button type="button" className="text-xs font-semibold text-[var(--primary)] hover:underline">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link href="/operations/manifests" className="mt-3 text-xs font-semibold text-[var(--primary)] hover:underline">
            View all interventions →
          </Link>
        </section>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
        <section className={`${PANEL} min-h-0`}>
          <SectionHeader number={4} title="Cross-MCC trends (14-day total litres)" />
          <div className="h-64 min-h-[14rem] max-h-[min(42vh,20rem)]">
            <Chart options={chartOptions} series={chartSeries} type="line" height="100%" />
          </div>
        </section>

        <section className={`${PANEL} min-h-0`}>
          <SectionHeader number={5} title="Supervision scoreboard" />
          <div className={`min-h-0 -mx-1 ${SCROLL_TABLE}`}>
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <th className={TH}>MCC</th>
                  <th className={TH}>Tank</th>
                  <th className={TH}>Power</th>
                  <th className={TH}>Gen.</th>
                  <th className={TH}>Testing</th>
                  <th className={TH}>Staff</th>
                  <th className={TH}>Buyer / pay</th>
                  <th className={`${TH} text-right`}>Esc.</th>
                </tr>
              </thead>
              <tbody>
                {SCOREBOARD.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/80">
                    <td className={`${TD} font-medium`}>{r.mcc}</td>
                    <td className={TD}>
                      <ProgressCell pct={r.tank} color={r.tank >= 85 ? 'red' : 'blue'} />
                    </td>
                    <td className={`${TD_MUTED} text-xs`}>{r.power}</td>
                    <td className={`${TD_MUTED} text-xs`}>{r.gen}</td>
                    <td className={TD}>
                      <ProgressCell pct={r.test} color={r.test < 80 ? 'amber' : 'blue'} />
                    </td>
                    <td className={TD}>
                      <ProgressCell pct={r.staff} color="blue" />
                    </td>
                    <td className={TD}>
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${
                          r.buyer === 'ok' ? 'bg-emerald-500' : r.buyer === 'watch' ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        title={r.buyer}
                      />
                    </td>
                    <td className={`${TD} text-right tabular-nums font-medium`}>{r.esc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link href="/dashboard" className="mt-3 text-xs font-semibold text-[var(--primary)] hover:underline">
            Open scoreboard detail →
          </Link>
        </section>
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        <section className={`${PANEL} min-h-0`}>
          <SectionHeader number={6} title="Upcoming visits & tasks" />
          <div className="flex gap-1 mb-3 flex-wrap">
            {VISIT_TABS.map((t, i) => (
              <button
                key={t}
                type="button"
                onClick={() => setVisitTab(i)}
                className={`rounded-sm px-2.5 py-1 text-xs font-medium transition-colors ${
                  visitTab === i ? 'bg-[var(--primary)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className={SCROLL_LIST}>
            {filteredVisits.map((v) => (
              <div key={v.id} className="rounded-sm border border-gray-200 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-900">{v.type}</span>
                  <span className="inline-flex items-center gap-1 rounded-sm bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                    <Icon icon={faClock} size="xs" />
                    Scheduled
                  </span>
                </div>
                <div className="text-sm font-medium text-gray-800 mt-1">{v.mcc}</div>
                <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-2">
                  <span>{v.when}</span>
                  <span>· {v.owner}</span>
                </div>
              </div>
            ))}
          </div>
          <Link href="#" className="mt-3 text-xs font-semibold text-[var(--primary)] hover:underline">
            View calendar →
          </Link>
        </section>

        <section className={`${PANEL} min-h-0`}>
          <SectionHeader number={7} title="Regional notes" />
          <div className={SCROLL_LIST}>
            {NOTES.map((n) => (
              <div
                key={n.id}
                className={`flex gap-2 rounded-sm border px-3 py-2.5 text-sm ${
                  n.tone === 'warn' ? 'border-amber-200 bg-amber-50/80' : n.tone === 'ok' ? 'border-emerald-200 bg-emerald-50/70' : 'border-blue-200 bg-blue-50/70'
                }`}
              >
                <span className="mt-0.5 shrink-0">
                  {n.tone === 'warn' ? (
                    <Icon icon={faTriangleExclamation} className="text-amber-600" size="sm" />
                  ) : n.tone === 'ok' ? (
                    <Icon icon={faCheck} className="text-emerald-600" size="sm" />
                  ) : (
                    <Icon icon={faClipboardList} className="text-blue-600" size="sm" />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="text-xs text-gray-500">
                    <span className="font-semibold text-gray-800">{n.author}</span> · {n.time}
                  </div>
                  <p className="text-sm text-gray-800 mt-0.5 leading-snug break-words">{n.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={`${PANEL} min-h-0`}>
          <SectionHeader number={8} title="Escalations to Gemura Ops" />
          <div className={`min-h-0 -mx-1 ${SCROLL_TABLE}`}>
            <table className="w-full min-w-[320px]">
              <thead>
                <tr>
                  <th className={TH}>Issue</th>
                  <th className={TH}>MCC</th>
                  <th className={TH}>Severity</th>
                  <th className={TH}>Raised</th>
                  <th className={TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {ESCALATIONS.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50/80">
                    <td className={`${TD} max-w-[11rem]`}>
                      <span className="line-clamp-2 text-sm">{e.issue}</span>
                    </td>
                    <td className={`${TD} font-medium text-xs whitespace-nowrap`}>{e.mcc}</td>
                    <td className={TD}>
                      <SeverityBadge s={e.severity} />
                    </td>
                    <td className={`${TD_MUTED} text-xs whitespace-nowrap`}>{e.raised}</td>
                    <td className={TD}>
                      <span
                        className={`rounded-sm px-2 py-0.5 text-[10px] font-semibold capitalize ${
                          e.status === 'open'
                            ? 'bg-red-50 text-red-800'
                            : e.status === 'in_progress'
                              ? 'bg-amber-50 text-amber-900'
                              : 'bg-emerald-50 text-emerald-800'
                        }`}
                      >
                        {e.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link href="#" className="mt-3 text-xs font-semibold text-[var(--primary)] hover:underline">
            View all escalations →
          </Link>
        </section>
      </div>
    </div>
  );
}
