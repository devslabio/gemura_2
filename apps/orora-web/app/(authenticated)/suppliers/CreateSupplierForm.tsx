'use client';

import { useState } from 'react';
import { ENTITY_TYPE_OPTIONS } from '@/lib/constants/entity-types';
import { suppliersApi, CreateSupplierData } from '@/lib/api/suppliers';
import { useToastStore } from '@/store/toast';
import Icon, { faCheckCircle, faSpinner } from '@/app/components/Icon';
import Select from '@/app/components/Select';

interface CreateSupplierFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function CreateSupplierForm({ onSuccess, onCancel }: CreateSupplierFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<Omit<CreateSupplierData, 'first_name' | 'last_name'> & { firstName: string; lastName: string; type: string }>({
    firstName: '',
    lastName: '',
    phone: '',
    price_per_liter: 0,
    email: '',
    nid: '',
    address: '',
    type: '',
  });
  const [nidTouched, setNidTouched] = useState(false);

  const nidValue = formData.nid ?? '';
  const nidClean = nidValue.replace(/\D/g, '');
  const nidValid = nidClean.length === 16 && /^1[0-9]{15}$/.test(nidClean);
  const nidInvalid = nidTouched && nidValue.length > 0 && !nidValid;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'nid') {
      const digitsOnly = value.replace(/\D/g, '');
      setFormData(prev => ({ ...prev, [name]: digitsOnly }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: name === 'price_per_liter' ? parseFloat(value) || 0 : value,
      }));
    }
    setError('');
  };

  const validateForm = (): boolean => {
    if (!formData.firstName.trim()) {
      setError('First name is required');
      return false;
    }
    if (!formData.lastName.trim()) {
      setError('Last name is required');
      return false;
    }
    if (!formData.phone.trim()) {
      setError('Phone number is required');
      return false;
    }
    if (!/^250[0-9]{9}$/.test(formData.phone.replace(/\D/g, ''))) {
      setError('Phone must be Rwandan format (250XXXXXXXXX)');
      return false;
    }
    if (!formData.price_per_liter || formData.price_per_liter <= 0) {
      setError('Price per liter must be greater than 0');
      return false;
    }
    if (!formData.nid || !formData.nid.trim()) {
      setError('National ID is required');
      return false;
    }
    if (!/^1[0-9]{15}$/.test(formData.nid)) {
      setError('National ID must be 16 digits and start with 1');
      return false;
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Invalid email format');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateForm()) return;
    setLoading(true);
    try {
      const normalizedPhone = formData.phone.replace(/\D/g, '');
      const finalData: CreateSupplierData = {
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        phone: normalizedPhone,
        price_per_liter: formData.price_per_liter,
        email: formData.email || undefined,
        nid: formData.nid,
        address: formData.address || undefined,
      };
      const response = await suppliersApi.createSupplier(finalData);
      if (response.code === 200 || response.code === 201) {
        useToastStore.getState().success('Supplier created successfully!');
        onSuccess();
      } else {
        setError(response.message || 'Failed to create supplier');
      }
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as { message?: string })?.message || 'Failed to create supplier.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-600">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="supplier-firstName" className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
          <input id="supplier-firstName" name="firstName" type="text" required value={formData.firstName} onChange={handleChange} className="input w-full" placeholder="First name" disabled={loading} />
        </div>
        <div>
          <label htmlFor="supplier-lastName" className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
          <input id="supplier-lastName" name="lastName" type="text" required value={formData.lastName} onChange={handleChange} className="input w-full" placeholder="Last name" disabled={loading} />
        </div>
        <div>
          <label htmlFor="supplier-phone" className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-red-500">*</span></label>
          <input id="supplier-phone" name="phone" type="tel" required value={formData.phone} onChange={handleChange} className="input w-full" placeholder="250788123456" disabled={loading} />
        </div>
        <div>
          <label htmlFor="supplier-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input id="supplier-email" name="email" type="email" value={formData.email} onChange={handleChange} className="input w-full" placeholder="email@example.com" disabled={loading} />
        </div>
        <div>
          <label htmlFor="supplier-type" className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <Select
            id="supplier-type"
            name="type"
            value={formData.type}
            onChange={(v) => setFormData((prev) => ({ ...prev, type: v }))}
            options={ENTITY_TYPE_OPTIONS.filter((o) => o.value !== '')}
            placeholder="— Select type —"
            allowEmpty
            disabled={loading}
            className="w-full"
          />
        </div>
        <div>
          <label htmlFor="supplier-price" className="block text-sm font-medium text-gray-700 mb-1">Price per liter (RWF) <span className="text-red-500">*</span></label>
          <input id="supplier-price" name="price_per_liter" type="number" step="0.01" min="0" required value={formData.price_per_liter} onChange={handleChange} className="input w-full" disabled={loading} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="supplier-nid" className="block text-sm font-medium text-gray-700 mb-1">National ID <span className="text-red-500">*</span></label>
          <input
            id="supplier-nid"
            name="nid"
            type="text"
            inputMode="numeric"
            value={formData.nid}
            onChange={handleChange}
            onBlur={() => setNidTouched(true)}
            className={`input w-full ${nidInvalid ? 'border-red-500 ring-1 ring-red-500' : ''}`}
            placeholder="National ID"
            maxLength={16}
            disabled={loading}
            required
            aria-invalid={nidInvalid}
            aria-describedby={nidInvalid ? 'supplier-nid-error' : undefined}
          />
          {nidInvalid && (
            <p id="supplier-nid-error" className="mt-1 text-sm text-red-600">
              National ID must be 16 digits and start with 1.
            </p>
          )}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="supplier-address" className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <input id="supplier-address" name="address" type="text" value={formData.address} onChange={handleChange} className="input w-full" placeholder="Optional" disabled={loading} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
        <button type="button" onClick={onCancel} className="btn btn-secondary">
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <><Icon icon={faSpinner} size="sm" spin className="mr-2" />Creating...</> : <><Icon icon={faCheckCircle} size="sm" className="mr-2" />Create Supplier</>}
        </button>
      </div>
    </form>
  );
}
