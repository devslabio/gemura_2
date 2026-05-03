'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { usePermission } from '@/hooks/usePermission';
import { useCrudPermissions } from '@/hooks/useCrudPermissions';
import { customersApi, CustomerDetails } from '@/lib/api/customers';
import { DetailPageSkeleton } from '@/app/components/SkeletonLoader';
import Icon, { faStore, faUser, faPhone, faEnvelope, faIdCard, faMapPin, faDollarSign, faEdit, faArrowLeft, faSpinner, faCalendar, faBuilding } from '@/app/components/Icon';

export default function CustomerDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;
  const { hasPermission, isAdmin } = usePermission();
  const { customers: customerCrud } = useCrudPermissions();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [customer, setCustomer] = useState<CustomerDetails | null>(null);

  useEffect(() => {
    if (!hasPermission('view_customers') && !isAdmin()) {
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
        setCustomer(response.data.customer);
      } else {
        setError('Failed to load customer data');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load customer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-RW', {
      style: 'currency',
      currency: 'RWF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return <DetailPageSkeleton />;
  }

  if (error && !customer) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
        <Link href="/customers" className="btn btn-secondary">
          <Icon icon={faArrowLeft} size="sm" className="mr-2" />
          Back to Customers
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/customers" className="text-sm text-gray-600 hover:text-[var(--primary)] mb-2 inline-flex items-center">
            <Icon icon={faArrowLeft} size="sm" className="mr-2" />
            Back to Customers
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{customer?.user?.name || 'Customer Details'}</h1>
        </div>
        {customerCrud.update ? (
          <Link href={`/customers/${customerId}/edit`} className="btn btn-primary">
            <Icon icon={faEdit} size="sm" className="mr-2" />
            Edit Customer
          </Link>
        ) : null}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {customer && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Full Name</label>
                    <div className="flex items-center text-gray-900">
                      <Icon icon={faUser} size="sm" className="mr-2 text-gray-400" />
                      <span>{customer.user.name}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Phone Number</label>
                    <div className="flex items-center text-gray-900">
                      <Icon icon={faPhone} size="sm" className="mr-2 text-gray-400" />
                      <span>{customer.user.phone}</span>
                    </div>
                  </div>
                  {customer.user.email && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Email Address</label>
                      <div className="flex items-center text-gray-900">
                        <Icon icon={faEnvelope} size="sm" className="mr-2 text-gray-400" />
                        <span>{customer.user.email}</span>
                      </div>
                    </div>
                  )}
                  {customer.user.nid && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">National ID</label>
                      <div className="flex items-center text-gray-900">
                        <Icon icon={faIdCard} size="sm" className="mr-2 text-gray-400" />
                        <span>{customer.user.nid}</span>
                      </div>
                    </div>
                  )}
                  {customer.user.address && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-500 mb-1">Address</label>
                      <div className="flex items-center text-gray-900">
                        <Icon icon={faMapPin} size="sm" className="mr-2 text-gray-400" />
                        <span>{customer.user.address}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Account Code</label>
                  <div className="flex items-center text-gray-900">
                    <Icon icon={faBuilding} size="sm" className="mr-2 text-gray-400" />
                    <span className="font-mono">{customer.account_code}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Account Type</label>
                  <span className="capitalize text-gray-900">{customer.type}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Account Status</label>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    customer.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {customer.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Relationship Details</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Price per Liter</span>
                  <span className="text-sm font-medium text-gray-900 flex items-center">
                    <Icon icon={faDollarSign} size="sm" className="mr-1 text-gray-400" />
                    {formatCurrency(customer.relationship.price_per_liter)}
                  </span>
                </div>
                {customer.relationship.average_supply_quantity && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Average Supply Quantity</span>
                    <span className="text-sm font-medium text-gray-900">
                      {Number(customer.relationship.average_supply_quantity).toFixed(2)}L
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">Relationship Status</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    customer.relationship.relationship_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {customer.relationship.relationship_status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Account ID</label>
                  <p className="text-sm text-gray-900 font-mono">{customer.account_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Created At</label>
                  <div className="flex items-center text-sm text-gray-900">
                    <Icon icon={faCalendar} size="sm" className="mr-2 text-gray-400" />
                    <span>{new Date(customer.relationship.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Updated At</label>
                  <div className="flex items-center text-sm text-gray-900">
                    <Icon icon={faCalendar} size="sm" className="mr-2 text-gray-400" />
                    <span>{new Date(customer.relationship.updated_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <Link href="/customers" className="btn btn-secondary w-full justify-center">
                  <Icon icon={faArrowLeft} size="sm" className="mr-2" />
                  Back to List
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
