'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { chargesApi, Charge, CreateChargeData } from '@/lib/api/charges';
import { suppliersApi, Supplier } from '@/lib/api/suppliers';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import Icon, { faPlus, faTag, faEdit, faTrash, faSpinner, faArrowsRotate } from '@/app/components/Icon';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';
import ConfirmDialog from '@/app/components/ConfirmDialog';
import Modal from '@/app/components/Modal';

const initialForm: CreateChargeData & { account_id?: string } = {
  name: '',
  description: '',
  kind: 'recurring',
  amount_type: 'fixed',
  amount: 0,
  recurrence: 'per_payroll',
  apply_to_all_suppliers: true,
  supplier_account_ids: [],
  effective_from: '',
  effective_to: '',
  is_active: true,
  account_id: undefined,
};

export default function ChargesPage() {
  const { currentAccount } = useAuthStore();
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const loadCharges = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await chargesApi.getCharges({
        account_id: currentAccount?.account_id,
        active_only: activeOnly,
      });
      if (res.code === 200 && res.data) setCharges(res.data);
      else setCharges([]);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      setError(ax?.response?.data?.message || ax?.message || 'Failed to load charges');
      setCharges([]);
    } finally {
      setLoading(false);
    }
  }, [currentAccount?.account_id, activeOnly]);

  useEffect(() => {
    loadCharges();
  }, [loadCharges]);

  useEffect(() => {
    if (!createModalOpen) return;
    let cancelled = false;
    setLoadingSuppliers(true);
    suppliersApi.getAllSuppliers(currentAccount?.account_id).then((res) => {
      if (!cancelled && res.data) setSuppliers(res.data);
    }).finally(() => { if (!cancelled) setLoadingSuppliers(false); });
    return () => { cancelled = true; };
  }, [createModalOpen, currentAccount?.account_id]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      useToastStore.getState().error('Name is required');
      return;
    }
    if (form.kind === 'recurring' && !form.recurrence) {
      useToastStore.getState().error('Recurrence is required for recurring charges');
      return;
    }
    if (form.amount_type === 'percentage' && (form.amount < 0 || form.amount > 100)) {
      useToastStore.getState().error('Percentage must be between 0 and 100');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        account_id: currentAccount?.account_id,
        description: form.description || undefined,
        recurrence: form.kind === 'recurring' ? form.recurrence : undefined,
        supplier_account_ids: form.apply_to_all_suppliers ? undefined : form.supplier_account_ids,
        effective_from: form.effective_from || undefined,
        effective_to: form.effective_to || undefined,
      };
      const res = await chargesApi.createCharge(payload);
      if (res.code === 200) {
        useToastStore.getState().success('Charge created');
        setCreateModalOpen(false);
        setForm(initialForm);
        loadCharges();
      } else {
        useToastStore.getState().error(res.message || 'Failed to create');
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      useToastStore.getState().error(ax?.response?.data?.message || 'Failed to create charge');
    } finally {
      setSaving(false);
    }
  };

  const toggleSupplier = (accountId: string) => {
    setForm((prev) => {
      const ids = prev.supplier_account_ids || [];
      const next = ids.includes(accountId) ? ids.filter((id) => id !== accountId) : [...ids, accountId];
      return { ...prev, supplier_account_ids: next };
    });
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await chargesApi.deleteCharge(id, currentAccount?.account_id);
      useToastStore.getState().success('Charge deleted');
      loadCharges();
      setDeleteId(null);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      useToastStore.getState().error(ax?.response?.data?.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const formatAmount = (c: Charge) => {
    if (c.amount_type === 'percentage') return `${c.amount}%`;
    return new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF', minimumFractionDigits: 0 }).format(c.amount);
  };

  if (loading && charges.length === 0) {
    return <ListPageSkeleton title="Charges" filterFields={1} tableRows={8} tableCols={6} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Supplier Charges</h1>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="rounded border-gray-300"
            />
            Active only
          </label>
          <button type="button" onClick={loadCharges} className="btn btn-secondary" disabled={loading}>
            <Icon icon={loading ? faSpinner : faArrowsRotate} size="sm" className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button type="button" onClick={() => setCreateModalOpen(true)} className="btn btn-primary">
            <Icon icon={faPlus} size="sm" className="mr-2" />
            New charge
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {charges.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-sm p-12 text-center">
          <Icon icon={faTag} className="text-gray-300 mx-auto mb-4" size="2x" />
          <p className="text-gray-600 font-medium">No charges yet</p>
          <button type="button" onClick={() => setCreateModalOpen(true)} className="btn btn-primary mt-4 inline-flex">
            New charge
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Kind</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Amount</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Applies to</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {charges.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{c.name}</div>
                      {c.description && <div className="text-xs text-gray-500 truncate max-w-[200px]">{c.description}</div>}
                    </td>
                    <td className="py-3 px-4 text-gray-600 capitalize">{c.kind.replace('_', ' ')}</td>
                    <td className="py-3 px-4 text-gray-900">{formatAmount(c)}</td>
                    <td className="py-3 px-4 text-gray-600">
                      {c.apply_to_all_suppliers ? 'All suppliers' : `Selected (${c.selected_suppliers?.length ?? 0})`}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link href={`/charges/${c.id}/edit`} className="p-1.5 text-gray-600 hover:text-[var(--primary)] inline-flex mr-1" title="Edit">
                        <Icon icon={faEdit} size="sm" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeleteId(c.id)}
                        className="p-1.5 text-gray-600 hover:text-red-600 inline-flex"
                        title="Delete"
                      >
                        <Icon icon={faTrash} size="sm" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={createModalOpen}
        onClose={() => { if (!saving) { setCreateModalOpen(false); setForm(initialForm); } }}
        title="New charge"
        maxWidth="max-w-2xl"
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={() => setCreateModalOpen(false)} className="btn btn-secondary" disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="create-charge-form" className="btn btn-primary" disabled={saving}>
              {saving ? <Icon icon={faSpinner} size="sm" className="animate-spin mr-2" /> : <Icon icon={faTag} size="sm" className="mr-2" />}
              Create charge
            </button>
          </div>
        }
      >
        <form id="create-charge-form" onSubmit={handleCreateSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="input w-full"
              placeholder="e.g. Transport fee"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description || ''}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="input w-full"
              rows={2}
              placeholder="Optional"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kind *</label>
              <select
                value={form.kind}
                onChange={(e) => setForm((p) => ({ ...p, kind: e.target.value as 'one_time' | 'recurring' }))}
                className="input w-full"
              >
                <option value="one_time">One-time</option>
                <option value="recurring">Recurring</option>
              </select>
            </div>
            {form.kind === 'recurring' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recurrence *</label>
                <select
                  value={form.recurrence || ''}
                  onChange={(e) => setForm((p) => ({ ...p, recurrence: e.target.value as 'monthly' | 'per_payroll' }))}
                  className="input w-full"
                >
                  <option value="per_payroll">Per payroll run</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount type *</label>
              <select
                value={form.amount_type}
                onChange={(e) => setForm((p) => ({ ...p, amount_type: e.target.value as 'fixed' | 'percentage' }))}
                className="input w-full"
              >
                <option value="fixed">Fixed (RWF)</option>
                <option value="percentage">Percentage of gross</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {form.amount_type === 'percentage' ? 'Percentage *' : 'Amount (RWF) *'}
              </label>
              <input
                type="number"
                min={0}
                max={form.amount_type === 'percentage' ? 100 : undefined}
                step={form.amount_type === 'percentage' ? 0.01 : 1}
                value={form.amount || ''}
                onChange={(e) => setForm((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))}
                className="input w-full"
                required
              />
            </div>
          </div>
          <div>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.apply_to_all_suppliers}
                onChange={(e) => setForm((p) => ({ ...p, apply_to_all_suppliers: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-700">Apply to all suppliers</span>
            </label>
          </div>
          {!form.apply_to_all_suppliers && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select suppliers</label>
              {loadingSuppliers ? (
                <p className="text-sm text-gray-500">Loading suppliers…</p>
              ) : (
                <div className="border border-gray-200 rounded-sm max-h-48 overflow-y-auto p-2 space-y-1">
                  {suppliers.length === 0 ? (
                    <p className="text-sm text-gray-500">No suppliers found.</p>
                  ) : (
                    suppliers.map((s) => (
                      <label key={s.account.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(form.supplier_account_ids || []).includes(s.account.id)}
                          onChange={() => toggleSupplier(s.account.id)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-900">{s.name}</span>
                        <span className="text-xs text-gray-500">{s.account.code}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Effective from (optional)</label>
              <input
                type="date"
                value={form.effective_from || ''}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setForm((p) => ({ ...p, effective_from: e.target.value }))}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Effective to (optional)</label>
              <input
                type="date"
                value={form.effective_to || ''}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setForm((p) => ({ ...p, effective_to: e.target.value }))}
                className="input w-full"
              />
            </div>
          </div>
          <div>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-700">Active</span>
            </label>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => !deleting && setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        title="Delete charge?"
        message="This will remove the charge. It will not affect payroll runs already generated."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        showIcon
        loading={deleting}
      />
    </div>
  );
}
