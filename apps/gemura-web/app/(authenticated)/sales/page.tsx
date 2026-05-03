'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { salesApi, Sale, SalesFilters } from '@/lib/api/sales';
import { useToastStore } from '@/store/toast';
import { useAuthStore } from '@/store/auth';
import { useCrudPermissions } from '@/hooks/useCrudPermissions';
import DataTableWithPagination from '@/app/components/DataTableWithPagination';
import type { TableColumn } from '@/app/components/DataTable';
import FilterBar, { FilterBarGroup, FilterBarActions, FilterBarApply, FilterBarExport } from '@/app/components/FilterBar';
import Modal from '@/app/components/Modal';
import BulkImportModal from '@/app/components/BulkImportModal';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';
import CreateSaleForm from './CreateSaleForm';
import Icon, { faPlus, faEye, faCheckCircle, faFile } from '@/app/components/Icon';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function SalesPage() {
  const searchParams = useSearchParams();
  const { currentAccount } = useAuthStore();
  const { sales: saleCrud } = useCrudPermissions();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [error, setError] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [filters, setFilters] = useState<SalesFilters>({
    status: searchParams.get('status') || undefined,
    date_from: searchParams.get('date_from') || undefined,
    date_to: searchParams.get('date_to') || undefined,
    customer_account_code: searchParams.get('customer') || undefined,
  });

  const loadSales = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await salesApi.getSales(filters, currentAccount?.account_id);
      if (response.code === 200) {
        setSales(response.data || []);
      } else {
        setError(response.message || 'Failed to load sales');
      }
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as { message?: string })?.message || 'Failed to load sales');
    } finally {
      setLoading(false);
    }
  }, [filters, currentAccount?.account_id]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const handleFilterChange = (key: keyof SalesFilters, value: string | number | undefined) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const handleApplyFilters = () => {
    loadSales();
  };

  const handleClearFilters = () => {
    setFilters({});
    loadSales();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-RW', {
      style: 'currency',
      currency: 'RWF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const columns: TableColumn<Sale>[] = [
    {
      key: 'sale_at',
      label: 'Date',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'customer_account',
      label: 'Customer',
      sortable: false,
      render: (_, row) => (
        <div>
          <div className="font-medium text-gray-900">{row.customer_account.name}</div>
          <div className="text-xs text-gray-500">{row.customer_account.code}</div>
        </div>
      ),
    },
    {
      key: 'quantity',
      label: 'Quantity (L)',
      sortable: true,
      render: (value) => `${Number(value).toFixed(2)}L`,
    },
    {
      key: 'unit_price',
      label: 'Unit Price',
      sortable: true,
      render: (value) => formatCurrency(Number(value)),
    },
    {
      key: 'total_amount',
      label: 'Total',
      sortable: true,
      render: (value) => (
        <span className="font-semibold text-gray-900">{formatCurrency(Number(value))}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => {
        const statusColors: Record<string, string> = {
          pending: 'bg-yellow-100 text-yellow-700',
          accepted: 'bg-green-100 text-green-700',
          rejected: 'bg-red-100 text-red-700',
          cancelled: 'bg-gray-100 text-gray-700',
          deleted: 'bg-red-100 text-red-700',
        };
        return (
          <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[value as string] || 'bg-gray-100 text-gray-700'}`}>
            {String(value).charAt(0).toUpperCase() + String(value).slice(1)}
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <Link
          href={`/sales/${row.id}`}
          className="p-1.5 text-gray-600 hover:text-[var(--primary)] transition-colors inline-flex"
          title="View details"
        >
          <Icon icon={faEye} size="sm" />
        </Link>
      ),
    },
  ];

  if (loading) {
    return <ListPageSkeleton title="Sales" filterFields={4} tableRows={10} tableCols={5} />;
  }

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales</h1>
        </div>
        {saleCrud.create ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setBulkImportOpen(true)} className="btn btn-secondary">
              <Icon icon={faFile} size="sm" className="mr-2" />
              Bulk import
            </button>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); salesApi.downloadTemplate().catch(() => {}); }}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-4 text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors"
            >
              Download template
            </a>
            <button type="button" onClick={() => setCreateModalOpen(true)} className="btn btn-primary">
              <Icon icon={faPlus} size="sm" className="mr-2" />
              New Sale
            </button>
          </div>
        ) : null}
      </div>

      <BulkImportModal
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        title="Sales"
        columns={[
          { key: 'customer_account_code', label: 'Customer account code', required: true },
          { key: 'quantity', label: 'Quantity (L)', required: true },
          { key: 'unit_price', label: 'Unit price' },
          { key: 'sale_at', label: 'Sale date (YYYY-MM-DD)' },
          { key: 'notes', label: 'Notes' },
          { key: 'payment_status', label: 'Payment status (paid/unpaid)' },
        ]}
        onDownloadTemplate={() => salesApi.downloadTemplate()}
        onBulkCreate={(rows) => {
          const data: import('@/lib/api/sales').CreateSaleData[] = rows.map((row) => ({
            customer_account_code: row.customer_account_code != null ? String(row.customer_account_code) : undefined,
            quantity: Number(row.quantity) || 0,
            unit_price: row.unit_price != null ? Number(row.unit_price) : undefined,
            sale_at: row.sale_at != null ? String(row.sale_at) : undefined,
            notes: row.notes != null ? String(row.notes) : undefined,
            payment_status: (row.payment_status as 'paid' | 'unpaid') || undefined,
          }));
          return salesApi.bulkCreate(data).then((r) => r.data);
        }}
        mapRow={(row) => ({
          customer_account_code: row.customer_account_code || undefined,
          quantity: Number(row.quantity) || 0,
          unit_price: row.unit_price ? Number(row.unit_price) : undefined,
          sale_at: row.sale_at || undefined,
          notes: row.notes || undefined,
          payment_status: (row.payment_status as 'paid' | 'unpaid') || undefined,
        })}
        onSuccess={loadSales}
      />

      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="New Sale" maxWidth="max-w-xl">
        <CreateSaleForm
          onSuccess={() => { setCreateModalOpen(false); loadSales(); }}
          onCancel={() => setCreateModalOpen(false)}
        />
      </Modal>

      {/* Filters (admin/users style) */}
      <FilterBar>
        <FilterBarGroup label="Status">
          <select
            value={filters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="input h-9 min-h-[2.25rem] !py-1.5 !px-3 text-sm w-full text-gray-900"
          >
            {STATUS_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FilterBarGroup>
        <FilterBarGroup label="Date From">
          <input
            type="date"
            value={filters.date_from || ''}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => handleFilterChange('date_from', e.target.value)}
            className="input h-9 min-h-[2.25rem] !py-1.5 !px-3 text-sm w-full text-gray-900"
          />
        </FilterBarGroup>
        <FilterBarGroup label="Date To">
          <input
            type="date"
            value={filters.date_to || ''}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => handleFilterChange('date_to', e.target.value)}
            className="input h-9 min-h-[2.25rem] !py-1.5 !px-3 text-sm w-full text-gray-900"
          />
        </FilterBarGroup>
        <FilterBarGroup label="Customer Code">
          <input
            type="text"
            value={filters.customer_account_code || ''}
            onChange={(e) => handleFilterChange('customer_account_code', e.target.value)}
            placeholder="A_XYZ789"
            className="input h-9 min-h-[2.25rem] !py-1.5 !px-3 text-sm w-full text-gray-900"
          />
        </FilterBarGroup>
        <FilterBarActions onClear={handleClearFilters} />
        <FilterBarApply onApply={handleApplyFilters} />
        <FilterBarExport<Sale>
          data={sales}
          exportFilename="sales"
          exportColumns={[
            { key: 'sale_at', label: 'Date', getValue: (r) => new Date(r.sale_at).toLocaleDateString() },
            { key: 'customer_account', label: 'Customer', getValue: (r) => r.customer_account?.name ?? '' },
            { key: 'quantity', label: 'Quantity (L)', getValue: (r) => String(Number(r.quantity).toFixed(2)) },
            { key: 'unit_price', label: 'Unit Price', getValue: (r) => String(r.unit_price ?? '') },
            { key: 'total_amount', label: 'Total', getValue: (r) => String(r.total_amount ?? '') },
            { key: 'status', label: 'Status', getValue: (r) => String(r.status ?? '') },
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

      {/* Sales Table */}
      <DataTableWithPagination<Sale>
        data={sales}
        columns={columns}
        loading={loading}
        emptyMessage={currentAccount ? 'No sales for this account' : 'Select an account to view sales'}
        itemLabel="sales"
      />
    </div>
  );
}
