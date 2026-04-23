'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { PermissionService } from '@/lib/services/permission.service';
import { adminApi } from '@/lib/api/admin';
import { useToastStore } from '@/store/toast';
import Icon, { faArrowLeft, faClipboardList } from '@/app/components/Icon';
import { DetailPageSkeleton } from '@/app/components/SkeletonLoader';

type Submission = Record<string, any>;

const SECTION7_REQUIREMENTS: { key: string; label: string }[] = [
  { key: 'coolingCapacity', label: 'Functioning cooling tank with confirmed capacity' },
  { key: 'connectivityViable', label: '3G/4G OR offline sync confirmed viable' },
  { key: 'powerBackup', label: 'Power backup (generator or solar) for cooling tank' },
  { key: 'ledgerWillingness', label: 'Management willing to adopt daily digital ledger' },
  { key: 'qualityEquipment', label: 'Milk quality testing equipment present and in use' },
  { key: 'amlClear', label: 'No active AML or blacklist flags (auto-screen result)' },
  { key: 'minFarmers', label: 'Minimum 10 farmers currently supplying' },
  { key: 'rejectionTracking', label: 'At least basic rejection reason tracking in place' },
];

const SECTION4_REJECTION_REASONS = [
  'Low fat content',
  'Umurara (fermentation)',
  'Amazi (water adulteration)',
  'Umubanji (antibiotic contamination)',
  'High temperature on arrival',
  'Other (specify below)',
];

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

function formatNumber(value: unknown, suffix = ''): string {
  if (isBlank(value)) return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `${n.toLocaleString()}${suffix}`;
}

function formatText(value: unknown): string {
  if (isBlank(value)) return '—';
  return String(value);
}

function Card({
  title,
  step,
  subtitle,
  actions,
  children,
}: {
  title: string;
  step?: string | number;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-sm">
      <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
        <div className="flex items-start gap-3">
          {step !== undefined && (
            <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-semibold">
              {step}
            </span>
          )}
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {actions}
      </header>
      <div className="p-6">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  mono,
  full,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  full?: boolean;
}) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className={`text-sm text-gray-900 mt-1 ${mono ? 'font-mono' : ''}`}>
        {isBlank(value) ? <span className="text-gray-400">—</span> : value}
      </dd>
    </div>
  );
}

function FieldGrid({ cols = 2, children }: { cols?: 1 | 2 | 3 | 4; children: ReactNode }) {
  const gridCls =
    cols === 1
      ? 'grid-cols-1'
      : cols === 2
        ? 'grid-cols-1 sm:grid-cols-2'
        : cols === 3
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          : 'grid-cols-2 sm:grid-cols-4';
  return <dl className={`grid ${gridCls} gap-x-6 gap-y-4`}>{children}</dl>;
}

function Chips({ items, tone = 'neutral' }: { items: unknown; tone?: 'neutral' | 'primary' }) {
  if (!Array.isArray(items) || items.length === 0) return <span className="text-gray-400">—</span>;
  const cls =
    tone === 'primary'
      ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
      : 'bg-gray-100 text-gray-700';
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, idx) => (
        <span key={`${idx}-${String(item)}`} className={`inline-flex px-2 py-0.5 rounded-full text-xs ${cls}`}>
          {String(item)}
        </span>
      ))}
    </div>
  );
}

function PassFailDot({ status }: { status?: string }) {
  const passed = status === 'pass';
  const failed = status === 'fail';
  const label = passed ? 'Pass' : failed ? 'Fail' : 'n/a';
  const cls = passed
    ? 'bg-green-100 text-green-800'
    : failed
      ? 'bg-red-100 text-red-800'
      : 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          passed ? 'bg-green-600' : failed ? 'bg-red-600' : 'bg-gray-400'
        }`}
      />
      {label}
    </span>
  );
}

function DecisionBadge({ decision }: { decision?: string }) {
  const value = (decision || '').toUpperCase();
  const cls =
    value === 'PASS'
      ? 'bg-green-100 text-green-800 border-green-200'
      : value === 'CONDITIONAL'
        ? 'bg-amber-100 text-amber-900 border-amber-200'
        : value === 'FAIL'
          ? 'bg-red-100 text-red-800 border-red-200'
          : 'bg-gray-100 text-gray-600 border-gray-200';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold border ${cls}`}>
      {value || '—'}
    </span>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const cls =
    status === 'pending'
      ? 'bg-amber-100 text-amber-900'
      : status === 'approved'
        ? 'bg-green-100 text-green-800'
        : status === 'rejected'
          ? 'bg-red-100 text-red-800'
          : status === 'needs_changes'
            ? 'bg-blue-100 text-blue-800'
            : 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex self-start px-2 py-1 rounded text-xs font-semibold ${cls}`}>
      {status || '—'}
    </span>
  );
}

export default function OnboardingSubmissionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { currentAccount } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [error, setError] = useState('');
  const [showPayload, setShowPayload] = useState(false);
  const [approvePassword, setApprovePassword] = useState('');
  const [linkUserId, setLinkUserId] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [needsNotes, setNeedsNotes] = useState('');
  const [acting, setActing] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  useEffect(() => {
    if (!PermissionService.canManageUsers() && !PermissionService.isAdmin()) {
      router.replace('/admin/onboarding');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await adminApi.getOnboardingSubmission(id, currentAccount?.account_id);
        if (cancelled) return;
        if (res.code === 200 && res.data) setSubmission(res.data as Submission);
        else setError('Failed to load submission');
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.message || e?.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, currentAccount?.account_id, router]);

  const refresh = async () => {
    const res = await adminApi.getOnboardingSubmission(id, currentAccount?.account_id);
    if (res.code === 200 && res.data) setSubmission(res.data as Submission);
  };

  const onApprove = async () => {
    if (!submission) return;
    if (submission.review_status === 'approved' && submission.linked_user_id) {
      useToastStore.getState().error('Already approved.');
      return;
    }
    setActing(true);
    setTempPassword(null);
    try {
      const body: { password?: string; linkExistingUserId?: string; reviewNotes?: string } = {};
      if (approvePassword.trim().length >= 8) body.password = approvePassword.trim();
      if (linkUserId.trim()) body.linkExistingUserId = linkUserId.trim();
      if (reviewNotes.trim()) body.reviewNotes = reviewNotes.trim();
      const res = await adminApi.approveOnboardingSubmission(id, body, currentAccount?.account_id);
      if (res.code === 200) {
        useToastStore.getState().success(res.message || 'Approved');
        const payload = res as { data?: { tempPassword?: string } };
        const tp = payload.data?.tempPassword;
        if (typeof tp === 'string') setTempPassword(tp);
        await refresh();
      } else {
        useToastStore.getState().error((res as any).message || 'Approve failed');
      }
    } catch (e: any) {
      useToastStore.getState().error(e?.response?.data?.message || e?.message || 'Approve failed');
    } finally {
      setActing(false);
    }
  };

  const onReject = async () => {
    if (!rejectNotes.trim()) {
      useToastStore.getState().error('Notes are required to reject.');
      return;
    }
    setActing(true);
    try {
      const res = await adminApi.rejectOnboardingSubmission(id, rejectNotes.trim(), currentAccount?.account_id);
      if (res.code === 200) {
        useToastStore.getState().success(res.message || 'Rejected');
        await refresh();
      }
    } catch (e: any) {
      useToastStore.getState().error(e?.response?.data?.message || e?.message || 'Reject failed');
    } finally {
      setActing(false);
    }
  };

  const onNeedsChanges = async () => {
    if (!needsNotes.trim()) {
      useToastStore.getState().error('Notes are required.');
      return;
    }
    setActing(true);
    try {
      const res = await adminApi.needsChangesOnboardingSubmission(id, needsNotes.trim(), currentAccount?.account_id);
      if (res.code === 200) {
        useToastStore.getState().success(res.message || 'Updated');
        await refresh();
      }
    } catch (e: any) {
      useToastStore.getState().error(e?.response?.data?.message || e?.message || 'Request failed');
    } finally {
      setActing(false);
    }
  };

  if (loading) return <DetailPageSkeleton />;
  if (error && !submission) {
    return (
      <div className="space-y-4">
        <Link href="/admin/onboarding" className="text-sm text-gray-600 inline-flex items-center gap-2">
          <Icon icon={faArrowLeft} size="sm" />
          Back
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-sm p-4 text-sm text-red-700">{error}</div>
      </div>
    );
  }
  if (!submission) return null;

  const canAct = submission.review_status === 'pending' || submission.review_status === 'needs_changes';
  const payload = (submission.section_payload || {}) as Record<string, any>;
  const s1 = (payload.section1Location || {}) as Record<string, any>;
  const s2 = (payload.section2 || {}) as Record<string, any>;
  const s3 = (payload.section3 || {}) as Record<string, any>;
  const s4 = (payload.section4 || {}) as Record<string, any>;
  const s5 = (payload.section5 || {}) as Record<string, any>;
  const s6 = (payload.section6 || {}) as Record<string, any>;
  const s7 = (payload.section7 || {}) as Record<string, any>;

  const coolingTanks: Array<Record<string, any>> = Array.isArray(s2.coolingTanks) ? s2.coolingTanks : [];
  const totalCoolingCapacity = coolingTanks.reduce(
    (sum, t) => sum + (Number(t.capacityLitres) || 0),
    0,
  );

  const rejectionRankings = (s4.rejectionRankings || {}) as Record<string, string>;
  const rankedRejections = SECTION4_REJECTION_REASONS
    .map((reason) => ({ reason, rank: rejectionRankings[reason] }))
    .filter((r) => r.rank && ['1', '2', '3'].includes(String(r.rank)))
    .sort((a, b) => Number(a.rank) - Number(b.rank));

  const assessment = (s7.assessment || {}) as Record<string, string>;
  const s7Notes = (s7.notes || {}) as Record<string, string>;

  const lat = s1.latitude;
  const lng = s1.longitude;
  const hasCoords = !isBlank(lat) && !isBlank(lng);

  type LocationLabels = {
    province?: string;
    district?: string;
    sector?: string;
    cell?: string;
    village?: string;
    path?: string;
  };
  const locLabels = submission.location_labels as LocationLabels | undefined;
  const locLevel = (key: keyof LocationLabels, raw: unknown) => {
    const resolved = locLabels?.[key];
    if (typeof resolved === 'string' && resolved.trim().length > 0 && resolved !== '—') return resolved;
    if (!isBlank(raw)) return formatText(raw);
    return '—';
  };

  return (
    <div className="space-y-6">
      <Link
        href="/admin/onboarding"
        className="text-sm text-gray-600 inline-flex items-center gap-2 hover:text-[var(--primary)]"
      >
        <Icon icon={faArrowLeft} size="sm" />
        Back to list
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Icon icon={faClipboardList} />
            {submission.business_name}
          </h1>
          <p className="text-sm text-gray-500 font-mono mt-1">{submission.submission_code}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mt-2">
            <span>
              Submitted{' '}
              <span className="text-gray-700">
                {submission.created_at ? new Date(submission.created_at).toLocaleString() : '—'}
              </span>
            </span>
            <span>
              Wizard decision <DecisionBadge decision={submission.final_decision} />{' '}
              <span className="text-gray-700">({submission.pass_count ?? 0} / 8)</span>
            </span>
          </div>
        </div>
        <StatusBadge status={submission.review_status} />
      </div>

      {tempPassword && (
        <div className="bg-amber-50 border border-amber-200 rounded-sm p-4 text-sm text-amber-950">
          <strong>Temporary password</strong> (copy now; it will not be shown again):{' '}
          <code className="font-mono bg-white px-2 py-0.5 rounded border">{tempPassword}</code>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Business & manager" step="B">
          <FieldGrid cols={2}>
            <Field label="Business name" value={submission.business_name} />
            <Field label="Common / local name" value={submission.common_name} />
            <Field
              label="Manager"
              value={`${submission.manager_first_name || ''} ${submission.manager_last_name || ''}`.trim()}
            />
            <Field label="Manager phone" value={submission.manager_phone} mono />
            <Field label="Manager ID number" value={submission.manager_id_number} mono />
            <Field
              label="Operator has disability"
              value={payload.operatorDisability}
            />
            <Field label="Ownership structure" value={payload.ownershipStructure} />
            {!isBlank(payload.ownershipOther) && (
              <Field label="Ownership — other" value={payload.ownershipOther} />
            )}
            <Field label="RURA / RAB registration" value={payload.registrationNumber} mono />
            <Field label="Operational status" value={payload.operationalStatus} />
            {!isBlank(payload.operationalNotes) && (
              <Field label="Operational notes" value={payload.operationalNotes} full />
            )}
          </FieldGrid>
        </Card>

        <Card title="Review" step="✓">
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-xs uppercase tracking-wide text-gray-500">Current status</dt>
              <dd>
                <StatusBadge status={submission.review_status} />
              </dd>
            </div>
            {submission.review_notes && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">Review notes</dt>
                <dd className="mt-1 whitespace-pre-wrap">{submission.review_notes}</dd>
              </div>
            )}
            {submission.reviewed_at && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">Reviewed</dt>
                <dd className="mt-1">
                  {new Date(submission.reviewed_at).toLocaleString()}
                  {submission.reviewed_by_user?.name && (
                    <span className="text-gray-500"> · by {submission.reviewed_by_user.name}</span>
                  )}
                </dd>
              </div>
            )}
            {submission.linked_user_id && (
              <div className="pt-2 border-t border-gray-100 space-y-1">
                <div>
                  <span className="text-xs uppercase tracking-wide text-gray-500">Linked user: </span>
                  <Link
                    href={`/admin/users/${submission.linked_user_id}`}
                    className="text-[var(--primary)] font-medium hover:underline"
                  >
                    {submission.linked_user?.name || 'Open user'}
                  </Link>
                </div>
                {submission.linked_account_id && (
                  <div>
                    <span className="text-xs uppercase tracking-wide text-gray-500">Account: </span>
                    <Link
                      href={`/admin/accounts/${submission.linked_account_id}`}
                      className="text-[var(--primary)] font-medium hover:underline"
                    >
                      {submission.linked_account?.name || 'Open account'}
                    </Link>
                    {submission.linked_account?.code && (
                      <span className="text-gray-500 font-mono ml-2 text-xs">
                        {submission.linked_account.code}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
            {!submission.review_notes && !submission.reviewed_at && !submission.linked_user_id && (
              <p className="text-sm text-gray-400">No review activity yet.</p>
            )}
          </dl>
        </Card>
      </div>

      <Card title="Location" step="1" subtitle="Section 1 — MCC location & geo">
        {locLabels?.path && locLabels.path !== '—' && (
          <div className="mb-5 rounded-sm border border-gray-100 bg-gray-50 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Administrative hierarchy</div>
            <div className="text-sm font-medium text-gray-900 leading-relaxed">{locLabels.path}</div>
          </div>
        )}
        <FieldGrid cols={3}>
          <Field label="Province" value={locLevel('province', submission.location_province_id || s1.provinceId)} />
          <Field label="District" value={locLevel('district', submission.location_district_id || s1.districtId)} />
          <Field label="Sector" value={locLevel('sector', submission.location_sector_id || s1.sectorId)} />
          <Field label="Cell" value={locLevel('cell', submission.location_cell_id || s1.cellId)} />
          <Field label="Village" value={locLevel('village', submission.location_village_id || s1.villageId)} />
          <Field
            label="Coordinates"
            value={
              hasCoords ? (
                <a
                  href={`https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--primary)] hover:underline font-mono"
                >
                  {lat}, {lng}
                </a>
              ) : (
                '—'
              )
            }
          />
        </FieldGrid>
      </Card>

      <Card title="Cooling, power & connectivity" step="2" subtitle="Section 2 — Infrastructure">
        {coolingTanks.length > 0 ? (
          <div className="mb-5 overflow-x-auto">
            <table className="min-w-full text-sm border border-gray-200 rounded-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Tank</th>
                  <th className="px-3 py-2 text-left font-medium">Capacity (L)</th>
                  <th className="px-3 py-2 text-left font-medium">Year / age</th>
                  <th className="px-3 py-2 text-left font-medium">Condition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {coolingTanks.map((tank, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2">{tank.tankNumber || `Tank ${idx + 1}`}</td>
                    <td className="px-3 py-2 font-mono">{formatNumber(tank.capacityLitres)}</td>
                    <td className="px-3 py-2">{formatText(tank.yearOrAge)}</td>
                    <td className="px-3 py-2">{formatText(tank.condition)}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-medium">
                  <td className="px-3 py-2">Total capacity</td>
                  <td className="px-3 py-2 font-mono">{formatNumber(totalCoolingCapacity, ' L')}</td>
                  <td className="px-3 py-2" colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 mb-4">No cooling tanks declared.</p>
        )}

        <FieldGrid cols={3}>
          <Field label="Daily milk volume (avg L/day)" value={formatNumber(s2.dailyMilkVolume)} />
          <Field label="Max milk in one day (L)" value={formatNumber(s2.maxMilkInOneDay)} />
          <Field label="Tank capacity sufficiency" value={s2.tankCapacitySufficiency} />
          <Field label="Generator capacity (kVA)" value={formatNumber(s2.generatorCapacityKva)} />
          <Field label="Mobile connectivity" value={s2.mobileConnectivity} />
          <Field label="Power supply sources" value={<Chips items={s2.powerSupplySelections} />} />
          {!isBlank(s2.insufficientCapacityPlan) && (
            <Field label="Plan if capacity insufficient" value={s2.insufficientCapacityPlan} full />
          )}
        </FieldGrid>
      </Card>

      <Card title="Farmers & milk collection" step="3" subtitle="Section 3 — Supply network">
        <FieldGrid cols={3}>
          <Field label="Total farmers supplying" value={formatNumber(s3.totalFarmersSupplying)} />
          <Field label="New farmers (last 3 months)" value={formatNumber(s3.newFarmersLast3Months)} />
          <Field label="Milk transporters (Abacunda)" value={formatNumber(s3.milkTransportersCount)} />
          <Field label="Average distance (km)" value={formatNumber(s3.averageDistanceKm)} />
          <Field label="Furthest farm (km)" value={formatNumber(s3.furthestFarmKm)} />
          <Field label="Evening milk pattern" value={s3.eveningMilkPattern} />
          <Field label="Own milk transport" value={s3.ownMilkTransportType} />
          {!isBlank(s3.noEveningMilkReason) && (
            <Field label="No evening milk — reason" value={s3.noEveningMilkReason} full />
          )}
          {!isBlank(s3.noOwnTransportPlan) && (
            <Field label="No own transport — plan" value={s3.noOwnTransportPlan} full />
          )}
        </FieldGrid>
      </Card>

      <Card title="Quality & rejection" step="4" subtitle="Section 4 — Testing & milk quality">
        <FieldGrid cols={2}>
          <Field label="Testing equipment present" value={<Chips items={s4.testingEquipmentSelections} />} />
          <Field label="Quality tests on every delivery" value={<Chips items={s4.qualityTestsSelections} />} />
          <Field label="Avg rejected per day (L)" value={formatNumber(s4.averageRejectedPerDayLitres)} />
          <Field
            label="Rejection rate"
            value={isBlank(s4.rejectionRatePercent) ? '—' : `${formatNumber(s4.rejectionRatePercent)}%`}
          />
        </FieldGrid>

        <div className="mt-5">
          <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Top rejection reasons</h3>
          {rankedRejections.length === 0 ? (
            <p className="text-sm text-gray-400">No reasons ranked.</p>
          ) : (
            <ol className="space-y-1.5">
              {rankedRejections.map((r) => (
                <li key={r.reason} className="flex items-center gap-3 text-sm">
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-semibold">
                    {r.rank}
                  </span>
                  <span>{r.reason}</span>
                </li>
              ))}
            </ol>
          )}
          {!isBlank(s4.otherRejectionReason) && (
            <p className="mt-3 text-sm">
              <span className="text-xs uppercase tracking-wide text-gray-500">Other reason: </span>
              {s4.otherRejectionReason}
            </p>
          )}
          {!isBlank(s4.correctiveActionsPlanned) && (
            <div className="mt-3 text-sm">
              <span className="text-xs uppercase tracking-wide text-gray-500">Corrective actions</span>
              <p className="mt-1 whitespace-pre-wrap">{s4.correctiveActionsPlanned}</p>
            </div>
          )}
        </div>
      </Card>

      <Card title="Staff & cooperative members" step="5" subtitle="Section 5 — People">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-3">Staff</h3>
            <FieldGrid cols={2}>
              <Field label="Total (incl. manager)" value={formatNumber(s5.staffTotalIncludingManager)} />
              <Field label="Women" value={formatNumber(s5.staffWomenCount)} />
              <Field label="Aged 18–35" value={formatNumber(s5.staffAged1835)} />
              <Field label="Women aged 18–35" value={formatNumber(s5.staffWomen1835)} />
              <Field label="With disability" value={formatNumber(s5.staffWithDisability)} />
            </FieldGrid>
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-3">Cooperative members</h3>
            <FieldGrid cols={2}>
              <Field label="Total" value={formatNumber(s5.coopMembersTotal)} />
              <Field label="Women" value={formatNumber(s5.coopMembersWomen)} />
              <Field label="Aged 18–35" value={formatNumber(s5.coopMembersAged1835)} />
              <Field label="Women aged 18–35" value={formatNumber(s5.coopMembersWomen1835)} />
            </FieldGrid>
          </div>
        </div>
      </Card>

      <Card title="Records, payments & commercial" step="6" subtitle="Section 6 — Operations & buyers">
        <FieldGrid cols={2}>
          <Field label="Record system" value={s6.recordSystem} />
          <Field label="Staff training status" value={s6.staffTrainingStatus} />
          <Field label="Employment contracts" value={s6.employmentContractsStatus} />
          <Field label="Digital ledger willingness" value={s6.digitalLedgerWillingness} />
          <Field label="Digital devices available" value={<Chips items={s6.digitalDeviceAccess} />} />
          <Field label="Farmer payment methods" value={<Chips items={s6.farmerPaymentMethods} />} />
          <Field label="Avg days delivery → payment" value={formatNumber(s6.avgDaysDeliveryToPayment, ' days')} />
          <Field
            label="Avg annual revenue (RWF)"
            value={isBlank(s6.averageAnnualRevenueRwf) ? '—' : `RWF ${formatNumber(s6.averageAnnualRevenueRwf)}`}
          />
          <Field label="Milk sales destinations" value={<Chips items={s6.milkSalesDestinations} />} full />
          <Field label="Main buyer" value={s6.mainBuyerName} />
          <Field label="Formal supply agreement" value={s6.formalSupplyAgreementDetails} />
        </FieldGrid>
      </Card>

      <Card
        title="Final assessment"
        step="7"
        subtitle="Section 7 — Eligibility decision"
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">Passes</span>
            <span className="text-sm font-semibold text-gray-900">
              {(s7.passCount ?? submission.pass_count ?? 0)} / 8
            </span>
            <DecisionBadge decision={s7.decision || submission.final_decision} />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Requirement</th>
                <th className="px-3 py-2 text-left font-medium w-28">Result</th>
                <th className="px-3 py-2 text-left font-medium">Agent note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {SECTION7_REQUIREMENTS.map((req) => (
                <tr key={req.key}>
                  <td className="px-3 py-2 align-top">{req.label}</td>
                  <td className="px-3 py-2 align-top">
                    <PassFailDot status={assessment[req.key]} />
                  </td>
                  <td className="px-3 py-2 align-top text-gray-700">
                    {s7Notes[req.key] ? s7Notes[req.key] : <span className="text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isBlank(s7.keyGaps) && (
          <div className="mt-5 bg-amber-50 border border-amber-200 rounded-sm p-4 text-sm text-amber-950">
            <div className="text-xs uppercase tracking-wide text-amber-800 mb-1">Key gaps requiring action</div>
            <p className="whitespace-pre-wrap">{s7.keyGaps}</p>
          </div>
        )}
      </Card>

      <div className="bg-white border border-gray-200 rounded-sm p-4">
        <button
          type="button"
          className="text-sm font-medium text-[var(--primary)] hover:underline"
          onClick={() => setShowPayload(!showPayload)}
        >
          {showPayload ? 'Hide' : 'Show'} raw wizard payload (JSON)
        </button>
        {showPayload && (
          <pre className="mt-3 text-xs bg-gray-50 border border-gray-200 rounded-sm p-3 overflow-auto max-h-[480px]">
            {JSON.stringify(payload, null, 2)}
          </pre>
        )}
      </div>

      {canAct && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-sm p-6 space-y-3">
            <h3 className="font-semibold text-gray-900">Approve</h3>
            <p className="text-xs text-gray-600">
              Creates a tenant account + default wallet and an MCC user (or links an existing user if phone matches).
            </p>
            <label className="block text-xs text-gray-600">Optional password (min 8 chars)</label>
            <input
              className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm"
              type="password"
              autoComplete="new-password"
              placeholder="Leave empty to auto-generate"
              value={approvePassword}
              onChange={(e) => setApprovePassword(e.target.value)}
              disabled={acting}
            />
            <label className="block text-xs text-gray-600">Link existing user UUID (optional)</label>
            <input
              className="w-full border border-gray-200 rounded-sm px-3 py-2 text-xs font-mono"
              placeholder="Same phone as manager required"
              value={linkUserId}
              onChange={(e) => setLinkUserId(e.target.value)}
              disabled={acting}
            />
            <label className="block text-xs text-gray-600">Internal notes (optional)</label>
            <textarea
              className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm min-h-[72px]"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              disabled={acting}
            />
            <button type="button" className="btn btn-primary w-full" disabled={acting} onClick={onApprove}>
              {acting ? 'Working…' : 'Approve & create'}
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-sm p-6 space-y-3">
            <h3 className="font-semibold text-gray-900">Request changes</h3>
            <textarea
              className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm min-h-[100px]"
              placeholder="What should the applicant fix?"
              value={needsNotes}
              onChange={(e) => setNeedsNotes(e.target.value)}
              disabled={acting}
            />
            <button
              type="button"
              className="btn border border-gray-300 bg-white w-full"
              disabled={acting}
              onClick={onNeedsChanges}
            >
              Mark needs changes
            </button>
          </div>

          <div className="bg-white border border-red-100 rounded-sm p-6 space-y-3">
            <h3 className="font-semibold text-red-800">Reject</h3>
            <textarea
              className="w-full border border-red-200 rounded-sm px-3 py-2 text-sm min-h-[100px]"
              placeholder="Reason (required)"
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              disabled={acting}
            />
            <button
              type="button"
              className="w-full py-2 rounded-sm text-sm font-medium border border-red-300 text-red-800 bg-red-50 hover:bg-red-100"
              disabled={acting}
              onClick={onReject}
            >
              Reject submission
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
