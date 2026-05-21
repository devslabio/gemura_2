'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import {
  supplierOperationsApi,
  type ManagedCollection,
  type ManagedTransfer,
  type TransferCollectionLine,
} from '@/lib/api/supplierOperations';
import { useToastStore } from '@/store/toast';
import Modal from '@/app/components/Modal';
import Icon, { faTriangleExclamation, faInfoCircle, faCheckCircle } from '@/app/components/Icon';

const getMccStatusBadge = (transfer: ManagedTransfer) => {
  if (!transfer.mcc_status || transfer.status !== 'submitted') {
    return null;
  }

  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    submitted: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending MCC' },
    accepted: { bg: 'bg-green-100', text: 'text-green-800', label: 'Accepted' },
    partially_accepted: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Partially Accepted' },
    rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' },
  };

  const config = statusConfig[transfer.mcc_status] || statusConfig.submitted;
  return (
    <span className={`text-xs rounded px-2 py-1 ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
};

function availableLiters(c: ManagedCollection): number {
  const total = Number(c.liters) || 0;
  const transferred = Number(c.liters_transferred) || 0;
  return Math.max(0, total - transferred);
}

export default function SupplierTransfersPage() {
  const { currentAccount } = useAuthStore();
  const accountType = (currentAccount?.account_type || '').toLowerCase();
  const [transfers, setTransfers] = useState<ManagedTransfer[]>([]);
  const [collections, setCollections] = useState<ManagedCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [lineDraft, setLineDraft] = useState<Record<string, { selected: boolean; liters: string }>>({});

  const load = async () => {
    setLoading(true);
    try {
      const [t, c] = await Promise.all([supplierOperationsApi.getTransfers(), supplierOperationsApi.getCollections()]);
      setTransfers(t.data ?? []);
      setCollections(c.data ?? []);
    } catch (e) {
      useToastStore.getState().error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load transfers'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const eligibleCollections = useMemo(
    () => collections.filter((c) => !c.transferred && availableLiters(c) > 0),
    [collections]
  );

  const openCreateModal = () => {
    const draft: Record<string, { selected: boolean; liters: string }> = {};
    for (const c of eligibleCollections) {
      const avail = availableLiters(c);
      draft[c.id] = { selected: false, liters: avail > 0 ? String(avail) : '' };
    }
    setLineDraft(draft);
    setCreateOpen(true);
  };

  if (!(accountType === 'supplier' || accountType === 'farmer')) {
    return <p className="text-sm text-gray-500">Only supplier/farmer accounts can access this page.</p>;
  }

  const onCreate = async () => {
    const lines: TransferCollectionLine[] = [];
    for (const c of eligibleCollections) {
      const d = lineDraft[c.id];
      if (!d?.selected) continue;
      const l = Number(d.liters);
      if (Number.isNaN(l) || l <= 0) {
        useToastStore.getState().error(`Enter valid liters for ${c.farm_name || 'collection'}`);
        return;
      }
      if (l > availableLiters(c) + 0.001) {
        useToastStore.getState().error(`Only ${availableLiters(c).toFixed(1)} L available on that collection`);
        return;
      }
      lines.push({ collection_id: c.id, liters: l });
    }
    if (lines.length === 0) {
      useToastStore.getState().error('Select at least one collection and liters to transfer');
      return;
    }

    setCreating(true);
    try {
      await supplierOperationsApi.createTransfer({ lines });
      useToastStore.getState().success('Transfer manifest created');
      setCreateOpen(false);
      await load();
    } catch (e) {
      useToastStore.getState().error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create transfer'
      );
    } finally {
      setCreating(false);
    }
  };

  const onSubmit = async (id: string) => {
    try {
      await supplierOperationsApi.submitTransfer(id);
      useToastStore.getState().success('Transfer submitted to MCC');
      await load();
    } catch (e) {
      useToastStore.getState().error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to submit transfer'
      );
    }
  };

  const draftTotal = useMemo(() => {
    let sum = 0;
    for (const c of eligibleCollections) {
      const d = lineDraft[c.id];
      if (d?.selected) sum += Number(d.liters) || 0;
    }
    return sum;
  }, [eligibleCollections, lineDraft]);

  return (
    <div className="space-y-4 -mt-1">
      <div className="border-b-2 border-gray-200 pb-3">
        <h1 className="text-2xl font-semibold text-gray-900">Transfers to MCC</h1>
        <p className="text-sm text-gray-600 mt-1">
          Choose how many litres from each collection to send. You do not have to transfer everything at once.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-700">
            Collections with milk available: <span className="font-semibold">{eligibleCollections.length}</span>
          </p>
          <p className="text-xs text-gray-500">If MCC accepts less than you sent, the difference is recorded as rejected.</p>
        </div>
        <button
          type="button"
          disabled={creating || eligibleCollections.length === 0}
          onClick={openCreateModal}
          className="rounded bg-primary text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Create transfer
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Manifest history</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : transfers.length === 0 ? (
          <p className="text-sm text-gray-500">No transfer manifests yet.</p>
        ) : (
          <div className="space-y-2">
            {transfers
              .slice()
              .reverse()
              .map((t) => (
                <div key={t.id} className="border border-gray-200 rounded p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{Number(t.total_liters || 0).toFixed(1)} L total</p>
                      <p className="text-xs text-gray-600">
                        Own: {Number(t.own_liters || 0).toFixed(1)} L · External: {Number(t.external_liters || 0).toFixed(1)} L
                      </p>
                      {Array.isArray(t.lines) && t.lines.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          {t.lines.length} collection line{t.lines.length === 1 ? '' : 's'}
                        </p>
                      )}
                      {t.submitted_at && (
                        <p className="text-xs text-gray-400 mt-1">
                          Submitted: {new Date(t.submitted_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {t.status === 'submitted' && t.mcc_status ? (
                        getMccStatusBadge(t)
                      ) : (
                        <span
                          className={`text-xs rounded px-2 py-1 ${t.status === 'submitted' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
                        >
                          {t.status === 'submitted' ? 'Pending MCC' : 'Draft'}
                        </span>
                      )}
                      {t.status !== 'submitted' && (
                        <button
                          type="button"
                          onClick={() => onSubmit(t.id)}
                          className="text-xs rounded bg-gray-900 text-white px-3 py-1.5"
                        >
                          Submit
                        </button>
                      )}
                    </div>
                  </div>

                  {t.mcc_status && t.mcc_status !== 'submitted' && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                      {t.mcc_status === 'rejected' && t.mcc_rejection_reason && (
                        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded p-2">
                          <Icon icon={faTriangleExclamation} className="text-xs mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="font-medium">Rejected:</span> {t.mcc_rejection_reason}
                            {t.mcc_rejected_liters != null && (
                              <> ({t.mcc_rejected_liters.toFixed(1)} L)</>
                            )}
                          </div>
                        </div>
                      )}
                      {t.mcc_status === 'partially_accepted' && (
                        <div className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 rounded p-2">
                          <Icon icon={faInfoCircle} className="text-xs mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="font-medium">Partially accepted:</span>{' '}
                            {t.mcc_accepted_liters?.toFixed(1)} L accepted, {t.mcc_rejected_liters?.toFixed(1)} L rejected
                            {t.mcc_rejection_reason && <> — {t.mcc_rejection_reason}</>}
                          </div>
                        </div>
                      )}
                      {t.mcc_status === 'accepted' && (
                        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded p-2">
                          <Icon icon={faCheckCircle} className="text-xs flex-shrink-0" />
                          <span>
                            {(t.mcc_accepted_liters ?? t.total_liters).toFixed(1)} L accepted by MCC
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create transfer manifest"
        maxWidth="max-w-2xl"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 text-sm text-gray-600"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={creating || draftTotal <= 0}
              onClick={onCreate}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded disabled:opacity-50"
            >
              {creating ? 'Creating…' : `Create (${draftTotal.toFixed(1)} L)`}
            </button>
          </div>
        }
      >
        <p className="text-sm text-gray-600 mb-3">
          Select collections and enter litres to transfer. Remaining milk stays on hand for a later manifest.
        </p>
        {eligibleCollections.length === 0 ? (
          <p className="text-sm text-gray-500">No collections with available litres.</p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Include</th>
                  <th className="px-3 py-2 text-left">Farm</th>
                  <th className="px-3 py-2 text-right">Available (L)</th>
                  <th className="px-3 py-2 text-right">Transfer (L)</th>
                </tr>
              </thead>
              <tbody>
                {eligibleCollections.map((c) => {
                  const avail = availableLiters(c);
                  const d = lineDraft[c.id] ?? { selected: false, liters: String(avail) };
                  return (
                    <tr key={c.id} className="border-t border-gray-100">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={d.selected}
                          onChange={(e) =>
                            setLineDraft((prev) => ({
                              ...prev,
                              [c.id]: { ...d, selected: e.target.checked },
                            }))
                          }
                        />
                      </td>
                      <td className="px-3 py-2">{c.farm_name || '—'}</td>
                      <td className="px-3 py-2 text-right font-mono">{avail.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          max={avail}
                          step="0.1"
                          disabled={!d.selected}
                          value={d.liters}
                          onChange={(e) =>
                            setLineDraft((prev) => ({
                              ...prev,
                              [c.id]: { ...d, liters: e.target.value },
                            }))
                          }
                          className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm disabled:bg-gray-100"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
