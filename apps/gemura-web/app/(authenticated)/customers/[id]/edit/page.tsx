'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { usePermission } from '@/hooks/usePermission';
import { useAuthStore } from '@/store/auth';
import { fullNameFromParts, splitFullName } from '@/lib/utils/name';
import { ENTITY_TYPE_OPTIONS } from '@/lib/constants/entity-types';
import { customersApi, UpdateCustomerData, CustomerDetails } from '@/lib/api/customers';
import { useToastStore } from '@/store/toast';
import Icon, { faUser, faPhone, faEnvelope, faIdCard, faMapPin, faDollarSign, faCheckCircle, faTimes, faSpinner } from '@/app/components/Icon';
import { DetailPageSkeleton } from '@/app/components/SkeletonLoader';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export default function EditCustomerPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;
  const { hasPermission, isAdmin } = usePermission();
  const { currentAccount } = useAuthStore();
  const role = (currentAccount?.role ?? '').toLowerCase();
  const isReadOnlyTeamRole = role === 'agent' || role === 'collector' || role === 'veterinary' || role === 'veterinarian' || role === 'veternary' || role === 'milkreceptionist' || role === 'milk_receptionist';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [formData, setFormData] = useState<Omit<UpdateCustomerData, 'name'> & { firstName: string; lastName: string; type: string }>({
    customer_account_code: '',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    nid: '',
    address: '',
    price_per_liter: 0,
    relationship_status: 'active',
    type: '',
  });

  useEffect(() => {
    if (isReadOnlyTeamRole || (!hasPermission('create_customers') && !isAdmin())) {
      router.push('/customers');
      return;
    }
    loadCustomer();
    // Only re-run when customer changes; hasPermission/isAdmin are stable in behavior
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const loadCustomer = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await customersApi.getCustomerById(customerId);
      if (response.code === 200 && response.data) {
        const customerData = response.data.customer;
        setCustomer(customerData);
        const { firstName, lastName } = splitFullName(customerData.user.name || '');
        setFormData({
          customer_account_code: customerData.account_code,
          firstName,
          lastName,
          phone: customerData.user.phone,
          email: customerData.user.email || '',
          nid: customerData.user.nid || '',
          address: customerData.user.address || '',
          price_per_liter: customerData.relationship.price_per_liter,
          relationship_status: customerData.relationship.relationship_status as 'active' | 'inactive',
          type: customerData.type ?? '',
        });
      } else {
        setError('Failed to load customer data');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load customer. Please try again.');
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
    if (!formData.firstName?.trim()) {
      setError('First name is required');
      return false;
    }
    if (!formData.lastName?.trim()) {
      setError('Last name is required');
      return false;
    }

    if (!formData.phone?.trim()) {
      setError('Phone number is required');
      return false;
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Invalid email format');
      return false;
    }

    if (formData.price_per_liter && formData.price_per_liter < 0) {
      setError('Price per liter cannot be negative');
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
      const { type: _type, ...rest } = formData;
      const finalData: UpdateCustomerData = {
        ...rest,
        name: fullNameFromParts(formData.firstName, formData.lastName),
        email: formData.email || undefined,
        nid: formData.nid || undefined,
        address: formData.address || undefined,
        price_per_liter: formData.price_per_liter || undefined,
      };

      const response = await customersApi.updateCustomer(finalData);

      if (response.code === 200) {
        useToastStore.getState().success('Customer updated successfully!');
        router.push(`/customers/${customerId}`);
      } else {
        setError(response.message || 'Failed to update customer');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to update customer. Please try again.');
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
          <h1 className="text-2xl font-bold text-gray-900">Edit Customer</h1>
        </div>
        <Link href={`/customers/${customerId}`} className="btn btn-secondary">
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
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                <Icon icon={faUser} size="sm" className="inline mr-2" />
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                value={formData.firstName}
                onChange={handleChange}
                className="input w-full"
                placeholder="First name"
                disabled={saving}
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                required
                value={formData.lastName}
                onChange={handleChange}
                className="input w-full"
                placeholder="Last name"
                disabled={saving}
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                <Icon icon={faPhone} size="sm" className="inline mr-2" />
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                value={formData.phone}
                onChange={handleChange}
                className="input w-full"
                placeholder="250788123456"
                disabled={saving}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                <Icon icon={faEnvelope} size="sm" className="inline mr-2" />
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="input w-full"
                placeholder="customer@example.com"
                disabled={saving}
              />
            </div>

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
              <label htmlFor="nid" className="block text-sm font-medium text-gray-700 mb-2">
                <Icon icon={faIdCard} size="sm" className="inline mr-2" />
                National ID
              </label>
              <input
                id="nid"
                name="nid"
                type="text"
                value={formData.nid}
                onChange={handleChange}
                className="input w-full"
                placeholder="1199887766554433"
                disabled={saving}
              />
            </div>

            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                <Icon icon={faMapPin} size="sm" className="inline mr-2" />
                Address
              </label>
              <input
                id="address"
                name="address"
                type="text"
                value={formData.address}
                onChange={handleChange}
                className="input w-full"
                placeholder="Kigali, Rwanda"
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
              <label htmlFor="customer-type" className="block text-sm font-medium text-gray-700 mb-2">
                Type
              </label>
              <select
                id="customer-type"
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
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <Link href={`/customers/${customerId}`} className="btn btn-secondary" tabIndex={-1}>
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
                Update Customer
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
