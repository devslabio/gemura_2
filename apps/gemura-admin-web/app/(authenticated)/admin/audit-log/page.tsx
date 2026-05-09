'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import AdminReportListChrome from '@/app/components/admin/AdminReportListChrome';
import DataTable, { TableColumn } from '@/app/components/DataTable';
import Pagination from '@/app/components/Pagination';
import type { ExportColumn } from '@/app/components/FilterBar';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';
import { adminApi, type PlatformAuditEventRow } from '@/lib/api/admin';
import { useAdminReportNavigation } from '@/hooks/useAdminReportNavigation';
import { useAuthStore } from '@/store/auth';
import { usePermission } from '@/hooks/usePermission';

const exportColumns: ExportColumn<PlatformAuditEventRow>[] = [
  { key: 'created_at', label: 'When' },
  { key: 'action', label: 'Action' },
  { key: 'entity_type', label: 'Entity' },
  { key: 'entity_id', label: 'Entity id' },
  { key: 'user_label', label: 'User' },
  { key: 'ip_address', label: 'IP' },
];

function AuditLogReportInner() {
  const router = useRouter();
  const { currentAccount } = useAuthStore();
  const { canViewDashboard, canManageUsers, isAdmin } = usePermission();
  const allowed = canViewDashboard() || canManageUsers() || isAdmin();

  const { apiParams, filterInputs, setDateFrom, setDateTo, setPageSize, setPage, clearFilters, backToOverviewHref } =
    useAdminReportNavigation();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PlatformAuditEventRow[]>([]);
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.listPlatformAuditEvents(currentAccount?.account_id, apiParams);
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

  const columns: TableColumn<PlatformAuditEventRow>[] = [
    {
      key: 'created_at',
      label: 'When',
      render: (v) => new Date(v as string).toLocaleString(),
    },
    { key: 'action', label: 'Action' },
    { key: 'entity_type', label: 'Entity' },
    {
      key: 'entity_id',
      label: 'Entity id',
      render: (v) => <span className="font-mono text-xs">{String(v)}</span>,
    },
    {
      key: 'user_label',
      label: 'User',
      render: (v) => (v as string) || '—',
    },
    {
      key: 'ip_address',
      label: 'IP',
      render: (v) => (v as string) || '—',
    },
  ];

  if (!allowed) return null;

  if (loading && rows.length === 0) {
    return <ListPageSkeleton title="Audit log" filterFields={4} tableRows={10} tableCols={6} />;
  }

  return (
    <AdminReportListChrome
      title="Audit log"
      backHref={backToOverviewHref}
      periodHint={periodHint}
      dateFrom={filterInputs.dateFrom}
      dateTo={filterInputs.dateTo}
      pageSize={filterInputs.pageSize}
      onDateFromChange={setDateFrom}
      onDateToChange={setDateTo}
      onPageSizeChange={setPageSize}
      onClearFilters={clearFilters}
      exportFilename={`audit-events-${new Date().toISOString().split('T')[0]}.csv`}
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
        emptyMessage="No audit events in this period."
      />

      {pagination.total > 0 ? (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          pageSize={pagination.limit}
          itemLabel="events"
          onPageChange={setPage}
        />
      ) : null}
    </AdminReportListChrome>
  );
}

export default function AuditLogReportPage() {
  return (
    <Suspense fallback={<ListPageSkeleton title="Audit log" filterFields={4} tableRows={10} tableCols={6} />}>
      <AuditLogReportInner />
    </Suspense>
  );
}
