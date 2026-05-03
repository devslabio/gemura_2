'use client';

import { useEffect, useState, useMemo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi, type RoleItem } from '@/lib/api/admin';
import { useAuthStore } from '@/store/auth';
import { usePermission } from '@/hooks/usePermission';
import Icon, { faLock, faChevronDown, faChevronUp, faEdit } from '@/app/components/Icon';
import FilterBar, { FilterBarSearch, FilterBarGroup } from '@/app/components/FilterBar';
import Pagination from '@/app/components/Pagination';
import { TableSkeleton } from '@/app/components/SkeletonLoader';

const PAGE_SIZES = [10, 20, 50, 100];

export default function AdminRolesPage() {
  const router = useRouter();
  const { currentAccount } = useAuthStore();
  const { canManageUsers, isAdmin } = usePermission();
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [rolesPage, setRolesPage] = useState(1);
  const [rolesPageSize, setRolesPageSize] = useState(10);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

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
      .getRoles(accountId)
      .then((res) => {
        if (cancelled) return;
        if (res.code === 200 && res.data?.roles) setRoles(res.data.roles);
        else setError(res.message || 'Failed to load roles');
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.response?.data?.message || err?.message || 'Failed to load roles');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAccount?.account_id]);

  const filteredRoles = useMemo(() => {
    if (!search.trim()) return roles;
    const q = search.trim().toLowerCase();
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q),
    );
  }, [roles, search]);

  useEffect(() => {
    setRolesPage(1);
  }, [search]);

  const rolesTotalPages = Math.max(1, Math.ceil(filteredRoles.length / rolesPageSize) || 1);

  useEffect(() => {
    setRolesPage((p) => Math.min(p, rolesTotalPages));
  }, [filteredRoles.length, rolesPageSize, rolesTotalPages]);

  const paginatedRoles = useMemo(() => {
    const start = (rolesPage - 1) * rolesPageSize;
    return filteredRoles.slice(start, start + rolesPageSize);
  }, [filteredRoles, rolesPage, rolesPageSize]);

  const formatPermissionCode = (code: string) =>
    code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-4">
      {/* Breadcrumb - ResolveIT-style */}
      <nav className="text-sm text-gray-600">
        <Link href="/admin/users" className="text-[var(--primary)] hover:underline">
          User Administration
        </Link>
        <span className="mx-2 text-gray-400">/</span>
        <span className="text-gray-900 font-medium">Roles</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles</h1>
        </div>
        <Link
          href="/admin/permissions"
          className="inline-flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 shrink-0"
        >
          <Icon icon={faLock} size="sm" />
          View Permissions
        </Link>
      </div>

      {/* Filters */}
      <FilterBar>
        <FilterBarSearch
          value={search}
          onChange={setSearch}
          placeholder="Search roles by name or description..."
        />
        <FilterBarGroup label="Rows per page">
          <select
            value={rolesPageSize}
            onChange={(e) => {
              setRolesPageSize(Number(e.target.value));
              setRolesPage(1);
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

      {/* Role definitions card */}
      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-800">Role definitions</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Permissions for each role are stored in the database. Use Edit permissions to control menu and API access for everyone with that role.
          </p>
        </div>

        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={8} cols={4} showRowNumbers={false} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-10 py-3 px-4 text-left" aria-label="Expand" />
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Description</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Permissions</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700 w-36">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRoles.map((role) => {
                  const isExpanded = expandedCode === role.code;
                  return (
                    <Fragment key={role.code}>
                      <tr
                        className="border-b border-gray-100 hover:bg-gray-50/80 transition-colors"
                      >
                        <td className="py-2 px-4">
                          <button
                            type="button"
                            onClick={() => setExpandedCode(isExpanded ? null : role.code)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-200/80"
                            aria-label={isExpanded ? 'Collapse' : 'Expand'}
                          >
                            <Icon icon={isExpanded ? faChevronUp : faChevronDown} size="sm" />
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-gray-900">{role.name}</span>
                          <span className="ml-2 text-xs text-gray-500 uppercase">({role.code})</span>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{role.description}</td>
                        <td className="py-3 px-4 text-right">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                            {role.permissionCount} permission{role.permissionCount !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {role.id ? (
                            <Link
                              href={`/admin/roles/${role.id}`}
                              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"
                            >
                              <Icon icon={faEdit} size="sm" />
                              Edit permissions
                            </Link>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50/50">
                          <td colSpan={5} className="py-4 px-4">
                            <div className="pl-8">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                                Permissions for {role.name}
                              </p>
                              <ul className="flex flex-wrap gap-2">
                                {(role.permissions ?? []).length > 0 ? (
                                  (role.permissions ?? []).map((code) => (
                                    <li
                                      key={code}
                                      className="inline-flex px-3 py-1.5 bg-white border border-gray-200 rounded text-gray-700 text-sm"
                                    >
                                      {formatPermissionCode(code)}
                                    </li>
                                  ))
                                ) : (
                                  <li className="text-gray-500 text-sm">No default permissions</li>
                                )}
                              </ul>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {filteredRoles.length === 0 && !error && (
              <div className="py-12 text-center text-gray-500 text-sm">No roles match your search.</div>
            )}
          </div>
        )}
      </div>

      {!loading && filteredRoles.length > 0 && (
        <Pagination
          currentPage={rolesPage}
          totalPages={rolesTotalPages}
          totalItems={filteredRoles.length}
          pageSize={rolesPageSize}
          itemLabel="roles"
          onPageChange={setRolesPage}
        />
      )}
    </div>
  );
}
