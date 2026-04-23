'use client';

import { useState, useEffect } from 'react';
import { collectionsApi, CreateCollectionData, RejectionReason } from '@/lib/api/collections';
import { suppliersApi, Supplier } from '@/lib/api/suppliers';
import { useToastStore } from '@/store/toast';
import Icon, { faCheckCircle, faSpinner } from '@/app/components/Icon';
import SearchableSelect from '@/app/components/SearchableSelect';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
];

interface CreateCollectionFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function CreateCollectionForm({ onSuccess, onCancel }: CreateCollectionFormProps) {
  const [loading, setLoading] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [loadingReasons, setLoadingReasons] = useState(true);
  const [error, setError] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [rejectionReasons, setRejectionReasons] = useState<RejectionReason[]>([]);
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
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateForm()) return;
    setLoading(true);
    try {
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="coll-shift" className="block text-sm font-medium text-gray-700 mb-1">Milk Brought Time</label>
          <select id="coll-shift" name="collection_shift" value={formData.collection_shift} onChange={handleChange} className="input w-full" disabled={loading}>
            <option value="morning">Morning</option>
            <option value="evening">Evening</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="coll-supplier" className="block text-sm font-medium text-gray-700 mb-1">Supplier <span className="text-red-500">*</span></label>
          {loadingSuppliers ? (
            <div className="input w-full flex items-center text-gray-500 text-sm"><Icon icon={faSpinner} size="sm" spin className="mr-2" />Loading suppliers...</div>
          ) : (
            <SearchableSelect
              id="coll-supplier"
              name="supplier_account_code"
              options={suppliers.map(s => ({ value: s.account.code, label: `${s.name} (${s.account.code})` }))}
              value={formData.supplier_account_code}
              onChange={handleSupplierSelect}
              placeholder="Search or select a supplier..."
              disabled={loading}
              required
            />
          )}
        </div>
        <div>
          <label htmlFor="coll-quantity" className="block text-sm font-medium text-gray-700 mb-1">Quantity (L) <span className="text-red-500">*</span></label>
          <input id="coll-quantity" name="quantity" type="number" step="0.01" min="0.01" required value={formData.quantity} onChange={handleChange} className="input w-full" disabled={loading} />
        </div>
        <div>
          <label htmlFor="coll-status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select id="coll-status" name="status" value={formData.status} onChange={handleChange} className="input w-full" disabled={loading}>
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        {formData.status === 'rejected' && (
          <div>
            <label htmlFor="coll-rejection_reason" className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason <span className="text-red-500">*</span></label>
            {loadingReasons ? (
              <div className="input w-full flex items-center text-gray-500 text-sm"><Icon icon={faSpinner} size="sm" spin className="mr-2" />Loading reasons...</div>
            ) : (
              <select id="coll-rejection_reason" name="rejection_reason" value={formData.rejection_reason} onChange={handleChange} className="input w-full" disabled={loading} required>
                <option value="">-- Select a reason --</option>
                {rejectionReasons.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
            )}
          </div>
        )}
        <div className="sm:col-span-2">
          <label htmlFor="coll-collection_at" className="block text-sm font-medium text-gray-700 mb-1">Date & time <span className="text-red-500">*</span></label>
          <input id="coll-collection_at" name="collection_at" type="datetime-local" required value={formData.collection_at} max={new Date().toISOString().slice(0, 16)} onChange={handleChange} className="input w-full" disabled={loading} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="coll-notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea id="coll-notes" name="notes" rows={2} value={formData.notes} onChange={handleChange} className="input w-full" disabled={loading} placeholder="Optional" />
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
