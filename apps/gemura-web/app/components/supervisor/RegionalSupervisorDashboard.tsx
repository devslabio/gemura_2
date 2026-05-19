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
import {
  supervisorApi,
  type SupervisorDashboardData,
  type SupervisorScope,
} from '@/lib/api/supervisor';
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

const ACTIVITY_TABS = ['All', 'Shifts', 'Gate', 'Manifests', 'Tests'] as const;
const ACTIVITY_KIND_BY_TAB: Record<number, SupervisorDashboardData['activities'][0]['kind'] | null> = {
  1: 'shift',
  2: 'delivery',
  3: 'manifest',
  4: 'test',
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
  href,
}: {
  label: string;
  value: string;
  sub: string;
  trend?: string;
  icon: IconDefinition;
  accent: 'blue' | 'green' | 'amber' | 'red' | 'slate';
  /** When set, entire tile navigates like manager dashboard KPI tiles. */
  href?: string;
}) {
  const map = {
    blue: { bg: '#eff6ff', fg: '#004AAD' },
    green: { bg: '#dcfce7', fg: '#059669' },
    amber: { bg: '#fef3c7', fg: '#b45309' },
    red: { bg: '#fee2e2', fg: '#b91c1c' },
    slate: { bg: '#f1f5f9', fg: '#475569' },
  } as const;
  const accentMeta = map[accent];
  const shell =
    'rounded-sm border border-gray-200 bg-white p-4 min-h-[104px] min-w-0 transition-colors hover:border-gray-300';
  const inner = (
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
  );
  if (href) {
    return (
      <Link
        href={href}
        className={`block ${shell} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2`}
      >
        {inner}
      </Link>
    );
  }
  return <div className={shell}>{inner}</div>;
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

  /** ~30-day window for list pages (sales, collections, gate, manifests, traceability). */
  const drillDownRange = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - 30);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return { from: iso(from), to: iso(to) };
  }, []);

  const withQuery = (path: string, params: Record<string, string>) => {
    const q = new URLSearchParams(params).toString();
    return q ? `${path}?${q}` : path;
  };

  const [dashboard, setDashboard] = useState<SupervisorDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const scope = dashboard?.scope ?? null;
  const summary = dashboard?.summary ?? null;
  const accounts = dashboard?.portfolio ?? [];
  const mapPins = dashboard?.map_pins ?? [];
  const interventions = dashboard?.interventions ?? [];
  const scoreboard = dashboard?.scoreboard ?? [];
  const activities = dashboard?.activities ?? [];
  const escalations = dashboard?.escalations ?? [];
  const trend = dashboard?.trend ?? { date_labels: [], series: [] };

  const [activityTab, setActivityTab] = useState(0);
  const filteredActivities = useMemo(() => {
    if (activityTab === 0) return activities;
    const kind = ACTIVITY_KIND_BY_TAB[activityTab];
    return kind ? activities.filter((a) => a.kind === kind) : activities;
  }, [activities, activityTab]);

  const regionalNotes = useMemo(
    () =>
      activities
        .filter((a) => a.detail?.trim())
        .slice(0, 12)
        .map((a) => ({
          id: a.id,
          tone: a.tone,
          author: a.owner ?? a.mcc_name,
          time: a.when_label,
          text: a.detail!.trim(),
        })),
    [activities],
  );

  const chartOptions: ApexCharts.ApexOptions = useMemo(
    () => ({
      chart: { type: 'line', toolbar: { show: false }, fontFamily: 'inherit', zoom: { enabled: false } },
      stroke: { curve: 'smooth', width: 2 },
      colors: ['#004AAD', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#be185d', '#4d7c0f'],
      markers: { size: 0 },
      legend: { position: 'top', fontSize: '11px' },
      xaxis: {
        categories: trend.date_labels,
        labels: { rotate: -35, style: { fontSize: '9px', colors: '#6b7280' } },
      },
      yaxis: {
        labels: {
          formatter: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v))),
          style: { fontSize: '10px', colors: '#6b7280' },
        },
      },
      grid: { borderColor: '#f3f4f6', strokeDashArray: 4 },
      dataLabels: { enabled: false },
      tooltip: { y: { formatter: (v) => `${Math.round(v).toLocaleString()} L` } },
      noData: { text: 'No gate volume in this period' },
    }),
    [trend.date_labels],
  );

  const chartSeries = useMemo(
    () => trend.series.map((s) => ({ name: s.name, data: s.data })),
    [trend.series],
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
    supervisorApi
      .getDashboard({
        ...accountParams,
        region_id: regionId || undefined,
        district_location_id: districtId || undefined,
        days: 14,
      })
      .then((res) => {
        if (cancelled) return;
        setDashboard(res.code === 200 ? res.data : null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg =
          (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ??
          (e as Error)?.message ??
          'Failed to load supervisor dashboard';
        setError(msg);
        setDashboard(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [regionId, districtId, apiAccountId]);

  const pctOrDash = (v: number | null | undefined, suffix = '%') =>
    loading || v == null ? '—' : `${v}${suffix}`;

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
            href="/suppliers"
          />
          <KpiStrip
            label="Members"
            value={loading ? '—' : String(summary?.members ?? 0)}
            sub="Active memberships"
            icon={faUserFriends}
            accent="slate"
            href="/members"
          />
          <KpiStrip
            label="Milk sales (count)"
            value={loading ? '—' : String(summary?.sales ?? 0)}
            sub="Transactions as supplier"
            icon={faChartLine}
            accent="green"
            href={withQuery('/sales', { date_from: drillDownRange.from, date_to: drillDownRange.to })}
          />
          <KpiStrip
            label="Milk collections (count)"
            value={loading ? '—' : String(summary?.collections ?? 0)}
            sub="Transactions as customer"
            icon={faClipboardList}
            accent="blue"
            href={withQuery('/collections', { date_from: drillDownRange.from, date_to: drillDownRange.to })}
          />
          <KpiStrip
            label="Manifest acceptance"
            value={pctOrDash(summary?.manifest_acceptance_pct)}
            sub="Accepted share of resolved manifests (accepted + rejected)"
            icon={faClipboardList}
            accent="blue"
            href={withQuery('/operations/manifests', { from: drillDownRange.from, to: drillDownRange.to })}
          />
          <KpiStrip
            label="Gate test rejection"
            value={pctOrDash(summary?.quality_test_rejection_pct)}
            sub="Rejected share of completed milk tests at gate"
            icon={faTriangleExclamation}
            accent="amber"
            href={withQuery('/operations/traceability', {
              from: drillDownRange.from,
              to: drillDownRange.to,
              outcome: 'rejected',
            })}
          />
          <KpiStrip
            label="Tank utilization"
            value={pctOrDash(summary?.avg_tank_utilization_pct)}
            sub="Mean tank fill % from latest facility snapshots"
            icon={faBuilding}
            accent="green"
            href={withQuery('/operations/gate', { from: drillDownRange.from, to: drillDownRange.to })}
          />
          <KpiStrip
            label="Open gate shifts"
            value={loading ? '—' : String(summary?.open_staff_shifts ?? 0)}
            sub="Staff shifts without an end time"
            icon={faClipboardList}
            accent="slate"
            href="/operations/shifts"
          />
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
                      <td className={`${TD} font-medium whitespace-nowrap`}>
                        <Link
                          href={`/suppliers/${row.id}`}
                          className="text-[var(--primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded-sm"
                        >
                          {row.name}
                        </Link>
                      </td>
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
          <SectionHeader number={2} title="Regional map / coverage" />
          <p className="text-xs text-gray-500 mb-2">
            {effectiveDistrictCount} districts · {summary?.mcc_count ?? 0} MCCs · status from live ops metrics
          </p>
          <div className="relative h-56 rounded-sm border border-gray-200 bg-gradient-to-br from-sky-50 via-emerald-50/40 to-amber-50/30 overflow-hidden">
            <div className="absolute inset-2 rounded-sm border border-dashed border-gray-300/60" />
            {mapPins.length === 0 ? (
              <p className="absolute inset-0 flex items-center justify-center text-xs text-gray-500 px-4 text-center">
                {loading ? 'Loading map…' : 'No MCCs in scope to plot.'}
              </p>
            ) : (
              mapPins.map((p) => (
                <Link
                  key={p.account_id}
                  href={`/suppliers/${p.account_id}`}
                  className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded-sm"
                  style={{ top: `${p.top_pct}%`, left: `${p.left_pct}%` }}
                  title={p.district_name ? `${p.label} · ${p.district_name}` : p.label}
                >
                  <span className={`h-3 w-3 rounded-full ring-2 ring-white shadow ${pinColor(p.status)}`} />
                  <span className="mt-0.5 max-w-[4.5rem] truncate text-[9px] font-medium text-gray-800 bg-white/90 px-1 rounded">
                    {p.label}
                  </span>
                </Link>
              ))
            )}
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
                {interventions.length === 0 ? (
                  <tr>
                    <td className={TD_MUTED} colSpan={6}>
                      {loading ? 'Loading…' : 'No priority interventions in this scope.'}
                    </td>
                  </tr>
                ) : (
                  interventions.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/80">
                      <td className={`${TD} font-medium whitespace-nowrap`}>{r.mcc_name}</td>
                      <td className={`${TD} max-w-[10rem]`}>
                        <span className="line-clamp-2 text-sm">{r.issue}</span>
                      </td>
                      <td className={TD}>
                        <SeverityBadge s={r.severity} />
                      </td>
                      <td className={TD_MUTED}>{r.owner ?? '—'}</td>
                      <td className={`${TD_MUTED} text-xs whitespace-nowrap`}>{r.due_label ?? '—'}</td>
                      <td className={`${TD} text-right`}>
                        <Link href={r.href} className="text-xs font-semibold text-[var(--primary)] hover:underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
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
                {scoreboard.length === 0 ? (
                  <tr>
                    <td className={TD_MUTED} colSpan={8}>
                      {loading ? 'Loading…' : 'No facility snapshots for MCCs in scope.'}
                    </td>
                  </tr>
                ) : (
                  scoreboard.map((r) => (
                    <tr key={r.account_id} className="hover:bg-gray-50/80">
                      <td className={`${TD} font-medium`}>
                        <Link href={`/suppliers/${r.account_id}`} className="text-[var(--primary)] hover:underline">
                          {r.mcc_name}
                        </Link>
                      </td>
                      <td className={TD}>
                        {r.tank_pct != null ? (
                          <ProgressCell pct={r.tank_pct} color={r.tank_pct >= 85 ? 'red' : 'blue'} />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={`${TD_MUTED} text-xs`}>{r.power ?? '—'}</td>
                      <td className={`${TD_MUTED} text-xs`}>{r.generator ?? '—'}</td>
                      <td className={TD}>
                        {r.test_pct != null ? (
                          <ProgressCell pct={r.test_pct} color={r.test_pct < 80 ? 'amber' : 'blue'} />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={TD}>
                        {r.staff_pct != null ? <ProgressCell pct={r.staff_pct} color="blue" /> : '—'}
                      </td>
                      <td className={TD}>
                        <span
                          className={`inline-block h-2.5 w-2.5 rounded-full ${
                            r.buyer_status === 'ok'
                              ? 'bg-emerald-500'
                              : r.buyer_status === 'watch'
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                          }`}
                          title={r.buyer_status}
                        />
                      </td>
                      <td className={`${TD} text-right tabular-nums font-medium`}>{r.escalation_count}</td>
                    </tr>
                  ))
                )}
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
          <SectionHeader number={6} title="Recent ops activity" />
          <div className="flex gap-1 mb-3 flex-wrap">
            {ACTIVITY_TABS.map((t, i) => (
              <button
                key={t}
                type="button"
                onClick={() => setActivityTab(i)}
                className={`rounded-sm px-2.5 py-1 text-xs font-medium transition-colors ${
                  activityTab === i ? 'bg-[var(--primary)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className={SCROLL_LIST}>
            {filteredActivities.length === 0 ? (
              <p className="text-sm text-gray-500 px-1">{loading ? 'Loading…' : 'No recent activity in this scope.'}</p>
            ) : filteredActivities.map((v) => (
              <div key={v.id} className="rounded-sm border border-gray-200 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-900">{v.title}</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[10px] font-semibold ${
                      v.tone === 'warn'
                        ? 'bg-amber-50 text-amber-900'
                        : v.tone === 'ok'
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-blue-50 text-blue-800'
                    }`}
                  >
                    <Icon icon={faClock} size="xs" />
                    {v.when_label}
                  </span>
                </div>
                <div className="text-sm font-medium text-gray-800 mt-1">{v.mcc_name}</div>
                <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-2">
                  {v.owner ? <span>{v.owner}</span> : null}
                  {v.detail ? <span className="line-clamp-2">{v.detail}</span> : null}
                </div>
                {v.href ? (
                  <Link href={v.href} className="mt-2 inline-block text-xs font-semibold text-[var(--primary)] hover:underline">
                    Open →
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
          <Link href="/operations/gate" className="mt-3 text-xs font-semibold text-[var(--primary)] hover:underline">
            View gate operations →
          </Link>
        </section>

        <section className={`${PANEL} min-h-0`}>
          <SectionHeader number={7} title="Gate & shift notes" />
          <div className={SCROLL_LIST}>
            {regionalNotes.length === 0 ? (
              <p className="text-sm text-gray-500 px-1">{loading ? 'Loading…' : 'No gate or shift notes in this period.'}</p>
            ) : (
              regionalNotes.map((n) => (
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
              ))
            )}
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
                {escalations.length === 0 ? (
                  <tr>
                    <td className={TD_MUTED} colSpan={5}>
                      {loading ? 'Loading…' : 'No open escalations from manifests or gate tests.'}
                    </td>
                  </tr>
                ) : (
                  escalations.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50/80">
                      <td className={`${TD} max-w-[11rem]`}>
                        <Link href={e.href} className="line-clamp-2 text-sm text-[var(--primary)] hover:underline">
                          {e.issue}
                        </Link>
                      </td>
                      <td className={`${TD} font-medium text-xs whitespace-nowrap`}>{e.mcc_name}</td>
                      <td className={TD}>
                        <SeverityBadge s={e.severity} />
                      </td>
                      <td className={`${TD_MUTED} text-xs whitespace-nowrap`}>{e.raised_label}</td>
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
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Link href="/operations/manifests" className="mt-3 text-xs font-semibold text-[var(--primary)] hover:underline">
            View manifests & traceability →
          </Link>
        </section>
      </div>
    </div>
  );
}
