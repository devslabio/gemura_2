'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { mccOperationsApi, type MccGateDeliveryRow } from '@/lib/api/mcc-operations';
import { suppliersApi, type Supplier } from '@/lib/api/suppliers';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import { usePermission } from '@/hooks/usePermission';
import { useClientPagination } from '@/hooks/useClientPagination';
import Modal from '@/app/components/Modal';
import Pagination from '@/app/components/Pagination';
import FilterBar, { FilterBarGroup, FilterBarActions, FilterBarApply, FilterBarExport } from '@/app/components/FilterBar';
import SearchableSelect from '@/app/components/SearchableSelect';
import Icon, { faPlus } from '@/app/components/Icon';

const FILTER_INPUT =
  'input h-9 min-h-[2.25rem] !py-1.5 !px-3 text-sm w-full min-w-0 sm:max-w-[11rem] text-gray-900';

const INPUT_FULL =
  'input h-9 min-h-[2.25rem] !py-1.5 !px-3 text-sm w-full text-gray-900';

const SOURCE_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'direct', label: 'Direct farmer' },
  { value: 'umucunda_a', label: 'Umucunda A' },
  { value: 'umucunda_b', label: 'Umucunda B' },
];

const MANIFEST_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'none', label: 'No manifest' },
  { value: 'has', label: 'Has manifest' },
];

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function defaultFromDate() {
  const x = new Date();
  x.setUTCDate(x.getUTCDate() - 7);
  return isoDate(x);
}

/** Gate intake log + record modal (same behavior as legacy `/operations/gate`). */
export default function GateArrivalsPanel({ showPageHeading = false }: { showPageHeading?: boolean }) {
  const { currentAccount } = useAuthStore();
  const { hasAnyPermission } = usePermission();
  const canManage = hasAnyPermission(['mcc_manage_operations', 'update_collections']);
  const accountId = currentAccount?.account_id ?? '';
  const [rows, setRows] = useState<MccGateDeliveryRow[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [from, setFrom] = useState(defaultFromDate);
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [supplierAccountIdFilter, setSupplierAccountIdFilter] = useState('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState('');
  const [manifestFilter, setManifestFilter] = useState('');

  const [sourceType, setSourceType] = useState<'direct' | 'umucunda_a' | 'umucunda_b'>('direct');
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [volume, setVolume] = useState('');
  const [notes, setNotes] = useState('');

  const supplierFilterOptions = useMemo(() => {
    const opts = suppliers.map((s) => {
      const name = s.account.name?.trim();
      const code = (s.account.code ?? '').trim();
      const label =
        name && code && name.toLowerCase() !== code.toLowerCase()
          ? `${name} (${code})`
          : name || code || 'Supplier';
      return { value: s.account.id, label };
    });
    opts.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
    return [{ value: '', label: 'All suppliers' }, ...opts];
  }, [suppliers]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (sourceTypeFilter && r.source_type !== sourceTypeFilter) return false;
      if (manifestFilter === 'none' && r.manifest) return false;
      if (manifestFilter === 'has' && !r.manifest) return false;
      if (supplierAccountIdFilter && r.source_account?.id !== supplierAccountIdFilter) return false;
      return true;
    });
  }, [rows, supplierAccountIdFilter, sourceTypeFilter, manifestFilter]);

  const {
    page: gatePage,
    setPage: setGatePage,
    paginatedItems: paginatedRows,
    totalPages: gateTotalPages,
    totalItems: gateTotalItems,
    startIndex: gateStartIndex,
    pageSize: gatePageSize,
  } = useClientPagination(filteredRows, {
    resetKey: `${from}-${to}-${supplierAccountIdFilter}-${sourceTypeFilter}-${manifestFilter}`,
  });

  const handleClearFilters = () => {
    setFrom(defaultFromDate());
    setTo(isoDate(new Date()));
    setSupplierAccountIdFilter('');
    setSourceTypeFilter('');
    setManifestFilter('');
  };

  const handleApplyFilters = () => {
    void load();
  };

  const load = useCallback(async () => {
    if (!accountId) {
      setRows([]);
      setSuppliers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [g, s] = await Promise.all([
        mccOperationsApi.listGateDeliveries(accountId, from, to),
        suppliersApi.getAllSuppliers(accountId),
      ]);
      setRows(g.data ?? []);
      setSuppliers(s.data ?? []);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to load';
      useToastStore.getState().error(msg);
    } finally {
      setLoading(false);
    }
  }, [accountId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setSourceType('direct');
    setSourceAccountId('');
    setVolume('');
    setNotes('');
  };

  const handleCreate = async () => {
    if (!accountId) return;
    const vol = Number(volume);
    if (!sourceAccountId || !Number.isFinite(vol) || vol <= 0) {
      useToastStore.getState().error('Choose a supplier and enter a positive volume (litres).');
      return;
    }
    setSaving(true);
    try {
      await mccOperationsApi.createGateDelivery({
        account_id: accountId,
        source_type: sourceType,
        source_account_id: sourceAccountId,
        gate_volume_litres: vol,
        notes: notes.trim() || undefined,
      });
      useToastStore.getState().success('Gate arrival recorded.');
      setModalOpen(false);
      resetForm();
      await load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Save failed';
      useToastStore.getState().error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 w-full min-w-0">
      {showPageHeading ? (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Gate arrivals</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
            {canManage && (
              <button type="button" onClick={() => setModalOpen(true)} className="btn btn-primary">
                <Icon icon={faPlus} size="sm" className="mr-2" />
                New gate arrival
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          {canManage && (
            <button type="button" onClick={() => setModalOpen(true)} className="btn btn-primary">
              <Icon icon={faPlus} size="sm" className="mr-2" />
              New gate arrival
            </button>
          )}
        </div>
      )}

      <FilterBar>
        <FilterBarGroup label="Source type">
          <select
            value={sourceTypeFilter}
            onChange={(e) => setSourceTypeFilter(e.target.value)}
            className={INPUT_FULL}
          >
            {SOURCE_TYPE_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FilterBarGroup>
        <FilterBarGroup label="Manifest">
          <select
            value={manifestFilter}
            onChange={(e) => setManifestFilter(e.target.value)}
            className={INPUT_FULL}
          >
            {MANIFEST_FILTER_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
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
        <FilterBarGroup label="Supplier">
          <SearchableSelect
            id="gate-filter-supplier"
            ariaLabel="Filter by supplier"
            options={supplierFilterOptions}
            value={supplierAccountIdFilter}
            onChange={setSupplierAccountIdFilter}
            placeholder={!accountId ? 'Select an account…' : 'All suppliers'}
            disabled={!accountId}
            portalDropdown
            maxListHeight={280}
            triggerClassName="!py-1.5 min-h-[2.25rem] pr-8"
          />
        </FilterBarGroup>
        <FilterBarActions onClear={handleClearFilters} />
        <FilterBarApply onApply={handleApplyFilters} />
        <FilterBarExport<MccGateDeliveryRow>
          data={filteredRows}
          exportFilename="gate-arrivals"
          exportColumns={[
            { key: 'arrived_at', label: 'Arrived', getValue: (r) => new Date(r.arrived_at).toLocaleString() },
            {
              key: 'source_account',
              label: 'Source',
              getValue: (r) => r.source_account?.name || r.source_account?.code || '—',
            },
            { key: 'source_type', label: 'Type', getValue: (r) => r.source_type },
            { key: 'gate_volume_litres', label: 'Volume (L)', getValue: (r) => String(r.gate_volume_litres) },
            {
              key: 'manifest',
              label: 'Manifest',
              getValue: (r) =>
                r.manifest ? `${r.manifest.manifest_ref} (${r.manifest.status})` : '',
            },
            { key: 'notes', label: 'Notes', getValue: (r) => r.notes ?? '' },
          ]}
          disabled={loading || !accountId}
        />
      </FilterBar>

      <div className="card overflow-hidden">
        {!accountId ? (
          <div className="card-body">
            <p className="text-gray-500 text-sm">Select an account to load gate arrivals.</p>
          </div>
        ) : loading ? (
          <div className="card-body">
            <p className="text-gray-500 text-sm">Loading…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="card-body">
            <p className="text-gray-500 text-sm">No gate arrivals in this range.</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="card-body">
            <p className="text-gray-500 text-sm">No arrivals match your filters.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80 text-left text-gray-600">
                  <th className="py-2.5 px-2 sm:px-4 font-medium w-10 text-right tabular-nums">#</th>
                  <th className="py-2.5 px-4 font-medium">Arrived</th>
                  <th className="py-2.5 px-4 font-medium">Source</th>
                  <th className="py-2.5 px-4 font-medium">Type</th>
                  <th className="py-2.5 px-4 font-medium">Volume (L)</th>
                  <th className="py-2.5 px-4 font-medium">Manifest</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((r, i) => (
                  <tr key={r.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2.5 px-2 sm:px-4 text-right tabular-nums text-gray-500">{gateStartIndex + i + 1}</td>
                    <td className="py-2.5 px-4 whitespace-nowrap text-gray-900">{new Date(r.arrived_at).toLocaleString()}</td>
                    <td className="py-2.5 px-4 text-gray-900">{r.source_account?.name || r.source_account?.code || '—'}</td>
                    <td className="py-2.5 px-4 text-gray-700">{r.source_type}</td>
                    <td className="py-2.5 px-4 tabular-nums text-gray-900">{r.gate_volume_litres}</td>
                    <td className="py-2.5 px-4">
                      {r.manifest ? (
                        <span className="text-emerald-700 font-medium">
                          {r.manifest.manifest_ref} ({r.manifest.status})
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && filteredRows.length > 0 && (
        <Pagination
          currentPage={gatePage}
          totalPages={gateTotalPages}
          totalItems={gateTotalItems}
          pageSize={gatePageSize}
          itemLabel="arrivals"
          onPageChange={setGatePage}
        />
      )}

      <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title="Record gate arrival">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source type</label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as typeof sourceType)}
              className={`${FILTER_INPUT} max-w-none w-full`}
            >
              <option value="direct">Direct farmer</option>
              <option value="umucunda_a">Umucunda A</option>
              <option value="umucunda_b">Umucunda B</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier (linked to this MCC)</label>
            <select
              value={sourceAccountId}
              onChange={(e) => setSourceAccountId(e.target.value)}
              className={`${FILTER_INPUT} max-w-none w-full`}
            >
              <option value="">Select…</option>
              {suppliers.map((s) => (
                <option key={s.account.id} value={s.account.id}>
                  {s.account.name || s.account.code} ({s.account.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Volume (litres)</label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              className={`${FILTER_INPUT} max-w-none w-full`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="input w-full min-h-[4rem] py-2 px-3 text-sm text-gray-900"
            />
          </div>
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
