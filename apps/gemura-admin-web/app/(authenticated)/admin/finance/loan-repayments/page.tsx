'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import AdminReportListChrome from '@/app/components/admin/AdminReportListChrome';
import DataTable, { TableColumn } from '@/app/components/DataTable';
import Pagination from '@/app/components/Pagination';
import type { ExportColumn } from '@/app/components/FilterBar';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';
import { adminApi, type PlatformLoanRepaymentRow } from '@/lib/api/admin';
import { useAdminReportNavigation } from '@/hooks/useAdminReportNavigation';
import { useAuthStore } from '@/store/auth';
import { usePermission } from '@/hooks/usePermission';

function formatRf(n: number) {
  return `RF ${new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(n)}`;
}

const exportColumns: ExportColumn<PlatformLoanRepaymentRow>[] = [
  { key: 'repayment_date', label: 'Date' },
  { key: 'amount', label: 'Amount' },
  { key: 'source', label: 'Source' },
  { key: 'loan_id', label: 'Loan id' },
  { key: 'borrower_label', label: 'Borrower' },
  { key: 'lender_name', label: 'Lender' },
];

function LoanRepaymentsReportInner() {
  const router = useRouter();
  const { currentAccount } = useAuthStore();
  const { canViewDashboard, canManageUsers, isAdmin } = usePermission();
  const allowed = canViewDashboard() || canManageUsers() || isAdmin();

  const { apiParams, filterInputs, periodLabel, setPageSize, setPage, clearFilters } =
    useAdminReportNavigation();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PlatformLoanRepaymentRow[]>([]);
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.listPlatformLoanRepayments(currentAccount?.account_id, apiParams);
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

  const columns: TableColumn<PlatformLoanRepaymentRow>[] = [
    {
      key: 'repayment_date',
      label: 'Date',
      render: (v) => new Date(v as string).toLocaleString(),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (v) => formatRf(Number(v)),
    },
    { key: 'source', label: 'Source' },
    { key: 'borrower_label', label: 'Borrower' },
    { key: 'lender_name', label: 'Lender', render: (v) => (v as string) || '—' },
  ];

  if (!allowed) return null;

  if (loading && rows.length === 0) {
    return <ListPageSkeleton title="Loan repayments" filterFields={4} tableRows={10} tableCols={5} />;
  }

  return (
    <AdminReportListChrome
      title="Loan repayments"
      periodHint={periodHint}
      pageSize={filterInputs.pageSize}
      onPageSizeChange={setPageSize}
      onClearFilters={clearFilters}
      exportFilename={`loan-repayments-${new Date().toISOString().split('T')[0]}.csv`}
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
        emptyMessage="No repayments in this period."
      />

      {pagination.total > 0 ? (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          pageSize={pagination.limit}
          itemLabel="repayments"
          onPageChange={setPage}
        />
      ) : null}
    </AdminReportListChrome>
  );
}

export default function LoanRepaymentsReportPage() {
  return (
    <Suspense fallback={<ListPageSkeleton title="Loan repayments" filterFields={4} tableRows={10} tableCols={5} />}>
      <LoanRepaymentsReportInner />
    </Suspense>
  );
}
