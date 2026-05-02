'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePermission } from '@/hooks/usePermission';
import { adminApi, UserListItem, UsersResponse } from '@/lib/api/admin';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import DataTable, { TableColumn } from '@/app/components/DataTable';
import Pagination from '@/app/components/Pagination';
import FilterBar, { FilterBarGroup, FilterBarSearch, FilterBarActions } from '@/app/components/FilterBar';
import Icon, { faPlus, faEye } from '@/app/components/Icon';
import Select from '@/app/components/Select';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';

const ROLE_OPTIONS = [
  { value: '', label: 'All Roles' },
  { value: 'system_admin', label: 'System admin' },
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

const PAGE_SIZES = [10, 20, 50, 100];

export default function UsersPage() {
  const router = useRouter();
  const { canManageUsers, isAdmin } = usePermission();
  const { currentAccount } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState('');
  const hasLoadedRef = useRef(false);
  const isLoadingRef = useRef(false);
  const filtersRef = useRef({ search, statusFilter, roleFilter, pageSize });
  const accountIdRef = useRef(currentAccount?.account_id);

  useEffect(() => {
    filtersRef.current = { search, statusFilter, roleFilter, pageSize };
  }, [search, statusFilter, roleFilter, pageSize]);

  useEffect(() => {
    accountIdRef.current = currentAccount?.account_id;
  }, [currentAccount?.account_id]);

  const loadUsers = useCallback(async (page: number = 1, overrides?: { limit?: number }) => {
    if (isLoadingRef.current) return;
    const { search: s, statusFilter: st, roleFilter: r, pageSize: lim } = filtersRef.current;
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
        (st || r) ? { ...(st ? { status: st } : {}), ...(r ? { role: r } : {}) } : undefined,
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

  // Initial load and permission check (run once; canManageUsers/isAdmin are stable in behavior)
  useEffect(() => {
    if (!canManageUsers() && !isAdmin()) {
      router.push('/dashboard');
      return;
    }
    if (!hasLoadedRef.current && !isLoadingRef.current) {
      loadUsers(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    loadUsers(1);
  };

  const onSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') applyFilters();
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setRoleFilter('');
    setPageSize(10);
    setPagination((prev) => ({ ...prev, page: 1 }));
    filtersRef.current = { search: '', statusFilter: '', roleFilter: '', pageSize: 10 };
    loadUsers(1);
  };

  if (loading && users.length === 0) {
    return (
      <ListPageSkeleton title="Users" filterFields={3} tableRows={10} tableCols={7} />
    );
  }

  const columns: TableColumn<UserListItem>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
    },
    {
      key: 'phone',
      label: 'Phone',
      sortable: true,
    },
    {
      key: 'role',
      label: 'Role',
      sortable: true,
      render: (value) => (
        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium capitalize">
          {value || 'N/A'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          value === 'active' 
            ? 'bg-green-100 text-green-700' 
            : 'bg-red-100 text-red-700'
        }`}>
          {value}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <Link
          href={`/admin/users/${row.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-[var(--primary)] transition-colors"
          title="View details"
        >
          <Icon icon={faEye} size="sm" />
          View
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        </div>
        <Link href="/admin/users/new" className="btn btn-primary">
          <Icon icon={faPlus} size="sm" className="mr-2" />
          Add User
        </Link>
      </div>


      {/* Filters (ResolveIT-style bar) */}
      <FilterBar>
        <FilterBarSearch
          value={search}
          onChange={setSearch}
          placeholder="Search by name, email, or phone..."
          onKeyDown={onSearchKeyDown}
        />
        <FilterBarGroup label="Role">
          <Select
            value={roleFilter}
            onChange={(v) => {
              setRoleFilter(v);
              setPagination((prev) => ({ ...prev, page: 1 }));
              filtersRef.current.roleFilter = v;
              loadUsers(1);
            }}
            options={ROLE_OPTIONS.filter((o) => o.value !== '')}
            placeholder="All Roles"
            allowEmpty
            className="w-full"
          />
        </FilterBarGroup>
        <FilterBarGroup label="Status">
          <Select
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setPagination((prev) => ({ ...prev, page: 1 }));
              filtersRef.current.statusFilter = v;
              loadUsers(1);
            }}
            options={STATUS_OPTIONS.filter((o) => o.value !== '')}
            placeholder="All Status"
            allowEmpty
            className="w-full"
          />
        </FilterBarGroup>
        <FilterBarGroup label="Page Size">
          <Select
            value={String(pageSize)}
            onChange={(v) => {
              const val = Number(v);
              setPageSize(val);
              filtersRef.current.pageSize = val;
              setPagination((prev) => ({ ...prev, page: 1 }));
              loadUsers(1, { limit: val });
            }}
            options={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
            placeholder="Page size"
            className="w-full"
          />
        </FilterBarGroup>
        <FilterBarActions onClear={clearFilters} />
      </FilterBar>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Users Table */}
      <DataTable
        data={users}
        columns={columns}
        loading={loading}
        emptyMessage="No users found"
      />

      {/* Pagination */}
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
