'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePermission } from '@/hooks/usePermission';
import { useAuthStore } from '@/store/auth';
import { PermissionService } from '@/lib/services/permission.service';
import { adminApi } from '@/lib/api/admin';
import { useToastStore } from '@/store/toast';
import Icon, { faClipboardList, faEye } from '@/app/components/Icon';
import Pagination from '@/app/components/Pagination';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';

const ACCOUNT_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'farmer', label: 'Farmer' },
  { value: 'supplier', label: 'Milk collector' },
];

const DATE_PRESET_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'custom', label: 'Custom range' },
];

function segmentLabel(segment: string | null | undefined, accountType: string): string {
  if (accountType === 'farmer') {
    const s = segment || 'direct_farmer';
    if (s === 'direct_farmer') return 'Direct farmer';
    return s.replace(/_/g, ' ');
  }
  const s = segment || '';
  if (s === 'farmer_collector') return 'Farmer collector';
  if (s === 'pure_collector') return 'Pure collector';
  return s.replace(/_/g, ' ') || '—';
}

type Row = {
  id: string;
  user_id: string;
  mcc_account_id: string | null;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    code: string;
    name: string;
    first_name: string;
    last_name: string;
    phone: string;
    account_type: string;
    supplier_segment: string | null;
  };
  linked_supplier_account: { id: string; code: string; name: string } | null;
  linked_mcc: { id: string; code: string; name: string } | null;
};

export default function SupplierOnboardingListPage() {
  const { currentAccount } = useAuthStore();
  const { canManageUsers, isAdmin } = usePermission();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [mccOptions, setMccOptions] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [mccFilter, setMccFilter] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [query, setQuery] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [error, setError] = useState('');
  const tzOffsetMinutes = new Date().getTimezoneOffset();

  const toLocalYmd = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    if (!PermissionService.canManageUsers() && !PermissionService.isAdmin()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await adminApi.listSupplierMilkOnboardingMccOptions(currentAccount?.account_id);
        if (cancelled) return;
        if (res.code === 200 && res.data?.mcc_accounts) {
          setMccOptions(res.data.mcc_accounts);
        }
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentAccount?.account_id]);

  useEffect(() => {
    if (!PermissionService.canManageUsers() && !PermissionService.isAdmin()) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const activeFrom = createdFrom || undefined;
        const activeTo = createdTo || undefined;
        const at =
          accountTypeFilter === 'farmer' || accountTypeFilter === 'supplier'
            ? (accountTypeFilter as 'farmer' | 'supplier')
            : undefined;
        const res = await adminApi.listSupplierMilkOnboarding(pagination.page, pagination.limit, currentAccount?.account_id, {
          mcc_account_id: mccFilter || undefined,
          account_type: at,
          search: query || undefined,
          created_from: activeFrom,
          created_to: activeTo,
          tz_offset_minutes: tzOffsetMinutes,
        });
        if (cancelled) return;
        if (res.code === 200 && res.data) {
          setRows(res.data.records as Row[]);
          setPagination(res.data.pagination);
        } else {
          setError(res.message || 'Failed to load');
        }
      } catch (e: any) {
        if (cancelled) return;
        const msg = e?.response?.data?.message || e?.message || 'Failed to load';
        setError(msg);
        useToastStore.getState().error(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    currentAccount?.account_id,
    mccFilter,
    accountTypeFilter,
    query,
    createdFrom,
    createdTo,
    pagination.page,
    pagination.limit,
  ]);

  useEffect(() => {
    const now = new Date();
    if (datePreset === 'all') {
      setCreatedFrom('');
      setCreatedTo('');
      return;
    }
    if (datePreset === 'today') {
      const today = toLocalYmd(now);
      setCreatedFrom(today);
      setCreatedTo(today);
      return;
    }
    if (datePreset === 'last_7_days') {
      const from = new Date(now);
      from.setDate(now.getDate() - 6);
      setCreatedFrom(toLocalYmd(from));
      setCreatedTo(toLocalYmd(now));
      return;
    }
    if (datePreset === 'this_month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      setCreatedFrom(toLocalYmd(first));
      setCreatedTo(toLocalYmd(now));
      return;
    }
    if (datePreset === 'last_month') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      setCreatedFrom(toLocalYmd(first));
      setCreatedTo(toLocalYmd(last));
    }
  }, [datePreset]);

  if (!canManageUsers() && !isAdmin()) {
    return (
      <div className="p-6">
        <p className="text-gray-600">You do not have access to this page.</p>
      </div>
    );
  }

  if (loading && rows.length === 0) return <ListPageSkeleton />;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Icon icon={faClipboardList} />
            Suppliers onboarding
          </h1>
          <p className="text-sm text-gray-500 mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span>Records created when an MCC onboards a farmer or milk collector from Gemura Web.</span>
            {!loading && (
              <span className="text-gray-400 tabular-nums whitespace-nowrap">
                {pagination.total} {pagination.total === 1 ? 'row' : 'rows'}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="border-b border-gray-100 pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-3">
          <form
            className="flex flex-1 min-w-0 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(searchTerm.trim());
              setPagination((p) => ({ ...p, page: 1 }));
            }}
          >
            <input
              className="border border-gray-200 rounded-sm px-3 py-1.5 text-sm bg-white flex-1 min-w-0 max-w-xl"
              placeholder="Supplier name, phone, user code, supplier account, or MCC"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button type="submit" className="btn btn-primary text-sm py-1.5 shrink-0">
              Search
            </button>
            {query && (
              <button
                type="button"
                className="btn border border-gray-300 bg-white text-sm py-1.5 shrink-0"
                onClick={() => {
                  setSearchTerm('');
                  setQuery('');
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
              >
                Clear
              </button>
            )}
          </form>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:shrink-0">
            <div className="flex items-center gap-2">
              <label htmlFor="sup-ob-mcc" className="text-xs font-medium text-gray-600 whitespace-nowrap">
                Linked MCC
              </label>
              <select
                id="sup-ob-mcc"
                className="border border-gray-200 rounded-sm px-2 py-1.5 text-sm bg-white min-w-[12rem] max-w-[16rem]"
                value={mccFilter}
                onChange={(e) => {
                  setMccFilter(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
              >
                <option value="">All MCCs</option>
                {mccOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} — {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="sup-ob-type" className="text-xs font-medium text-gray-600 whitespace-nowrap">
                Type
              </label>
              <select
                id="sup-ob-type"
                className="border border-gray-200 rounded-sm px-2 py-1.5 text-sm bg-white w-[12rem]"
                value={accountTypeFilter}
                onChange={(e) => {
                  setAccountTypeFilter(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
              >
                {ACCOUNT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="sup-ob-date" className="text-xs font-medium text-gray-600 whitespace-nowrap">
                Registered
              </label>
              <select
                id="sup-ob-date"
                className="border border-gray-200 rounded-sm px-2 py-1.5 text-sm bg-white w-[12rem]"
                value={datePreset}
                onChange={(e) => {
                  setDatePreset(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
              >
                {DATE_PRESET_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {datePreset === 'custom' && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  className="border border-gray-200 rounded-sm px-2 py-1.5 text-sm bg-white"
                  value={createdFrom}
                  onChange={(e) => {
                    setCreatedFrom(e.target.value);
                    setPagination((p) => ({ ...p, page: 1 }));
                  }}
                />
                <span className="text-gray-500 text-xs">–</span>
                <input
                  type="date"
                  className="border border-gray-200 rounded-sm px-2 py-1.5 text-sm bg-white"
                  value={createdTo}
                  onChange={(e) => {
                    setCreatedTo(e.target.value);
                    setPagination((p) => ({ ...p, page: 1 }));
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-3 py-2 font-medium w-10 text-right text-gray-500 tabular-nums">#</th>
                <th className="px-3 py-2 font-medium">Supplier</th>
                <th className="px-3 py-2 font-medium">Phone</th>
                <th className="px-3 py-2 font-medium">Supplier account</th>
                <th className="px-3 py-2 font-medium">Linked MCC</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Registered</th>
                <th className="px-3 py-2 font-medium w-24"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                    No onboarding records found.
                  </td>
                </tr>
              ) : (
                rows.map((r, index) => (
                  <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50/80">
                    <td className="px-3 py-2.5 text-right text-gray-500 tabular-nums text-xs w-10">
                      {(pagination.page - 1) * pagination.limit + index + 1}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-gray-900">{r.user.name}</div>
                      <div className="text-xs text-gray-400 font-mono">{r.user.code}</div>
                      <Link
                        href={`/admin/users/${r.user.id}`}
                        className="text-xs text-primary hover:underline mt-0.5 inline-block"
                      >
                        User profile
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">{r.user.phone}</td>
                    <td className="px-3 py-2.5">
                      {r.linked_supplier_account ? (
                        <Link
                          href={`/admin/accounts/${r.linked_supplier_account.id}`}
                          className="text-primary hover:underline"
                        >
                          <span className="font-mono text-xs">{r.linked_supplier_account.code}</span>
                          <span className="ml-2 text-gray-600 text-xs">{r.linked_supplier_account.name}</span>
                        </Link>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.linked_mcc && r.mcc_account_id ? (
                        <Link href={`/admin/accounts/${r.mcc_account_id}`} className="text-primary hover:underline">
                          <span className="font-mono text-xs">{r.linked_mcc.code}</span>
                          <span className="ml-2 text-gray-600 text-xs">{r.linked_mcc.name}</span>
                        </Link>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700">
                      <span className="capitalize">{r.user.account_type}</span>
                      <div className="text-xs text-gray-500">{segmentLabel(r.user.supplier_segment, r.user.account_type)}</div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/admin/onboarding/suppliers/${r.id}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline text-sm font-medium"
                      >
                        <Icon icon={faEye} size="sm" />
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pagination.total > 0 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          pageSize={pagination.limit}
          itemLabel="records"
          onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
        />
      )}
    </div>
  );
}
