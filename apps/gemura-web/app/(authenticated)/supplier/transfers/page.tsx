'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { supplierOperationsApi, type ManagedCollection, type ManagedTransfer } from '@/lib/api/supplierOperations';
import { useToastStore } from '@/store/toast';
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

export default function SupplierTransfersPage() {
  const { currentAccount } = useAuthStore();
  const accountType = (currentAccount?.account_type || '').toLowerCase();
  const [transfers, setTransfers] = useState<ManagedTransfer[]>([]);
  const [collections, setCollections] = useState<ManagedCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

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

  if (!(accountType === 'supplier' || accountType === 'farmer')) {
    return <p className="text-sm text-gray-500">Only supplier/farmer accounts can access this page.</p>;
  }

  const nonTransferred = collections.filter((c) => !c.transferred);

  const onCreate = async () => {
    setCreating(true);
    try {
      await supplierOperationsApi.createTransfer({});
      useToastStore.getState().success('Transfer manifest created');
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

  return (
    <div className="space-y-4 -mt-1">
      <div className="border-b-2 border-gray-200 pb-3">
        <h1 className="text-2xl font-semibold text-gray-900">Transfers to MCC</h1>
        <p className="text-sm text-gray-600 mt-1">Create manifest from non-transferred collections and submit to your MCC.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-700">Eligible collections: <span className="font-semibold">{nonTransferred.length}</span></p>
          <p className="text-xs text-gray-500">Submitted manifests lock their included lines.</p>
        </div>
        <button type="button" disabled={creating || nonTransferred.length === 0} onClick={onCreate} className="rounded bg-primary text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
          {creating ? 'Creating…' : 'Create transfer'}
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
                        <span className={`text-xs rounded px-2 py-1 ${t.status === 'submitted' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {t.status === 'submitted' ? 'Pending' : 'Draft'}
                        </span>
                      )}
                      {t.status !== 'submitted' && (
                        <button type="button" onClick={() => onSubmit(t.id)} className="text-xs rounded bg-gray-900 text-white px-3 py-1.5">
                          Submit
                        </button>
                      )}
                    </div>
                  </div>

                  {/* MCC Response Details */}
                  {t.mcc_status && t.mcc_status !== 'submitted' && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                      {t.mcc_status === 'rejected' && t.mcc_rejection_reason && (
                        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded p-2">
                          <Icon icon={faTriangleExclamation} className="text-xs mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="font-medium">Rejected:</span> {t.mcc_rejection_reason}
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
                            {t.mcc_accepted_liters?.toFixed(1) || t.total_liters.toFixed(1)} L accepted by MCC
                          </span>
                        </div>
                      )}
                      {t.mcc_notes && (
                        <p className="text-xs text-gray-500 pl-5">
                          <span className="font-medium">MCC notes:</span> {t.mcc_notes}
                        </p>
                      )}
                      {t.mcc_processed_at && (
                        <p className="text-xs text-gray-400 pl-5">
                          Processed: {new Date(t.mcc_processed_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

