'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import AdminReportListChrome from '@/app/components/admin/AdminReportListChrome';
import DataTable, { TableColumn } from '@/app/components/DataTable';
import Pagination from '@/app/components/Pagination';
import type { ExportColumn } from '@/app/components/FilterBar';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';
import { adminApi, type PlatformAccountingTransactionRow } from '@/lib/api/admin';
import { useAdminReportNavigation } from '@/hooks/useAdminReportNavigation';
import { useAuthStore } from '@/store/auth';
import { usePermission } from '@/hooks/usePermission';

function formatRf(n: number) {
  return `RF ${new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(n)}`;
}

const exportColumns: ExportColumn<PlatformAccountingTransactionRow>[] = [
  { key: 'transaction_date', label: 'Date' },
  { key: 'reference_number', label: 'Reference' },
  { key: 'description', label: 'Description' },
  { key: 'total_amount', label: 'Total' },
  { key: 'entry_lines', label: 'Lines' },
  { key: 'farm_name', label: 'Farm' },
];

function AccountingTransactionsReportInner() {
  const router = useRouter();
  const { currentAccount } = useAuthStore();
  const { canViewDashboard, canManageUsers, isAdmin } = usePermission();
  const allowed = canViewDashboard() || canManageUsers() || isAdmin();

  const { apiParams, filterInputs, periodLabel, setPageSize, setPage, clearFilters } =
    useAdminReportNavigation();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PlatformAccountingTransactionRow[]>([]);
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.listPlatformAccountingTransactions(currentAccount?.account_id, apiParams);
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

  const columns: TableColumn<PlatformAccountingTransactionRow>[] = [
    {
      key: 'transaction_date',
      label: 'Date',
      render: (v) => new Date(v as string).toLocaleDateString(),
    },
    {
      key: 'reference_number',
      label: 'Reference',
      render: (v) => (v ? <span className="font-mono text-xs">{String(v)}</span> : '—'),
    },
    {
      key: 'description',
      label: 'Description',
      render: (v) => (v as string)?.slice(0, 120) || '—',
    },
    {
      key: 'total_amount',
      label: 'Total',
      render: (v) => formatRf(Number(v)),
    },
    { key: 'entry_lines', label: 'Lines', render: (v) => Number(v).toLocaleString() },
    {
      key: 'farm_name',
      label: 'Farm',
      render: (v) => (v as string) || '—',
    },
  ];

  if (!allowed) return null;

  if (loading && rows.length === 0) {
    return <ListPageSkeleton title="Accounting transactions" filterFields={4} tableRows={10} tableCols={6} />;
  }

  return (
    <AdminReportListChrome
      title="Accounting transactions"
      periodHint={periodHint}
      pageSize={filterInputs.pageSize}
      onPageSizeChange={setPageSize}
      onClearFilters={clearFilters}
      exportFilename={`accounting-transactions-${new Date().toISOString().split('T')[0]}.csv`}
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
        emptyMessage="No journal batches in this period."
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
        Chart-of-accounts batches by transaction date (main app Finance → Transactions).
      </p>
    </AdminReportListChrome>
  );
}

export default function AccountingTransactionsReportPage() {
  return (
    <Suspense fallback={<ListPageSkeleton title="Accounting transactions" filterFields={4} tableRows={10} tableCols={6} />}>
      <AccountingTransactionsReportInner />
    </Suspense>
  );
}
