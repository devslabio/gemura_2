import type { ManagedTransfer } from '@/lib/api/supplierOperations';

/** Liters rejected at MCC intake for a processed transfer (full or partial). */
export function rejectedLitersFromTransfer(t: ManagedTransfer): number {
  if (t.status !== 'submitted') return 0;
  if (t.mcc_status === 'rejected') {
    return Number(t.mcc_rejected_liters ?? t.total_liters) || 0;
  }
  if (t.mcc_status === 'partially_accepted') {
    return Number(t.mcc_rejected_liters) || 0;
  }
  return 0;
}

export function getTransferIntakeStats(transfers: ManagedTransfer[]) {
  const submitted = transfers.filter((t) => t.status === 'submitted');
  const accepted = submitted.filter(
    (t) => t.mcc_status === 'accepted' || t.mcc_status === 'partially_accepted',
  );
  const pending = submitted.filter((t) => !t.mcc_status || t.mcc_status === 'submitted');
  const rejectedLiters = submitted.reduce((s, t) => s + rejectedLitersFromTransfer(t), 0);
  const fullRejectTransfers = submitted.filter((t) => t.mcc_status === 'rejected').length;
  const partialRejectTransfers = submitted.filter(
    (t) => t.mcc_status === 'partially_accepted' && rejectedLitersFromTransfer(t) > 0,
  ).length;
  const rejectedTransferCount = fullRejectTransfers + partialRejectTransfers;

  return {
    submitted: submitted.length,
    accepted: accepted.length,
    rejected: rejectedTransferCount,
    pending: pending.length,
    totalSubmittedLiters: submitted.reduce((s, t) => s + t.total_liters, 0),
    acceptedLiters: accepted.reduce((s, t) => s + (t.mcc_accepted_liters ?? t.total_liters), 0),
    rejectedLiters,
  };
}
