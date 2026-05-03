'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { loansApi, Loan } from '@/lib/api/loans';
import { useToastStore } from '@/store/toast';
import { useCrudPermissions } from '@/hooks/useCrudPermissions';
import Icon, { faArrowLeft, faCalendar, faSpinner, faEdit, faCheckCircle } from '@/app/components/Icon';
import Modal from '@/app/components/Modal';

export default function LoanDetailPage() {
  const { financeMutations } = useCrudPermissions();
  const params = useParams();
  const id = params?.id as string;
  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [repayAmount, setRepayAmount] = useState('');
  const [repayDate, setRepayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [repaySubmitting, setRepaySubmitting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setError('');
    loansApi
      .getLoanById(id)
      .then((r) => {
        if (r.code === 200 && r.data) setLoan(r.data);
        else setError(r.message || 'Loan not found');
      })
      .catch((err: unknown) => {
        const data = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data;
        const raw = data?.message;
        const msg = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : (err as Error)?.message ?? 'Failed to load loan';
        setError(msg || 'Failed to load loan');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF', minimumFractionDigits: 0 }).format(amount);
  const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString() : '—');

  const openEdit = () => {
    if (!loan) return;
    setEditStatus(loan.status);
    setEditDueDate(loan.due_date ? loan.due_date.slice(0, 10) : '');
    setEditNotes(loan.notes || '');
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditSubmitting(true);
    try {
      const res = await loansApi.updateLoan(id, {
        status: editStatus ? (editStatus as 'active' | 'closed') : undefined,
        due_date: editDueDate || undefined,
        notes: editNotes.trim() || undefined,
      });
      if (res.code === 200 && res.data) {
        setLoan(res.data);
        setEditOpen(false);
        useToastStore.getState().success('Loan updated.');
      } else {
        useToastStore.getState().error(res.message || 'Failed to update loan');
      }
    } catch {
      useToastStore.getState().error('Failed to update loan');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleRecordRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loan || !repayAmount || Number(repayAmount) <= 0) return;
    const amount = Number(repayAmount);
    if (amount > loan.outstanding) {
      useToastStore.getState().error('Amount cannot exceed outstanding balance.');
      return;
    }
    const effectiveDate = repayDate;
    setRepaySubmitting(true);
    try {
      const res = await loansApi.recordRepayment(id, { amount, repayment_date: effectiveDate });
      if (res.code === 200 && res.data) {
        setLoan(res.data);
        setRepayAmount('');
        setRepayDate(new Date().toISOString().slice(0, 10));
        useToastStore.getState().success('Repayment recorded.');
      } else {
        useToastStore.getState().error(res.message || 'Failed to record repayment');
      }
    } catch {
      useToastStore.getState().error('Failed to record repayment');
    } finally {
      setRepaySubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Icon icon={faSpinner} size="2x" className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div className="space-y-4">
        <Link href="/loans" className="text-sm text-gray-600 hover:text-[var(--primary)] inline-flex items-center gap-1">
          <Icon icon={faArrowLeft} size="sm" /> Back to Loans
        </Link>
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <p className="text-red-700">{error || 'Loan not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/loans" className="text-sm text-gray-600 hover:text-[var(--primary)] inline-flex items-center gap-1">
          <Icon icon={faArrowLeft} size="sm" /> Back to Loans
        </Link>
        {financeMutations ? (
          <button type="button" onClick={openEdit} className="btn btn-secondary">
            <Icon icon={faEdit} size="sm" className="mr-2" />
            Edit loan
          </button>
        ) : null}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-4">Loan details</h1>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-gray-500">Borrower</dt>
            <dd className="font-medium text-gray-900">{loan.borrower_label}</dd>
            <dd className="text-xs text-gray-500 capitalize">{loan.borrower_type}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Status</dt>
            <dd>
              <span
                className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                  loan.status === 'active' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Principal</dt>
            <dd className="font-medium">{formatCurrency(loan.principal)}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Amount repaid</dt>
            <dd>{formatCurrency(loan.amount_repaid)}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Outstanding</dt>
            <dd className="font-medium text-amber-700">{formatCurrency(loan.outstanding)}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Disbursement date</dt>
            <dd className="flex items-center gap-1">
              <Icon icon={faCalendar} size="sm" className="text-gray-400" />
              {formatDate(loan.disbursement_date)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Due date</dt>
            <dd>{formatDate(loan.due_date)}</dd>
          </div>
          {loan.notes && (
            <div className="sm:col-span-2">
              <dt className="text-sm text-gray-500">Notes</dt>
              <dd className="text-gray-700">{loan.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      {financeMutations && loan.status === 'active' && loan.outstanding > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Record repayment</h2>
          <form onSubmit={handleRecordRepayment} className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Repayment date</label>
                <input
                  type="date"
                  value={repayDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setRepayDate(e.target.value)}
                  className="input w-40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (RWF)</label>
                <input
                  type="number"
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  className="input w-40"
                  min={0.01}
                  max={loan.outstanding}
                  step={0.01}
                  placeholder="0"
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={repaySubmitting || !repayAmount}>
                {repaySubmitting ? <Icon icon={faSpinner} size="sm" className="animate-spin" /> : null}
                Record repayment
              </button>
            </div>
          </form>
          <p className="text-xs text-gray-500 mt-2">Outstanding: {formatCurrency(loan.outstanding)}</p>
          <p className="text-xs text-gray-500 mt-1">
            Repayments from payroll deductions are created automatically when payroll is processed.
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Repayments</h2>
        {loan.repayments && loan.repayments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Amount</th>
                  <th className="pb-2 pr-4 font-medium">Source</th>
                  <th className="pb-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {loan.repayments.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100">
                    <td className="py-2 pr-4">{formatDate(r.repayment_date)}</td>
                    <td className="py-2 pr-4 font-medium text-emerald-700">{formatCurrency(r.amount)}</td>
                    <td className="py-2 pr-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${r.source === 'payroll' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}`}>
                        {r.source === 'payroll' ? 'Payroll' : 'Direct'}
                      </span>
                    </td>
                    <td className="py-2 text-gray-600">{r.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No repayments recorded yet.</p>
        )}
      </div>

      {/* Edit loan modal: status, due date, notes only (principal/borrower cannot be changed after creation) */}
      <Modal
        open={editOpen}
        onClose={() => !editSubmitting && setEditOpen(false)}
        title="Edit loan"
        maxWidth="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditOpen(false)} className="btn btn-secondary" disabled={editSubmitting}>
              Cancel
            </button>
            <button type="submit" form="edit-loan-form" className="btn btn-primary" disabled={editSubmitting}>
              {editSubmitting ? <Icon icon={faSpinner} size="sm" className="animate-spin mr-2" /> : <Icon icon={faCheckCircle} size="sm" className="mr-2" />}
              Save
            </button>
          </div>
        }
      >
        <form id="edit-loan-form" onSubmit={handleEdit} className="space-y-4">
          <p className="text-xs text-gray-500">
            Only status, due date, and notes can be edited. Principal and borrower are fixed after creation for accounting and audit.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due date</label>
            <input
              type="date"
              value={editDueDate}
              onChange={(e) => setEditDueDate(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={3}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="Optional notes"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
