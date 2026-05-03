'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { collectionsApi, Collection, CollectionsFilters } from '@/lib/api/collections';
import { useToastStore } from '@/store/toast';
import { useAuthStore } from '@/store/auth';
import { usePermission } from '@/hooks/usePermission';
import DataTableWithPagination from '@/app/components/DataTableWithPagination';
import type { TableColumn } from '@/app/components/DataTable';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';
import FilterBar, { FilterBarGroup, FilterBarActions, FilterBarApply, FilterBarExport } from '@/app/components/FilterBar';
import Modal from '@/app/components/Modal';
import BulkImportModal from '@/app/components/BulkImportModal';
import CreateCollectionForm from './CreateCollectionForm';
import GateArrivalsPanel from './GateArrivalsPanel';
import Icon, { faPlus, faEye, faFile } from '@/app/components/Icon';

const GATE_SECTION_ID = 'gate-arrivals';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function CollectionsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { hasPermission, hasAnyPermission } = usePermission();
  const canViewCollectionRecords = hasPermission('view_collections');
  const canViewGateArrivals = hasAnyPermission(['mcc_view_operations', 'view_collections']);
  const { currentAccount } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [error, setError] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const recordsHydratedRef = useRef(false);
  const [filters, setFilters] = useState<CollectionsFilters>({
    status: searchParams.get('status') || undefined,
    date_from: searchParams.get('date_from') || undefined,
    date_to: searchParams.get('date_to') || undefined,
    supplier_name: searchParams.get('supplier_name') || undefined,
  });

  /** Legacy `?tab=gate` → hash anchor */
  useEffect(() => {
    if (searchParams.get('tab') !== 'gate') return;
    const q = new URLSearchParams(searchParams.toString());
    q.delete('tab');
    const qs = q.toString();
    const base = qs ? `${pathname}?${qs}` : pathname;
    router.replace(`${base}#${GATE_SECTION_ID}`, { scroll: false });
  }, [searchParams, pathname, router]);

  useEffect(() => {
    if (pathname !== '/collections') return;
    if (typeof window === 'undefined') return;
    if (window.location.hash !== `#${GATE_SECTION_ID}`) return;
    requestAnimationFrame(() => {
      document.getElementById(GATE_SECTION_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [pathname, canViewGateArrivals]);

  const loadCollections = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await collectionsApi.getCollections(filters, currentAccount?.account_id);
      if (response.code === 200) {
        setCollections(response.data || []);
      } else {
        setError(response.message || 'Failed to load collections');
      }
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as { message?: string })?.message || 'Failed to load collections');
    } finally {
      setLoading(false);
    }
  }, [filters, currentAccount?.account_id]);

  useEffect(() => {
    if (!canViewCollectionRecords) return;
    loadCollections();
  }, [loadCollections, canViewCollectionRecords]);

  useEffect(() => {
    if (canViewCollectionRecords && !loading) {
      recordsHydratedRef.current = true;
    }
  }, [canViewCollectionRecords, loading]);

  const handleFilterChange = (key: keyof CollectionsFilters, value: string | number | undefined) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const handleApplyFilters = () => {
    loadCollections();
  };

  const handleClearFilters = () => {
    setFilters({});
    loadCollections();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-RW', {
      style: 'currency',
      currency: 'RWF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const supplierDisplayName = (row: Collection) => {
    const name = row.supplier_account?.name?.trim();
    const code = row.supplier_account?.code?.trim();
    if (name && name.toLowerCase() !== 'system') return name;
    return code || '—';
  };

  const formatCollectionShift = (shift?: 'morning' | 'evening') => {
    if (shift === 'evening') return 'Evening';
    return 'Morning';
  };

  const mccSourceLabel = (row: Collection) => {
    if (row.mcc_collection_context === 'direct_gate') return 'Direct gate';
    if (row.mcc_collection_context === 'umucunda_manifest_line') return 'Manifest line';
    return '—';
  };

  const columns: TableColumn<Collection>[] = [
    {
      key: 'collection_at',
      label: 'Date',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'supplier_account',
      label: 'Supplier',
      sortable: false,
      render: (_, row) => (
        <div>
          <div className="font-medium text-gray-900">{supplierDisplayName(row)}</div>
          <div className="text-xs text-gray-500">{row.supplier_account?.code ?? '—'}</div>
        </div>
      ),
    },
    {
      key: 'collection_shift',
      label: 'Shift',
      sortable: true,
      render: (value) => (
        <span className="text-sm text-gray-700">{formatCollectionShift(value as 'morning' | 'evening' | undefined)}</span>
      ),
    },
    {
      key: 'mcc_collection_context',
      label: 'MCC source',
      sortable: false,
      render: (_, row) => (
        <span className="text-xs text-gray-700">{mccSourceLabel(row)}</span>
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
          href={`/collections/${row.id}`}
          className="p-1.5 text-gray-600 hover:text-[var(--primary)] transition-colors inline-flex"
          title="View details"
        >
          <Icon icon={faEye} size="sm" />
        </Link>
      ),
    },
  ];

  if (loading && canViewCollectionRecords && !recordsHydratedRef.current) {
    return <ListPageSkeleton title="Milk collection" filterFields={4} tableRows={10} tableCols={6} />;
  }

  const pageSubtitle =
    canViewCollectionRecords && canViewGateArrivals
      ? 'Purchase records and gate intake on one page.'
      : canViewGateArrivals
        ? 'Gate intake log for this MCC.'
        : 'Supplier milk purchases for this account.';

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Milk collection</h1>
          <p className="text-sm text-gray-600 mt-1">{pageSubtitle}</p>
        </div>
        {canViewCollectionRecords ? (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button type="button" onClick={() => setBulkImportOpen(true)} className="btn btn-secondary">
              <Icon icon={faFile} size="sm" className="mr-2" />
              Bulk import
            </button>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                collectionsApi.downloadTemplate().catch(() => {});
              }}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-4 text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors"
            >
              Download template
            </a>
            <button type="button" onClick={() => setCreateModalOpen(true)} className="btn btn-primary">
              <Icon icon={faPlus} size="sm" className="mr-2" />
              New collection
            </button>
          </div>
        ) : null}
      </div>

      {canViewCollectionRecords ? (
        <>
          <BulkImportModal
            open={bulkImportOpen}
            onClose={() => setBulkImportOpen(false)}
            title="Collections"
            columns={[
              { key: 'supplier_account_code', label: 'Supplier account code', required: true },
              { key: 'quantity', label: 'Quantity (L)', required: true },
              { key: 'status', label: 'Status (pending/accepted/rejected/cancelled)' },
              { key: 'collection_at', label: 'Collection date/time', required: true },
              { key: 'notes', label: 'Notes' },
              { key: 'payment_status', label: 'Payment status (paid/unpaid)' },
            ]}
            onDownloadTemplate={() => collectionsApi.downloadTemplate()}
            onBulkCreate={(rows) => {
              const data: import('@/lib/api/collections').CreateCollectionData[] = rows.map((row) => ({
                supplier_account_code: String(row.supplier_account_code ?? ''),
                quantity: Number(row.quantity) || 0,
                status: (row.status as 'pending' | 'accepted' | 'rejected' | 'cancelled') || undefined,
                collection_at: String(row.collection_at ?? new Date().toISOString().slice(0, 19).replace('T', ' ')),
                notes: row.notes != null ? String(row.notes) : undefined,
                payment_status: (row.payment_status as 'paid' | 'unpaid') || undefined,
              }));
              return collectionsApi.bulkCreate(data).then((r) => r.data);
            }}
            mapRow={(row) => ({
              supplier_account_code: row.supplier_account_code || '',
              quantity: Number(row.quantity) || 0,
              status: row.status || undefined,
              collection_at: row.collection_at || new Date().toISOString().slice(0, 19).replace('T', ' '),
              notes: row.notes || undefined,
              payment_status: (row.payment_status as 'paid' | 'unpaid') || undefined,
            })}
            onSuccess={loadCollections}
          />

          <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="New milk collection" maxWidth="max-w-2xl">
            <CreateCollectionForm
              onSuccess={() => {
                setCreateModalOpen(false);
                loadCollections();
              }}
              onCancel={() => setCreateModalOpen(false)}
            />
          </Modal>

          <section aria-labelledby="collections-records-heading" className="space-y-4">
            <h2 id="collections-records-heading" className="text-lg font-semibold text-gray-900">
              Collection records
            </h2>

            <FilterBar>
              <FilterBarGroup label="Status">
                <select
                  value={filters.status || ''}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="input h-9 min-h-[2.25rem] !py-1.5 !px-3 text-sm w-full text-gray-900"
                >
                  {STATUS_OPTIONS.map((option) => (
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
              <FilterBarGroup label="Supplier Name">
                <input
                  type="text"
                  value={filters.supplier_name || ''}
                  onChange={(e) => handleFilterChange('supplier_name', e.target.value)}
                  placeholder="Search supplier name..."
                  className="input h-9 min-h-[2.25rem] !py-1.5 !px-3 text-sm w-full text-gray-900"
                />
              </FilterBarGroup>
              <FilterBarActions onClear={handleClearFilters} />
              <FilterBarApply onApply={handleApplyFilters} />
              <FilterBarExport<Collection>
                data={collections}
                exportFilename="collections"
                exportColumns={[
                  { key: 'collection_at', label: 'Date', getValue: (r) => new Date(r.collection_at).toLocaleString() },
                  { key: 'supplier_account', label: 'Supplier', getValue: (r) => supplierDisplayName(r) },
                  { key: 'collection_shift', label: 'Shift', getValue: (r) => formatCollectionShift(r.collection_shift) },
                  { key: 'quantity', label: 'Quantity (L)', getValue: (r) => String(Number(r.quantity).toFixed(2)) },
                  { key: 'unit_price', label: 'Unit Price', getValue: (r) => String(r.unit_price ?? '') },
                  { key: 'total_amount', label: 'Total', getValue: (r) => String(r.total_amount ?? '') },
                  { key: 'status', label: 'Status', getValue: (r) => String(r.status ?? '') },
                ]}
                disabled={loading}
              />
            </FilterBar>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-sm p-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <DataTableWithPagination<Collection>
              data={collections}
              columns={columns}
              loading={loading}
              emptyMessage={currentAccount ? 'No collections for this account' : 'Select an account to view collections'}
              itemLabel="collections"
            />
          </section>
        </>
      ) : null}

      {canViewGateArrivals ? (
        <section
          id={GATE_SECTION_ID}
          className={`scroll-mt-6 space-y-4 ${canViewCollectionRecords ? 'border-t border-gray-200 pt-10' : ''}`}
        >
          <h2 className="text-lg font-semibold text-gray-900">Gate arrivals</h2>
          <GateArrivalsPanel />
        </section>
      ) : null}
    </div>
  );
}
