'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { OverviewResponse, OverviewRecentTransaction } from '@/lib/api/stats';
import type { MccManagerOverviewData } from '@/lib/api/mcc-manager';
import { mccManagerApi } from '@/lib/api/mcc-manager';
import { employeesApi } from '@/lib/api/employees';
import { useToastStore } from '@/store/toast';
import { usePermission } from '@/hooks/usePermission';
import Icon, {
  faBell,
  faBox,
  faClipboardList,
  faTriangleExclamation,
  faUserFriends,
} from '@/app/components/Icon';
import StatCard from '@/app/components/StatCard';

type OverviewData = OverviewResponse['data'];

const BLUE = { iconBgColor: '#eff6ff', iconColor: 'var(--primary)' };
const GREEN = { iconBgColor: '#dcfce7', iconColor: '#059669' };
const AMBER = { iconBgColor: '#fef3c7', iconColor: '#b45309' };
const RED = { iconBgColor: '#fee2e2', iconColor: '#b91c1c' };

/** Matches dashboard chart / donut: sales-style green, collections-style blue */
const SPLIT_DIRECT = '#059669';
const SPLIT_UMUCUNDA = '#004AAD';

const PANEL =
  'bg-white border border-gray-200 rounded-sm p-6 min-h-0 h-full flex flex-col';
const PANEL_TITLE = 'text-base font-semibold text-gray-900';
const PANEL_DESC = 'text-sm text-gray-500 mt-1 mb-4';
const TH = 'text-left py-2.5 px-3 text-xs font-medium text-gray-700 border-b border-gray-200';
const TD = 'py-2.5 px-3 text-sm text-gray-900 border-b border-gray-100 align-middle';
const TD_MUTED = 'py-2.5 px-3 text-sm text-gray-600 border-b border-gray-100 align-middle';
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

function splitStatLabel(pk: OpsPeriodKey): string {
  switch (pk) {
    case 'day':
      return 'Direct vs Umucunda (today)';
    case 'week':
      return 'Direct vs Umucunda (week)';
    case 'month':
      return 'Direct vs Umucunda (month)';
    case 'quarter':
      return 'Direct vs Umucunda (quarter)';
    case 'year':
      return 'Direct vs Umucunda (year)';
    case 'custom':
      return 'Direct vs Umucunda (range)';
    default:
      return 'Direct vs Umucunda';
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

function resolutionLabel(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'resolved') return 'Resolved';
  if (s === 'secondary_test') return 'Secondary test pending';
  if (s === 'frozen') return 'Frozen';
  if (s === 'auto_zero') return 'Auto zero';
  return 'Unresolved';
}

function badgeSubmitted(on: boolean) {
  return on
    ? 'inline-flex rounded-sm bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800'
    : 'inline-flex rounded-sm bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900';
}

function badgeNeutral() {
  return 'inline-flex rounded-sm bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800';
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

  const rejectionAlertCount = gateRejections.length + rejectedMilkInPeriod.length;

  const alerts = useMemo(() => {
    const list: { id: string; priority: number; title: string; detail: string; tone: 'critical' | 'warn' | 'info' }[] =
      [];
    if (periodKey === 'day' && litresPeriod > 8000) {
      list.push({
        id: 'tank',
        priority: 1,
        title: 'Tank capacity',
        detail: 'Cold storage trending high versus typical evening fill — confirm sensor or dip reading.',
        tone: 'warn',
      });
    }
    const pendingManifests = manifestRows.filter((m) => !m.submitted).length;
    if (pendingManifests > 0) {
      list.push({
        id: 'manifest',
        priority: 2,
        title: 'Umucunda manifest window',
        detail: `${pendingManifests} route(s) still pending submission or acceptance.`,
        tone: 'warn',
      });
    } else {
      list.push({
        id: 'manifest',
        priority: 4,
        title: 'Umucunda manifest window',
        detail:
          periodKey === 'day'
            ? 'No manifest flags on today’s gate data.'
            : `No manifest flags on gate snapshot (${rangeDateTo}).`,
        tone: 'info',
      });
    }
    if (rejectionAlertCount > 0) {
      list.push({
        id: 'reject',
        priority: 0,
        title: 'Rejection follow-up',
        detail: `${gateRejections.length} gate test(s), ${rejectedMilkInPeriod.length} milk sale record(s) — review within 48h.`,
        tone: 'critical',
      });
    }
    list.push({
      id: 'gen',
      priority: 3,
      title: 'Generator fuel check',
      detail: 'Weekly walk-down due when maintenance scheduling is enabled.',
      tone: 'info',
    });
    list.push({
      id: 'credit',
      priority: 5,
      title: 'Farmer credit tier',
      detail: 'No automatic tier changes pending.',
      tone: 'info',
    });
    list.push({
      id: 'ops',
      priority: 6,
      title: 'Gemura Ops',
      detail: 'No inbound escalations.',
      tone: 'info',
    });
    return list.sort((a, b) => a.priority - b.priority);
  }, [
    litresPeriod,
    periodKey,
    rangeDateTo,
    rejectionAlertCount,
    gateRejections.length,
    rejectedMilkInPeriod.length,
    manifestRows,
  ]);

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

  return (
    <div className="space-y-4 mb-4">
      {mccError ? (
        <div className="rounded-sm border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900">
          {mccError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
        <StatCard
          label={collectionsStatLabel(periodKey)}
          value={formatL(litresPeriod)}
          subtitle={[
            litres7Avg > 0.01
              ? `Trailing 7-day avg ${formatL(litres7Avg)}/day · ${intakeVsAvg === 'good' ? 'On track' : intakeVsAvg === 'amber' ? 'Watch' : 'Below trend'}`
              : 'Compare after more history',
            gate && gate.total_litres > 0
              ? `Gate (${rangeDateTo}): ${formatL(gate.total_litres)} · ${gate.delivery_count} load${gate.delivery_count === 1 ? '' : 's'}`
              : '',
          ]
            .filter(Boolean)
            .join(' · ')}
          icon={faBox}
          href="/collections"
          {...(intakeVsAvg === 'good' ? GREEN : intakeVsAvg === 'amber' ? AMBER : intakeVsAvg === 'bad' ? RED : BLUE)}
        />
        <StatCard
          label={splitStatLabel(periodKey)}
          value={splitTotal > 0 ? `${pctDirect}% / ${pctUmu}%` : '—'}
          subtitle={
            splitTotal > 0
              ? `${formatL(directL)} direct · ${formatL(umucundaL)} Umucunda${useGateSplit ? ' · gate' : ' · estimate'}`
              : mccLoading
                ? 'Loading…'
                : periodKey === 'day'
                  ? 'No gate or same-day collections'
                  : `No gate on ${rangeDateTo} · sample from recent txn list only`
          }
          icon={faClipboardList}
          href="/collections#gate-arrivals"
          {...BLUE}
        />
        <StatCard
          label={rejectionsStatLabel(periodKey)}
          value={String(gateRejections.length + rejectedMilkInPeriod.length)}
          subtitle={
            gateRejections.length || rejectedMilkInPeriod.length
              ? `${gateRejections.length} gate test · ${rejectedMilkInPeriod.length} milk sale`
              : 'None'
          }
          icon={faTriangleExclamation}
          href="/collections"
          {...(gateRejections.length + rejectedMilkInPeriod.length ? AMBER : GREEN)}
        />
        <StatCard
          label="Manifest compliance"
          value={manifestRows.length ? `${submittedCount}/${manifestRows.length}` : mccLoading ? '…' : '0/0'}
          subtitle={
            manifestRows.length
              ? `Submitted / scheduled · gate ${rangeDateTo} (UTC)`
              : `No manifest rows for gate ${rangeDateTo}`
          }
          icon={faClipboardList}
          href="/operations/manifests"
          {...BLUE}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
        <section className={PANEL}>
          <h3 className={PANEL_TITLE}>Delivery source</h3>
          <p className={PANEL_DESC}>Direct farmer vs Umucunda volume from gate deliveries.</p>
          {splitTotal <= 0 ? (
            <p className={EMPTY}>
              {mccLoading
                ? 'Loading…'
                : `No gate intake for ${rangeDateTo}. Collections can still exist without gate records.`}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex h-3 overflow-hidden rounded-sm bg-gray-100">
                <div className="min-w-0 transition-all" style={{ width: `${pctDirect}%`, backgroundColor: SPLIT_DIRECT }} title="Direct" />
                <div className="min-w-0 transition-all" style={{ width: `${pctUmu}%`, backgroundColor: SPLIT_UMUCUNDA }} title="Umucunda" />
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>
                  <span className="inline-block h-2 w-2 rounded-sm mr-1.5 align-middle" style={{ backgroundColor: SPLIT_DIRECT }} />
                  Direct {pctDirect}%
                </span>
                <span>
                  <span className="inline-block h-2 w-2 rounded-sm mr-1.5 align-middle" style={{ backgroundColor: SPLIT_UMUCUNDA }} />
                  Umucunda {pctUmu}%
                </span>
              </div>
            </div>
          )}

          <div className="mt-6 border-t border-gray-200 pt-6">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Manifest compliance</h4>
            {manifestRows.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">No manifest rows for gate {rangeDateTo}.</p>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full min-w-[320px]">
                  <thead>
                    <tr>
                      <th className={TH}>Route / reference</th>
                      <th className={`${TH} text-right`}>Expected (L)</th>
                      <th className={TH}>Submitted</th>
                      <th className={TH}>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manifestRows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50/80">
                        <td className={TD}>
                          <div className="font-medium text-gray-900">{row.route_label}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{row.manifest_ref}</div>
                        </td>
                        <td className={`${TD} text-right tabular-nums`}>{row.expected_litres}</td>
                        <td className={TD}>
                          <span className={badgeSubmitted(row.submitted)}>{row.submitted ? 'Yes' : 'Pending'}</span>
                          <div className="text-xs text-gray-500 mt-1 capitalize">{row.status}</div>
                        </td>
                        <td className={TD}>
                          <span className={row.payment_hold ? 'text-amber-700 font-medium text-sm' : 'text-gray-600 text-sm'}>
                            {row.payment_hold ? 'On hold' : 'Clear'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className={PANEL}>
          <h3 className={`${PANEL_TITLE} flex items-center gap-2`}>
            <Icon icon={faUserFriends} className="text-[var(--primary)]" size="sm" />
            Staff on shift
          </h3>
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
                    <th className={`${TH} text-right`}>Tasks</th>
                    <th className={TH}>Duty</th>
                    <th className={TH}>Shift</th>
                  </tr>
                </thead>
                <tbody>
                  {staffRows.map((row) => (
                    <tr key={row.user_account_id} className="hover:bg-gray-50/80">
                      <td className={`${TD} font-medium`}>{row.name}</td>
                      <td className={TD}>
                        {canReassignGateStaff ? (
                          <select
                            value={row.role}
                            onChange={(e) => reassignRole(row.user_account_id, e.target.value)}
                            className="w-full min-w-0 max-w-[200px] rounded-sm border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                            aria-label={`Role for ${row.name}`}
                          >
                            {!GATE_ROLE_OPTIONS.some((o) => o.value === row.role) ? (
                              <option value={row.role}>{row.role}</option>
                            ) : null}
                            {GATE_ROLE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-sm text-gray-800">{row.role}</span>
                        )}
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>{row.tasks_done}</td>
                      <td className={TD}>
                        <span className={row.on_duty ? 'text-sm font-medium text-emerald-700' : 'text-sm text-gray-400'}>
                          {row.on_duty ? 'On duty' : 'Off'}
                        </span>
                      </td>
                      <td className={TD_MUTED}>
                        {row.shift_started_at ? (
                          (() => {
                            const hrs = (Date.now() - new Date(row.shift_started_at!).getTime()) / 3600000;
                            return hrs > 8 ? (
                              <span className="rounded-sm bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">
                                &gt; 8h
                              </span>
                            ) : (
                              <span className="tabular-nums">{hrs.toFixed(1)}h</span>
                            );
                          })()
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={PANEL}>
          <h3 className={PANEL_TITLE}>Rejection traceability</h3>
          <p className={PANEL_DESC}>Rejected gate tests for gate day {rangeDateTo} (UTC).</p>
          {gateRejections.length === 0 ? (
            <p className={EMPTY}>No gate rejection tests for {rangeDateTo}.</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full min-w-[520px]">
                <thead>
                  <tr>
                    <th className={TH}>Source</th>
                    <th className={`${TH} text-right`}>Vol (L)</th>
                    <th className={TH}>Cause</th>
                    <th className={TH}>Farms</th>
                    <th className={TH}>Status</th>
                    <th className={`${TH} text-right`}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {gateRejections.map((r) => (
                    <tr key={r.test_result_id} className="hover:bg-gray-50/80">
                      <td className={TD}>{r.source_label}</td>
                      <td className={`${TD} text-right tabular-nums`}>{r.volume_litres}</td>
                      <td className={`${TD} max-w-[180px]`}>
                        <span className="line-clamp-2" title={r.rejection_cause}>
                          {r.rejection_cause}
                        </span>
                      </td>
                      <td className={`${TD} max-w-[120px]`}>
                        <span className="line-clamp-2 text-gray-600" title={r.farms_summary}>
                          {r.farms_summary}
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

        <section className={PANEL}>
          <h3 className={`${PANEL_TITLE} flex items-center gap-2`}>
            <Icon icon={faBell} className="text-[var(--primary)]" size="sm" />
            Alerts
          </h3>
          <p className={PANEL_DESC}>Highest priority first.</p>
          <ul className="space-y-2 flex-1">
            {alerts.map((a) => (
              <li
                key={a.id}
                className={`flex gap-3 rounded-sm border px-3 py-3 text-sm ${
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
        </section>
      </div>
    </div>
  );
}
