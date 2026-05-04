'use client';

import { useState } from 'react';
import { ENTITY_TYPE_OPTIONS } from '@/lib/constants/entity-types';
import { customersApi, CreateCustomerData } from '@/lib/api/customers';
import { useToastStore } from '@/store/toast';
import Icon, { faCheckCircle, faSpinner } from '@/app/components/Icon';
import Select from '@/app/components/Select';

interface CreateCustomerFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function CreateCustomerForm({ onSuccess, onCancel }: CreateCustomerFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<Omit<CreateCustomerData, 'first_name' | 'last_name'> & { firstName: string; lastName: string; price_per_liter: number; type: string }>({
    firstName: '',
    lastName: '',
    phone: '',
    price_per_liter: 0,
    email: '',
    nid: '',
    address: '',
    type: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'price_per_liter' ? parseFloat(value) || 0 : value,
    }));
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
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Invalid email format');
      return false;
    }
    if (formData.price_per_liter != null && formData.price_per_liter < 0) {
      setError('Price per liter cannot be negative');
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
      const finalData: CreateCustomerData = {
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        phone: formData.phone,
        email: formData.email || undefined,
        nid: formData.nid || undefined,
        address: formData.address || undefined,
        price_per_liter: formData.price_per_liter || undefined,
      };
      const response = await customersApi.createCustomer(finalData);
      if (response.code === 200 || response.code === 201) {
        useToastStore.getState().success('Customer created successfully!');
        onSuccess();
      } else {
        setError(response.message || 'Failed to create customer');
      }
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as { message?: string })?.message || 'Failed to create customer.');
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
          <label htmlFor="customer-firstName" className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
          <input id="customer-firstName" name="firstName" type="text" required value={formData.firstName} onChange={handleChange} className="input w-full" placeholder="First name" disabled={loading} />
        </div>
        <div>
          <label htmlFor="customer-lastName" className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
          <input id="customer-lastName" name="lastName" type="text" required value={formData.lastName} onChange={handleChange} className="input w-full" placeholder="Last name" disabled={loading} />
        </div>
        <div>
          <label htmlFor="customer-phone" className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-red-500">*</span></label>
          <input id="customer-phone" name="phone" type="tel" required value={formData.phone} onChange={handleChange} className="input w-full" placeholder="250788123456" disabled={loading} />
        </div>
        <div>
          <label htmlFor="customer-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input id="customer-email" name="email" type="email" value={formData.email} onChange={handleChange} className="input w-full" placeholder="email@example.com" disabled={loading} />
        </div>
        <div>
          <label htmlFor="customer-type" className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <Select
            id="customer-type"
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
          <label htmlFor="customer-price" className="block text-sm font-medium text-gray-700 mb-1">Price per liter (RWF)</label>
          <input id="customer-price" name="price_per_liter" type="number" step="0.01" min="0" value={formData.price_per_liter || ''} onChange={handleChange} className="input w-full" disabled={loading} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="customer-nid" className="block text-sm font-medium text-gray-700 mb-1">National ID</label>
          <input id="customer-nid" name="nid" type="text" value={formData.nid} onChange={handleChange} className="input w-full" placeholder="Optional" disabled={loading} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="customer-address" className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <input id="customer-address" name="address" type="text" value={formData.address} onChange={handleChange} className="input w-full" placeholder="Optional" disabled={loading} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
        <button type="button" onClick={onCancel} className="btn btn-secondary">Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <><Icon icon={faSpinner} size="sm" spin className="mr-2" />Creating...</> : <><Icon icon={faCheckCircle} size="sm" className="mr-2" />Create Customer</>}
        </button>
      </div>
    </form>
  );
}
