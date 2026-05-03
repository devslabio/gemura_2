'use client';

import { useCallback, useEffect, useState } from 'react';
import { mccOperationsApi, type MccGateDeliveryRow, type MccTestResultRow } from '@/lib/api/mcc-operations';
import { mccManagerApi } from '@/lib/api/mcc-manager';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import { useCrudPermissions } from '@/hooks/useCrudPermissions';
import { useClientPagination } from '@/hooks/useClientPagination';
import Modal from '@/app/components/Modal';
import Pagination from '@/app/components/Pagination';
import Icon, { faPlus } from '@/app/components/Icon';
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

export default function OperationsTraceabilityPage() {
  const { currentAccount } = useAuthStore();
  const { mccTraceabilityMutations: canManage } = useCrudPermissions();
  const toast = useToastStore();
  const accountId = currentAccount?.account_id ?? '';
  const [rows, setRows] = useState<MccTestResultRow[]>([]);
  const [gates, setGates] = useState<MccGateDeliveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [outcome, setOutcome] = useState<string>('');
  const [from, setFrom] = useState(defaultTraceabilityFrom);
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gateId, setGateId] = useState('');
  const [testOutcome, setTestOutcome] = useState<'pending' | 'accepted' | 'rejected'>('accepted');
  const [rejectionCause, setRejectionCause] = useState('');

  const {
    page: testPage,
    setPage: setTestPage,
    paginatedItems: paginatedTests,
    totalPages: testTotalPages,
    totalItems: testTotalItems,
    startIndex: testStartIndex,
    pageSize: testPageSize,
  } = useClientPagination(rows, { resetKey: `${from}-${to}-${outcome}` });

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const [t, g] = await Promise.all([
        mccOperationsApi.listTestResults(accountId, outcome || undefined, from, to),
        mccOperationsApi.listGateDeliveries(accountId, from, to),
      ]);
      setRows(t.data ?? []);
      setGates(g.data ?? []);
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [accountId, outcome, from, to, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!accountId || !gateId) {
      toast.error('Select a gate delivery.');
      return;
    }
    setSaving(true);
    try {
      await mccOperationsApi.createTestResult({
        account_id: accountId,
        mcc_gate_delivery_id: gateId,
        outcome: testOutcome,
        rejection_cause: testOutcome === 'rejected' ? rejectionCause || undefined : undefined,
      });
      toast.success('Test result saved.');
      setModalOpen(false);
      setGateId('');
      setRejectionCause('');
      await load();
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const setResolution = async (testId: string, status: 'resolved' | 'secondary_test' | 'frozen') => {
    try {
      await mccManagerApi.updateTestResolution(testId, { source_resolution_status: status, account_id: accountId });
      toast.success('Resolution updated.');
      await load();
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Update failed');
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
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
          {canManage && (
            <button type="button" onClick={() => setModalOpen(true)} disabled={gates.length === 0} className="btn btn-primary">
              <Icon icon={faPlus} size="sm" className="mr-2" />
              Record test
            </button>
          )}
        </div>
      </div>

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
          data={rows}
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
          ]}
          disabled={loading || !accountId || rows.length === 0}
        />
      </FilterBar>

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
                  {r.outcome === 'rejected' && (
                    <p className="text-gray-600 mt-1">
                      Resolution: <span className="font-medium">{r.source_resolution_status ?? 'unresolved'}</span>
                    </p>
                  )}
                  </div>
                </div>
                {r.outcome === 'rejected' && canManage && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setResolution(r.id, 'resolved')}
                      className="btn btn-success btn-sm"
                    >
                      Resolved
                    </button>
                    <button type="button" onClick={() => setResolution(r.id, 'secondary_test')} className="btn btn-secondary btn-sm">
                      Secondary test
                    </button>
                    <button
                      type="button"
                      onClick={() => setResolution(r.id, 'frozen')}
                      className="btn btn-outline btn-sm border-amber-300 text-amber-900 hover:bg-amber-50"
                    >
                      Frozen
                    </button>
                  </div>
                )}
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

      <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title="Record milk test" maxWidth="max-w-lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gate delivery</label>
            <select
              value={gateId}
              onChange={(e) => setGateId(e.target.value)}
              className={`${FILTER_INPUT} max-w-none w-full`}
            >
              <option value="">Select…</option>
              {gates.map((g) => (
                <option key={g.id} value={g.id}>
                  {new Date(g.arrived_at).toLocaleString()} — {g.source_account?.name || g.source_account?.code}
                </option>
              ))}
            </select>
          </div>
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
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button type="button" disabled={saving} onClick={() => setModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="button" disabled={saving} onClick={handleCreate} className="btn btn-primary">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
