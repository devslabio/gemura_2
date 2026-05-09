'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import AdminReportListChrome from '@/app/components/admin/AdminReportListChrome';
import DataTable, { TableColumn } from '@/app/components/DataTable';
import Pagination from '@/app/components/Pagination';
import type { ExportColumn } from '@/app/components/FilterBar';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';
import { adminApi, type PlatformMilkSaleRow } from '@/lib/api/admin';
import { useAdminReportNavigation } from '@/hooks/useAdminReportNavigation';
import { useAuthStore } from '@/store/auth';
import { usePermission } from '@/hooks/usePermission';

function formatRf(n: number) {
  return `RF ${new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(n)}`;
}

const milkExportColumns: ExportColumn<PlatformMilkSaleRow>[] = [
  { key: 'sale_at', label: 'Sale at' },
  { key: 'status', label: 'Status' },
  { key: 'quantity', label: 'Qty (L)' },
  { key: 'unit_price', label: 'Unit price' },
  { key: 'amount_paid', label: 'Amount paid' },
  { key: 'supplier_name', label: 'Supplier' },
  { key: 'supplier_code', label: 'Supplier code' },
  { key: 'customer_name', label: 'Customer' },
  { key: 'customer_code', label: 'Customer code' },
];

function MilkCollectionsReportInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentAccount } = useAuthStore();
  const { canViewDashboard, canManageUsers, isAdmin } = usePermission();
  const allowed = canViewDashboard() || canManageUsers() || isAdmin();

  const { apiParams, filterInputs, setDateFrom, setDateTo, setPageSize, setPage, clearFilters, backToOverviewHref } =
    useAdminReportNavigation();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PlatformMilkSaleRow[]>([]);
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [error, setError] = useState('');

  const rejectionsHref = useMemo(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.set('page', '1');
    return `/admin/milk/rejections?${p.toString()}`;
  }, [searchParams]);

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.listPlatformMilkSales(currentAccount?.account_id, {
        scope: 'collections',
        ...apiParams,
      });
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

  const columns: TableColumn<PlatformMilkSaleRow>[] = [
    { key: 'sale_at', label: 'Sale at', render: (v) => new Date(v as string).toLocaleString() },
    {
      key: 'status',
      label: 'Status',
      render: (value) => (
        <span className="rounded px-2 py-1 text-xs font-medium capitalize bg-blue-50 text-blue-800">{String(value)}</span>
      ),
    },
    {
      key: 'quantity',
      label: 'Qty (L)',
      render: (v) => Number(v).toLocaleString(),
    },
    {
      key: 'unit_price',
      label: 'Unit',
      render: (v) => formatRf(Number(v)),
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
      key: 'amount_paid',
      label: 'Paid',
      render: (v) => formatRf(Number(v)),
    },
  ];

  if (!allowed) return null;

  if (loading && rows.length === 0) {
    return <ListPageSkeleton title="Milk collections" filterFields={4} tableRows={10} tableCols={7} />;
  }

  return (
    <AdminReportListChrome
      title="Milk collections"
      backHref={backToOverviewHref}
      periodHint={periodHint}
      headerRight={
        <Link href={rejectionsHref} className="btn btn-secondary">
          Rejected milk
        </Link>
      }
      dateFrom={filterInputs.dateFrom}
      dateTo={filterInputs.dateTo}
      pageSize={filterInputs.pageSize}
      onDateFromChange={setDateFrom}
      onDateToChange={setDateTo}
      onPageSizeChange={setPageSize}
      onClearFilters={clearFilters}
      exportFilename={`milk-collections-${new Date().toISOString().split('T')[0]}.csv`}
      exportColumns={milkExportColumns}
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
        emptyMessage="No milk transactions in this period."
      />

      {pagination.total > 0 ? (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          pageSize={pagination.limit}
          itemLabel="transactions"
          onPageChange={setPage}
        />
      ) : null}

      <p className="text-xs text-gray-500">
        Totals align with dashboard collections (non-deleted milk sales in the selected window).
      </p>
    </AdminReportListChrome>
  );
}

export default function MilkCollectionsReportPage() {
  return (
    <Suspense fallback={<ListPageSkeleton title="Milk collections" filterFields={4} tableRows={10} tableCols={7} />}>
      <MilkCollectionsReportInner />
    </Suspense>
  );
}
