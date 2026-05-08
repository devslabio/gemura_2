'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  mccOperationsApi,
  type MccGateDeliveryRow,
  type MccManifestRow,
  type MccTestResultRow,
} from '@/lib/api/mcc-operations';
import { mccManagerApi } from '@/lib/api/mcc-manager';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import { useCrudPermissions } from '@/hooks/useCrudPermissions';
import { useClientPagination } from '@/hooks/useClientPagination';
import Modal from '@/app/components/Modal';
import Pagination from '@/app/components/Pagination';
import Icon, { faEdit, faPlus } from '@/app/components/Icon';
import FilterBar, { FilterBarGroup, FilterBarActions, FilterBarApply, FilterBarExport } from '@/app/components/FilterBar';

const FILTER_INPUT =
  'input h-9 min-h-[2.25rem] !py-1.5 !px-3 text-sm w-full min-w-0 sm:max-w-[11rem] text-gray-900';

const INPUT_FULL =
  'input h-9 min-h-[2.25rem] !py-1.5 !px-3 text-sm w-full text-gray-900';

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function defaultTraceabilityFrom() {
  const x = new Date();
  x.setUTCDate(x.getUTCDate() - 30);
  return isoDate(x);
}

function sanitizeDateParam(value: string | null, fallback: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function sanitizeOutcomeParam(value: string | null) {
  return value === 'pending' || value === 'accepted' || value === 'rejected' ? value : '';
}

function isUmucundaSource(sourceType: string) {
  return sourceType === 'umucunda_a' || sourceType === 'umucunda_b';
}

/** Umucunda batches need a submitted manifest before recording a test (aligned with API validation). */
function gateTestBlockedReason(g: MccGateDeliveryRow): string | null {
  if (!isUmucundaSource(g.source_type)) return null;
  if (!g.manifest) return 'Create and submit the Umucunda manifest before recording a milk test.';
  if (g.manifest.status === 'draft') return 'Submit the manifest before recording a milk test.';
  return null;
}

function testSortTier(r: MccTestResultRow): number {
  if (r.outcome === 'pending') return 0;
  if (r.outcome === 'rejected') {
    const rs = r.source_resolution_status;
    if (!rs || rs === 'unresolved') return 1;
    return 3;
  }
  return 2;
}

function formatDetailSummary(detail: Record<string, unknown> | null | undefined): string | null {
  if (!detail || typeof detail !== 'object') return null;
  const parts: string[] = [];
  if (detail.temperature_c != null) parts.push(`${detail.temperature_c}°C`);
  if (detail.fat_percent != null) parts.push(`Fat ${detail.fat_percent}%`);
  if (detail.alcohol_pass === true || detail.alcohol_pass === false)
    parts.push(`Alcohol ${detail.alcohol_pass ? 'pass' : 'fail'}`);
  if (detail.antibiotic_strip === true || detail.antibiotic_strip === false)
    parts.push(`Antibiotic strip ${detail.antibiotic_strip ? 'pass' : 'fail'}`);
  if (detail.lactometer_reading != null) parts.push(`Lactometer ${detail.lactometer_reading}`);
  if (detail.visual_ok === true) parts.push('Visual OK');
  if (typeof detail.notes === 'string' && detail.notes.trim()) parts.push(detail.notes.trim());
  return parts.length ? parts.join(' · ') : null;
}

function csvBoolDetail(row: MccTestResultRow, key: string): string {
  const d = row.detail;
  if (!d || typeof d !== 'object') return '';
  const v = (d as Record<string, unknown>)[key];
  if (v === true) return 'yes';
  if (v === false) return 'no';
  return '';
}

function TraceabilityPageInner() {
  const { currentAccount } = useAuthStore();
  const { mccTraceabilityMutations: canManage } = useCrudPermissions();
  const toast = useToastStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const accountId = currentAccount?.account_id ?? '';
  const [rows, setRows] = useState<MccTestResultRow[]>([]);
  const [gates, setGates] = useState<MccGateDeliveryRow[]>([]);
  const [manifests, setManifests] = useState<MccManifestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [outcome, setOutcome] = useState<string>(() => sanitizeOutcomeParam(searchParams.get('outcome')));
  const [from, setFrom] = useState(() => sanitizeDateParam(searchParams.get('from'), defaultTraceabilityFrom()));
  const [to, setTo] = useState(() => sanitizeDateParam(searchParams.get('to'), isoDate(new Date())));
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingRow, setEditingRow] = useState<MccTestResultRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [gateId, setGateId] = useState('');
  const [testOutcome, setTestOutcome] = useState<'pending' | 'accepted' | 'rejected'>('accepted');
  const [rejectionCause, setRejectionCause] = useState('');
  const [temperatureC, setTemperatureC] = useState('');
  const [fatPercent, setFatPercent] = useState('');
  const [alcoholPass, setAlcoholPass] = useState<'pass' | 'fail' | ''>('');
  const [antibioticStrip, setAntibioticStrip] = useState<'pass' | 'fail' | ''>('');
  const [lactometerReading, setLactometerReading] = useState('');
  const [visualOk, setVisualOk] = useState(false);
  const [qualityNotes, setQualityNotes] = useState('');
  const [manifestLineId, setManifestLineId] = useState('');
  const testNextHandledRef = useRef(false);
  const [resolvingTestId, setResolvingTestId] = useState<string | null>(null);

  const sortedTestRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const ta = testSortTier(a);
      const tb = testSortTier(b);
      if (ta !== tb) return ta - tb;
      return new Date(b.tested_at).getTime() - new Date(a.tested_at).getTime();
    });
  }, [rows]);

  const gatesFifo = useMemo(
    () =>
      [...gates].sort((a, b) => new Date(a.arrived_at).getTime() - new Date(b.arrived_at).getTime()),
    [gates],
  );

  const pendingQueueDepth = useMemo(
    () => sortedTestRows.filter((r) => r.outcome === 'pending').length,
    [sortedTestRows],
  );

  const gatesEligibleForTest = useMemo(
    () => gatesFifo.filter((g) => !gateTestBlockedReason(g)),
    [gatesFifo],
  );

  const umucundaNeedsManifestBanner = useMemo(() => {
    if (loading || gates.length === 0 || gatesEligibleForTest.length > 0) return false;
    return gatesFifo.some((g) => isUmucundaSource(g.source_type));
  }, [loading, gates.length, gatesEligibleForTest.length, gatesFifo]);

  const manifestLinesGateId =
    modalMode === 'edit' && editingRow ? editingRow.mcc_gate_delivery_id : gateId;

  const linesForActiveGate = useMemo(() => {
    if (!manifestLinesGateId) return [];
    const m = manifests.find((x) => x.gate_delivery?.id === manifestLinesGateId);
    return m?.lines ?? [];
  }, [manifests, manifestLinesGateId]);

  useEffect(() => {
    if (modalMode !== 'create') return;
    setManifestLineId('');
  }, [gateId, modalMode]);

  const {
    page: testPage,
    setPage: setTestPage,
    paginatedItems: paginatedTests,
    totalPages: testTotalPages,
    totalItems: testTotalItems,
    startIndex: testStartIndex,
    pageSize: testPageSize,
  } = useClientPagination(sortedTestRows, { resetKey: `${from}-${to}-${outcome}` });

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const [t, g, mf] = await Promise.all([
        mccOperationsApi.listTestResults(accountId, outcome || undefined, from, to),
        mccOperationsApi.listGateDeliveries(accountId, from, to),
        mccOperationsApi.listManifests(accountId, from, to),
      ]);
      setRows(t.data ?? []);
      setGates(g.data ?? []);
      setManifests(mf.data ?? []);
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [accountId, outcome, from, to, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const buildQualityDetail = (): Record<string, unknown> | undefined => {
    const d: Record<string, unknown> = {};
    const t = temperatureC.trim();
    if (t !== '' && !Number.isNaN(Number(t))) d.temperature_c = Number(t);
    const f = fatPercent.trim();
    if (f !== '' && !Number.isNaN(Number(f))) d.fat_percent = Number(f);
    if (alcoholPass === 'pass') d.alcohol_pass = true;
    if (alcoholPass === 'fail') d.alcohol_pass = false;
    if (antibioticStrip === 'pass') d.antibiotic_strip = true;
    if (antibioticStrip === 'fail') d.antibiotic_strip = false;
    const l = lactometerReading.trim();
    if (l !== '') d.lactometer_reading = l;
    if (visualOk) d.visual_ok = true;
    const n = qualityNotes.trim();
    if (n) d.notes = n;
    return Object.keys(d).length ? d : undefined;
  };

  const resetQualityFields = () => {
    setTemperatureC('');
    setFatPercent('');
    setAlcoholPass('');
    setAntibioticStrip('');
    setLactometerReading('');
    setVisualOk(false);
    setQualityNotes('');
  };

  const hydrateQualityFromDetail = (detail: Record<string, unknown> | null | undefined) => {
    const d = detail && typeof detail === 'object' ? detail : {};
    setTemperatureC(d.temperature_c != null ? String(d.temperature_c) : '');
    setFatPercent(d.fat_percent != null ? String(d.fat_percent) : '');
    if (d.alcohol_pass === true) setAlcoholPass('pass');
    else if (d.alcohol_pass === false) setAlcoholPass('fail');
    else setAlcoholPass('');
    if (d.antibiotic_strip === true) setAntibioticStrip('pass');
    else if (d.antibiotic_strip === false) setAntibioticStrip('fail');
    else setAntibioticStrip('');
    setLactometerReading(d.lactometer_reading != null ? String(d.lactometer_reading) : '');
    setVisualOk(d.visual_ok === true);
    setQualityNotes(typeof d.notes === 'string' ? d.notes : '');
  };

  /** Merge form into previous detail so clearing a field removes that key (for PATCH updates). */
  const applyQualityFormToDetail = (previous: Record<string, unknown> | null | undefined): Record<string, unknown> => {
    const out: Record<string, unknown> = {
      ...(previous && typeof previous === 'object' ? { ...previous } : {}),
    };
    const t = temperatureC.trim();
    if (t === '') delete out.temperature_c;
    else if (!Number.isNaN(Number(t))) out.temperature_c = Number(t);
    const f = fatPercent.trim();
    if (f === '') delete out.fat_percent;
    else if (!Number.isNaN(Number(f))) out.fat_percent = Number(f);
    if (alcoholPass === '') delete out.alcohol_pass;
    else if (alcoholPass === 'pass') out.alcohol_pass = true;
    else if (alcoholPass === 'fail') out.alcohol_pass = false;
    if (antibioticStrip === '') delete out.antibiotic_strip;
    else if (antibioticStrip === 'pass') out.antibiotic_strip = true;
    else if (antibioticStrip === 'fail') out.antibiotic_strip = false;
    const l = lactometerReading.trim();
    if (l === '') delete out.lactometer_reading;
    else out.lactometer_reading = l;
    if (!visualOk) delete out.visual_ok;
    else out.visual_ok = true;
    const n = qualityNotes.trim();
    if (n === '') delete out.notes;
    else out.notes = n;
    return out;
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalMode('create');
    setEditingRow(null);
    setGateId('');
    setManifestLineId('');
    setRejectionCause('');
    resetQualityFields();
  };

  const openCreateModal = useCallback((preselectedGateId?: string) => {
    setModalMode('create');
    setEditingRow(null);
    setGateId(preselectedGateId ?? '');
    setManifestLineId('');
    setTestOutcome('accepted');
    setRejectionCause('');
    resetQualityFields();
    setModalOpen(true);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const setOrDelete = (key: string, value: string) => {
      if (value) params.set(key, value);
      else params.delete(key);
    };
    setOrDelete('outcome', outcome);
    setOrDelete('from', from);
    setOrDelete('to', to);
    const current = searchParams.toString();
    const next = params.toString();
    if (next !== current) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  }, [outcome, from, to, pathname, router, searchParams]);

  useEffect(() => {
    if (searchParams.get('testNext') !== '1') return;
    if (!canManage || loading) return;
    if (testNextHandledRef.current) return;
    testNextHandledRef.current = true;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('testNext');
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    const first = gatesEligibleForTest[0];
    if (first) {
      openCreateModal(first.id);
    } else {
      toast.error('No eligible gate delivery for a new test.');
    }
  }, [searchParams, loading, canManage, gatesEligibleForTest, pathname, router, toast, openCreateModal]);

  useEffect(() => {
    if (searchParams.get('testNext') !== '1') testNextHandledRef.current = false;
  }, [searchParams]);

  const openEditModal = (row: MccTestResultRow) => {
    setModalMode('edit');
    setEditingRow(row);
    setGateId(row.mcc_gate_delivery_id);
    setManifestLineId(row.manifest_line_id ?? '');
    setTestOutcome(row.outcome as 'pending' | 'accepted' | 'rejected');
    setRejectionCause(row.rejection_cause ?? '');
    hydrateQualityFromDetail(row.detail ?? undefined);
    setModalOpen(true);
  };

  const handleCreate = async () => {
    if (!accountId || !gateId) {
      toast.error('Select a gate delivery.');
      return;
    }
    const selectedGate = gates.find((g) => g.id === gateId);
    const block = selectedGate ? gateTestBlockedReason(selectedGate) : null;
    if (block) {
      toast.error(block);
      return;
    }
    setSaving(true);
    try {
      const detail = buildQualityDetail();
      await mccOperationsApi.createTestResult({
        account_id: accountId,
        mcc_gate_delivery_id: gateId,
        ...(manifestLineId.trim() ? { manifest_line_id: manifestLineId.trim() } : {}),
        outcome: testOutcome,
        rejection_cause: testOutcome === 'rejected' ? rejectionCause || undefined : undefined,
        ...(detail ? { detail } : {}),
      });
      toast.success('Test result saved.');
      closeModal();
      await load();
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!accountId || !editingRow) return;
    setSaving(true);
    try {
      const detail = applyQualityFormToDetail(editingRow.detail ?? undefined);
      const curLine = manifestLineId.trim();
      const prevLine = editingRow.manifest_line_id ?? '';
      const manifestPatch: { manifest_line_id?: string | null } =
        curLine === prevLine ? {} : curLine === '' ? { manifest_line_id: null } : { manifest_line_id: curLine };

      await mccOperationsApi.updateTestResult(editingRow.id, {
        account_id: accountId,
        outcome: testOutcome,
        rejection_cause: testOutcome === 'rejected' ? rejectionCause || undefined : undefined,
        detail,
        ...manifestPatch,
      });
      toast.success('Test result updated.');
      closeModal();
      await load();
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const setResolution = async (testId: string, status: 'resolved' | 'secondary_test' | 'frozen') => {
    if (!accountId) {
      toast.error('No account selected.');
      return;
    }
    setResolvingTestId(testId);
    try {
      await mccManagerApi.updateTestResolution(testId, { source_resolution_status: status, account_id: accountId });
      toast.success('Resolution updated.');
      await load();
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Update failed');
    } finally {
      setResolvingTestId(null);
    }
  };

  const handleClearFilters = () => {
    setOutcome('');
    setFrom(defaultTraceabilityFrom());
    setTo(isoDate(new Date()));
  };

  return (
    <div className="space-y-4 w-full min-w-0">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Milk tests & traceability</h1>
          <p className="text-sm text-gray-600 mt-1">
            Queue shows pending and unresolved rejections first. Umucunda arrivals need an Umucunda manifest created,
            then submitted (not draft), before you can record a milk test — matching gate intake validation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
          {canManage && (
            <button
              type="button"
              onClick={() => openCreateModal()}
              disabled={gatesEligibleForTest.length === 0}
              title={
                gates.length > 0 && gatesEligibleForTest.length === 0
                  ? 'No gate is ready: Umucunda batches need a manifest on file and submitted (not draft) before recording a milk test.'
                  : gatesEligibleForTest.length === 0
                    ? 'No gate deliveries in this date range.'
                    : undefined
              }
              className="btn btn-primary"
            >
              <Icon icon={faPlus} size="sm" className="mr-2" />
              Record test
            </button>
          )}
        </div>
      </div>

      {!loading && umucundaNeedsManifestBanner && (
        <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong className="font-semibold">Umucunda milk tests blocked:</strong> every Umucunda gate arrival in this date
          range needs a manifest before tests can be recorded. Create lines under{' '}
          <Link href="/operations/manifests" className="font-medium text-[var(--primary)] hover:underline">
            Manifests
          </Link>
          , then submit — drafts cannot receive milk tests until submitted (same rules as the API).
        </div>
      )}

      <FilterBar>
        <FilterBarGroup label="Outcome">
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className={INPUT_FULL}>
            <option value="">All outcomes</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
        </FilterBarGroup>
        <FilterBarGroup label="Date From">
          <input
            type="date"
            value={from}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setFrom(e.target.value)}
            className={INPUT_FULL}
          />
        </FilterBarGroup>
        <FilterBarGroup label="Date To">
          <input
            type="date"
            value={to}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setTo(e.target.value)}
            className={INPUT_FULL}
          />
        </FilterBarGroup>
        <FilterBarActions onClear={handleClearFilters} />
        <FilterBarApply onApply={() => void load()} />
        <FilterBarExport<MccTestResultRow>
          data={sortedTestRows}
          exportFilename="mcc-milk-tests"
          exportColumns={[
            { key: 'outcome', label: 'Outcome' },
            {
              key: 'tested_at',
              label: 'Tested at',
              getValue: (r) => new Date(r.tested_at).toLocaleString(),
            },
            {
              key: 'gate_source',
              label: 'Gate source',
              getValue: (r) =>
                r.gate_delivery?.source_account?.name || r.gate_delivery?.source_account?.code || '',
            },
            {
              key: 'farmer_line',
              label: 'Manifest line farmer',
              getValue: (r) =>
                r.manifest_line?.farmer_supplier?.name || r.manifest_line?.farmer_supplier?.code || '',
            },
            { key: 'rejection_cause', label: 'Rejection cause', getValue: (r) => r.rejection_cause ?? '' },
            {
              key: 'resolution',
              label: 'Resolution status',
              getValue: (r) => r.source_resolution_status ?? '',
            },
            {
              key: 'temperature_c',
              label: 'Temp °C',
              getValue: (r) =>
                r.detail && typeof r.detail === 'object' && r.detail.temperature_c != null
                  ? String((r.detail as Record<string, unknown>).temperature_c)
                  : '',
            },
            {
              key: 'fat_percent',
              label: 'Fat %',
              getValue: (r) =>
                r.detail && typeof r.detail === 'object' && r.detail.fat_percent != null
                  ? String((r.detail as Record<string, unknown>).fat_percent)
                  : '',
            },
            { key: 'alcohol_pass', label: 'Alcohol pass', getValue: (r) => csvBoolDetail(r, 'alcohol_pass') },
            {
              key: 'antibiotic_strip',
              label: 'Antibiotic strip',
              getValue: (r) => csvBoolDetail(r, 'antibiotic_strip'),
            },
            {
              key: 'lactometer_reading',
              label: 'Lactometer',
              getValue: (r) =>
                r.detail && typeof r.detail === 'object' && (r.detail as Record<string, unknown>).lactometer_reading != null
                  ? String((r.detail as Record<string, unknown>).lactometer_reading)
                  : '',
            },
            {
              key: 'visual_ok',
              label: 'Visual OK',
              getValue: (r) => csvBoolDetail(r, 'visual_ok'),
            },
            {
              key: 'quality_notes',
              label: 'Quality notes',
              getValue: (r) =>
                r.detail && typeof r.detail === 'object' && typeof (r.detail as Record<string, unknown>).notes === 'string'
                  ? String((r.detail as Record<string, unknown>).notes)
                  : '',
            },
          ]}
          disabled={loading || !accountId || sortedTestRows.length === 0}
        />
      </FilterBar>

      {!loading && pendingQueueDepth > 5 && outcome === '' && (
        <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong className="font-semibold">Queue depth:</strong> {pendingQueueDepth} pending tests in this date range
          (consider prioritizing outcomes marked pending below).
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-500 text-sm">No test results in this range.</p>
      ) : (
        <div className="space-y-3">
          {paginatedTests.map((r, ri) => (
            <div key={r.id} className="card p-4 text-sm">
              <div className="flex flex-wrap justify-between gap-3">
                <div className="min-w-0 flex gap-3">
                  <span
                    className="shrink-0 w-7 text-right text-xs font-semibold text-gray-400 tabular-nums pt-0.5"
                    title="Row in list"
                  >
                    {testStartIndex + ri + 1}
                  </span>
                  <div className="min-w-0">
                  <p className="font-medium text-gray-900">
                    {r.outcome} · {new Date(r.tested_at).toLocaleString()}
                  </p>
                  <p className="text-gray-600 mt-1">
                    Gate: {r.gate_delivery?.source_account?.name || r.gate_delivery?.source_account?.code || '—'}
                  </p>
                  {r.manifest_line && (
                    <p className="text-gray-600">
                      Line: {r.manifest_line.farmer_supplier?.name || r.manifest_line.farmer_supplier?.code}
                    </p>
                  )}
                  {r.rejection_cause && <p className="text-red-700 mt-1">Cause: {r.rejection_cause}</p>}
                  {(() => {
                    const ds = formatDetailSummary(r.detail);
                    return ds ? <p className="text-gray-600 mt-1 text-xs">{ds}</p> : null;
                  })()}
                  {r.outcome === 'rejected' && (
                    <p className="text-gray-600 mt-1">
                      Resolution: <span className="font-medium">{r.source_resolution_status ?? 'unresolved'}</span>
                    </p>
                  )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => openEditModal(r)}
                      className="btn btn-secondary btn-sm inline-flex items-center gap-1"
                    >
                      <Icon icon={faEdit} size="sm" />
                      Edit
                    </button>
                  )}
                  {r.outcome === 'rejected' && canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() => setResolution(r.id, 'resolved')}
                        disabled={resolvingTestId === r.id}
                        title="Mark supplier/source traceability as resolved (requires mcc_manage_operations)."
                        className="btn btn-success btn-sm"
                      >
                        {resolvingTestId === r.id ? '…' : 'Resolved'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setResolution(r.id, 'secondary_test')}
                        disabled={resolvingTestId === r.id}
                        title="Flag for a secondary test workflow."
                        className="btn btn-secondary btn-sm"
                      >
                        Secondary test
                      </button>
                      <button
                        type="button"
                        onClick={() => setResolution(r.id, 'frozen')}
                        disabled={resolvingTestId === r.id}
                        title="Hold as frozen pending further review."
                        className="btn btn-outline btn-sm border-amber-300 text-amber-900 hover:bg-amber-50"
                      >
                        Frozen
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && rows.length > 0 && (
        <Pagination
          currentPage={testPage}
          totalPages={testTotalPages}
          totalItems={testTotalItems}
          pageSize={testPageSize}
          itemLabel="tests"
          onPageChange={setTestPage}
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          if (!saving) closeModal();
        }}
        title={modalMode === 'edit' ? 'Edit milk test' : 'Record milk test'}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          {modalMode === 'edit' && editingRow ? (
            <>
              <div className="rounded-sm bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-700">
                <span className="font-medium text-gray-900">Gate:</span>{' '}
                {editingRow.gate_delivery?.source_account?.name || editingRow.gate_delivery?.source_account?.code || '—'}
                <span className="mx-2 text-gray-300">·</span>
                <span className="font-medium text-gray-900">Tested:</span>{' '}
                {new Date(editingRow.tested_at).toLocaleString()}
              </div>
              {linesForActiveGate.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manifest line (optional)</label>
                  <select
                    value={manifestLineId}
                    onChange={(e) => setManifestLineId(e.target.value)}
                    className={`${FILTER_INPUT} max-w-none w-full`}
                  >
                    <option value="">Whole gate / unspecified</option>
                    {linesForActiveGate.map((ln) => (
                      <option key={ln.id} value={ln.id}>
                        {(ln.farmer_supplier?.name || ln.farmer_supplier?.code || 'Farmer')} · {ln.declared_litres} L
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Change which farmer line this test applies to, or clear to gate-level only.</p>
                </div>
              )}
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gate delivery (oldest first)</label>
              <select
                value={gateId}
                onChange={(e) => setGateId(e.target.value)}
                className={`${FILTER_INPUT} max-w-none w-full`}
              >
                <option value="">Select…</option>
                {gatesFifo.map((g) => {
                  const blocked = gateTestBlockedReason(g);
                  return (
                    <option key={g.id} value={g.id} disabled={Boolean(blocked)}>
                      {blocked ? `⚠ ${blocked} · ` : ''}
                      {new Date(g.arrived_at).toLocaleString()} — {g.source_account?.name || g.source_account?.code}
                      {g.manifest ? ` · manifest ${g.manifest.status}` : ''}
                    </option>
                  );
                })}
              </select>
              <p className="text-xs text-gray-600 mt-2">
                Umucunda routes: options stay disabled until a manifest exists and is submitted (API blocks saves before
                then).
              </p>
              {linesForActiveGate.length > 0 && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manifest line (optional)</label>
                  <select
                    value={manifestLineId}
                    onChange={(e) => setManifestLineId(e.target.value)}
                    className={`${FILTER_INPUT} max-w-none w-full`}
                  >
                    <option value="">Whole gate / unspecified</option>
                    {linesForActiveGate.map((ln) => (
                      <option key={ln.id} value={ln.id}>
                        {(ln.farmer_supplier?.name || ln.farmer_supplier?.code || 'Farmer')} · {ln.declared_litres} L
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Outcome</label>
            <select
              value={testOutcome}
              onChange={(e) => setTestOutcome(e.target.value as typeof testOutcome)}
              className={`${FILTER_INPUT} max-w-none w-full`}
            >
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          {testOutcome === 'rejected' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rejection cause</label>
              <textarea
                value={rejectionCause}
                onChange={(e) => setRejectionCause(e.target.value)}
                rows={2}
                className="input w-full min-h-[4rem] py-2 px-3 text-sm text-gray-900"
              />
            </div>
          )}
          <fieldset className="border border-gray-200 rounded-sm p-3 space-y-3">
            <legend className="text-xs font-semibold text-gray-700 px-1">Quality readings (optional)</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Temp (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={temperatureC}
                  onChange={(e) => setTemperatureC(e.target.value)}
                  className={INPUT_FULL}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fat %</label>
                <input
                  type="number"
                  step="0.01"
                  value={fatPercent}
                  onChange={(e) => setFatPercent(e.target.value)}
                  className={INPUT_FULL}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Alcohol test</label>
                <select
                  value={alcoholPass}
                  onChange={(e) => setAlcoholPass(e.target.value as 'pass' | 'fail' | '')}
                  className={INPUT_FULL}
                >
                  <option value="">—</option>
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Antibiotic strip</label>
                <select
                  value={antibioticStrip}
                  onChange={(e) => setAntibioticStrip(e.target.value as 'pass' | 'fail' | '')}
                  className={INPUT_FULL}
                >
                  <option value="">—</option>
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Lactometer</label>
              <input
                type="text"
                value={lactometerReading}
                onChange={(e) => setLactometerReading(e.target.value)}
                className={INPUT_FULL}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={visualOk} onChange={(e) => setVisualOk(e.target.checked)} />
              Visual inspection OK
            </label>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea
                value={qualityNotes}
                onChange={(e) => setQualityNotes(e.target.value)}
                rows={2}
                className="input w-full min-h-[3rem] py-2 px-3 text-sm text-gray-900"
              />
            </div>
          </fieldset>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button type="button" disabled={saving} onClick={closeModal} className="btn btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => (modalMode === 'edit' ? handleUpdate() : handleCreate())}
              className="btn btn-primary"
            >
              {saving ? 'Saving…' : modalMode === 'edit' ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function OperationsTraceabilityPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 w-full min-w-0 p-1">
          <p className="text-gray-500 text-sm">Loading traceability…</p>
        </div>
      }
    >
      <TraceabilityPageInner />
    </Suspense>
  );
}
