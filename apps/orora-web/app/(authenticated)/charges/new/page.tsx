'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { chargesApi, CreateChargeData } from '@/lib/api/charges';
import { suppliersApi, Supplier } from '@/lib/api/suppliers';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import Icon, { faArrowLeft, faSpinner, faTag } from '@/app/components/Icon';
import Select from '@/app/components/Select';
import DatePicker from '@/app/components/DatePicker';

export default function NewChargePage() {
  const router = useRouter();
  const { currentAccount } = useAuthStore();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreateChargeData & { account_id?: string }>({
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
        router.push('/charges');
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

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <Link href="/charges" className="text-sm text-gray-600 hover:text-[var(--primary)] inline-flex items-center mb-2">
          <Icon icon={faArrowLeft} size="sm" className="mr-2" />
          Back to Charges
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New charge</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-sm p-6 space-y-5">
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
            <Select
              value={form.kind}
              onChange={(v) => setForm((p) => ({ ...p, kind: v as 'one_time' | 'recurring' }))}
              options={[
                { value: 'one_time', label: 'One-time' },
                { value: 'recurring', label: 'Recurring' },
              ]}
              placeholder="Select kind"
              className="w-full"
            />
          </div>
          {form.kind === 'recurring' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recurrence *</label>
              <Select
                value={form.recurrence || ''}
                onChange={(v) => setForm((p) => ({ ...p, recurrence: v as 'monthly' | 'per_payroll' }))}
                options={[
                  { value: 'per_payroll', label: 'Per payroll run' },
                  { value: 'monthly', label: 'Monthly' },
                ]}
                placeholder="Select recurrence"
                className="w-full"
              />
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount type *</label>
            <Select
              value={form.amount_type}
              onChange={(v) => setForm((p) => ({ ...p, amount_type: v as 'fixed' | 'percentage' }))}
              options={[
                { value: 'fixed', label: 'Fixed (RWF)' },
                { value: 'percentage', label: 'Percentage of gross' },
              ]}
              placeholder="Select type"
              className="w-full"
            />
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
            <DatePicker value={form.effective_from || ''} onChange={(v) => setForm((p) => ({ ...p, effective_from: v }))} max={new Date().toISOString().slice(0, 10)} className="w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Effective to (optional)</label>
            <DatePicker value={form.effective_to || ''} onChange={(v) => setForm((p) => ({ ...p, effective_to: v }))} max={new Date().toISOString().slice(0, 10)} className="w-full" />
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
        <div className="flex gap-2 pt-2">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <Icon icon={faSpinner} size="sm" className="animate-spin mr-2" /> : <Icon icon={faTag} size="sm" className="mr-2" />}
            Create charge
          </button>
          <Link href="/charges" className="btn btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
