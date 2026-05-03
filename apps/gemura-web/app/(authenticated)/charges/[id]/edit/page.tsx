'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { chargesApi, Charge, UpdateChargeData } from '@/lib/api/charges';
import { suppliersApi, Supplier } from '@/lib/api/suppliers';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import { useCrudPermissions } from '@/hooks/useCrudPermissions';
import Icon, { faArrowLeft, faSpinner, faTag } from '@/app/components/Icon';

export default function EditChargePage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const { currentAccount } = useAuthStore();
  const { financeMutations } = useCrudPermissions();

  useEffect(() => {
    if (!financeMutations) router.replace('/charges');
  }, [financeMutations, router]);
  const [charge, setCharge] = useState<Charge | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<UpdateChargeData & { account_id?: string }>({
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
  });

  const loadCharge = useCallback(async () => {
    if (!id) return;
    try {
      const res = await chargesApi.getChargeById(id, currentAccount?.account_id);
      if (res.code === 200 && res.data) {
        const c = res.data;
        setCharge(c);
        setForm({
          name: c.name,
          description: c.description ?? '',
          kind: (c.kind === 'one_time' ? 'one_time' : 'recurring') as 'one_time' | 'recurring',
          amount_type: (c.amount_type === 'percentage' ? 'percentage' : 'fixed') as 'fixed' | 'percentage',
          amount: c.amount,
          recurrence: (c.recurrence === 'monthly' ? 'monthly' : 'per_payroll'),
          apply_to_all_suppliers: c.apply_to_all_suppliers,
          supplier_account_ids: c.selected_suppliers?.map((s) => s.id) ?? [],
          effective_from: c.effective_from ?? '',
          effective_to: c.effective_to ?? '',
          is_active: c.is_active,
          account_id: currentAccount?.account_id,
        });
      }
    } catch {
      useToastStore.getState().error('Charge not found');
      router.push('/charges');
    } finally {
      setLoading(false);
    }
  }, [id, currentAccount?.account_id, router]);

  useEffect(() => {
    loadCharge();
  }, [loadCharge]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await suppliersApi.getAllSuppliers(currentAccount?.account_id);
        if (!cancelled && res.data) setSuppliers(res.data);
      } finally {
        if (!cancelled) setLoadingSuppliers(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentAccount?.account_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !form.name?.trim()) {
      useToastStore.getState().error('Name is required');
      return;
    }
    if (form.kind === 'recurring' && !form.recurrence) {
      useToastStore.getState().error('Recurrence is required for recurring charges');
      return;
    }
    if (form.amount_type === 'percentage' && (form.amount != null && (form.amount < 0 || form.amount > 100))) {
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
        supplier_account_ids: form.apply_to_all_suppliers ? [] : form.supplier_account_ids,
        effective_from: form.effective_from || undefined,
        effective_to: form.effective_to || undefined,
      };
      const res = await chargesApi.updateCharge(id, payload);
      if (res.code === 200) {
        useToastStore.getState().success('Charge updated');
        router.push('/charges');
      } else {
        useToastStore.getState().error(res.message || 'Failed to update');
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      useToastStore.getState().error(ax?.response?.data?.message || 'Failed to update charge');
    } finally {
      setSaving(false);
    }
  };

  const toggleSupplier = (accountId: string) => {
    setForm((prev) => {
      const ids = prev.supplier_account_ids || [];
      const next = ids.includes(accountId) ? ids.filter((i) => i !== accountId) : [...ids, accountId];
      return { ...prev, supplier_account_ids: next };
    });
  };

  if (loading || !charge) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <Link href="/charges" className="text-sm text-gray-600 hover:text-[var(--primary)] inline-flex items-center mb-2">
          <Icon icon={faArrowLeft} size="sm" className="mr-2" />
          Back to Charges
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit charge</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input
            type="text"
            value={form.name || ''}
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
              value={form.kind || 'recurring'}
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
              value={form.amount_type || 'fixed'}
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
              value={form.amount ?? ''}
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
              checked={form.apply_to_all_suppliers ?? true}
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
                    <label
                      key={s.account.id}
                      className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={(form.supplier_account_ids || []).includes(s.account.id)}
                        onChange={() => toggleSupplier(s.account.id)}
                        className="mt-0.5 shrink-0 rounded border-gray-300"
                      />
                      <div className="min-w-0 flex-1 text-sm text-gray-900">
                        <span className="font-medium">{s.name}</span>
                        <span className="text-xs text-gray-500 ml-2">({s.account.code})</span>
                      </div>
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
              checked={form.is_active ?? true}
              onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
              className="rounded border-gray-300"
            />
            <span className="text-sm font-medium text-gray-700">Active</span>
          </label>
        </div>
        <div className="flex gap-2 pt-2">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <Icon icon={faSpinner} size="sm" className="animate-spin mr-2" /> : <Icon icon={faTag} size="sm" className="mr-2" />}
            Save changes
          </button>
          <Link href="/charges" className="btn btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
