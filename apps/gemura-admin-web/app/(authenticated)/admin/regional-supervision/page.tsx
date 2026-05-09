'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import DataTable, { TableColumn } from '@/app/components/DataTable';
import Pagination from '@/app/components/Pagination';
import FilterBar from '@/app/components/FilterBar';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';
import Modal from '@/app/components/Modal';
import AccountLocationEditor from '@/app/components/admin/AccountLocationEditor';
import { adminApi, type TenantAccountRow, type UserListItem } from '@/lib/api/admin';
import { locationsApi, type Location } from '@/lib/api/locations';
import { useAuthStore } from '@/store/auth';
import { usePermission } from '@/hooks/usePermission';

export default function RegionalSupervisionPage() {
  const router = useRouter();
  const { currentAccount } = useAuthStore();
  const { canManageUsers, isAdmin } = usePermission();
  const allowed = canManageUsers() || isAdmin();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TenantAccountRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [accountType, setAccountType] = useState<'tenant' | 'branch' | 'admin' | 'all'>('all');
  const [filterProvinceId, setFilterProvinceId] = useState('');
  const [filterDistricts, setFilterDistricts] = useState<Location[]>([]);
  const [filterDistrictId, setFilterDistrictId] = useState('');
  const [provinces, setProvinces] = useState<Location[]>([]);
  const [editRow, setEditRow] = useState<TenantAccountRow | null>(null);
  const [listReload, setListReload] = useState(0);

  const [supervisorUsers, setSupervisorUsers] = useState<UserListItem[]>([]);
  const [supervisorUserId, setSupervisorUserId] = useState('');
  const [supervisorUserIdManual, setSupervisorUserIdManual] = useState('');
  const [scopeDistrictIds, setScopeDistrictIds] = useState<string[]>([]);
  const [scopeProvinceId, setScopeProvinceId] = useState('');
  const [scopeDistrictOptions, setScopeDistrictOptions] = useState<Location[]>([]);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [scopeSaving, setScopeSaving] = useState(false);
  const [scopeError, setScopeError] = useState('');

  const adminAccountId = currentAccount?.account_id;

  const loadAccounts = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    try {
      const res = await adminApi.listTenantAccountsForAdmin(adminAccountId, {
        page: pagination.page,
        limit: pagination.limit,
        search: search.trim() || undefined,
        account_type: accountType,
        district_location_id: filterDistrictId || undefined,
      });
      if (res.code === 200 && res.data) {
        setRows(res.data.rows);
        setPagination((prev) => ({ ...prev, ...res.data.pagination }));
      } else {
        setRows([]);
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [allowed, adminAccountId, pagination.page, pagination.limit, search, accountType, filterDistrictId, listReload]);

  useEffect(() => {
    if (!allowed) {
      router.replace('/dashboard');
      return;
    }
    loadAccounts();
  }, [allowed, loadAccounts, router]);

  useEffect(() => {
    locationsApi.getProvinces().then((r) => setProvinces(Array.isArray(r?.data) ? r.data : [])).catch(() => setProvinces([]));
  }, []);

  useEffect(() => {
    if (!filterProvinceId) {
      setFilterDistricts([]);
      setFilterDistrictId('');
      return;
    }
    locationsApi
      .getChildren(filterProvinceId)
      .then((r) => setFilterDistricts(Array.isArray(r?.data) ? r.data : []))
      .catch(() => setFilterDistricts([]));
  }, [filterProvinceId]);

  useEffect(() => {
    if (!scopeProvinceId) {
      setScopeDistrictOptions([]);
      return;
    }
    locationsApi
      .getChildren(scopeProvinceId)
      .then((r) => setScopeDistrictOptions(Array.isArray(r?.data) ? r.data : []))
      .catch(() => setScopeDistrictOptions([]));
  }, [scopeProvinceId]);

  const loadSupervisorUsers = useCallback(async () => {
    const res = await adminApi.getUsers(1, 100, undefined, adminAccountId, { role: 'regional_supervisor' });
    if (res.code === 200 && res.data?.users) setSupervisorUsers(res.data.users);
    else setSupervisorUsers([]);
  }, [adminAccountId]);

  useEffect(() => {
    if (!allowed) return;
    loadSupervisorUsers();
  }, [allowed, loadSupervisorUsers]);

  const effectiveSupervisorUserId = supervisorUserId.trim() || supervisorUserIdManual.trim();

  useEffect(() => {
    if (!effectiveSupervisorUserId) {
      setScopeDistrictIds([]);
      return;
    }
    let cancelled = false;
    setScopeLoading(true);
    setScopeError('');
    adminApi
      .getRegionalSupervisorScope(adminAccountId, effectiveSupervisorUserId)
      .then((res) => {
        if (cancelled) return;
        if (res.code === 200 && res.data) {
          setScopeDistrictIds(res.data.districts.map((d) => d.id));
        } else {
          setScopeError(res.message || 'Failed to load scope');
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setScopeError(e instanceof Error ? e.message : 'Failed to load scope');
      })
      .finally(() => {
        if (!cancelled) setScopeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [adminAccountId, effectiveSupervisorUserId]);

  const toggleScopeDistrict = (id: string) => {
    setScopeDistrictIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const saveScope = async () => {
    if (!effectiveSupervisorUserId) return;
    setScopeSaving(true);
    setScopeError('');
    try {
      const res = await adminApi.setRegionalSupervisorScope(adminAccountId, effectiveSupervisorUserId, {
        district_location_ids: scopeDistrictIds,
      });
      if (res.code !== 200) setScopeError(res.message || 'Failed to save');
    } catch (e: unknown) {
      setScopeError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setScopeSaving(false);
    }
  };

  const columns: TableColumn<TenantAccountRow>[] = useMemo(
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
      { key: 'type', label: 'Type', render: (v) => <span className="capitalize">{String(v)}</span> },
      {
        key: 'operational_location_label',
        label: 'Location (province → village)',
        render: (v) => <span className="text-sm text-gray-700">{(v as string) || '—'}</span>,
      },
      {
        key: 'actions',
        label: '',
        render: (_v, row) => (
          <button type="button" className="text-sm text-[var(--primary)] font-medium" onClick={() => setEditRow(row)}>
            Edit location
          </button>
        ),
      },
    ],
    [],
  );

  if (!allowed) return null;

  if (loading && rows.length === 0) {
    return <ListPageSkeleton title="Regional supervision" filterFields={4} tableRows={8} tableCols={4} />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Regional supervision</h1>
        <p className="text-sm text-gray-600 mt-1 max-w-3xl">
          Assign a <strong>village</strong> to each platform account (same hierarchy as Orora farms). The system stores the
          containing <strong>district</strong> for filters and regional supervisor matching. Supervisors hold the{' '}
          <code className="text-xs bg-gray-100 px-1 rounded">regional_supervisor</code> role; below, select which{' '}
          <strong>districts</strong> each supervisor covers.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Platform accounts</h2>
        <FilterBar>
          <input
            type="search"
            placeholder="Search name or code"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-sm border border-gray-300 px-3 py-2 text-sm w-full max-w-xs"
          />
          <select
            className="rounded-sm border border-gray-300 px-3 py-2 text-sm"
            value={accountType}
            onChange={(e) => setAccountType(e.target.value as typeof accountType)}
          >
            <option value="all">All types</option>
            <option value="tenant">Tenant</option>
            <option value="branch">Branch</option>
            <option value="admin">Admin</option>
          </select>
          <select
            className="rounded-sm border border-gray-300 px-3 py-2 text-sm min-w-[10rem]"
            value={filterProvinceId}
            onChange={(e) => {
              setFilterProvinceId(e.target.value);
              setFilterDistrictId('');
            }}
          >
            <option value="">All provinces</option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-sm border border-gray-300 px-3 py-2 text-sm min-w-[10rem]"
            value={filterDistrictId}
            onChange={(e) => setFilterDistrictId(e.target.value)}
            disabled={!filterProvinceId}
          >
            <option value="">All districts</option>
            {filterDistricts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setPagination((p) => ({ ...p, page: 1 }));
              setListReload((n) => n + 1);
            }}
          >
            Apply
          </button>
        </FilterBar>

        <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No accounts match." showRowNumbers />

        {pagination.total > 0 ? (
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            pageSize={pagination.limit}
            itemLabel="accounts"
            onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
          />
        ) : null}
      </section>

      <section className="space-y-3 border-t border-gray-200 pt-8">
        <h2 className="text-lg font-semibold text-gray-900">Regional supervisor districts</h2>
        <p className="text-sm text-gray-600">
          Pick a user with the regional supervisor role, choose a province, then tick one or more districts they oversee.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1 min-w-[12rem]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Supervisor user</label>
            <select
              className="w-full rounded-sm border border-gray-300 px-3 py-2 text-sm"
              value={supervisorUserId}
              onChange={(e) => {
                setSupervisorUserId(e.target.value);
                if (e.target.value) setSupervisorUserIdManual('');
              }}
            >
              <option value="">— Select user —</option>
              {supervisorUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email || u.phone})
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[12rem]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Or user UUID</label>
            <input
              type="text"
              placeholder="Paste user id"
              value={supervisorUserIdManual}
              onChange={(e) => {
                setSupervisorUserIdManual(e.target.value);
                if (e.target.value.trim()) setSupervisorUserId('');
              }}
              className="w-full rounded-sm border border-gray-300 px-3 py-2 text-sm font-mono"
            />
          </div>
          <div className="flex-1 min-w-[12rem]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Province (for district pick)</label>
            <select
              className="w-full rounded-sm border border-gray-300 px-3 py-2 text-sm"
              value={scopeProvinceId}
              onChange={(e) => setScopeProvinceId(e.target.value)}
            >
              <option value="">—</option>
              {provinces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {scopeError ? <p className="text-sm text-red-600">{scopeError}</p> : null}
        {scopeLoading ? <p className="text-sm text-gray-500">Loading scope…</p> : null}
        {scopeProvinceId && scopeDistrictOptions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 border border-gray-100 rounded-sm p-3 bg-gray-50/50">
            {scopeDistrictOptions.map((d) => (
              <label key={d.id} className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scopeDistrictIds.includes(d.id)}
                  onChange={() => toggleScopeDistrict(d.id)}
                  className="rounded border-gray-300"
                />
                {d.name}
              </label>
            ))}
          </div>
        ) : null}
        <div>
          <button type="button" className="btn btn-primary" disabled={!effectiveSupervisorUserId || scopeSaving} onClick={saveScope}>
            {scopeSaving ? 'Saving…' : 'Save supervisor districts'}
          </button>
        </div>
      </section>

      {editRow ? (
        <Modal open maxWidth="max-w-2xl" onClose={() => setEditRow(null)} title={`Location — ${editRow.name}`}>
          <AccountLocationEditor
            accountId={editRow.id}
            adminAccountId={adminAccountId}
            initialLocationId={editRow.operational_location_id}
            onCancel={() => setEditRow(null)}
            onSaved={() => {
              setEditRow(null);
              loadAccounts();
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}
