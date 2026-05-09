'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import AdminReportListChrome from '@/app/components/admin/AdminReportListChrome';
import DataTable, { TableColumn } from '@/app/components/DataTable';
import Pagination from '@/app/components/Pagination';
import type { ExportColumn } from '@/app/components/FilterBar';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';
import { adminApi, type PlatformLoanRow } from '@/lib/api/admin';
import { useAdminReportNavigation } from '@/hooks/useAdminReportNavigation';
import { useAuthStore } from '@/store/auth';
import { usePermission } from '@/hooks/usePermission';

function formatRf(n: number) {
  return `RF ${new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(n)}`;
}

const exportColumns: ExportColumn<PlatformLoanRow>[] = [
  { key: 'disbursement_date', label: 'Disbursed' },
  { key: 'status', label: 'Status' },
  { key: 'principal', label: 'Principal' },
  { key: 'borrower_label', label: 'Borrower' },
  { key: 'lender_name', label: 'Lender' },
];

function LoanDisbursementsReportInner() {
  const router = useRouter();
  const { currentAccount } = useAuthStore();
  const { canViewDashboard, canManageUsers, isAdmin } = usePermission();
  const allowed = canViewDashboard() || canManageUsers() || isAdmin();

  const { apiParams, filterInputs, setDateFrom, setDateTo, setPageSize, setPage, clearFilters, backToOverviewHref } =
    useAdminReportNavigation();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PlatformLoanRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.listPlatformLoans(currentAccount?.account_id, {
        mode: 'disbursed_in_period',
        ...apiParams,
      });
      if (res.code === 200 && res.data) {
        setRows(res.data.rows);
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

  const columns: TableColumn<PlatformLoanRow>[] = [
    {
      key: 'disbursement_date',
      label: 'Disbursed',
      render: (v) => new Date(v as string).toLocaleDateString(),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => (
        <span className="rounded px-2 py-1 text-xs font-medium capitalize bg-blue-50 text-blue-800">{String(value)}</span>
      ),
    },
    {
      key: 'principal',
      label: 'Principal',
      render: (v) => formatRf(Number(v)),
    },
    { key: 'borrower_label', label: 'Borrower' },
    { key: 'lender_name', label: 'Lender', render: (v) => (v as string) || '—' },
  ];

  if (!allowed) return null;

  if (loading && rows.length === 0) {
    return <ListPageSkeleton title="Loan disbursements" filterFields={4} tableRows={10} tableCols={5} />;
  }

  return (
    <AdminReportListChrome
      title="Loan disbursements"
      backHref={backToOverviewHref}
      periodHint="Loans with disbursement date in the selected window."
      dateFrom={filterInputs.dateFrom}
      dateTo={filterInputs.dateTo}
      pageSize={filterInputs.pageSize}
      onDateFromChange={setDateFrom}
      onDateToChange={setDateTo}
      onPageSizeChange={setPageSize}
      onClearFilters={clearFilters}
      exportFilename={`loan-disbursements-${new Date().toISOString().split('T')[0]}.csv`}
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
        emptyMessage="No disbursements in this period."
      />

      {pagination.total > 0 ? (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          pageSize={pagination.limit}
          itemLabel="loans"
          onPageChange={setPage}
        />
      ) : null}
    </AdminReportListChrome>
  );
}

export default function LoanDisbursementsReportPage() {
  return (
    <Suspense fallback={<ListPageSkeleton title="Loan disbursements" filterFields={4} tableRows={10} tableCols={5} />}>
      <LoanDisbursementsReportInner />
    </Suspense>
  );
}
