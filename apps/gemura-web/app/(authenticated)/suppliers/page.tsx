'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { suppliersApi, Supplier } from '@/lib/api/suppliers';
import { useAuthStore } from '@/store/auth';
import { usePermission } from '@/hooks/usePermission';
import DataTableWithPagination from '@/app/components/DataTableWithPagination';
import FilterBar, { FilterBarGroup, FilterBarSearch, FilterBarActions, FilterBarExport } from '@/app/components/FilterBar';
import type { TableColumn } from '@/app/components/DataTable';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';
import Modal from '@/app/components/Modal';
import BulkImportModal from '@/app/components/BulkImportModal';
import CreateSupplierForm from './CreateSupplierForm';
import Icon, { faPlus, faEye, faCheckCircle, faBuilding, faPhone, faDollarSign, faFile } from '@/app/components/Icon';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'farmer', label: 'farmer' },
  { value: 'collector', label: 'collector' },
  { value: 'collector-farmer', label: 'collector-farmer' },
  { value: 'mcp', label: 'mcp' },
  { value: 'farmer only', label: 'farmer only' },
];

export default function SuppliersPage() {
  const searchParams = useSearchParams();
  const { currentAccount } = useAuthStore();
  const { hasPermission, isAdmin } = usePermission();
  const role = (currentAccount?.role ?? '').toLowerCase();
  const isReadOnlyTeamRole = role === 'agent' || role === 'collector' || role === 'veterinary' || role === 'veterinarian' || role === 'veternary' || role === 'milkreceptionist' || role === 'milk_receptionist';
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const canCreateSupplier = !isReadOnlyTeamRole && (hasPermission('create_suppliers') || isAdmin());

  const normalizeSupplierType = (supplierType?: string | null): string => {
    if (!supplierType || supplierType === 'supplier') return 'farmer';
    return supplierType;
  };

  const loadSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await suppliersApi.getAllSuppliers(currentAccount?.account_id);
      if (response.code === 200) {
        setSuppliers(response.data || []);
      } else {
        setError(response.message || 'Failed to load suppliers');
      }
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as { message?: string })?.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, [currentAccount?.account_id]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const filteredSuppliers = useMemo(() => {
    let list = suppliers;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.code && s.code.toLowerCase().includes(q)) ||
          (s.phone && s.phone.includes(q)) ||
          normalizeSupplierType(s.type).toLowerCase().includes(q) ||
            (s.bank_name && s.bank_name.toLowerCase().includes(q)) ||
            (s.bank_account_number && s.bank_account_number.toLowerCase().includes(q)) ||
          (s.account?.code && s.account.code.toLowerCase().includes(q)) ||
          (s.account?.name && s.account.name.toLowerCase().includes(q))
      );
    }
    if (statusFilter) {
      list = list.filter((s) => s.relationship_status === statusFilter);
    }
    if (typeFilter) {
      list = list.filter((s) => normalizeSupplierType(s.type) === typeFilter);
    }
    return list;
  }, [suppliers, search, statusFilter, typeFilter]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setTypeFilter('');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-RW', {
      style: 'currency',
      currency: 'RWF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const columns: TableColumn<Supplier>[] = [
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
      key: 'type',
      label: 'Type',
      sortable: true,
      render: (value, row) => (
        <span className="text-gray-900">{normalizeSupplierType((value as string | null | undefined) ?? row.type)}</span>
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
      key: 'bank_name',
      label: 'Bank',
      sortable: true,
      render: (value) => value ? (
        <div className="flex items-center text-gray-900">
          <Icon icon={faBuilding} size="sm" className="mr-2 text-gray-400" />
          <span>{String(value)}</span>
        </div>
      ) : (
        <span className="text-gray-400">N/A</span>
      ),
    },
    {
      key: 'bank_account_number',
      label: 'Bank Account',
      sortable: true,
      render: (value) => value ? (
        <div className="flex items-center text-gray-900">
          <Icon icon={faBuilding} size="sm" className="mr-2 text-gray-400" />
          <span>{String(value)}</span>
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
          href={`/suppliers/${row.account.id}`}
          className="p-1.5 text-gray-600 hover:text-[var(--primary)] transition-colors inline-flex"
          title="View details"
        >
          <Icon icon={faEye} size="sm" />
        </Link>
      ),
    },
  ];

  if (loading) {
    return <ListPageSkeleton title="Suppliers" filterFields={3} tableRows={10} tableCols={4} />;
  }

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => canCreateSupplier && setBulkImportOpen(true)} className="btn btn-secondary" disabled={!canCreateSupplier}>
            <Icon icon={faFile} size="sm" className="mr-2" />
            Bulk import
          </button>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); suppliersApi.downloadTemplate().catch(() => {}); }}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-4 text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors"
          >
            Download template
          </a>
          <button type="button" onClick={() => canCreateSupplier && setCreateModalOpen(true)} className="btn btn-primary" disabled={!canCreateSupplier}>
            <Icon icon={faPlus} size="sm" className="mr-2" />
            Add Supplier
          </button>
        </div>
      </div>

      <BulkImportModal
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        title="Suppliers"
        columns={[
          { key: 'name', label: 'Name', required: true },
          { key: 'phone', label: 'Phone', required: true },
          { key: 'price_per_liter', label: 'Price per liter', required: true },
          { key: 'email', label: 'Email' },
          { key: 'nid', label: 'NID' },
          { key: 'address', label: 'Address' },
          { key: 'bank_name', label: 'Bank name' },
          { key: 'bank_account_number', label: 'Bank account number' },
        ]}
        onDownloadTemplate={() => suppliersApi.downloadTemplate()}
        onBulkCreate={(rows) => {
          const data: import('@/lib/api/suppliers').CreateSupplierData[] = rows.map((row) => ({
            name: String(row.name ?? ''),
            phone: String(row.phone ?? ''),
            price_per_liter: Number(row.price_per_liter) || 0,
            email: row.email != null ? String(row.email) : undefined,
            nid: row.nid != null ? String(row.nid) : undefined,
            address: row.address != null ? String(row.address) : undefined,
            bank_name: row.bank_name != null ? String(row.bank_name) : undefined,
            bank_account_number: row.bank_account_number != null ? String(row.bank_account_number) : undefined,
          }));
          return suppliersApi.bulkCreate(data).then((r) => r.data);
        }}
        mapRow={(row) => ({
          name: row.name || '',
          phone: row.phone || '',
          price_per_liter: Number(row.price_per_liter) || 0,
          email: row.email || undefined,
          nid: row.nid || undefined,
          address: row.address || undefined,
          bank_name: row.bank_name || undefined,
          bank_account_number: row.bank_account_number || undefined,
        })}
        onSuccess={loadSuppliers}
      />

      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Add Supplier" maxWidth="max-w-lg">
        <CreateSupplierForm
          onSuccess={() => {
            setCreateModalOpen(false);
            loadSuppliers();
          }}
          onCancel={() => setCreateModalOpen(false)}
        />
      </Modal>

      <FilterBar>
        <FilterBarSearch
          value={search}
          onChange={setSearch}
          placeholder="Search by name, code, phone, type..."
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
        <FilterBarGroup label="Type">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input h-9 min-h-[2.25rem] !py-1.5 !px-3 text-sm w-full text-gray-900"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FilterBarGroup>
        <FilterBarActions onClear={clearFilters} />
        <FilterBarExport<Supplier>
          data={filteredSuppliers}
          exportFilename="suppliers"
          exportColumns={[
            { key: 'name', label: 'Name' },
            { key: 'code', label: 'Code' },
            { key: 'phone', label: 'Phone' },
            { key: 'type', label: 'Type', getValue: (r) => normalizeSupplierType(r.type) },
            { key: 'price_per_liter', label: 'Price/Liter', getValue: (r) => r.price_per_liter != null ? String(r.price_per_liter) : '' },
            { key: 'bank_name', label: 'Bank Name', getValue: (r) => r.bank_name ?? '' },
            { key: 'bank_account_number', label: 'Bank Account Number', getValue: (r) => r.bank_account_number ?? '' },
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

      {/* Suppliers Table */}
      <DataTableWithPagination<Supplier>
        data={filteredSuppliers}
        columns={columns}
        loading={loading}
        emptyMessage={currentAccount ? (filteredSuppliers.length === 0 && suppliers.length > 0 ? 'No suppliers match the filters' : 'No suppliers for this account') : 'Select an account to view suppliers'}
        itemLabel="suppliers"
      />
    </div>
  );
}
