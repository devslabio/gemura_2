'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import DataTable, { TableColumn } from '@/app/components/DataTable';
import Pagination from '@/app/components/Pagination';
import FilterBar, { FilterBarGroup, FilterBarSearch, FilterBarApply } from '@/app/components/FilterBar';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';
import Modal from '@/app/components/Modal';
import AccountLocationEditor from '@/app/components/admin/AccountLocationEditor';
import { adminApi, type TenantAccountRow, type UserListItem } from '@/lib/api/admin';
import { locationsApi, type Location } from '@/lib/api/locations';
import { useAuthStore } from '@/store/auth';
import { usePermission } from '@/hooks/usePermission';

const PAGE_SIZES = [10, 20, 50, 100] as const;

export default function RegionalSupervisionPage() {
  const router = useRouter();
  const { currentAccount } = useAuthStore();
  const { canManageUsers, isAdmin } = usePermission();
  const allowed = canManageUsers() || isAdmin();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TenantAccountRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [accountType, setAccountType] = useState<'tenant' | 'branch' | 'admin' | 'all'>('all');
  const [filterProvinceId, setFilterProvinceId] = useState('');
  const [filterDistricts, setFilterDistricts] = useState<Location[]>([]);
  const [filterDistrictId, setFilterDistrictId] = useState('');
  const [filterSupervisorId, setFilterSupervisorId] = useState('');
  const [applied, setApplied] = useState({
    search: '',
    accountType: 'all' as 'tenant' | 'branch' | 'admin' | 'all',
    filterDistrictId: '',
    filterSupervisorId: '',
  });
  const [provinces, setProvinces] = useState<Location[]>([]);
  const [editRow, setEditRow] = useState<TenantAccountRow | null>(null);
  const [listReload, setListReload] = useState(0);
  const [savingSupervisorForAccountId, setSavingSupervisorForAccountId] = useState<string | null>(null);

  const [supervisorUsers, setSupervisorUsers] = useState<UserListItem[]>([]);
  const [supervisorUserId, setSupervisorUserId] = useState('');
  const [supervisorUserIdManual, setSupervisorUserIdManual] = useState('');
  const [scopeDistrictIds, setScopeDistrictIds] = useState<string[]>([]);
  const [scopeProvinceId, setScopeProvinceId] = useState('');
  const [scopeDistrictOptions, setScopeDistrictOptions] = useState<Location[]>([]);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [scopeSaving, setScopeSaving] = useState(false);
  const [scopeError, setScopeError] = useState('');
  const [bulkDistrictModalOpen, setBulkDistrictModalOpen] = useState(false);

  const adminAccountId = currentAccount?.account_id;

  const loadAccounts = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    try {
      const res = await adminApi.listTenantAccountsForAdmin(adminAccountId, {
        page: pagination.page,
        limit: pagination.limit,
        search: applied.search.trim() || undefined,
        account_type: applied.accountType,
        district_location_id: applied.filterDistrictId || undefined,
        regional_supervisor_user_id: applied.filterSupervisorId || undefined,
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
  }, [
    allowed,
    adminAccountId,
    pagination.page,
    pagination.limit,
    applied,
    listReload,
  ]);

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
    const res = await adminApi.getUsers(1, 200, undefined, adminAccountId, { role: 'regional_supervisor' });
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

  const onSupervisorAssign = useCallback(
    async (accountId: string, value: string) => {
      const next = value === '' ? null : value;
      setSavingSupervisorForAccountId(accountId);
      try {
        const res = await adminApi.updateTenantAccountRegionalSupervisor(adminAccountId, accountId, {
          regional_supervisor_user_id: next,
        });
        if (res.code === 200) {
          setListReload((n) => n + 1);
        }
      } finally {
        setSavingSupervisorForAccountId(null);
      }
    },
    [adminAccountId],
  );

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
      {
        key: 'operational_location_label',
        label: 'Location',
        render: (_v, row) => (
          <span className="text-sm text-gray-700">
            {row.operational_location_label || row.operational_district_label || '—'}
          </span>
        ),
      },
      {
        key: 'regional_supervisor',
        label: 'Supervisor',
        render: (_v, row) => {
          const busy = savingSupervisorForAccountId === row.id;
          return (
            <select
              className="w-full max-w-[16rem] min-h-[2.25rem] rounded-sm border border-gray-300 px-2 py-1.5 text-sm text-gray-900 bg-white disabled:opacity-60"
              value={row.regional_supervisor_user_id ?? ''}
              disabled={busy}
              onChange={(e) => onSupervisorAssign(row.id, e.target.value)}
              aria-label={`Supervisor for ${row.name}`}
            >
              <option value="">Unassigned</option>
              {supervisorUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          );
        },
      },
      {
        key: 'actions',
        label: '',
        render: (_v, row) => (
          <button type="button" className="text-sm text-[var(--primary)] font-medium whitespace-nowrap" onClick={() => setEditRow(row)}>
            Edit location
          </button>
        ),
      },
    ],
    [supervisorUsers, savingSupervisorForAccountId, onSupervisorAssign],
  );

  if (!allowed) return null;

  if (loading && rows.length === 0) {
    return <ListPageSkeleton title="Regional supervision" filterFields={6} tableRows={8} tableCols={4} />;
  }

  const applyAccountFilters = () => {
    setApplied({
      search: search.trim(),
      accountType,
      filterDistrictId,
      filterSupervisorId,
    });
    setPagination((p) => ({ ...p, page: 1 }));
    setListReload((n) => n + 1);
  };

  return (
    <div className="space-y-8 max-w-[1600px]">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="space-y-2 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Regional supervision</h1>
          <p className="text-sm text-gray-600 max-w-2xl">
            Platform accounts with geography and assigned{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">regional_supervisor</code> (
            <Link href="/admin/users" className="text-[var(--primary)] hover:underline">
              Users
            </Link>
            ). Scoped supervisors see matching rows on{' '}
            <Link href="/admin/accounts" className="text-[var(--primary)] hover:underline">
              Accounts
            </Link>
            .
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary text-sm shrink-0 self-start sm:mt-0.5"
          onClick={() => setBulkDistrictModalOpen(true)}
        >
          Bulk district access
        </button>
      </header>

      <section className="space-y-4">
        <FilterBar>
          <FilterBarSearch
            value={search}
            onChange={setSearch}
            placeholder="Search name or code…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyAccountFilters();
              }
            }}
          />
          <FilterBarGroup label="Account type">
            <select
              className="w-full min-h-[2.75rem] rounded-sm border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as typeof accountType)}
            >
              <option value="all">All types</option>
              <option value="tenant">Tenant</option>
              <option value="branch">Branch</option>
              <option value="admin">Admin</option>
            </select>
          </FilterBarGroup>
          <FilterBarGroup label="Province">
            <select
              className="w-full min-h-[2.75rem] rounded-sm border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white"
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
          </FilterBarGroup>
          <FilterBarGroup label="District">
            <select
              className="w-full min-h-[2.75rem] rounded-sm border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white disabled:bg-gray-50 disabled:text-gray-500"
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
          </FilterBarGroup>
          <FilterBarGroup label="Supervisor">
            <select
              className="w-full min-h-[2.75rem] rounded-sm border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white"
              value={filterSupervisorId}
              onChange={(e) => setFilterSupervisorId(e.target.value)}
            >
              <option value="">All</option>
              <option value="unassigned">Unassigned</option>
              {supervisorUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </FilterBarGroup>
          <FilterBarGroup label="Page size">
            <select
              className="w-full min-h-[2.75rem] rounded-sm border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white"
              value={pagination.limit}
              onChange={(e) => {
                const n = Number(e.target.value);
                setPagination((p) => ({ ...p, limit: n, page: 1 }));
              }}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </FilterBarGroup>
          <FilterBarApply onApply={applyAccountFilters} />
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

      {bulkDistrictModalOpen ? (
        <Modal
          open
          maxWidth="max-w-4xl"
          onClose={() => setBulkDistrictModalOpen(false)}
          title="Bulk: supervisor district access"
        >
          <p className="text-sm text-gray-600 mb-4">
            Choose which districts each supervisor can see (in addition to per-account assignments in the table, which also add the
            account’s district to their scope).
          </p>
          <div className="space-y-4">
            <FilterBar>
              <FilterBarGroup label="Supervisor user">
                <select
                  className="w-full min-h-[2.75rem] rounded-sm border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white"
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
              </FilterBarGroup>
              <FilterBarGroup label="Or user UUID">
                <input
                  type="text"
                  placeholder="Paste user id"
                  value={supervisorUserIdManual}
                  onChange={(e) => {
                    setSupervisorUserIdManual(e.target.value);
                    if (e.target.value.trim()) setSupervisorUserId('');
                  }}
                  className="w-full min-h-[2.75rem] box-border rounded-sm border border-gray-300 px-3 py-2 text-sm font-mono text-gray-900 bg-white placeholder:text-gray-500"
                />
              </FilterBarGroup>
              <FilterBarGroup label="Province (districts)">
                <select
                  className="w-full min-h-[2.75rem] rounded-sm border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white"
                  value={scopeProvinceId}
                  onChange={(e) => setScopeProvinceId(e.target.value)}
                >
                  <option value="">— Select —</option>
                  {provinces.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </FilterBarGroup>
              <div className="flex flex-col gap-1.5 flex-shrink-0 min-w-0 basis-full sm:basis-auto">
                <label className="text-sm font-medium text-gray-700 invisible select-none">Save</label>
                <button
                  type="button"
                  disabled={!effectiveSupervisorUserId || scopeSaving}
                  onClick={saveScope}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[2.75rem] h-auto px-4 py-2 text-sm font-medium bg-[var(--primary)] text-white border-0 rounded hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {scopeSaving ? 'Saving…' : 'Save districts'}
                </button>
              </div>
            </FilterBar>
            {scopeError ? <p className="text-sm text-red-600">{scopeError}</p> : null}
            {scopeLoading ? <p className="text-sm text-gray-500">Loading scope…</p> : null}
            {scopeProvinceId && scopeDistrictOptions.length > 0 ? (
              <div className="rounded-sm border border-gray-200 bg-gray-50/80 p-4 md:p-5">
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-3">Districts in this province</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2.5">
                  {scopeDistrictOptions.map((d) => (
                    <label
                      key={d.id}
                      className="flex items-center gap-2.5 min-h-[2.25rem] text-sm text-gray-800 cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={scopeDistrictIds.includes(d.id)}
                        onChange={() => toggleScopeDistrict(d.id)}
                        className="h-4 w-4 shrink-0 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                      />
                      <span className="leading-snug">{d.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}

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
