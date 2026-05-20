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

const loanExportColumns: ExportColumn<PlatformLoanRow>[] = [
  { key: 'disbursement_date', label: 'Disbursed' },
  { key: 'status', label: 'Status' },
  { key: 'principal', label: 'Principal' },
  { key: 'amount_repaid', label: 'Repaid' },
  { key: 'borrower_label', label: 'Borrower' },
  { key: 'borrower_code', label: 'Borrower code' },
  { key: 'lender_name', label: 'Lender' },
];

function ActiveLoansReportInner() {
  const router = useRouter();
  const { currentAccount } = useAuthStore();
  const { canViewDashboard, canManageUsers, isAdmin } = usePermission();
  const allowed = canViewDashboard() || canManageUsers() || isAdmin();

  const { apiParams, filterInputs, setPageSize, setPage, clearFilters } = useAdminReportNavigation();

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
        mode: 'active_portfolio',
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
        <span className="rounded px-2 py-1 text-xs font-medium capitalize bg-gray-100 text-gray-800">{String(value)}</span>
      ),
    },
    {
      key: 'principal',
      label: 'Principal',
      render: (v) => formatRf(Number(v)),
    },
    {
      key: 'amount_repaid',
      label: 'Repaid',
      render: (v) => formatRf(Number(v)),
    },
    { key: 'borrower_label', label: 'Borrower' },
    { key: 'lender_name', label: 'Lender', render: (v) => (v as string) || '—' },
  ];

  if (!allowed) return null;

  if (loading && rows.length === 0) {
    return <ListPageSkeleton title="Active loans" filterFields={4} tableRows={10} tableCols={6} />;
  }

  return (
    <AdminReportListChrome
      title="Active loans"
      periodHint="Portfolio view: all loans with status active (date filters do not apply)."
      showDateFilters={false}
      showPeriodToolbar={false}
      pageSize={filterInputs.pageSize}
      onPageSizeChange={setPageSize}
      onClearFilters={clearFilters}
      exportFilename={`active-loans-${new Date().toISOString().split('T')[0]}.csv`}
      exportColumns={loanExportColumns}
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

      <DataTable columns={columns} data={rows} loading={loading && rows.length === 0} showRowNumbers emptyMessage="No active loans." />

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

export default function ActiveLoansReportPage() {
  return (
    <Suspense fallback={<ListPageSkeleton title="Active loans" filterFields={4} tableRows={10} tableCols={6} />}>
      <ActiveLoansReportInner />
    </Suspense>
  );
}
