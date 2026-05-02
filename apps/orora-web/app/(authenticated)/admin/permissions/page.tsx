'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePermission } from '@/hooks/usePermission';
import { adminApi, type PermissionItem } from '@/lib/api/admin';
import { useAuthStore } from '@/store/auth';
import Icon, { faLock } from '@/app/components/Icon';
import FilterBar, { FilterBarGroup, FilterBarSearch } from '@/app/components/FilterBar';
import Pagination from '@/app/components/Pagination';
import Select from '@/app/components/Select';
import { TableSkeleton } from '@/app/components/SkeletonLoader';

const PAGE_SIZES = [10, 20, 50, 100];

export default function AdminPermissionsPage() {
  const router = useRouter();
  const { canManageUsers, isAdmin } = usePermission();
  const { currentAccount } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [permSearch, setPermSearch] = useState('');
  const [permPage, setPermPage] = useState(1);
  const [permPageSize, setPermPageSize] = useState(10);

  useEffect(() => {
    if (!canManageUsers() && !isAdmin()) {
      router.push('/dashboard');
      return;
    }
    const accountId = currentAccount?.account_id;
    if (!accountId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    adminApi
      .getPermissions(accountId)
      .then((res) => {
        if (cancelled) return;
        if (res.code === 200 && res.data?.permissions) setPermissions(res.data.permissions);
        else setError(res.message || 'Failed to load permissions');
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.response?.data?.message || err?.message || 'Failed to load permissions');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAccount?.account_id]);

  const categories = Array.from(new Set(permissions.map((p) => p.category).filter(Boolean))).sort() as string[];

  const filtered = useMemo(() => {
    let list = categoryFilter ? permissions.filter((p) => p.category === categoryFilter) : permissions;
    const q = permSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [permissions, categoryFilter, permSearch]);

  useEffect(() => {
    setPermPage(1);
  }, [categoryFilter, permSearch]);

  const permTotalPages = Math.max(1, Math.ceil(filtered.length / permPageSize) || 1);

  useEffect(() => {
    setPermPage((p) => Math.min(p, permTotalPages));
  }, [filtered.length, permPageSize, permTotalPages]);

  const paginatedPermissions = useMemo(() => {
    const start = (permPage - 1) * permPageSize;
    return filtered.slice(start, start + permPageSize);
  }, [filtered, permPage, permPageSize]);

  return (
    <div className="space-y-4">
      {/* Breadcrumb - ResolveIT-style */}
      <nav className="text-sm text-gray-600">
        <Link href="/admin/users" className="text-[var(--primary)] hover:underline">
          User Administration
        </Link>
        <span className="mx-2 text-gray-400">/</span>
        <span className="text-gray-900 font-medium">Permissions</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Permissions</h1>
        </div>
        <Link
          href="/admin/roles"
          className="inline-flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 shrink-0"
        >
          <Icon icon={faLock} size="sm" />
          View Roles
        </Link>
      </div>

      {/* Filters */}
      <FilterBar>
        <FilterBarSearch value={permSearch} onChange={setPermSearch} placeholder="Search by name, code, or description..." />
        <FilterBarGroup label="Category">
          <Select
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={categories.map((cat) => ({ value: cat, label: cat }))}
            placeholder="All categories"
            allowEmpty
            className="w-full"
          />
        </FilterBarGroup>
        <FilterBarGroup label="Rows per page">
          <select
            value={permPageSize}
            onChange={(e) => {
              setPermPageSize(Number(e.target.value));
              setPermPage(1);
            }}
            className="input h-9 min-h-[2.25rem] !py-1.5 !px-3 text-sm w-full text-gray-900"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </FilterBarGroup>
      </FilterBar>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Permission definitions card */}
      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-800">Permission definitions</h2>
          <p className="text-xs text-gray-500 mt-0.5">Each permission can be granted to users via their role or by direct assignment when editing a user.</p>
        </div>

        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={12} cols={4} showRowNumbers={false} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Permission</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Description</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Category</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Roles with access</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPermissions.map((perm) => (
                  <tr key={perm.code} className="border-b border-gray-100 hover:bg-gray-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-900">{perm.name}</span>
                      <span className="block text-xs text-gray-500 font-mono mt-0.5">{perm.code}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{perm.description}</td>
                    <td className="py-3 px-4">
                      {perm.category ? (
                        <span className="inline-flex px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs font-medium">
                          {perm.category}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {perm.roles.length > 0 ? (
                          perm.roles.map((r) => (
                            <span
                              key={r.code}
                              className="inline-flex px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-medium"
                            >
                              {r.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400 text-xs">No default roles</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && !error && (
              <div className="py-12 text-center text-gray-500 text-sm">
                {categoryFilter || permSearch.trim() ? 'No permissions match your filters.' : 'No permissions found.'}
              </div>
            )}
          </div>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <Pagination
          currentPage={permPage}
          totalPages={permTotalPages}
          totalItems={filtered.length}
          pageSize={permPageSize}
          itemLabel="permissions"
          onPageChange={setPermPage}
        />
      )}
    </div>
  );
}
