'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { accountMembershipsApi, type AccountMembershipRow } from '@/lib/api/account-memberships';
import FilterBar, { FilterBarGroup, FilterBarSearch } from '@/app/components/FilterBar';
import DataTableWithPagination from '@/app/components/DataTableWithPagination';
import type { TableColumn } from '@/app/components/DataTable';
import Icon, { faUserFriends } from '@/app/components/Icon';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'inactive', label: 'Inactive' },
];

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Flatten nested user fields so DataTable sorting matches other list pages */
type MemberTableRow = AccountMembershipRow & {
  memberName: string;
  memberPhone: string | null;
  memberEmail: string | null;
  memberCode: string | null;
};

export default function MembersPage() {
  const { currentAccount } = useAuthStore();
  const accountId = currentAccount?.account_id ?? '';
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AccountMembershipRow[]>([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    if (!accountId) return;
    try {
      setLoading(true);
      setError('');
      const statusArg = statusFilter || undefined;
      const res = await accountMembershipsApi.listForAccount(accountId, statusArg as 'pending' | 'active' | 'inactive' | undefined);
      if (res.code === 200) {
        setRows(res.data || []);
      } else {
        setError(res.message || 'Failed to load members');
      }
    } catch (e: unknown) {
      setError(
        (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
          (e as Error)?.message ||
          'Failed to load members',
      );
    } finally {
      setLoading(false);
    }
  }, [accountId, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const u = r.user;
      const hay = [u.name, u.first_name, u.last_name, u.phone, u.email, u.code].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const tableData = useMemo<MemberTableRow[]>(
    () =>
      filtered.map((r) => ({
        ...r,
        memberName: r.user.name,
        memberPhone: r.user.phone,
        memberEmail: r.user.email,
        memberCode: r.user.code,
      })),
    [filtered],
  );

  const columns: TableColumn<MemberTableRow>[] = useMemo(
    () => [
      {
        key: 'memberName',
        label: 'Member',
        sortable: true,
        className: 'whitespace-normal min-w-[12rem]',
        render: (value, row) => (
          <div>
            <div className="font-medium text-gray-900">{value}</div>
            {row.memberCode ? <div className="text-xs text-gray-500">{row.memberCode}</div> : null}
          </div>
        ),
      },
      {
        key: 'memberPhone',
        label: 'Phone',
        sortable: true,
        render: (value) => <span className="text-gray-900">{value || '—'}</span>,
      },
      {
        key: 'memberEmail',
        label: 'Email',
        sortable: true,
        className: 'whitespace-normal max-w-xs',
        render: (value) => <span className="text-gray-700">{value || '—'}</span>,
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        render: (value) => (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              value === 'active'
                ? 'bg-emerald-50 text-emerald-800'
                : value === 'pending'
                  ? 'bg-amber-50 text-amber-900'
                  : 'bg-gray-100 text-gray-700'
            }`}
          >
            {String(value)}
          </span>
        ),
      },
      {
        key: 'member_since',
        label: 'Member since',
        sortable: true,
        render: (value) => <span className="text-gray-700">{formatDate(value as string | null)}</span>,
      },
    ],
    [],
  );

  if (!accountId) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Choose an account from the header to view cooperative members.
      </div>
    );
  }

  const emptyMessage =
    filtered.length === 0 && rows.length > 0
      ? 'No members match your filters.'
      : 'No cooperative members for this account yet.';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Icon icon={faUserFriends} className="text-[var(--primary)]" />
            Members
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Cooperative membership for <span className="font-medium text-gray-800">{currentAccount?.account_name}</span>. You can also mark people as members when{' '}
            <Link href="/suppliers" className="text-[var(--primary)] underline underline-offset-2">
              registering a supplier
            </Link>
            .
          </p>
        </div>
      </div>

      <FilterBar>
        <FilterBarSearch value={search} onChange={setSearch} placeholder="Search name, phone, email…" />
        <FilterBarGroup label="Status">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input min-w-[140px]"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FilterBarGroup>
      </FilterBar>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <DataTableWithPagination<MemberTableRow>
        data={tableData}
        columns={columns}
        loading={loading}
        emptyMessage={emptyMessage}
        itemLabel="members"
        showRowNumbers
      />
    </div>
  );
}
