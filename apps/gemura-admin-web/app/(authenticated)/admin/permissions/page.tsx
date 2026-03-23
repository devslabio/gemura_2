'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi, type PermissionItem } from '@/lib/api/admin';
import { useAuthStore } from '@/store/auth';
import { usePermission } from '@/hooks/usePermission';
import Icon, { faLock } from '@/app/components/Icon';
import FilterBar, { FilterBarGroup } from '@/app/components/FilterBar';
import { TableSkeleton } from '@/app/components/SkeletonLoader';

export default function AdminPermissionsPage() {
  const router = useRouter();
  const { currentAccount } = useAuthStore();
  const { canManageUsers, isAdmin } = usePermission();
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

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
    adminApi.getPermissions(accountId).then((res) => {
      if (!cancelled) {
        if (res.code === 200 && res.data?.permissions) setPermissions(res.data.permissions);
        else setError(res.message || 'Failed to load permissions');
      }
    }).catch((err: any) => !cancelled && setError(err?.response?.data?.message || err?.message || 'Failed to load permissions'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // Important: do NOT include canManageUsers/isAdmin in deps
    // Those are unstable function values, and would cause the effect to re-run and flicker.
  }, [currentAccount?.account_id, router]);

  const categories = Array.from(new Set(permissions.map((p) => p.category).filter(Boolean))).sort() as string[];
  const filtered = categoryFilter ? permissions.filter((p) => p.category === categoryFilter) : permissions;

  return (
    <div className="space-y-4">
      <nav className="text-sm text-gray-600">
        <Link href="/admin/users" className="text-[var(--primary)] hover:underline">User Administration</Link>
        <span className="mx-2 text-gray-400">/</span>
        <span className="text-gray-900 font-medium">Permissions</span>
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Permissions</h1>
        <Link href="/admin/roles" className="inline-flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 shrink-0">
          <Icon icon={faLock} size="sm" />
          View Roles
        </Link>
      </div>

      <FilterBar>
        <FilterBarGroup label="Category">
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="input h-9 !py-1.5 !px-3 text-sm w-full text-gray-900">
            <option value="">All categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </FilterBarGroup>
      </FilterBar>

      {error && <div className="bg-red-50 border border-red-200 rounded-sm p-4 text-sm text-red-600">{error}</div>}

      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-800">Permission definitions</h2>
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
                {filtered.map((perm) => (
                  <tr key={perm.code} className="border-b border-gray-100 hover:bg-gray-50/80 transition-colors">
                    <td className="py-3 px-4"><span className="font-medium text-gray-900">{perm.name}</span><span className="block text-xs text-gray-500 font-mono mt-0.5">{perm.code}</span></td>
                    <td className="py-3 px-4 text-gray-600">{perm.description}</td>
                    <td className="py-3 px-4">{perm.category ? <span className="inline-flex px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs font-medium">{perm.category}</span> : <span className="text-gray-400">—</span>}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {perm.roles.length > 0 ? (
                          perm.roles.map((r) => <span key={r.code} className="inline-flex px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-medium">{r.name}</span>)
                        ) : (
                          <span className="text-gray-400 text-xs">No default roles</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && !error && <div className="py-12 text-center text-gray-500 text-sm">{categoryFilter ? 'No permissions in this category.' : 'No permissions found.'}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

