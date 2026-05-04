'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { customersApi, Customer } from '@/lib/api/customers';
import { splitFullName } from '@/lib/utils/name';
import { useAuthStore } from '@/store/auth';
import { useCrudPermissions } from '@/hooks/useCrudPermissions';
import DataTableWithPagination from '@/app/components/DataTableWithPagination';
import FilterBar, { FilterBarGroup, FilterBarSearch, FilterBarActions, FilterBarExport } from '@/app/components/FilterBar';
import type { TableColumn } from '@/app/components/DataTable';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';
import Modal from '@/app/components/Modal';
import BulkImportModal from '@/app/components/BulkImportModal';
import CreateCustomerForm from './CreateCustomerForm';
import Icon, { faPlus, faEye, faCheckCircle, faStore, faPhone, faEnvelope, faDollarSign, faFile } from '@/app/components/Icon';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export default function CustomersPage() {
  const searchParams = useSearchParams();
  const { currentAccount } = useAuthStore();
  const { customers: customerCrud } = useCrudPermissions();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await customersApi.getAllCustomers(currentAccount?.account_id);
      if (response.code === 200) {
        setCustomers(response.data || []);
      } else {
        setError(response.message || 'Failed to load customers');
      }
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as { message?: string })?.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [currentAccount?.account_id]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const filteredCustomers = useMemo(() => {
    let list = customers;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          (c.name && c.name.toLowerCase().includes(q)) ||
          (c.code && c.code.toLowerCase().includes(q)) ||
          (c.phone && c.phone.includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.account?.code && c.account.code.toLowerCase().includes(q)) ||
          (c.account?.name && c.account.name.toLowerCase().includes(q))
      );
    }
    if (statusFilter) {
      list = list.filter((c) => c.relationship_status === statusFilter);
    }
    return list;
  }, [customers, search, statusFilter]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-RW', {
      style: 'currency',
      currency: 'RWF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const columns: TableColumn<Customer>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (value, row) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          <div className="text-xs text-gray-500">{row.account.code}</div>
        </div>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      sortable: true,
      render: (value) => (
        <div className="flex items-center text-gray-900">
          <Icon icon={faPhone} size="sm" className="mr-2 text-gray-400" />
          <span>{value}</span>
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
      render: (value) => value ? (
        <div className="flex items-center text-gray-900">
          <Icon icon={faEnvelope} size="sm" className="mr-2 text-gray-400" />
          <span>{value}</span>
        </div>
      ) : (
        <span className="text-gray-400">N/A</span>
      ),
    },
    {
      key: 'price_per_liter',
      label: 'Price/Liter',
      sortable: true,
      render: (value) => value ? (
        <div className="flex items-center text-gray-900">
          <Icon icon={faDollarSign} size="sm" className="mr-2 text-gray-400" />
          <span>{formatCurrency(Number(value))}</span>
        </div>
      ) : (
        <span className="text-gray-400">N/A</span>
      ),
    },
    {
      key: 'average_supply_quantity',
      label: 'Avg Quantity',
      sortable: true,
      render: (value) => value ? `${Number(value).toFixed(2)}L` : <span className="text-gray-400">N/A</span>,
    },
    {
      key: 'relationship_status',
      label: 'Status',
      sortable: true,
      render: (value) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          value === 'active' 
            ? 'bg-green-100 text-green-700' 
            : 'bg-gray-100 text-gray-700'
        }`}>
          {String(value).charAt(0).toUpperCase() + String(value).slice(1)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <Link
          href={`/customers/${row.account.id}`}
          className="p-1.5 text-gray-600 hover:text-[var(--primary)] transition-colors inline-flex"
          title="View details"
        >
          <Icon icon={faEye} size="sm" />
        </Link>
      ),
    },
  ];

  if (loading) {
    return <ListPageSkeleton title="Customers" filterFields={3} tableRows={10} tableCols={4} />;
  }

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        </div>
        {customerCrud.create ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setBulkImportOpen(true)} className="btn btn-secondary">
              <Icon icon={faFile} size="sm" className="mr-2" />
              Bulk import
            </button>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); customersApi.downloadTemplate().catch(() => {}); }}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-4 text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors"
            >
              Download template
            </a>
            <button type="button" onClick={() => setCreateModalOpen(true)} className="btn btn-primary">
              <Icon icon={faPlus} size="sm" className="mr-2" />
              Add Customer
            </button>
          </div>
        ) : null}
      </div>

      <BulkImportModal
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        title="Customers"
        columns={[
          { key: 'name', label: 'Name', required: true },
          { key: 'phone', label: 'Phone', required: true },
          { key: 'email', label: 'Email' },
          { key: 'nid', label: 'NID' },
          { key: 'address', label: 'Address' },
          { key: 'price_per_liter', label: 'Price per liter' },
        ]}
        onDownloadTemplate={() => customersApi.downloadTemplate()}
        onBulkCreate={(rows) => {
          const data: import('@/lib/api/customers').CreateCustomerData[] = rows.map((row) => {
            const { firstName, lastName } = splitFullName(String(row.name ?? ''));
            return {
              first_name: firstName,
              last_name: lastName,
              phone: String(row.phone ?? ''),
              email: row.email != null ? String(row.email) : undefined,
              nid: row.nid != null ? String(row.nid) : undefined,
              address: row.address != null ? String(row.address) : undefined,
              price_per_liter: row.price_per_liter != null ? Number(row.price_per_liter) : undefined,
            };
          });
          return customersApi.bulkCreate(data).then((r) => r.data);
        }}
        mapRow={(row) => ({
          name: row.name || '',
          phone: row.phone || '',
          email: row.email || undefined,
          nid: row.nid || undefined,
          address: row.address || undefined,
          price_per_liter: row.price_per_liter ? Number(row.price_per_liter) : undefined,
        })}
        onSuccess={loadCustomers}
      />

      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Add Customer" maxWidth="max-w-lg">
        <CreateCustomerForm
          onSuccess={() => {
            setCreateModalOpen(false);
            loadCustomers();
          }}
          onCancel={() => setCreateModalOpen(false)}
        />
      </Modal>

      <FilterBar>
        <FilterBarSearch
          value={search}
          onChange={setSearch}
          placeholder="Search by name, code, phone, email..."
        />
        <FilterBarGroup label="Status">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input h-9 min-h-[2.25rem] !py-1.5 !px-3 text-sm w-full text-gray-900"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FilterBarGroup>
        <FilterBarActions onClear={clearFilters} />
        <FilterBarExport<Customer>
          data={filteredCustomers}
          exportFilename="customers"
          exportColumns={[
            { key: 'name', label: 'Name' },
            { key: 'code', label: 'Code' },
            { key: 'phone', label: 'Phone' },
            { key: 'email', label: 'Email', getValue: (r) => r.email ?? '' },
            { key: 'price_per_liter', label: 'Price/Liter', getValue: (r) => r.price_per_liter != null ? String(r.price_per_liter) : '' },
            { key: 'relationship_status', label: 'Status' },
          ]}
          disabled={loading}
        />
      </FilterBar>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Customers Table */}
      <DataTableWithPagination<Customer>
        data={filteredCustomers}
        columns={columns}
        loading={loading}
        emptyMessage={currentAccount ? (filteredCustomers.length === 0 && customers.length > 0 ? 'No customers match the filters' : 'No customers for this account') : 'Select an account to view customers'}
        itemLabel="customers"
      />
    </div>
  );
}
