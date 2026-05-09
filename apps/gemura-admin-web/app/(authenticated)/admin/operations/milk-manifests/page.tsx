'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import AdminReportListChrome from '@/app/components/admin/AdminReportListChrome';
import DataTable, { TableColumn } from '@/app/components/DataTable';
import Pagination from '@/app/components/Pagination';
import type { ExportColumn } from '@/app/components/FilterBar';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';
import { adminApi, type PlatformMilkManifestRow } from '@/lib/api/admin';
import { useAdminReportNavigation } from '@/hooks/useAdminReportNavigation';
import { useAuthStore } from '@/store/auth';
import { usePermission } from '@/hooks/usePermission';

const exportColumns: ExportColumn<PlatformMilkManifestRow>[] = [
  { key: 'manifest_ref', label: 'Ref' },
  { key: 'status', label: 'Status' },
  { key: 'mcc_name', label: 'MCC' },
  { key: 'umucunda_name', label: 'Umucunda' },
  { key: 'line_count', label: 'Lines' },
  { key: 'gate_arrived_at', label: 'Gate arrived' },
  { key: 'gate_volume_litres', label: 'Gate vol (L)' },
];

function MilkManifestsReportInner() {
  const router = useRouter();
  const { currentAccount } = useAuthStore();
  const { canViewDashboard, canManageUsers, isAdmin } = usePermission();
  const allowed = canViewDashboard() || canManageUsers() || isAdmin();

  const { apiParams, filterInputs, setDateFrom, setDateTo, setPageSize, setPage, clearFilters, backToOverviewHref } =
    useAdminReportNavigation();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PlatformMilkManifestRow[]>([]);
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.listPlatformMilkManifests(currentAccount?.account_id, apiParams);
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

  const columns: TableColumn<PlatformMilkManifestRow>[] = [
    { key: 'manifest_ref', label: 'Ref', render: (v) => <span className="font-mono text-xs">{String(v)}</span> },
    {
      key: 'status',
      label: 'Status',
      render: (value) => (
        <span className="rounded px-2 py-1 text-xs font-medium capitalize bg-gray-100 text-gray-800">{String(value)}</span>
      ),
    },
    {
      key: 'mcc_name',
      label: 'MCC',
      render: (v, row) => (v as string) || row.mcc_code || '—',
    },
    {
      key: 'umucunda_name',
      label: 'Umucunda',
      render: (v, row) => (v as string) || row.umucunda_code || '—',
    },
    { key: 'line_count', label: 'Lines', render: (v) => Number(v).toLocaleString() },
    {
      key: 'gate_arrived_at',
      label: 'Gate arrived',
      render: (v) => (v ? new Date(v as string).toLocaleString() : '—'),
    },
    {
      key: 'gate_volume_litres',
      label: 'Gate vol (L)',
      render: (v) => (v != null ? Number(v).toLocaleString(undefined, { maximumFractionDigits: 3 }) : '—'),
    },
  ];

  if (!allowed) return null;

  if (loading && rows.length === 0) {
    return <ListPageSkeleton title="Milk manifests" filterFields={4} tableRows={10} tableCols={7} />;
  }

  return (
    <AdminReportListChrome
      title="Milk manifests"
      backHref={backToOverviewHref}
      periodHint={periodHint}
      dateFrom={filterInputs.dateFrom}
      dateTo={filterInputs.dateTo}
      pageSize={filterInputs.pageSize}
      onDateFromChange={setDateFrom}
      onDateToChange={setDateTo}
      onPageSizeChange={setPageSize}
      onClearFilters={clearFilters}
      exportFilename={`milk-manifests-${new Date().toISOString().split('T')[0]}.csv`}
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
        emptyMessage="No manifests created in this period."
      />

      {pagination.total > 0 ? (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          pageSize={pagination.limit}
          itemLabel="manifests"
          onPageChange={setPage}
        />
      ) : null}

      <p className="text-xs text-gray-500">
        Manifests by record creation time (main app Operations → Manifests / traceability).
      </p>
    </AdminReportListChrome>
  );
}

export default function MilkManifestsReportPage() {
  return (
    <Suspense fallback={<ListPageSkeleton title="Milk manifests" filterFields={4} tableRows={10} tableCols={7} />}>
      <MilkManifestsReportInner />
    </Suspense>
  );
}
