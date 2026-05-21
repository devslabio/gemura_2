'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import { transfersApi, type IncomingTransfer, type ProcessTransferPayload } from '@/lib/api/transfersApi';
import { collectionsApi } from '@/lib/api/collections';
import Modal from '@/app/components/Modal';
import Icon, { faArrowsRotate, faSpinner } from '@/app/components/Icon';

interface RejectionReason {
  id: string;
  name: string;
}

export default function IncomingTransfersPage() {
  const { currentAccount } = useAuthStore();
  const [transfers, setTransfers] = useState<IncomingTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('submitted');
  const [rejectionReasons, setRejectionReasons] = useState<RejectionReason[]>([]);

  // Process modal state
  const [processModalOpen, setProcessModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<IncomingTransfer | null>(null);
  const [processStatus, setProcessStatus] = useState<'accepted' | 'rejected'>('accepted');
  const [acceptedLiters, setAcceptedLiters] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [processNotes, setProcessNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const loadTransfers = async () => {
    setLoading(true);
    try {
      const res = await transfersApi.getIncoming(statusFilter || undefined);
      setTransfers(res.data ?? []);
    } catch (e) {
      useToastStore.getState().error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load transfers'
      );
    } finally {
      setLoading(false);
    }
  };

  const loadRejectionReasons = async () => {
    try {
      const res = await collectionsApi.getRejectionReasons();
      setRejectionReasons(res.data ?? []);
    } catch {
      // Fallback reasons if API fails
      setRejectionReasons([
        { id: '1', name: 'Added Water' },
        { id: '2', name: 'Antibiotics' },
        { id: '3', name: 'Aflatoxin' },
        { id: '4', name: 'Adulteration' },
        { id: '5', name: 'Temperature' },
      ]);
    }
  };

  useEffect(() => {
    void loadTransfers();
    void loadRejectionReasons();
  }, [statusFilter]);

  const openProcessModal = (transfer: IncomingTransfer) => {
    setSelectedTransfer(transfer);
    setProcessStatus('accepted');
    setAcceptedLiters(String(transfer.total_liters));
    setRejectionReason('');
    setProcessNotes('');
    setProcessModalOpen(true);
  };

  const acceptedNum = selectedTransfer ? Number(acceptedLiters) : 0;
  const rejectedAtIntake =
    selectedTransfer && processStatus === 'accepted'
      ? Math.max(0, selectedTransfer.total_liters - acceptedNum)
      : 0;
  const needsPartialRejectionReason = processStatus === 'accepted' && rejectedAtIntake > 0.001;

  const handleProcess = async () => {
    if (!selectedTransfer) return;

    if (processStatus === 'rejected' && !rejectionReason) {
      useToastStore.getState().error('Please select a rejection reason');
      return;
    }

    if (needsPartialRejectionReason && !rejectionReason) {
      useToastStore.getState().error('Select a reason for the litres you are not accepting');
      return;
    }

    if (processStatus === 'accepted') {
      const liters = Number(acceptedLiters);
      if (Number.isNaN(liters) || liters < 0 || liters > selectedTransfer.total_liters) {
        useToastStore.getState().error(`Accepted quantity must be between 0 and ${selectedTransfer.total_liters.toFixed(1)} L`);
        return;
      }
    }

    setProcessing(true);
    try {
      const payload: ProcessTransferPayload = {
        status: processStatus,
        notes: processNotes || undefined,
      };

      if (processStatus === 'accepted') {
        const liters = Number(acceptedLiters);
        payload.accepted_liters = liters;
        if (rejectedAtIntake > 0.001) {
          payload.rejection_reason = rejectionReason;
        }
      } else {
        payload.rejection_reason = rejectionReason;
      }

      await transfersApi.process(selectedTransfer.id, payload);
      useToastStore.getState().success(
        processStatus === 'accepted' ? 'Transfer accepted successfully' : 'Transfer rejected'
      );
      setProcessModalOpen(false);
      setSelectedTransfer(null);
      await loadTransfers();
    } catch (e) {
      useToastStore.getState().error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to process transfer'
      );
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      submitted: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-green-100 text-green-800',
      partially_accepted: 'bg-blue-100 text-blue-800',
      rejected: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      submitted: 'Pending',
      accepted: 'Accepted',
      partially_accepted: 'Partial',
      rejected: 'Rejected',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const isExternalAccount = ['farmer', 'supplier', 'customer'].includes(
    (currentAccount?.account_type || '').toLowerCase()
  );

  if (isExternalAccount) {
    return <p className="text-sm text-gray-500">Only MCC accounts can access incoming transfers.</p>;
  }

  return (
    <div className="space-y-4 -mt-1">
      <div className="border-b-2 border-gray-200 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Incoming Transfers</h1>
          <p className="text-sm text-gray-600 mt-1">
            Milk transfers submitted by farmers and collectors awaiting your review.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadTransfers()}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <Icon icon={faArrowsRotate} className="text-xs" />
          Refresh
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { value: 'submitted', label: 'Pending' },
          { value: 'accepted', label: 'Accepted' },
          { value: 'partially_accepted', label: 'Partial' },
          { value: 'rejected', label: 'Rejected' },
          { value: '', label: 'All' },
        ].map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              statusFilter === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Transfers Table */}
      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : transfers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No transfers found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs uppercase text-gray-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3 text-right">Own Farm</th>
                  <th className="px-4 py-3 text-right">External</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transfers.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(t.submitted_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{t.supplier.name}</div>
                      {t.supplier.code && (
                        <div className="text-xs text-gray-500">{t.supplier.code}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {t.own_liters.toFixed(1)} L
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {t.external_liters.toFixed(1)} L
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">
                      {t.total_liters.toFixed(1)} L
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(t.status)}</td>
                    <td className="px-4 py-3">
                      {t.status === 'submitted' ? (
                        <button
                          type="button"
                          onClick={() => openProcessModal(t)}
                          className="text-primary hover:text-primary-dark text-sm font-medium"
                        >
                          Process
                        </button>
                      ) : (
                        <span className="text-gray-400 text-sm">
                          {t.processed_at ? new Date(t.processed_at).toLocaleDateString() : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Process Transfer Modal */}
      <Modal
        open={processModalOpen}
        onClose={() => setProcessModalOpen(false)}
        title="Process Transfer"
        maxWidth="max-w-lg"
      >
        {selectedTransfer && (
          <div className="space-y-4">
            {/* Transfer Summary */}
            <div className="bg-gray-50 rounded p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Supplier:</span>
                <span className="font-medium">{selectedTransfer.supplier.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">From own farm:</span>
                <span className="font-mono">{selectedTransfer.own_liters.toFixed(1)} L</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Collected from others:</span>
                <span className="font-mono">{selectedTransfer.external_liters.toFixed(1)} L</span>
              </div>
              <div className="flex justify-between text-sm font-medium border-t border-gray-200 pt-2">
                <span>Total:</span>
                <span className="font-mono">{selectedTransfer.total_liters.toFixed(1)} L</span>
              </div>
              {selectedTransfer.supplier_notes && (
                <div className="text-sm text-gray-600 pt-2 border-t border-gray-200">
                  <span className="font-medium">Supplier notes:</span> {selectedTransfer.supplier_notes}
                </div>
              )}
            </div>

            {/* Status Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={processStatus}
                onChange={(e) => setProcessStatus(e.target.value as 'accepted' | 'rejected')}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Accepted Liters (for partial acceptance) */}
            {processStatus === 'accepted' && (
              <div className="space-y-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Accepted Quantity (L)
                  </label>
                  <input
                    type="number"
                    value={acceptedLiters}
                    onChange={(e) => setAcceptedLiters(e.target.value)}
                    min="0"
                    max={selectedTransfer.total_liters}
                    step="0.1"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter less than {selectedTransfer.total_liters.toFixed(1)} L to reject the remainder at intake
                    (e.g. supplier sent 12 L, accept 10 L — 2 L recorded as rejected on both sides).
                  </p>
                </div>
                {rejectedAtIntake > 0.001 && (
                  <p className="text-sm text-amber-800 bg-amber-50 rounded px-3 py-2">
                    <span className="font-medium">{rejectedAtIntake.toFixed(1)} L</span> will be recorded as rejected.
                  </p>
                )}
              </div>
            )}

            {/* Rejection Reason — full reject or partial accept */}
            {(processStatus === 'rejected' || needsPartialRejectionReason) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {needsPartialRejectionReason ? 'Reason for rejected litres' : 'Rejection Reason'}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">-- Select a reason --</option>
                  {rejectionReasons.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={processNotes}
                onChange={(e) => setProcessNotes(e.target.value)}
                rows={2}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="Optional notes..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setProcessModalOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcess}
                disabled={processing}
                className={`px-4 py-2 text-sm text-white rounded font-medium flex items-center gap-2 ${
                  processStatus === 'rejected'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-primary hover:bg-primary-dark'
                } disabled:opacity-50`}
              >
                {processing && <Icon icon={faSpinner} spin className="text-xs" />}
                {processStatus === 'accepted' ? 'Accept Transfer' : 'Reject Transfer'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
