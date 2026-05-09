'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { accountsApi, type Account } from '@/lib/api/accounts';
import { adminApi, type TenantAccountRow } from '@/lib/api/admin';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import { usePermission } from '@/hooks/usePermission';
import DataTable, { TableColumn } from '@/app/components/DataTable';
import Pagination from '@/app/components/Pagination';
import FilterBar, { FilterBarGroup, FilterBarSearch, FilterBarApply, FilterBarActions, FilterBarExport } from '@/app/components/FilterBar';
import Icon, { faUserShield, faCheckCircle, faArrowsUpDown, faSpinner, faEye } from '@/app/components/Icon';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';

type Row = TenantAccountRow & { membership?: Account };

const PAGE_SIZES = [10, 20, 50, 100] as const;

export default function AccountsPage() {
  const router = useRouter();
  const { setCurrentAccount, currentAccount } = useAuthStore();
  const { canManageUsers, isAdmin } = usePermission();
  const allowed = canManageUsers() || isAdmin();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [switching, setSwitching] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const [accountType, setAccountType] = useState<'tenant' | 'branch' | 'admin' | 'all'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });

  const adminAccountId = currentAccount?.account_id;

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError('');
    try {
      const [platformRes, mineRes] = await Promise.all([
        adminApi.listTenantAccountsForAdmin(adminAccountId, {
          page,
          limit: pageSize,
          search: searchApplied.trim() || undefined,
          account_type: accountType,
        }),
        accountsApi.getUserAccounts(),
      ]);

      const membershipById = new Map<string, Account>();
      if (mineRes.code === 200 && mineRes.data?.accounts) {
        for (const a of mineRes.data.accounts) {
          membershipById.set(a.account_id, a);
        }
      }

      if (platformRes.code === 200 && platformRes.data) {
        setPagination(platformRes.data.pagination);
        setRows(
          platformRes.data.rows.map((r) => ({
            ...r,
            membership: membershipById.get(r.id),
          })),
        );
      } else {
        setError(platformRes.message || 'Failed to load accounts');
        setRows([]);
      }
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
          (err as { message?: string })?.message ||
          'Failed to load accounts',
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [allowed, adminAccountId, page, pageSize, searchApplied, accountType]);

  useEffect(() => {
    if (!allowed) {
      router.replace('/dashboard');
      return;
    }
    load();
  }, [allowed, load, router]);

  const handleApplySearch = () => {
    setSearchApplied(searchInput);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setSearchApplied('');
    setAccountType('all');
    setPage(1);
  };

  const handleSwitchAccount = useCallback(
    async (accountId: string) => {
      if (switching) return;
      try {
        setSwitching(accountId);
        const response = await accountsApi.switchAccount({ account_id: accountId });
        if (response.code === 200) {
          const newAccount = response.data.accounts.find((acc) => acc.account_id === accountId);
          if (newAccount) setCurrentAccount(newAccount);
          useToastStore.getState().success('Account switched successfully!');
          await load();
        } else {
          setError(response.message || 'Failed to switch account');
        }
      } catch (err: unknown) {
        setError(
          (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
            (err as { message?: string })?.message ||
            'Failed to switch account.',
        );
      } finally {
        setSwitching(null);
      }
    },
    [switching, setCurrentAccount, load],
  );

  const columns: TableColumn<Row>[] = useMemo(
    () => [
      {
        key: 'name',
        label: 'Account',
        render: (_v, row) => (
          <div>
            <div className="font-medium text-gray-900">{row.name}</div>
            <div className="text-xs text-gray-500">{row.code || row.id}</div>
          </div>
        ),
      },
      {
        key: 'type',
        label: 'Type',
        render: (v) => <span className="capitalize text-gray-900">{String(v)}</span>,
      },
      {
        key: 'status',
        label: 'Status',
        render: (value) => (
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${value === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}
          >
            {String(value)}
          </span>
        ),
      },
      {
        key: 'operational_location_label',
        label: 'Location',
        render: (v) => <span className="text-sm text-gray-700">{(v as string) || '—'}</span>,
      },
      {
        key: 'membership',
        label: 'Your role',
        render: (_v, row) =>
          row.membership ? (
            <div className="flex items-center">
              <Icon icon={faUserShield} size="sm" className="mr-2 text-gray-400" />
              <span className="capitalize text-gray-900">{row.membership.role || '—'}</span>
            </div>
          ) : (
            <span className="text-sm text-gray-400">—</span>
          ),
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (_, row) => (
          <div className="flex items-center gap-2">
            {row.membership && !row.membership.is_default && (
              <button
                type="button"
                onClick={() => handleSwitchAccount(row.id)}
                disabled={switching === row.id}
                className="p-1.5 text-gray-600 hover:text-[var(--primary)] transition-colors disabled:opacity-50"
                title="Switch session to this account"
              >
                {switching === row.id ? <Icon icon={faSpinner} size="sm" spin /> : <Icon icon={faArrowsUpDown} size="sm" />}
              </button>
            )}
            {row.membership?.is_default && (
              <span className="text-xs text-green-600 flex items-center gap-1" title="Current default account">
                <Icon icon={faCheckCircle} size="sm" /> Default
              </span>
            )}
            <Link href={`/admin/accounts/${row.id}`} className="p-1.5 text-gray-600 hover:text-[var(--primary)] transition-colors" title="View details">
              <Icon icon={faEye} size="sm" />
            </Link>
          </div>
        ),
      },
    ],
    [switching, handleSwitchAccount],
  );

  if (!allowed) return null;

  if (loading && rows.length === 0) {
    return <ListPageSkeleton title="Accounts" filterFields={4} tableRows={10} tableCols={6} />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
        <p className="text-sm text-gray-600 mt-1 max-w-2xl">
          All platform accounts (tenants, branches, admin). Location comes from operational geography when set. Use{' '}
          <Link href="/admin/regional-supervision" className="text-[var(--primary)] hover:underline">
            Regional supervision
          </Link>{' '}
          to assign village-level placement.
        </p>
      </div>

      <FilterBar>
        <FilterBarGroup label="Search">
          <FilterBarSearch
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Name or code"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleApplySearch();
            }}
          />
        </FilterBarGroup>
        <FilterBarGroup label="Account type">
          <select
            className="w-full min-h-[36px] rounded-sm border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white"
            value={accountType}
            onChange={(e) => {
              setAccountType(e.target.value as typeof accountType);
              setPage(1);
            }}
          >
            <option value="all">All</option>
            <option value="tenant">Tenant</option>
            <option value="branch">Branch</option>
            <option value="admin">Admin</option>
          </select>
        </FilterBarGroup>
        <FilterBarGroup label="Page size">
          <select
            className="w-full min-h-[36px] rounded-sm border border-gray-300 px-3 py-2 text-sm"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </FilterBarGroup>
        <FilterBarApply onApply={handleApplySearch} />
        <FilterBarActions onClear={handleClearFilters} />
        <FilterBarExport<TenantAccountRow>
          data={rows.map(({ membership: _, ...r }) => r)}
          exportFilename={`platform-accounts-page-${pagination.page}`}
          disabled={loading || rows.length === 0}
          exportColumns={[
            { key: 'name', label: 'Name' },
            { key: 'code', label: 'Code' },
            { key: 'type', label: 'Type' },
            { key: 'status', label: 'Status' },
            { key: 'operational_location_label', label: 'Location' },
          ]}
        />
      </FilterBar>

      {error ? <div className="bg-red-50 border border-red-200 rounded-sm p-4 text-sm text-red-600">{error}</div> : null}

      {loading && rows.length > 0 ? (
        <p className="text-xs text-gray-500" aria-live="polite">
          Updating…
        </p>
      ) : null}

      <DataTable columns={columns} data={rows} loading={loading && rows.length === 0} emptyMessage="No accounts found." showRowNumbers />

      {pagination.total > 0 ? (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          pageSize={pagination.limit}
          itemLabel="accounts"
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}
