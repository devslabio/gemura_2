'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import AdminReportListChrome from '@/app/components/admin/AdminReportListChrome';
import DataTable, { TableColumn } from '@/app/components/DataTable';
import Pagination from '@/app/components/Pagination';
import type { ExportColumn } from '@/app/components/FilterBar';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';
import { adminApi, type PlatformSupplierCustomerLinkRow } from '@/lib/api/admin';
import { useAdminReportNavigation } from '@/hooks/useAdminReportNavigation';
import { useAuthStore } from '@/store/auth';
import { usePermission } from '@/hooks/usePermission';

const exportColumns: ExportColumn<PlatformSupplierCustomerLinkRow>[] = [
  { key: 'created_at', label: 'Linked at' },
  { key: 'supplier_name', label: 'Supplier' },
  { key: 'customer_name', label: 'Customer (MCC)' },
  { key: 'price_per_liter', label: 'Price / L' },
  { key: 'relationship_status', label: 'Status' },
];

function SupplierLinksReportInner() {
  const router = useRouter();
  const { currentAccount } = useAuthStore();
  const { canViewDashboard, canManageUsers, isAdmin } = usePermission();
  const allowed = canViewDashboard() || canManageUsers() || isAdmin();

  const { apiParams, filterInputs, setDateFrom, setDateTo, setPageSize, setPage, clearFilters, backToOverviewHref } =
    useAdminReportNavigation();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PlatformSupplierCustomerLinkRow[]>([]);
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.listPlatformSupplierCustomerLinks(currentAccount?.account_id, apiParams);
      if (res.code === 200 && res.data) {
        setRows(res.data.rows);
        setPeriod(res.data.period);
        setPagination(res.data.pagination);
      } else {
        setError(res.message || 'Failed to load');
        setRows([]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [allowed, currentAccount?.account_id, apiParams]);

  useEffect(() => {
    if (!allowed) {
      router.replace('/dashboard');
      return;
    }
    load();
  }, [allowed, load, router]);

  const periodHint = period
    ? `Resolved window (UTC): ${new Date(period.start).toLocaleString()} → ${new Date(period.end).toLocaleString()}`
    : undefined;

  const columns: TableColumn<PlatformSupplierCustomerLinkRow>[] = [
    {
      key: 'created_at',
      label: 'Linked at',
      render: (v) => new Date(v as string).toLocaleString(),
    },
    {
      key: 'supplier_name',
      label: 'Supplier',
      render: (v, row) => (v as string) || row.supplier_code || '—',
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: (v, row) => (v as string) || row.customer_code || '—',
    },
    {
      key: 'price_per_liter',
      label: 'Price / L',
      render: (v) => Number(v).toLocaleString('en-RW', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    },
    {
      key: 'relationship_status',
      label: 'Status',
      render: (value) => (
        <span className="rounded px-2 py-1 text-xs font-medium capitalize bg-gray-100 text-gray-800">{String(value)}</span>
      ),
    },
  ];

  if (!allowed) return null;

  if (loading && rows.length === 0) {
    return <ListPageSkeleton title="Supplier–customer links" filterFields={4} tableRows={10} tableCols={5} />;
  }

  return (
    <AdminReportListChrome
      title="Supplier–customer links"
      backHref={backToOverviewHref}
      periodHint={periodHint}
      dateFrom={filterInputs.dateFrom}
      dateTo={filterInputs.dateTo}
      pageSize={filterInputs.pageSize}
      onDateFromChange={setDateFrom}
      onDateToChange={setDateTo}
      onPageSizeChange={setPageSize}
      onClearFilters={clearFilters}
      exportFilename={`supplier-customer-links-${new Date().toISOString().split('T')[0]}.csv`}
      exportColumns={exportColumns}
      exportRows={rows}
    >
      {error ? (
        <div className="rounded-sm border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : null}

      {loading && rows.length > 0 ? (
        <p className="text-xs text-gray-500" aria-live="polite">
          Updating results…
        </p>
      ) : null}

      <DataTable
        columns={columns}
        data={rows}
        loading={loading && rows.length === 0}
        showRowNumbers
        emptyMessage="No new supplier–customer links in this period."
      />

      {pagination.total > 0 ? (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          pageSize={pagination.limit}
          itemLabel="links"
          onPageChange={setPage}
        />
      ) : null}

      <p className="text-xs text-gray-500">
        New relationships created in the window (main app Suppliers / Customers directory).
      </p>
    </AdminReportListChrome>
  );
}

export default function SupplierLinksReportPage() {
  return (
    <Suspense fallback={<ListPageSkeleton title="Supplier–customer links" filterFields={4} tableRows={10} tableCols={5} />}>
      <SupplierLinksReportInner />
    </Suspense>
  );
}
