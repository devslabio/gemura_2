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

const rejectionExportColumns: ExportColumn<PlatformMilkSaleRow>[] = [
  { key: 'sale_at', label: 'Sale at' },
  { key: 'status', label: 'Status' },
  { key: 'quantity', label: 'Qty (L)' },
  { key: 'unit_price', label: 'Unit price' },
  { key: 'supplier_name', label: 'Supplier' },
  { key: 'customer_name', label: 'Customer' },
];

function MilkRejectionsReportInner() {
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

  const collectionsHref = useMemo(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.set('page', '1');
    return `/admin/milk/collections?${p.toString()}`;
  }, [searchParams]);

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.listPlatformMilkSales(currentAccount?.account_id, {
        scope: 'rejections',
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
  ];

  if (!allowed) return null;

  if (loading && rows.length === 0) {
    return <ListPageSkeleton title="Milk rejections" filterFields={4} tableRows={10} tableCols={5} />;
  }

  return (
    <AdminReportListChrome
      title="Milk rejections"
      backHref={backToOverviewHref}
      periodHint={periodHint}
      headerRight={
        <Link href={collectionsHref} className="btn btn-secondary">
          All collections
        </Link>
      }
      dateFrom={filterInputs.dateFrom}
      dateTo={filterInputs.dateTo}
      pageSize={filterInputs.pageSize}
      onDateFromChange={setDateFrom}
      onDateToChange={setDateTo}
      onPageSizeChange={setPageSize}
      onClearFilters={clearFilters}
      exportFilename={`milk-rejections-${new Date().toISOString().split('T')[0]}.csv`}
      exportColumns={rejectionExportColumns}
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
        emptyMessage="No rejected milk transactions in this period."
      />

      {pagination.total > 0 ? (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          pageSize={pagination.limit}
          itemLabel="rejections"
          onPageChange={setPage}
        />
      ) : null}
    </AdminReportListChrome>
  );
}

export default function MilkRejectionsReportPage() {
  return (
    <Suspense fallback={<ListPageSkeleton title="Milk rejections" filterFields={4} tableRows={10} tableCols={5} />}>
      <MilkRejectionsReportInner />
    </Suspense>
  );
}
