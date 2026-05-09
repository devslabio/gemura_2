'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import AdminReportListChrome from '@/app/components/admin/AdminReportListChrome';
import DataTable, { TableColumn } from '@/app/components/DataTable';
import Pagination from '@/app/components/Pagination';
import type { ExportColumn } from '@/app/components/FilterBar';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';
import { adminApi, type PlatformPayrollRunRow } from '@/lib/api/admin';
import { useAdminReportNavigation } from '@/hooks/useAdminReportNavigation';
import { useAuthStore } from '@/store/auth';
import { usePermission } from '@/hooks/usePermission';

function formatRf(n: number) {
  return `RF ${new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(n)}`;
}

const exportColumns: ExportColumn<PlatformPayrollRunRow>[] = [
  { key: 'run_date', label: 'Run date' },
  { key: 'run_name', label: 'Name' },
  { key: 'total_amount', label: 'Total' },
  { key: 'status', label: 'Status' },
  { key: 'account_name', label: 'Account' },
];

function PayrollRunsReportInner() {
  const router = useRouter();
  const { currentAccount } = useAuthStore();
  const { canViewDashboard, canManageUsers, isAdmin } = usePermission();
  const allowed = canViewDashboard() || canManageUsers() || isAdmin();

  const { apiParams, filterInputs, setDateFrom, setDateTo, setPageSize, setPage, clearFilters } =
    useAdminReportNavigation();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PlatformPayrollRunRow[]>([]);
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.listPlatformPayrollRuns(currentAccount?.account_id, apiParams);
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
    ? `Resolved window (UTC): ${new Date(period.start).toLocaleString()} → ${new Date(period.end).toLocaleString()} · completed runs only`
    : undefined;

  const columns: TableColumn<PlatformPayrollRunRow>[] = [
    {
      key: 'run_date',
      label: 'Run date',
      render: (v) => new Date(v as string).toLocaleDateString(),
    },
    { key: 'run_name', label: 'Name' },
    {
      key: 'total_amount',
      label: 'Total',
      render: (v) => formatRf(Number(v)),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => (
        <span className="rounded px-2 py-1 text-xs font-medium capitalize bg-emerald-50 text-emerald-900">{String(value)}</span>
      ),
    },
    {
      key: 'account_name',
      label: 'Account',
      render: (v, row) => (v as string) || row.account_code || '—',
    },
  ];

  if (!allowed) return null;

  if (loading && rows.length === 0) {
    return <ListPageSkeleton title="Payroll runs" filterFields={4} tableRows={10} tableCols={5} />;
  }

  return (
    <AdminReportListChrome
      title="Payroll runs"
      periodHint={periodHint}
      dateFrom={filterInputs.dateFrom}
      dateTo={filterInputs.dateTo}
      pageSize={filterInputs.pageSize}
      onDateFromChange={setDateFrom}
      onDateToChange={setDateTo}
      onPageSizeChange={setPageSize}
      onClearFilters={clearFilters}
      exportFilename={`payroll-runs-${new Date().toISOString().split('T')[0]}.csv`}
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
        emptyMessage="No completed payroll runs in this period."
      />

      {pagination.total > 0 ? (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          pageSize={pagination.limit}
          itemLabel="runs"
          onPageChange={setPage}
        />
      ) : null}
    </AdminReportListChrome>
  );
}

export default function PayrollRunsReportPage() {
  return (
    <Suspense fallback={<ListPageSkeleton title="Payroll runs" filterFields={4} tableRows={10} tableCols={5} />}>
      <PayrollRunsReportInner />
    </Suspense>
  );
}
