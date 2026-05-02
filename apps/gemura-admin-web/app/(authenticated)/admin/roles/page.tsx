'use client';

import { useEffect, useState, useMemo, Fragment, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi, type RoleItem, type PermissionItem } from '@/lib/api/admin';
import { useAuthStore } from '@/store/auth';
import { usePermission } from '@/hooks/usePermission';
import Icon, { faLock, faChevronDown, faChevronUp, faPlus, faEdit, faTrash } from '@/app/components/Icon';
import FilterBar, { FilterBarSearch } from '@/app/components/FilterBar';
import { TableSkeleton } from '@/app/components/SkeletonLoader';
import Modal from '@/app/components/Modal';

type RoleFormState = {
  name: string;
  slug: string;
  description: string;
  permissionIds: Set<string>;
  is_active: boolean;
  is_assignable: boolean;
};

const emptyForm = (): RoleFormState => ({
  name: '',
  slug: '',
  description: '',
  permissionIds: new Set(),
  is_active: true,
  is_assignable: true,
});

export default function AdminRolesPage() {
  const router = useRouter();
  const { currentAccount } = useAuthStore();
  const { canManageUsers, isAdmin } = usePermission();
  const accountId = currentAccount?.account_id;

  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permCatalog, setPermCatalog] = useState<PermissionItem[]>([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RoleItem | null>(null);
  const [form, setForm] = useState<RoleFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadAll = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError('');
    try {
      const [rRes, pRes] = await Promise.all([
        adminApi.getRoles(accountId),
        adminApi.getPermissions(accountId),
      ]);
      if (rRes.code === 200 && rRes.data?.roles) setRoles(rRes.data.roles);
      else setError(rRes.message || 'Failed to load roles');
      if (pRes.code === 200 && pRes.data?.permissions) setPermCatalog(pRes.data.permissions);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        'Failed to load roles';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (!canManageUsers() && !isAdmin()) {
      router.push('/dashboard');
      return;
    }
    if (!accountId) {
      setLoading(false);
      return;
    }
    void loadAll();
    // canManageUsers / isAdmin are intentionally omitted — unstable refs would refetch in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gate runs once per accountId
  }, [accountId, router, loadAll]);

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

  const formatPermissionCode = (code: string) => code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const permissionsByCategory = useMemo(() => {
    const map = new Map<string, PermissionItem[]>();
    for (const p of permCatalog) {
      const cat = p.category || 'General';
      const list = map.get(cat) ?? [];
      list.push(p);
      map.set(cat, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [permCatalog]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (role: RoleItem) => {
    if (!role.id) {
      setFormError('This role has no id (run DB migration / restart API).');
      return;
    }
    const ids = new Set<string>();
    for (const code of role.permissions ?? []) {
      const row = permCatalog.find((p) => p.code === code);
      if (row?.id) ids.add(row.id);
    }
    setEditing(role);
    setForm({
      name: role.name,
      slug: role.code,
      description: role.description || '',
      permissionIds: ids,
      is_active: role.is_active !== false,
      is_assignable: role.is_assignable !== false,
    });
    setFormError('');
    setModalOpen(true);
  };

  const togglePerm = (id: string) => {
    setForm((prev) => {
      const next = new Set(prev.permissionIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, permissionIds: next };
    });
  };

  const submitModal = async () => {
    if (!accountId) return;
    const name = form.name.trim();
    if (!name) {
      setFormError('Name is required.');
      return;
    }
    const permission_ids = [...form.permissionIds];
    if (permission_ids.length === 0) {
      setFormError('Select at least one permission.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editing?.id) {
        const res = await adminApi.updatePlatformRole(
          editing.id,
          {
            name,
            ...(!editing.is_system ? { slug: form.slug.trim() || undefined } : {}),
            description: form.description.trim() || null,
            permission_ids,
            is_active: form.is_active,
            is_assignable: form.is_assignable,
          },
          accountId,
        );
        if (res.code !== 200) {
          setFormError(res.message || 'Update failed');
          return;
        }
      } else {
        const res = await adminApi.createPlatformRole(
          {
            name,
            slug: form.slug.trim() || undefined,
            description: form.description.trim() || undefined,
            permission_ids,
            is_active: form.is_active,
            is_assignable: form.is_assignable,
          },
          accountId,
        );
        if (res.code !== 201) {
          setFormError(res.message || 'Create failed');
          return;
        }
      }
      setModalOpen(false);
      await loadAll();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        'Request failed';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (role: RoleItem) => {
    if (!accountId || !role.id) return;
    if (role.is_system) return;
    if (!globalThis.confirm(`Delete role “${role.name}”? Users cannot reference it afterwards.`)) return;
    try {
      const res = await adminApi.deletePlatformRole(role.id, accountId);
      if (res.code !== 200) {
        setError(res.message || 'Delete failed');
        return;
      }
      await loadAll();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        'Delete failed';
      setError(msg);
    }
  };

  const rowKey = (r: RoleItem) => r.id ?? r.code;

  return (
    <div className="space-y-4">
      <nav className="text-sm text-gray-600">
        <Link href="/admin/users" className="text-[var(--primary)] hover:underline">
          User Administration
        </Link>
        <span className="mx-2 text-gray-400">/</span>
        <span className="text-gray-900 font-medium">Roles</span>
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Roles</h1>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button type="button" onClick={openCreate} className="btn btn-primary inline-flex items-center gap-2 h-9 px-4 text-sm">
            <Icon icon={faPlus} size="sm" />
            New role
          </button>
          <Link
            href="/admin/permissions"
            className="inline-flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            <Icon icon={faLock} size="sm" />
            Permissions
          </Link>
        </div>
      </div>

      <FilterBar>
        <FilterBarSearch value={search} onChange={setSearch} placeholder="Search roles by name or description..." />
      </FilterBar>

      {error && <div className="bg-red-50 border border-red-200 rounded-sm p-4 text-sm text-red-600">{error}</div>}

      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h2 className="text-sm font-semibold text-gray-800">Platform roles</h2>
          <p className="text-xs text-gray-500">System roles cannot be deleted; custom roles are managed here.</p>
        </div>
        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={8} cols={5} showRowNumbers={false} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-10 py-3 px-4 text-left" />
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Description</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Permissions</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700 w-36">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoles.map((role) => {
                  const rk = rowKey(role);
                  const isExpanded = expandedCode === rk;
                  return (
                    <Fragment key={rk}>
                      <tr className="border-b border-gray-100 hover:bg-gray-50/80 transition-colors">
                        <td className="py-2 px-4">
                          <button
                            type="button"
                            onClick={() => setExpandedCode(isExpanded ? null : rk)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-200/80"
                          >
                            <Icon icon={isExpanded ? faChevronUp : faChevronDown} size="sm" />
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-gray-900">{role.name}</span>
                          <span className="ml-2 text-xs text-gray-500 uppercase">({role.code})</span>
                          {role.is_system ? (
                            <span className="ml-2 inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-100">
                              SYSTEM
                            </span>
                          ) : null}
                          {role.is_active === false ? (
                            <span className="ml-2 inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600">
                              INACTIVE
                            </span>
                          ) : null}
                        </td>
                        <td className="py-3 px-4 text-gray-600">{role.description}</td>
                        <td className="py-3 px-4 text-right">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                            {role.permissionCount}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex gap-1 justify-end">
                            <button
                              type="button"
                              title="Edit role"
                              disabled={!role.id}
                              onClick={() => openEdit(role)}
                              className="p-2 text-gray-500 hover:text-[var(--primary)] hover:bg-gray-100 rounded disabled:opacity-40"
                            >
                              <Icon icon={faEdit} size="sm" />
                            </button>
                            {!role.is_system ? (
                              <button
                                type="button"
                                title="Delete role"
                                disabled={!role.id}
                                onClick={() => deleteRole(role)}
                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-40"
                              >
                                <Icon icon={faTrash} size="sm" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50/50">
                          <td colSpan={5} className="py-4 px-4">
                            <div className="pl-8">
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
                                  <li className="text-gray-500 text-sm">No permissions</li>
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

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editing ? `Edit role: ${editing.name}` : 'Create role'}
        maxWidth="max-w-4xl"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" disabled={saving} className="btn btn-secondary h-9 px-4 text-sm" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="button" disabled={saving} className="btn btn-primary h-9 px-4 text-sm" onClick={() => void submitModal()}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create role'}
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-sm">
          {formError ? <div className="text-red-600 text-sm">{formError}</div> : null}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-gray-600 mb-1">Display name</label>
              <input className="input w-full" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 mb-1">
                Slug {!editing?.is_system ? '' : '(system role — read-only)'}
              </label>
              <input
                className="input w-full font-mono text-xs"
                value={form.slug}
                onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                disabled={!!editing?.is_system}
                placeholder="auto-from-name if empty"
              />
            </div>
            <div className="flex flex-col gap-2 justify-end">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                />
                <span className="text-gray-700">Active</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_assignable}
                  onChange={(e) => setForm((p) => ({ ...p, is_assignable: e.target.checked }))}
                />
                <span className="text-gray-700">Assignable to employees</span>
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-gray-600 mb-1">Description</label>
              <textarea
                className="input w-full min-h-[72px]"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <p className="text-gray-700 font-medium mb-2">Permissions</p>
            <div className="max-h-[45vh] overflow-y-auto border border-gray-200 rounded-sm p-3 space-y-4 bg-gray-50/50">
              {permissionsByCategory.map(([cat, items]) => (
                <div key={cat}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{cat}</p>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {items.map((perm) => (
                      <li key={perm.code}>
                        <label className="flex gap-2 items-start cursor-pointer">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={perm.id ? form.permissionIds.has(perm.id) : false}
                            disabled={!perm.id}
                            onChange={() => perm.id && togglePerm(perm.id)}
                          />
                          <span>
                            <span className="font-medium text-gray-900">{perm.name}</span>
                            <span className="block text-[11px] text-gray-500 font-mono">{perm.code}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {permCatalog.length === 0 ? <p className="text-gray-500 text-sm">Loading permission catalog…</p> : null}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
