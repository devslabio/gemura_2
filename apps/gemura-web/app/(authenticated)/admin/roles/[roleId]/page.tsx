'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { adminApi, type PermissionItem, type RoleItem } from '@/lib/api/admin';
import { useAuthStore } from '@/store/auth';
import { usePermission } from '@/hooks/usePermission';
import Icon, { faArrowLeft } from '@/app/components/Icon';
import FilterBar, { FilterBarSearch } from '@/app/components/FilterBar';
import { useToastStore } from '@/store/toast';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function EditRolePermissionsPage() {
  const router = useRouter();
  const params = useParams();
  const roleId = params.roleId as string;
  const { currentAccount } = useAuthStore();
  const { canManageUsers, isAdmin } = usePermission();
  const toast = useToastStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [role, setRole] = useState<RoleItem | null>(null);
  const [catalog, setCatalog] = useState<PermissionItem[]>([]);
  const [permSearch, setPermSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const applyRoleSelection = useCallback((r: RoleItem, perms: PermissionItem[]) => {
    const codes = new Set(r.permissions ?? []);
    const ids = new Set<string>();
    for (const p of perms) {
      if (p.id && codes.has(p.code)) ids.add(p.id);
    }
    setSelectedIds(ids);
  }, []);

  useEffect(() => {
    if (!canManageUsers() && !isAdmin()) {
      router.push('/dashboard');
      return;
    }
    if (!roleId || !UUID_RE.test(roleId)) {
      setError('Invalid role id.');
      setLoading(false);
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
    Promise.all([adminApi.getRoles(accountId), adminApi.getPermissions(accountId)])
      .then(([rolesRes, permsRes]) => {
        if (cancelled) return;
        if (rolesRes.code !== 200 || !rolesRes.data?.roles) {
          setError(rolesRes.message || 'Failed to load roles');
          return;
        }
        if (permsRes.code !== 200 || !permsRes.data?.permissions) {
          setError(permsRes.message || 'Failed to load permissions');
          return;
        }
        const found = rolesRes.data.roles.find((x) => x.id === roleId);
        if (!found) {
          setError('Role not found.');
          return;
        }
        const permList = permsRes.data.permissions.filter((p): p is PermissionItem & { id: string } =>
          Boolean(p.id),
        );
        setCatalog(permList);
        setRole(found);
        applyRoleSelection(found, permList);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load role');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [roleId, currentAccount?.account_id, canManageUsers, isAdmin, router, applyRoleSelection]);

  const filteredCatalog = useMemo(() => {
    const q = permSearch.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q),
    );
  }, [catalog, permSearch]);

  const grouped = useMemo(() => {
    const map = new Map<string, PermissionItem[]>();
    for (const p of filteredCatalog) {
      const c = p.category || 'General';
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(p);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, items]) => ({ category, items }));
  }, [filteredCatalog]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectCategory = (items: PermissionItem[], select: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const p of items) {
        if (!p.id) continue;
        if (select) next.add(p.id);
        else next.delete(p.id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    const accountId = currentAccount?.account_id;
    if (!accountId || !roleId) return;
    setSaving(true);
    setError('');
    try {
      const res = await adminApi.updatePlatformRole(
        roleId,
        { permission_ids: Array.from(selectedIds) },
        accountId,
      );
      if (res.code === 200 && res.data?.role) {
        setRole(res.data.role);
        applyRoleSelection(res.data.role, catalog);
        toast.success('Permissions saved. Users must log in again to pick up changes.');
        router.push('/admin/roles');
      } else {
        setError(res.message || 'Save failed');
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Save failed');
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!loading && error && !role) {
    return (
      <div className="space-y-4">
        <nav className="text-sm text-gray-600">
          <Link href="/admin/users" className="text-[var(--primary)] hover:underline">
            User Administration
          </Link>
          <span className="mx-2 text-gray-400">/</span>
          <Link href="/admin/roles" className="text-[var(--primary)] hover:underline">
            Roles
          </Link>
          <span className="mx-2 text-gray-400">/</span>
          <span className="text-gray-900 font-medium">Edit</span>
        </nav>
        <div className="bg-red-50 border border-red-200 rounded-sm p-4 text-sm text-red-700">{error}</div>
        <Link href="/admin/roles" className="inline-flex items-center gap-2 text-sm text-[var(--primary)]">
          <Icon icon={faArrowLeft} size="sm" />
          Back to roles
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <nav className="text-sm text-gray-600">
        <Link href="/admin/users" className="text-[var(--primary)] hover:underline">
          User Administration
        </Link>
        <span className="mx-2 text-gray-400">/</span>
        <Link href="/admin/roles" className="text-[var(--primary)] hover:underline">
          Roles
        </Link>
        <span className="mx-2 text-gray-400">/</span>
        <span className="text-gray-900 font-medium">{role?.name ?? 'Edit permissions'}</span>
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Role permissions</h1>
          {role && (
            <p className="text-sm text-gray-600 mt-1">
              <span className="font-medium text-gray-800">{role.name}</span>{' '}
              <span className="text-xs uppercase text-gray-500">({role.code})</span>
              {role.is_system ? (
                <span className="ml-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                  System role — edit carefully
                </span>
              ) : null}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-2 max-w-2xl">
            The operations menu and API checks use these permission codes. Members linked to this platform role
            need to sign out and back in (or refresh their session) after you save.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link
            href="/admin/roles"
            className="inline-flex items-center justify-center h-9 px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="button"
            disabled={saving || loading || !role}
            onClick={() => void handleSave()}
            className="inline-flex items-center justify-center h-9 px-4 text-sm font-medium text-white bg-[var(--primary)] rounded hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save permissions'}
          </button>
        </div>
      </div>

      <FilterBar>
        <FilterBarSearch
          value={permSearch}
          onChange={setPermSearch}
          placeholder="Search permissions by name, code, category…"
        />
      </FilterBar>

      {error && role && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-gray-500 text-sm">Loading…</div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ category, items }) => (
            <div key={category} className="bg-white border border-gray-200 rounded-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-gray-800">{category}</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => selectCategory(items, true)}
                    className="text-xs font-medium text-[var(--primary)] hover:underline"
                  >
                    Select all in section
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => selectCategory(items, false)}
                    className="text-xs font-medium text-gray-600 hover:underline"
                  >
                    Clear section
                  </button>
                </div>
              </div>
              <ul className="divide-y divide-gray-100">
                {items.map((p) => (
                  <li key={p.code} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50/80">
                    <input
                      type="checkbox"
                      id={`perm-${p.code}`}
                      checked={p.id ? selectedIds.has(p.id) : false}
                      onChange={() => p.id && toggle(p.id)}
                      disabled={!p.id}
                      className="mt-1 rounded border-gray-300 shrink-0"
                    />
                    <label htmlFor={`perm-${p.code}`} className="flex-1 min-w-0 cursor-pointer mb-0">
                      <span className="font-medium text-gray-900">{p.name}</span>
                      <span className="block text-xs font-mono text-gray-500 mt-0.5">{p.code}</span>
                      {p.description ? (
                        <span className="block text-sm text-gray-600 mt-1">{p.description}</span>
                      ) : null}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {grouped.length === 0 && (
            <div className="py-12 text-center text-gray-500 text-sm">No permissions match your search.</div>
          )}
        </div>
      )}
    </div>
  );
}
