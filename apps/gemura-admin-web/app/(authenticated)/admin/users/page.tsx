'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { usePermission } from '@/hooks/usePermission';
import { adminApi, UserListItem, UsersResponse } from '@/lib/api/admin';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import DataTable, { TableColumn } from '@/app/components/DataTable';
import Pagination from '@/app/components/Pagination';
import FilterBar, { FilterBarGroup, FilterBarSearch, FilterBarActions } from '@/app/components/FilterBar';
import Icon, { faPlus, faEye, faDownload } from '@/app/components/Icon';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';

const ROLE_OPTIONS = [
  { value: '', label: 'All Roles' },
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'collector', label: 'Collector' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'agent', label: 'Agent' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'customer', label: 'Customer' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const ACCOUNT_TYPE_OPTIONS = [
  { value: '', label: 'All Account Types' },
  { value: 'mcc', label: 'MCC' },
  { value: 'agent', label: 'Agent' },
  { value: 'collector', label: 'Collector' },
  { value: 'veterinarian', label: 'Veterinarian' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'customer', label: 'Customer' },
  { value: 'farmer', label: 'Farmer' },
  { value: 'owner', label: 'Owner' },
];

const PAGE_SIZES = [10, 20, 50, 100];

export default function UsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentAccount } = useAuthStore();
  const { canManageUsers, isAdmin } = usePermission();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [error, setError] = useState('');
  const hasLoadedRef = useRef(false);
  const isLoadingRef = useRef(false);
  const filtersRef = useRef({ search, statusFilter, roleFilter, accountTypeFilter, pageSize, sortBy: 'created_at', sortDir: 'desc' as 'asc' | 'desc' });
  const accountIdRef = useRef(currentAccount?.account_id);
  const initializedFromQueryRef = useRef(false);
  const skipNextSearchDebounceRef = useRef(false);

  /** Keep filters + sort in sync with the ref; search is driven by debounce/URL/clear only. */
  useEffect(() => {
    filtersRef.current = {
      ...filtersRef.current,
      statusFilter,
      roleFilter,
      accountTypeFilter,
      pageSize,
      sortBy,
      sortDir,
    };
  }, [statusFilter, roleFilter, accountTypeFilter, pageSize, sortBy, sortDir]);

  useEffect(() => {
    accountIdRef.current = currentAccount?.account_id;
  }, [currentAccount?.account_id]);

  const loadUsers = useCallback(async (page: number = 1, overrides?: { limit?: number }) => {
    if (isLoadingRef.current) return;
    const { search: s, statusFilter: st, roleFilter: r, accountTypeFilter: at, pageSize: lim, sortBy: sb, sortDir: sd } = filtersRef.current;
    const limit = overrides?.limit ?? lim;

    try {
      isLoadingRef.current = true;
      setLoading(true);
      setError('');
      const response: UsersResponse = await adminApi.getUsers(
        page,
        limit,
        s?.trim() || undefined,
        accountIdRef.current,
        st || r || at
          ? {
              ...(st ? { status: st } : {}),
              ...(r ? { role: r } : {}),
              ...(at ? { account_type: at } : {}),
            }
          : undefined,
        { sortBy: sb, sortDir: sd },
      );

      if (response && response.code === 200 && response.data) {
        const usersArray = Array.isArray(response.data.users) ? response.data.users : [];
        const paginationData = response.data.pagination || { page: 1, limit, total: 0, totalPages: 0 };
        setUsers(usersArray);
        setPagination(paginationData);
        hasLoadedRef.current = true;
      } else {
        setError(response?.message || 'Failed to load users');
        setUsers([]);
        setPagination({ page: 1, limit, total: 0, totalPages: 0 });
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || 'Failed to load users';
      setError(errorMessage);
      setUsers([]);
      setPagination((prev) => ({ ...prev, total: 0, totalPages: 0 }));
      useToastStore.getState().error(errorMessage);
    } finally {
      isLoadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canManageUsers() && !isAdmin()) {
      router.push('/dashboard');
      return;
    }
    if (!hasLoadedRef.current && !isLoadingRef.current) {
      if (!initializedFromQueryRef.current) {
        const nextSearch = searchParams.get('search') ?? '';
        const nextStatus = searchParams.get('status') ?? '';
        const nextRole = searchParams.get('role') ?? '';
        const nextAccountType = searchParams.get('account_type') ?? '';
        const limitRaw = Number(searchParams.get('limit'));
        const nextLimit = PAGE_SIZES.includes(limitRaw) ? limitRaw : pageSize;

        initializedFromQueryRef.current = true;
        skipNextSearchDebounceRef.current = true;
        setSearch(nextSearch);
        setStatusFilter(nextStatus);
        setRoleFilter(nextRole);
        setAccountTypeFilter(nextAccountType);
        setPageSize(nextLimit);
        setPagination((prev) => ({ ...prev, page: 1, limit: nextLimit }));
        filtersRef.current = {
          search: nextSearch,
          statusFilter: nextStatus,
          roleFilter: nextRole,
          accountTypeFilter: nextAccountType,
          pageSize: nextLimit,
          sortBy: 'created_at',
          sortDir: 'desc',
        };
        loadUsers(1, { limit: nextLimit });
        return;
      }

      loadUsers(1);
    }
  }, [canManageUsers, isAdmin, loadUsers, router, searchParams, pageSize]);

  useEffect(() => {
    if (!canManageUsers() && !isAdmin()) return;
    if (!initializedFromQueryRef.current) return;
    if (skipNextSearchDebounceRef.current) {
      skipNextSearchDebounceRef.current = false;
      return;
    }
    if (!hasLoadedRef.current) return;

    const q = search.trim();
    const delay = setTimeout(() => {
      filtersRef.current = { ...filtersRef.current, search: q };
      setPagination((prev) => ({ ...prev, page: 1 }));
      loadUsers(1);
    }, 380);

    return () => clearTimeout(delay);
  }, [search, canManageUsers, isAdmin, loadUsers]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const { search: s, statusFilter: st, roleFilter: r, accountTypeFilter: at } = filtersRef.current;
      const blob = await adminApi.exportUsersCsv(accountIdRef.current, {
        search: s?.trim() || undefined,
        status: st || undefined,
        role: r || undefined,
        account_type: at || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      useToastStore.getState().error(err?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleSort = (key: string, dir: 'asc' | 'desc') => {
    setSortBy(key);
    setSortDir(dir);
    filtersRef.current = { ...filtersRef.current, sortBy: key, sortDir: dir };
    setPagination((prev) => ({ ...prev, page: 1 }));
    loadUsers(1);
  };

  const clearFilters = () => {
    skipNextSearchDebounceRef.current = true;
    setSearch('');
    setStatusFilter('');
    setRoleFilter('');
    setAccountTypeFilter('');
    setPageSize(10);
    setSortBy('created_at');
    setSortDir('desc');
    setPagination((prev) => ({ ...prev, page: 1 }));
    filtersRef.current = { search: '', statusFilter: '', roleFilter: '', accountTypeFilter: '', pageSize: 10, sortBy: 'created_at', sortDir: 'desc' };
    loadUsers(1);
  };

  if (loading && users.length === 0 && !hasLoadedRef.current) {
    return <ListPageSkeleton title="Users" filterFields={4} tableRows={10} tableCols={13} />;
  }

  const columns: TableColumn<UserListItem>[] = [
    { key: 'name', label: 'Name', sortable: 'server' },
    { key: 'email', label: 'Email', sortable: 'server' },
    { key: 'phone', label: 'Phone', sortable: 'server' },
    {
      key: 'account_type',
      label: 'Account Type',
      sortable: 'server',
      render: (value) => (
        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium capitalize">
          {value || 'N/A'}
        </span>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (value) => <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium capitalize">{value || 'N/A'}</span>,
    },
    {
      key: 'suppliers',
      label: 'Suppliers',
      sortable: true,
      render: (_, row) => row.stats?.suppliers ?? 0,
    },
    {
      key: 'customers',
      label: 'Customers',
      sortable: true,
      render: (_, row) => row.stats?.customers ?? 0,
    },
    {
      key: 'sales',
      label: 'Sales',
      sortable: true,
      render: (_, row) => row.stats?.sales ?? 0,
    },
    {
      key: 'collections',
      label: 'Collections',
      sortable: true,
      render: (_, row) => row.stats?.collections ?? 0,
    },
    {
      key: 'farms',
      label: 'Farms',
      sortable: true,
      render: (_, row) => row.stats?.farms ?? 0,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: 'server',
      render: (value) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${value === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {value}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: 'server',
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <Link href={`/admin/users/${row.id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-[var(--primary)] transition-colors">
          <Icon icon={faEye} size="sm" />
          View
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn btn-secondary"
          >
            <Icon icon={faDownload} size="sm" className="mr-2" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <Link href="/admin/users/new" className="btn btn-primary">
            <Icon icon={faPlus} size="sm" className="mr-2" />
            Add User
          </Link>
        </div>
      </div>

      <FilterBar>
        <FilterBarSearch value={search} onChange={setSearch} placeholder="Search by name, email, or phone..." />
        <FilterBarGroup label="Role">
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
              filtersRef.current.roleFilter = e.target.value;
              loadUsers(1);
            }}
            className="input h-9 !py-1.5 !px-3 text-sm w-full text-gray-900"
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FilterBarGroup>
        <FilterBarGroup label="Account Type">
          <select
            value={accountTypeFilter}
            onChange={(e) => {
              setAccountTypeFilter(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
              filtersRef.current.accountTypeFilter = e.target.value;
              loadUsers(1);
            }}
            className="input h-9 !py-1.5 !px-3 text-sm w-full text-gray-900"
          >
            {ACCOUNT_TYPE_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FilterBarGroup>
        <FilterBarGroup label="Status">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
              filtersRef.current.statusFilter = e.target.value;
              loadUsers(1);
            }}
            className="input h-9 !py-1.5 !px-3 text-sm w-full text-gray-900"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FilterBarGroup>
        <FilterBarGroup label="Page Size">
          <select
            value={pageSize}
            onChange={(e) => {
              const val = Number(e.target.value);
              setPageSize(val);
              filtersRef.current.pageSize = val;
              setPagination((prev) => ({ ...prev, page: 1 }));
              loadUsers(1, { limit: val });
            }}
            className="input h-9 !py-1.5 !px-3 text-sm w-full text-gray-900"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </FilterBarGroup>
        <FilterBarActions onClear={clearFilters} />
      </FilterBar>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {loading && users.length > 0 && (
        <p className="text-xs text-gray-500" aria-live="polite">
          Updating results…
        </p>
      )}

      <DataTable
        data={users}
        columns={columns}
        loading={loading && users.length === 0}
        emptyMessage="No users found"
        onSort={handleSort}
        activeSortKey={sortBy}
        activeSortDir={sortDir}
      />

      {pagination.total > 0 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          pageSize={pagination.limit}
          itemLabel="users"
          onPageChange={(page) => loadUsers(page)}
        />
      )}
    </div>
  );
}
