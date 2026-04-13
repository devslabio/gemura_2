'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { usePermission } from '@/hooks/usePermission';
import { ENTITY_TYPE_OPTIONS } from '@/lib/constants/entity-types';
import { suppliersApi, UpdateSupplierData, SupplierDetails } from '@/lib/api/suppliers';
import { useToastStore } from '@/store/toast';
import Icon, { faDollarSign, faCheckCircle, faTimes, faSpinner } from '@/app/components/Icon';
import { DetailPageSkeleton } from '@/app/components/SkeletonLoader';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export default function EditSupplierPage() {
  const router = useRouter();
  const params = useParams();
  const supplierId = params.id as string;
  const { hasPermission, isAdmin } = usePermission();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [supplier, setSupplier] = useState<SupplierDetails | null>(null);
  const [formData, setFormData] = useState<UpdateSupplierData & { type: string }>({
    supplier_account_code: '',
    price_per_liter: 0,
    relationship_status: 'active',
    bank_name: '',
    bank_account_number: '',
    type: '',
  });

  useEffect(() => {
    if (!hasPermission('create_suppliers') && !isAdmin()) {
      router.push('/suppliers');
      return;
    }
    loadSupplier();
    // Only re-run when supplier changes; hasPermission/isAdmin are stable in behavior
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  const loadSupplier = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await suppliersApi.getSupplierById(supplierId);
      if (response.code === 200 && response.data) {
        const supplierData = response.data.supplier;
        setSupplier(supplierData);
        setFormData({
          supplier_account_code: supplierData.account_code,
          price_per_liter: supplierData.relationship.price_per_liter,
          relationship_status: supplierData.relationship.relationship_status as 'active' | 'inactive',
          bank_name: supplierData.bank_name || '',
          bank_account_number: supplierData.bank_account_number || '',
          type: supplierData.type ?? '',
        });
      } else {
        setError('Failed to load supplier data');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load supplier. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'price_per_liter' ? parseFloat(value) || 0 : value,
    }));
    setError('');
  };

  const validateForm = (): boolean => {
    if (formData.price_per_liter && formData.price_per_liter < 0) {
      setError('Price per liter cannot be negative');
      return false;
    }

    if (formData.bank_account_number && formData.bank_account_number.trim().length < 5) {
      setError('Bank account number looks too short');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setSaving(true);

    try {
      const { type: _type, ...rawPayload } = formData;
      const payload: UpdateSupplierData = {
        ...rawPayload,
        bank_name: rawPayload.bank_name?.trim() || undefined,
        bank_account_number: rawPayload.bank_account_number?.trim() || undefined,
      };
      const response = await suppliersApi.updateSupplier(payload);

      if (response.code === 200) {
        useToastStore.getState().success('Supplier updated successfully!');
        router.push(`/suppliers/${supplierId}`);
      } else {
        setError(response.message || 'Failed to update supplier');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to update supplier. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <DetailPageSkeleton />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Supplier</h1>
        </div>
        <Link href={`/suppliers/${supplierId}`} className="btn btn-secondary">
          <Icon icon={faTimes} size="sm" className="mr-2" />
          Cancel
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-sm p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Supplier Relationship</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="price_per_liter" className="block text-sm font-medium text-gray-700 mb-2">
                <Icon icon={faDollarSign} size="sm" className="inline mr-2" />
                Price per Liter (RWF)
              </label>
              <input
                id="price_per_liter"
                name="price_per_liter"
                type="number"
                step="0.01"
                min="0"
                value={formData.price_per_liter || ''}
                onChange={handleChange}
                className="input w-full"
                placeholder="0.00"
                disabled={saving}
              />
            </div>

            <div>
              <label htmlFor="relationship_status" className="block text-sm font-medium text-gray-700 mb-2">
                Relationship Status
              </label>
              <select
                id="relationship_status"
                name="relationship_status"
                value={formData.relationship_status}
                onChange={handleChange}
                className="input w-full"
                disabled={saving}
              >
                {STATUS_OPTIONS.map(status => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="supplier-type" className="block text-sm font-medium text-gray-700 mb-2">
                Type
              </label>
              <select
                id="supplier-type"
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="input w-full"
                disabled={saving}
              >
                {ENTITY_TYPE_OPTIONS.map(opt => (
                  <option key={opt.value || 'none'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="bank_name" className="block text-sm font-medium text-gray-700 mb-2">
                Bank Name
              </label>
              <input
                id="bank_name"
                name="bank_name"
                type="text"
                value={formData.bank_name || ''}
                onChange={handleChange}
                className="input w-full"
                placeholder="e.g. Bank of Kigali"
                disabled={saving}
              />
            </div>

            <div>
              <label htmlFor="bank_account_number" className="block text-sm font-medium text-gray-700 mb-2">
                Bank Account Number
              </label>
              <input
                id="bank_account_number"
                name="bank_account_number"
                type="text"
                value={formData.bank_account_number || ''}
                onChange={handleChange}
                className="input w-full"
                placeholder="e.g. 0123456789012"
                disabled={saving}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <Link href={`/suppliers/${supplierId}`} className="btn btn-secondary" tabIndex={-1}>
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? (
              <>
                <Icon icon={faSpinner} size="sm" spin className="mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Icon icon={faCheckCircle} size="sm" className="mr-2" />
                Update Supplier
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
