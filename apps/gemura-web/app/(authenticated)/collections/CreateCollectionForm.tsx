'use client';

import { useState, useEffect, useMemo } from 'react';
import { collectionsApi, CreateCollectionData, RejectionReason } from '@/lib/api/collections';
import { suppliersApi, Supplier } from '@/lib/api/suppliers';
import { mccOperationsApi, MccGateDeliveryRow, MccManifestRow } from '@/lib/api/mcc-operations';
import { PermissionService } from '@/lib/services/permission.service';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import { usePermission } from '@/hooks/usePermission';
import Icon, { faCheckCircle, faSpinner } from '@/app/components/Icon';
import SearchableSelect from '@/app/components/SearchableSelect';

/** How this milk collection ties to MCC intake / manifests (stored on the same milk sale as before). */
type MccLinkMode = 'none' | 'direct_gate_new' | 'direct_gate_existing' | 'manifest_line';

function ymdRangeDaysBack(daysBack: number): { from: string; to: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysBack);
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  return { from: fmt(start), to: fmt(end) };
}

function supplierCodeForAccount(suppliers: Supplier[], accountId: string, fallbackCode: string | null): string | null {
  if (fallbackCode) return fallbackCode;
  const s = suppliers.find((x) => x.account.id === accountId);
  return s?.account.code ?? null;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
];

const SHIFT_OPTIONS = [
  { value: 'morning', label: 'Morning' },
  { value: 'evening', label: 'Evening' },
];

const SELECT_TRIGGER_MODAL =
  '!py-2 text-sm text-gray-900 pr-9 min-h-[2.5rem]';

const gateSelectOptions = (rows: MccGateDeliveryRow[]) =>
  rows.map((d) => ({
    value: d.id,
    label: `${new Date(d.arrived_at).toLocaleString()} · ${d.source_account.name} · ${d.gate_volume_litres} L`,
  }));

interface CreateCollectionFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function CreateCollectionForm({ onSuccess, onCancel }: CreateCollectionFormProps) {
  const { currentAccount } = useAuthStore();
  const { hasAnyPermission } = usePermission();
  const canRecordGateArrival = hasAnyPermission(['mcc_manage_operations', 'update_collections']);
  const [loading, setLoading] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [loadingReasons, setLoadingReasons] = useState(true);
  const [loadingMcc, setLoadingMcc] = useState(false);
  const [error, setError] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [rejectionReasons, setRejectionReasons] = useState<RejectionReason[]>([]);
  const [gateRows, setGateRows] = useState<MccGateDeliveryRow[]>([]);
  const [manifestRows, setManifestRows] = useState<MccManifestRow[]>([]);
  const [mccLinkMode, setMccLinkMode] = useState<MccLinkMode>('none');
  const [selectedGateId, setSelectedGateId] = useState('');
  const [selectedManifestLineId, setSelectedManifestLineId] = useState('');
  /** Optional notes stored only on the gate row when using “new direct gate” in one step. */
  const [gateArrivalNotes, setGateArrivalNotes] = useState('');
  const [formData, setFormData] = useState<CreateCollectionData & { unit_price: number }>({
    collection_shift: 'morning',
    supplier_account_code: '',
    quantity: 0,
    unit_price: 0,
    status: 'accepted',
    collection_at: new Date().toISOString().slice(0, 16),
    notes: '',
    payment_status: 'unpaid',
    rejection_reason: '',
  });

  useEffect(() => {
    let cancelled = false;
    suppliersApi.getAllSuppliers().then((res) => {
      if (!cancelled && res.code === 200) setSuppliers(res.data || []);
    }).finally(() => { if (!cancelled) setLoadingSuppliers(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    collectionsApi.getRejectionReasons().then((res) => {
      if (!cancelled && res.code === 200) setRejectionReasons(res.data || []);
    }).finally(() => { if (!cancelled) setLoadingReasons(false); });
    return () => { cancelled = true; };
  }, []);

  const canLoadMccOps =
    !!currentAccount?.account_id &&
    String(currentAccount.account_type).toLowerCase() === 'mcc' &&
    PermissionService.hasPermission('mcc_view_operations');

  useEffect(() => {
    if (!canLoadMccOps || !currentAccount?.account_id) return;
    let cancelled = false;
    const { from, to } = ymdRangeDaysBack(30);
    setLoadingMcc(true);
    Promise.all([
      mccOperationsApi.listGateDeliveries(currentAccount.account_id, from, to),
      mccOperationsApi.listManifests(currentAccount.account_id, from, to),
    ])
      .then(([gRes, mRes]) => {
        if (cancelled) return;
        if (gRes.code === 200 && gRes.data) setGateRows(gRes.data);
        if (mRes.code === 200 && mRes.data) setManifestRows(mRes.data);
      })
      .finally(() => {
        if (!cancelled) setLoadingMcc(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canLoadMccOps, currentAccount?.account_id]);

  const linkableGateRows = useMemo(
    () =>
      gateRows.filter(
        (d) => d.source_type === 'direct' && !d.linked_collection_id,
      ),
    [gateRows],
  );

  const linkableManifestLineOptions = useMemo(() => {
    const out: { lineId: string; label: string; litres: number; supplierAccountId: string; supplierCode: string | null }[] = [];
    for (const m of manifestRows) {
      if (m.status !== 'accepted') continue;
      for (const line of m.lines) {
        if (line.linked_collection_id) continue;
        const litres = Number(line.declared_litres);
        out.push({
          lineId: line.id,
          label: `${m.manifest_ref} · ${line.farmer_supplier.name} · ${line.declared_litres} L`,
          litres: Number.isFinite(litres) ? litres : 0,
          supplierAccountId: line.farmer_supplier.id,
          supplierCode: line.farmer_supplier.code,
        });
      }
    }
    return out;
  }, [manifestRows]);

  const handleMccLinkModeChange = (mode: MccLinkMode) => {
    setMccLinkMode(mode);
    setSelectedGateId('');
    setSelectedManifestLineId('');
    setGateArrivalNotes('');
    setError('');
  };

  const handleGateRowChange = (gateId: string) => {
    setSelectedGateId(gateId);
    setError('');
    const row = gateRows.find((g) => g.id === gateId);
    if (!row) return;
    const code = supplierCodeForAccount(suppliers, row.source_account.id, row.source_account.code);
    const litres = Number(row.gate_volume_litres);
    const supplier = suppliers.find((s) => s.account.id === row.source_account.id || (code && s.account.code === code));
    const price = supplier?.price_per_liter;
    setFormData((prev) => ({
      ...prev,
      supplier_account_code: code ?? prev.supplier_account_code,
      quantity: Number.isFinite(litres) && litres > 0 ? litres : prev.quantity,
      ...(typeof price === 'number' ? { unit_price: price } : {}),
    }));
  };

  const handleManifestLineChange = (lineId: string) => {
    setSelectedManifestLineId(lineId);
    setError('');
    const opt = linkableManifestLineOptions.find((o) => o.lineId === lineId);
    if (!opt) return;
    const code = supplierCodeForAccount(suppliers, opt.supplierAccountId, opt.supplierCode);
    const supplier = suppliers.find((s) => s.account.id === opt.supplierAccountId || (code && s.account.code === code));
    const price = supplier?.price_per_liter;
    setFormData((prev) => ({
      ...prev,
      supplier_account_code: code ?? prev.supplier_account_code,
      quantity: opt.litres > 0 ? opt.litres : prev.quantity,
      ...(typeof price === 'number' ? { unit_price: price } : {}),
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'status' && value !== 'rejected' ? { rejection_reason: '' } : {}),
    }));
    setError('');
  };

  const handleSupplierSelect = (supplier_account_code: string) => {
    setFormData(prev => ({ ...prev, supplier_account_code }));
    setError('');
    const supplier = suppliers.find(s => s.account.code === supplier_account_code);
    const price = supplier?.price_per_liter;
    if (typeof price === 'number') setFormData(prev => ({ ...prev, unit_price: price }));
  };

  const validateForm = (): boolean => {
    if (!formData.supplier_account_code) { setError('Please select a supplier'); return false; }
    if (!formData.quantity || formData.quantity <= 0) { setError('Quantity must be greater than 0'); return false; }
    if (!formData.collection_at) { setError('Collection date and time is required'); return false; }
    if (formData.status === 'rejected' && !formData.rejection_reason) { setError('Rejection reason is required when status is rejected'); return false; }
    if (mccLinkMode === 'direct_gate_existing' && !selectedGateId) {
      setError('Select a direct gate arrival, or pick another source.');
      return false;
    }
    if (mccLinkMode === 'manifest_line' && !selectedManifestLineId) {
      setError('Select a manifest line, or choose another source.');
      return false;
    }
    if (mccLinkMode === 'direct_gate_new' && canLoadMccOps && !canRecordGateArrival) {
      setError('You do not have permission to record a new gate arrival.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateForm()) return;
    setLoading(true);
    try {
      let mccGateDeliveryId: string | undefined;

      if (canLoadMccOps && mccLinkMode === 'direct_gate_new' && canRecordGateArrival) {
        const supplier = suppliers.find((s) => s.account.code === formData.supplier_account_code);
        if (!supplier?.account?.id) {
          setError('Select a linked supplier for this MCC before recording a gate arrival.');
          setLoading(false);
          return;
        }
        const arrivedAt = new Date(formData.collection_at);
        if (Number.isNaN(arrivedAt.getTime())) {
          setError('Invalid collection date/time.');
          setLoading(false);
          return;
        }
        const gateRes = (await mccOperationsApi.createGateDelivery({
          account_id: currentAccount!.account_id,
          source_type: 'direct',
          source_account_id: supplier.account.id,
          gate_volume_litres: Number(formData.quantity),
          arrived_at: arrivedAt.toISOString(),
          notes: gateArrivalNotes.trim() || (formData.notes ?? '').trim() || undefined,
        })) as { code: number; message?: string; data?: { id: string } };
        if (gateRes.code !== 200 && gateRes.code !== 201) {
          setError(gateRes.message || 'Could not record gate arrival.');
          setLoading(false);
          return;
        }
        const newId = gateRes.data?.id;
        if (!newId) {
          setError('Gate arrival saved but no id was returned. Try again or record the gate separately.');
          setLoading(false);
          return;
        }
        mccGateDeliveryId = newId;
      } else if (mccLinkMode === 'direct_gate_existing' && selectedGateId) {
        mccGateDeliveryId = selectedGateId;
      }

      const collectionDate = formData.collection_at.replace('T', ' ').slice(0, 19);
      const finalData: CreateCollectionData = {
        collection_shift: formData.collection_shift,
        supplier_account_code: formData.supplier_account_code,
        quantity: formData.quantity,
        status: formData.status as any,
        collection_at: collectionDate,
        notes: formData.notes,
        payment_status: formData.payment_status as any,
        rejection_reason: formData.status === 'rejected' ? (formData.rejection_reason || undefined) : undefined,
        ...(mccGateDeliveryId ? { mcc_gate_delivery_id: mccGateDeliveryId } : {}),
        ...(mccLinkMode === 'manifest_line' && selectedManifestLineId ? { mcc_manifest_line_id: selectedManifestLineId } : {}),
      };
      const response = await collectionsApi.createCollection(finalData);
      if (response.code === 200 || response.code === 201) {
        useToastStore.getState().success('Collection created successfully!');
        onSuccess();
      } else {
        setError(response.message || 'Failed to create collection');
      }
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as { message?: string })?.message || 'Failed to create collection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-600">{error}</div>}
      {canLoadMccOps && (
        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50/90 to-white p-4 space-y-3 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Collection source</h3>
          {loadingMcc ? (
            <div className="text-sm text-gray-600 flex items-center">
              <Icon icon={faSpinner} size="sm" spin className="mr-2" />
              Loading gate and manifest data…
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Collection source">
                <button
                  type="button"
                  role="radio"
                  aria-checked={mccLinkMode === 'none'}
                  disabled={loading}
                  onClick={() => handleMccLinkModeChange('none')}
                  className={`text-left rounded-lg border px-3 py-2.5 text-sm transition-all disabled:opacity-50 ${
                    mccLinkMode === 'none'
                      ? 'border-[var(--primary)] bg-[var(--primary)]/[0.06] shadow-sm ring-1 ring-[var(--primary)]/25'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <span className="font-medium text-gray-900">Standard</span>
                  <span className="block text-xs text-gray-600 mt-0.5">No gate or manifest link</span>
                </button>
                {canRecordGateArrival ? (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={mccLinkMode === 'direct_gate_new'}
                    disabled={loading}
                    onClick={() => handleMccLinkModeChange('direct_gate_new')}
                    className={`text-left rounded-lg border px-3 py-2.5 text-sm transition-all disabled:opacity-50 ${
                      mccLinkMode === 'direct_gate_new'
                        ? 'border-[var(--primary)] bg-[var(--primary)]/[0.06] shadow-sm ring-1 ring-[var(--primary)]/25'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <span className="font-medium text-gray-900">New direct gate</span>
                    <span className="block text-xs text-gray-600 mt-0.5">Gate row + this collection in one step</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  role="radio"
                  aria-checked={mccLinkMode === 'direct_gate_existing'}
                  disabled={loading}
                  onClick={() => handleMccLinkModeChange('direct_gate_existing')}
                  className={`text-left rounded-lg border px-3 py-2.5 text-sm transition-all disabled:opacity-50 ${
                    mccLinkMode === 'direct_gate_existing'
                      ? 'border-[var(--primary)] bg-[var(--primary)]/[0.06] shadow-sm ring-1 ring-[var(--primary)]/25'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <span className="font-medium text-gray-900">Existing gate</span>
                  <span className="block text-xs text-gray-600 mt-0.5">Link an arrival from the last 30 days</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={mccLinkMode === 'manifest_line'}
                  disabled={loading}
                  onClick={() => handleMccLinkModeChange('manifest_line')}
                  className={`text-left rounded-lg border px-3 py-2.5 text-sm transition-all disabled:opacity-50 ${
                    mccLinkMode === 'manifest_line'
                      ? 'border-[var(--primary)] bg-[var(--primary)]/[0.06] shadow-sm ring-1 ring-[var(--primary)]/25'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <span className="font-medium text-gray-900">Umucunda manifest</span>
                  <span className="block text-xs text-gray-600 mt-0.5">Accepted line per farmer</span>
                </button>
              </div>
              {mccLinkMode === 'direct_gate_new' && canRecordGateArrival && (
                <div>
                  <label htmlFor="coll-gate-only-notes" className="block text-xs font-medium text-gray-700 mb-1">
                    Gate-only notes (optional)
                  </label>
                  <textarea
                    id="coll-gate-only-notes"
                    rows={2}
                    value={gateArrivalNotes}
                    onChange={(e) => {
                      setGateArrivalNotes(e.target.value);
                      setError('');
                    }}
                    className="input w-full text-sm text-gray-900"
                    placeholder="Stored on the gate row; collection notes below can differ."
                    disabled={loading}
                  />
                </div>
              )}
              {mccLinkMode === 'direct_gate_existing' && (
                <div>
                  <label htmlFor="coll-mcc-gate" className="block text-xs font-medium text-gray-700 mb-1">
                    Gate arrival (direct, not yet linked)
                  </label>
                  <SearchableSelect
                    id="coll-mcc-gate"
                    options={gateSelectOptions(linkableGateRows)}
                    value={selectedGateId}
                    onChange={(id) => handleGateRowChange(id)}
                    placeholder={linkableGateRows.length === 0 ? 'No arrivals to link' : 'Search or select gate arrival…'}
                    disabled={loading || linkableGateRows.length === 0}
                    portalDropdown
                    maxListHeight={280}
                    triggerClassName={SELECT_TRIGGER_MODAL}
                  />
                  {linkableGateRows.length === 0 && (
                    <p className="text-xs text-amber-800 mt-1">No unlinked direct gate rows in the last 30 days. Use “New direct gate” or log under Gate arrivals first.</p>
                  )}
                </div>
              )}
              {mccLinkMode === 'manifest_line' && (
                <div>
                  <label htmlFor="coll-mcc-manifest-line" className="block text-xs font-medium text-gray-700 mb-1">
                    Manifest line (accepted, not yet linked)
                  </label>
                  <SearchableSelect
                    id="coll-mcc-manifest-line"
                    options={linkableManifestLineOptions.map((o) => ({ value: o.lineId, label: o.label }))}
                    value={selectedManifestLineId}
                    onChange={(id) => handleManifestLineChange(id)}
                    placeholder={linkableManifestLineOptions.length === 0 ? 'No lines available' : 'Search or select manifest line…'}
                    disabled={loading || linkableManifestLineOptions.length === 0}
                    portalDropdown
                    maxListHeight={280}
                    triggerClassName={SELECT_TRIGGER_MODAL}
                  />
                  {linkableManifestLineOptions.length === 0 && (
                    <p className="text-xs text-amber-800 mt-1">No accepted manifest lines available to link (or all lines already have a collection).</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
      <div className="border-t border-gray-100 pt-4 mt-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Collection details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
          <div className="sm:col-span-2">
            <label htmlFor="coll-shift" className="block text-sm font-medium text-gray-700 mb-1">
              Milk brought time
            </label>
            <SearchableSelect
              id="coll-shift"
              options={SHIFT_OPTIONS}
              value={formData.collection_shift ?? 'morning'}
              onChange={(v) => {
                setFormData((prev) => ({ ...prev, collection_shift: v as 'morning' | 'evening' }));
                setError('');
              }}
              placeholder="Shift…"
              disabled={loading}
              portalDropdown
              showSearch={false}
              maxListHeight={200}
              triggerClassName={SELECT_TRIGGER_MODAL}
              ariaLabel="Milk brought time shift"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="coll-supplier" className="block text-sm font-medium text-gray-700 mb-1">
              Supplier <span className="text-red-500">*</span>
            </label>
            {loadingSuppliers ? (
              <div className="input w-full flex items-center text-gray-500 text-sm min-h-[2.5rem] rounded-sm border border-gray-200 bg-gray-50 px-3">
                <Icon icon={faSpinner} size="sm" spin className="mr-2" />
                Loading suppliers…
              </div>
            ) : (
              <SearchableSelect
                id="coll-supplier"
                name="supplier_account_code"
                options={suppliers.map((s) => ({ value: s.account.code, label: `${s.name} (${s.account.code})` }))}
                value={formData.supplier_account_code}
                onChange={handleSupplierSelect}
                placeholder="Search or select supplier…"
                disabled={loading}
                required
                portalDropdown
                maxListHeight={280}
                triggerClassName={SELECT_TRIGGER_MODAL}
              />
            )}
          </div>
          <div>
            <label htmlFor="coll-quantity" className="block text-sm font-medium text-gray-700 mb-1">
              Quantity (L) <span className="text-red-500">*</span>
            </label>
            <input
              id="coll-quantity"
              name="quantity"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              autoComplete="off"
              value={formData.quantity === 0 ? '' : formData.quantity}
              onChange={(e) => {
                const raw = e.target.value;
                const n = raw === '' ? 0 : Number(raw);
                setFormData((prev) => ({
                  ...prev,
                  quantity: Number.isFinite(n) ? n : prev.quantity,
                }));
                setError('');
              }}
              className="input w-full text-gray-900 tabular-nums min-h-[2.5rem]"
              disabled={loading}
              placeholder="e.g. 120.5"
            />
          </div>
          <div>
            <label htmlFor="coll-status" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <SearchableSelect
              id="coll-status"
              options={STATUS_OPTIONS}
              value={formData.status ?? 'accepted'}
              onChange={(v) => {
                setFormData((prev) => ({
                  ...prev,
                  status: v as typeof prev.status,
                  ...(v !== 'rejected' ? { rejection_reason: '' } : {}),
                }));
                setError('');
              }}
              placeholder="Status…"
              disabled={loading}
              portalDropdown
              showSearch={false}
              maxListHeight={220}
              triggerClassName={SELECT_TRIGGER_MODAL}
              ariaLabel="Collection status"
            />
          </div>
          {formData.status === 'rejected' && (
            <div className="sm:col-span-2">
              <label htmlFor="coll-rejection_reason" className="block text-sm font-medium text-gray-700 mb-1">
                Rejection reason <span className="text-red-500">*</span>
              </label>
              {loadingReasons ? (
                <div className="input w-full flex items-center text-gray-500 text-sm min-h-[2.5rem] rounded-sm border border-gray-200 bg-gray-50 px-3">
                  <Icon icon={faSpinner} size="sm" spin className="mr-2" />
                  Loading reasons…
                </div>
              ) : (
                <SearchableSelect
                  id="coll-rejection_reason"
                  options={rejectionReasons.map((r) => ({ value: r.name, label: r.name }))}
                  value={formData.rejection_reason ?? ''}
                  onChange={(v) => {
                    setFormData((prev) => ({ ...prev, rejection_reason: v }));
                    setError('');
                  }}
                  placeholder="Select a reason…"
                  disabled={loading}
                  required
                  portalDropdown
                  maxListHeight={280}
                  triggerClassName={SELECT_TRIGGER_MODAL}
                  ariaLabel="Rejection reason"
                />
              )}
            </div>
          )}
          <div className="sm:col-span-2">
            <label htmlFor="coll-collection_at" className="block text-sm font-medium text-gray-700 mb-1">
              Date &amp; time <span className="text-red-500">*</span>
            </label>
            <input
              id="coll-collection_at"
              name="collection_at"
              type="datetime-local"
              required
              value={formData.collection_at}
              max={new Date().toISOString().slice(0, 16)}
              onChange={handleChange}
              className="input w-full text-gray-900 min-h-[2.5rem] [color-scheme:light]"
              disabled={loading}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="coll-notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              id="coll-notes"
              name="notes"
              rows={3}
              value={formData.notes ?? ''}
              onChange={handleChange}
              className="input w-full min-h-[5rem] py-2.5 text-sm text-gray-900 resize-y"
              disabled={loading}
              placeholder="Optional"
            />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
        <button type="button" onClick={onCancel} className="btn btn-secondary">Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <><Icon icon={faSpinner} size="sm" spin className="mr-2" />Creating...</> : <><Icon icon={faCheckCircle} size="sm" className="mr-2" />Create Collection</>}
        </button>
      </div>
    </form>
  );
}
