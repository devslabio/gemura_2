'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import AdminReportListChrome from '@/app/components/admin/AdminReportListChrome';
import DataTable, { TableColumn } from '@/app/components/DataTable';
import Pagination from '@/app/components/Pagination';
import type { ExportColumn } from '@/app/components/FilterBar';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';
import { adminApi, type PlatformChargeRow } from '@/lib/api/admin';
import { useAdminReportNavigation } from '@/hooks/useAdminReportNavigation';
import { useAuthStore } from '@/store/auth';
import { usePermission } from '@/hooks/usePermission';

function formatRf(n: number) {
  return `RF ${new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(n)}`;
}

const exportColumns: ExportColumn<PlatformChargeRow>[] = [
  { key: 'updated_at', label: 'Updated' },
  { key: 'mcc_name', label: 'MCC' },
  { key: 'name', label: 'Name' },
  { key: 'kind', label: 'Kind' },
  { key: 'amount_type', label: 'Amount type' },
  { key: 'amount', label: 'Amount' },
  { key: 'is_active', label: 'Active' },
];

function ChargesReportInner() {
  const router = useRouter();
  const { currentAccount } = useAuthStore();
  const { canViewDashboard, canManageUsers, isAdmin } = usePermission();
  const allowed = canViewDashboard() || canManageUsers() || isAdmin();

  const { apiParams, filterInputs, periodLabel, setPageSize, setPage, clearFilters } =
    useAdminReportNavigation();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PlatformChargeRow[]>([]);
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.listPlatformCharges(currentAccount?.account_id, apiParams);
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
    ? `${periodLabel} · UTC: ${new Date(period.start).toLocaleString()} → ${new Date(period.end).toLocaleString()}`
    : periodLabel;

  const columns: TableColumn<PlatformChargeRow>[] = [
    {
      key: 'updated_at',
      label: 'Updated',
      render: (v) => new Date(v as string).toLocaleString(),
    },
    {
      key: 'mcc_name',
      label: 'MCC',
      render: (v, row) => (v as string) || row.mcc_code || '—',
    },
    { key: 'name', label: 'Charge' },
    {
      key: 'kind',
      label: 'Kind',
      render: (v) => <span className="capitalize">{String(v)}</span>,
    },
    { key: 'amount_type', label: 'Type', render: (v) => <span className="capitalize">{String(v)}</span> },
    {
      key: 'amount',
      label: 'Amount',
      render: (v, row) => (row.amount_type === 'percentage' ? `${Number(v)}%` : formatRf(Number(v))),
    },
    {
      key: 'is_active',
      label: 'Active',
      render: (v) => (
        <span className={`rounded px-2 py-1 text-xs font-medium ${v ? 'bg-green-50 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
          {v ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'apply_to_all_suppliers',
      label: 'Scope',
      render: (v) => (v ? 'All suppliers' : 'Selected suppliers'),
    },
  ];

  if (!allowed) return null;

  if (loading && rows.length === 0) {
    return <ListPageSkeleton title="Supplier charges" filterFields={4} tableRows={10} tableCols={7} />;
  }

  return (
    <AdminReportListChrome
      title="Supplier charges"
      periodHint={periodHint}
      pageSize={filterInputs.pageSize}
      onPageSizeChange={setPageSize}
      onClearFilters={clearFilters}
      exportFilename={`charges-${new Date().toISOString().split('T')[0]}.csv`}
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
        emptyMessage="No charge definitions changed in this period."
      />

      {pagination.total > 0 ? (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          pageSize={pagination.limit}
          itemLabel="charges"
          onPageChange={setPage}
        />
      ) : null}

      <p className="text-xs text-gray-500">
        Rows include supplier charges whose created or updated time falls in the selected window (matches main app Charges).
      </p>
    </AdminReportListChrome>
  );
}

export default function ChargesReportPage() {
  return (
    <Suspense fallback={<ListPageSkeleton title="Supplier charges" filterFields={4} tableRows={10} tableCols={7} />}>
      <ChargesReportInner />
    </Suspense>
  );
}
