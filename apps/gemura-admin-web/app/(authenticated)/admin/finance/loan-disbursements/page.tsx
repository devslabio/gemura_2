'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import PlatformDrilldownShell from '@/app/components/admin/PlatformDrilldownShell';
import DataTable, { TableColumn } from '@/app/components/DataTable';
import Pagination from '@/app/components/Pagination';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';
import { adminApi, type PlatformLoanRow } from '@/lib/api/admin';
import { useAuthStore } from '@/store/auth';
import { usePermission } from '@/hooks/usePermission';

function formatRf(n: number) {
  return `RF ${new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(n)}`;
}

export default function LoanDisbursementsReportPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { currentAccount } = useAuthStore();
  const { canViewDashboard, canManageUsers, isAdmin } = usePermission();
  const allowed = canViewDashboard() || canManageUsers() || isAdmin();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PlatformLoanRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [error, setError] = useState('');

  const apiParams = useMemo(() => {
    const page = Math.max(1, Number(searchParams.get('page') || 1) || 1);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit') || 25) || 25));
    const date_from = searchParams.get('date_from') ?? undefined;
    const date_to = searchParams.get('date_to') ?? undefined;
    const tzRaw = searchParams.get('tz_offset_minutes');
    const tzParsed = tzRaw !== null && tzRaw !== '' ? Number.parseInt(tzRaw, 10) : NaN;
    const tz_offset_minutes = Number.isFinite(tzParsed) ? tzParsed : undefined;
    return { page, limit, date_from, date_to, tz_offset_minutes };
  }, [searchParams.toString()]);

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

  const onPageChange = (page: number) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set('page', String(page));
    router.push(`${pathname}?${p.toString()}`);
  };

  const backHref = useMemo(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete('page');
    const s = p.toString();
    return `/admin/dashboard/overview${s ? `?${s}` : ''}`;
  }, [searchParams]);

  const columns: TableColumn<PlatformLoanRow>[] = [
    {
      key: 'disbursement_date',
      label: 'Disbursed',
      render: (v) => new Date(v as string).toLocaleDateString(),
    },
    { key: 'status', label: 'Status' },
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
    return (
      <PlatformDrilldownShell title="Loan disbursements" backHref={backHref}>
        <ListPageSkeleton title="" filterFields={0} tableRows={8} tableCols={5} />
      </PlatformDrilldownShell>
    );
  }

  return (
    <PlatformDrilldownShell
      title="Loan disbursements (period)"
      periodLabel="Loans with disbursement date in the selected dashboard window."
      backHref={backHref}
    >
      {error ? (
        <div className="rounded-sm border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{error}</div>
      ) : null}
      <div className="overflow-x-auto rounded-sm border border-gray-200 bg-white">
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          showRowNumbers
          emptyMessage="No disbursements in this period."
        />
      </div>
      <Pagination
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        totalItems={pagination.total}
        pageSize={pagination.limit}
        itemLabel="loans"
        onPageChange={onPageChange}
      />
    </PlatformDrilldownShell>
  );
}
