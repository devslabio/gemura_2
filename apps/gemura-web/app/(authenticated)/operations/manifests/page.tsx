'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { mccOperationsApi, type MccGateDeliveryRow, type MccManifestRow } from '@/lib/api/mcc-operations';
import { suppliersApi, type Supplier } from '@/lib/api/suppliers';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import { usePermission } from '@/hooks/usePermission';
import { useClientPagination } from '@/hooks/useClientPagination';
import Modal from '@/app/components/Modal';
import Pagination from '@/app/components/Pagination';
import Icon, { faPlus, faTrash } from '@/app/components/Icon';
import FilterBar, { FilterBarGroup, FilterBarActions, FilterBarApply, FilterBarExport } from '@/app/components/FilterBar';

const FILTER_INPUT =
  'input h-9 min-h-[2.25rem] !py-1.5 !px-3 text-sm w-full min-w-0 sm:max-w-[11rem] text-gray-900';

const INPUT_FULL =
  'input h-9 min-h-[2.25rem] !py-1.5 !px-3 text-sm w-full text-gray-900';

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function defaultManifestFrom() {
  const x = new Date();
  x.setUTCDate(x.getUTCDate() - 14);
  return isoDate(x);
}

function sanitizeDateParam(value: string | null, fallback: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

type DraftLine = { farmer_supplier_account_id: string; declared_litres: string; container_id: string };

function emptyDraftLine(): DraftLine {
  return { farmer_supplier_account_id: '', declared_litres: '', container_id: '' };
}

function linesFromManifest(m: MccManifestRow): DraftLine[] {
  if (!m.lines.length) return [emptyDraftLine()];
  return m.lines.map((l) => ({
    farmer_supplier_account_id: l.farmer_supplier.id,
    declared_litres: String(l.declared_litres),
    container_id: l.container_id ?? '',
  }));
}

export default function OperationsManifestsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { currentAccount } = useAuthStore();
  const { hasPermission, hasAnyPermission } = usePermission();
  const accountId = currentAccount?.account_id ?? '';
  const canManage = hasAnyPermission([
    'mcc_manage_operations',
    'mcc_manage_own_operations',
    'mcc_floor_operations',
    'update_collections',
  ]);
  const canAcceptManifests = hasPermission('mcc_accept_manifests');

  const [manifests, setManifests] = useState<MccManifestRow[]>([]);
  const [gates, setGates] = useState<MccGateDeliveryRow[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editManifest, setEditManifest] = useState<MccManifestRow | null>(null);
  const [rejectManifest, setRejectManifest] = useState<MccManifestRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [from, setFrom] = useState(() => sanitizeDateParam(searchParams.get('from'), defaultManifestFrom()));
  const [to, setTo] = useState(() => sanitizeDateParam(searchParams.get('to'), isoDate(new Date())));

  const [gateId, setGateId] = useState('');
  const [createLines, setCreateLines] = useState<DraftLine[]>([emptyDraftLine()]);
  const [editLines, setEditLines] = useState<DraftLine[]>([emptyDraftLine()]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('from', from);
    params.set('to', to);
    const current = searchParams.toString();
    const next = params.toString();
    if (next !== current) {
      router.replace(`${pathname}?${next}`, { scroll: false });
    }
  }, [from, to, pathname, router, searchParams]);

  const {
    page: manifestPage,
    setPage: setManifestPage,
    paginatedItems: paginatedManifests,
    totalPages: manifestTotalPages,
    totalItems: manifestTotalItems,
    startIndex: manifestStartIndex,
    pageSize: manifestPageSize,
  } = useClientPagination(manifests, { resetKey: `${from}-${to}` });

  const load = useCallback(async () => {
    if (!accountId) {
      setManifests([]);
      setGates([]);
      setSuppliers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [m, g, s] = await Promise.all([
        mccOperationsApi.listManifests(accountId, from, to),
        mccOperationsApi.listGateDeliveries(accountId, from, to),
        suppliersApi.getAllSuppliers(accountId),
      ]);
      setManifests(m.data ?? []);
      setGates(g.data ?? []);
      setSuppliers(s.data ?? []);
    } catch (e: unknown) {
      useToastStore.getState().error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [accountId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const gatesWithoutManifest = useMemo(
    () => gates.filter((g) => g.source_type !== 'direct' && !g.manifest),
    [gates],
  );

  const selectedGate = useMemo(() => gatesWithoutManifest.find((g) => g.id === gateId), [gatesWithoutManifest, gateId]);

  const parseDraftLines = (rows: DraftLine[]) => {
    const out: { farmer_supplier_account_id: string; declared_litres: number; container_id?: string }[] = [];
    for (const row of rows) {
      if (!row.farmer_supplier_account_id.trim()) continue;
      const vol = Number(row.declared_litres);
      if (!Number.isFinite(vol) || vol < 0) {
        throw new Error('Each line needs a valid declared volume (litres).');
      }
      out.push({
        farmer_supplier_account_id: row.farmer_supplier_account_id,
        declared_litres: vol,
        container_id: row.container_id.trim() || undefined,
      });
    }
    if (!out.length) throw new Error('Add at least one farmer line with supplier and litres.');
    return out;
  };

  const handleCreate = async () => {
    if (!accountId || !selectedGate) {
      useToastStore.getState().error('Select an Umucunda gate delivery without a manifest.');
      return;
    }
    setSaving(true);
    try {
      const lines = parseDraftLines(createLines);
      await mccOperationsApi.createManifest({
        account_id: accountId,
        gate_delivery_id: selectedGate.id,
        umucunda_supplier_account_id: selectedGate.source_account.id,
        lines,
      });
      useToastStore.getState().success('Manifest created (draft).');
      setCreateOpen(false);
      setGateId('');
      setCreateLines([emptyDraftLine()]);
      await load();
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Save failed';
      useToastStore.getState().error(msg);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (m: MccManifestRow) => {
    setEditManifest(m);
    setEditLines(linesFromManifest(m));
  };

  const saveEdit = async () => {
    if (!accountId || !editManifest) return;
    setSaving(true);
    try {
      const lines = parseDraftLines(editLines);
      await mccOperationsApi.updateManifestDraft(editManifest.id, { account_id: accountId, lines });
      useToastStore.getState().success('Draft updated.');
      setEditManifest(null);
      await load();
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Save failed';
      useToastStore.getState().error(msg);
    } finally {
      setSaving(false);
    }
  };

  const confirmReject = async () => {
    if (!accountId || !rejectManifest) return;
    const reason = rejectReason.trim();
    if (!reason) {
      useToastStore.getState().error('Enter a rejection reason.');
      return;
    }
    setSaving(true);
    try {
      await mccOperationsApi.rejectManifest(rejectManifest.id, reason, accountId);
      useToastStore.getState().success('Manifest rejected.');
      setRejectManifest(null);
      setRejectReason('');
      await load();
    } catch (e: unknown) {
      useToastStore.getState().error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Reject failed');
    } finally {
      setSaving(false);
    }
  };

  const act = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      useToastStore.getState().success(label);
      await load();
    } catch (e: unknown) {
      useToastStore.getState().error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Action failed');
    }
  };

  const updateCreateLine = (index: number, patch: Partial<DraftLine>) => {
    setCreateLines((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const updateEditLine = (index: number, patch: Partial<DraftLine>) => {
    setEditLines((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleClearFilters = () => {
    setFrom(defaultManifestFrom());
    setTo(isoDate(new Date()));
  };

  const renderLineEditors = (
    rows: DraftLine[],
    onChange: (index: number, patch: Partial<DraftLine>) => void,
    onAdd: () => void,
    onRemove: (index: number) => void,
  ) => (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div
          key={index}
          className="flex flex-col sm:flex-row gap-2 sm:items-end border border-gray-200 rounded-sm p-3 bg-gray-50/40"
        >
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-medium text-gray-600 mb-1">Farmer (supplier)</label>
            <select
              value={row.farmer_supplier_account_id}
              onChange={(e) => onChange(index, { farmer_supplier_account_id: e.target.value })}
              className={`${FILTER_INPUT} max-w-none w-full`}
            >
              <option value="">Select…</option>
              {suppliers.map((s) => (
                <option key={s.account.id} value={s.account.id}>
                  {s.account.name || s.account.code}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-28">
            <label className="block text-xs font-medium text-gray-600 mb-1">Litres</label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={row.declared_litres}
              onChange={(e) => onChange(index, { declared_litres: e.target.value })}
              className={`${FILTER_INPUT} sm:max-w-[8rem]`}
            />
          </div>
          <div className="w-full sm:w-32">
            <label className="block text-xs font-medium text-gray-600 mb-1">Container</label>
            <input
              value={row.container_id}
              onChange={(e) => onChange(index, { container_id: e.target.value })}
              className={`${FILTER_INPUT} max-w-none sm:max-w-[8rem]`}
              placeholder="Optional"
            />
          </div>
          <button
            type="button"
            disabled={rows.length <= 1}
            onClick={() => onRemove(index)}
            className="shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-sm disabled:opacity-30"
            aria-label="Remove line"
          >
            <Icon icon={faTrash} className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={onAdd} className="btn btn-ghost btn-sm !px-0">
        + Add line
      </button>
    </div>
  );

  return (
    <div className="space-y-4 w-full min-w-0">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Manifests</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
          {canManage && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              disabled={gatesWithoutManifest.length === 0}
              className="btn btn-primary"
            >
              <Icon icon={faPlus} size="sm" className="mr-2" />
              New manifest
            </button>
          )}
        </div>
      </div>

      <FilterBar>
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
        <FilterBarExport<MccManifestRow>
          data={manifests}
          exportFilename="mcc-manifests"
          exportColumns={[
            { key: 'manifest_ref', label: 'Manifest ref' },
            { key: 'status', label: 'Status' },
            {
              key: 'gate_arrived',
              label: 'Gate arrived',
              getValue: (m) => new Date(m.gate_delivery.arrived_at).toLocaleString(),
            },
            {
              key: 'umucunda_supplier',
              label: 'Umucunda supplier',
              getValue: (m) => m.umucunda_supplier?.name || m.umucunda_supplier?.code || '',
            },
            {
              key: 'lines_count',
              label: 'Farmer lines',
              getValue: (m) => String(m.lines?.length ?? 0),
            },
            {
              key: 'submitted_at',
              label: 'Submitted',
              getValue: (m) => (m.submitted_at ? new Date(m.submitted_at).toLocaleString() : ''),
            },
            {
              key: 'accepted_at',
              label: 'Accepted',
              getValue: (m) => (m.accepted_at ? new Date(m.accepted_at).toLocaleString() : ''),
            },
          ]}
          disabled={loading || !accountId || manifests.length === 0}
        />
      </FilterBar>

      {accountId && gatesWithoutManifest.length === 0 && !loading && canManage && (
        <div className="bg-amber-50 border border-amber-200 rounded-sm p-3">
          <p className="text-sm text-amber-900">
            No Umucunda gate deliveries without a manifest in this range. Record a gate arrival first, then add a manifest.
          </p>
        </div>
      )}

      {!accountId ? (
        <p className="text-gray-500 text-sm">Select an account to load manifests.</p>
      ) : loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : manifests.length === 0 ? (
        <p className="text-gray-500 text-sm">No manifests in this range.</p>
      ) : (
        <div className="space-y-3">
          {paginatedManifests.map((m, mi) => (
            <div key={m.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex gap-3 min-w-0">
                  <span
                    className="shrink-0 w-7 text-right text-xs font-semibold text-gray-400 tabular-nums pt-0.5"
                    title="Row in list"
                  >
                    {manifestStartIndex + mi + 1}
                  </span>
                  <div className="min-w-0">
                  <p className="font-medium text-gray-900">
                    {m.manifest_ref} <span className="text-gray-500 font-normal">· {m.status}</span>
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Gate {new Date(m.gate_delivery.arrived_at).toLocaleString()} · {m.umucunda_supplier?.name || m.umucunda_supplier?.code}
                  </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canManage && m.status === 'draft' && (
                    <>
                      <button type="button" onClick={() => openEdit(m)} className="btn btn-secondary btn-sm">
                        Edit lines
                      </button>
                      <button
                        type="button"
                        onClick={() => act('Submitted', () => mccOperationsApi.submitManifest(m.id, accountId))}
                        className="btn btn-primary btn-sm"
                      >
                        Submit
                      </button>
                    </>
                  )}
                  {m.status === 'submitted' && canAcceptManifests && (
                    <button
                      type="button"
                      onClick={() => act('Accepted', () => mccOperationsApi.acceptManifest(m.id, accountId))}
                      className="btn btn-success btn-sm"
                    >
                      Accept
                    </button>
                  )}
                  {m.status === 'submitted' && !canAcceptManifests && (
                    <span className="text-xs text-gray-500">Accept requires Accept MCC manifests permission</span>
                  )}
                  {canAcceptManifests && m.status === 'submitted' && (
                    <button
                      type="button"
                      onClick={() => {
                        setRejectManifest(m);
                        setRejectReason('');
                      }}
                      className="btn btn-danger btn-sm"
                    >
                      Reject
                    </button>
                  )}
                  {canAcceptManifests && m.status === 'draft' && (
                    <button
                      type="button"
                      onClick={() => {
                        setRejectManifest(m);
                        setRejectReason('');
                      }}
                      className="btn btn-danger btn-sm"
                    >
                      Reject draft
                    </button>
                  )}
                </div>
              </div>
              <div className="table-responsive mt-3 -mx-1">
                <table className="w-full text-sm min-w-[280px]">
                  <thead>
                    <tr className="text-left text-gray-600 border-b border-gray-200 bg-gray-50/80">
                      <th className="py-2 px-2 font-medium w-8 text-right tabular-nums">#</th>
                      <th className="py-2 px-3 font-medium">Farmer</th>
                      <th className="py-2 px-3 font-medium">Litres</th>
                      <th className="py-2 px-3 font-medium">Container</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.lines.map((l, li) => (
                      <tr key={l.id} className="border-b border-gray-100 last:border-0">
                        <td className="py-2 px-2 text-right tabular-nums text-gray-500">{li + 1}</td>
                        <td className="py-2 px-3 text-gray-900">{l.farmer_supplier?.name || l.farmer_supplier?.code}</td>
                        <td className="py-2 px-3 tabular-nums">{l.declared_litres}</td>
                        <td className="py-2 px-3 text-gray-700">{l.container_id || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && manifests.length > 0 && (
        <Pagination
          currentPage={manifestPage}
          totalPages={manifestTotalPages}
          totalItems={manifestTotalItems}
          pageSize={manifestPageSize}
          itemLabel="manifests"
          onPageChange={setManifestPage}
        />
      )}

      <Modal open={createOpen} onClose={() => !saving && setCreateOpen(false)} title="New manifest (draft)" maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gate delivery (Umucunda, no manifest yet)</label>
            <select
              value={gateId}
              onChange={(e) => setGateId(e.target.value)}
              className={`${FILTER_INPUT} max-w-none w-full`}
            >
              <option value="">Select…</option>
              {gatesWithoutManifest.map((g) => (
                <option key={g.id} value={g.id}>
                  {`${new Date(g.arrived_at).toLocaleString()} — ${g.source_account?.name || g.source_account?.code || '—'} (${g.gate_volume_litres} L)`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800 mb-2">Farmer lines</p>
            {renderLineEditors(
              createLines,
              updateCreateLine,
              () => setCreateLines((prev) => [...prev, emptyDraftLine()]),
              (index) => setCreateLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index))),
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button type="button" disabled={saving} onClick={() => setCreateOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="button" disabled={saving} onClick={handleCreate} className="btn btn-primary">
              {saving ? 'Saving…' : 'Create draft'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!editManifest} onClose={() => !saving && setEditManifest(null)} title="Edit draft lines" maxWidth="max-w-2xl">
        <div className="space-y-4">
          {renderLineEditors(
            editLines,
            updateEditLine,
            () => setEditLines((prev) => [...prev, emptyDraftLine()]),
            (index) => setEditLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index))),
          )}
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button type="button" disabled={saving} onClick={() => setEditManifest(null)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="button" disabled={saving} onClick={saveEdit} className="btn btn-primary">
              {saving ? 'Saving…' : 'Save lines'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!rejectManifest} onClose={() => !saving && setRejectManifest(null)} title="Reject manifest" maxWidth="max-w-md">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="input w-full min-h-[5rem] py-2 px-3 text-sm text-gray-900"
              placeholder="Required"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button type="button" disabled={saving} onClick={() => setRejectManifest(null)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="button" disabled={saving} onClick={confirmReject} className="btn btn-danger">
              {saving ? 'Saving…' : 'Reject'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
