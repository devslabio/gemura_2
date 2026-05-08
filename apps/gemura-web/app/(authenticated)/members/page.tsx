'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { accountMembershipsApi, type AccountMembershipRow } from '@/lib/api/account-memberships';
import { onboardApi, type OnboardCreateUserRequest } from '@/lib/api/onboard';
import FilterBar, { FilterBarGroup, FilterBarSearch } from '@/app/components/FilterBar';
import DataTableWithPagination from '@/app/components/DataTableWithPagination';
import type { TableColumn } from '@/app/components/DataTable';
import Modal from '@/app/components/Modal';
import ConfirmDialog from '@/app/components/ConfirmDialog';
import Icon, { faUserFriends, faPlus, faEdit, faTrash, faSpinner } from '@/app/components/Icon';
import { useToastStore } from '@/store/toast';
import RwandaLocationPicker, { type RwandaLocationValue } from '@/app/components/RwandaLocationPicker';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'inactive', label: 'Inactive' },
];

const MEMBERSHIP_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'inactive', label: 'Inactive' },
] as const;

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

function toDateInputValue(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function dateInputToIso(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  // Create an ISO string at midnight local time (good enough for date-only semantics)
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function MembersPage() {
  const { currentAccount } = useAuthStore();
  const accountId = currentAccount?.account_id ?? '';
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AccountMembershipRow[]>([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const toast = useToastStore();

  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerSubmitting, setRegisterSubmitting] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [registerForm, setRegisterForm] = useState<OnboardCreateUserRequest & { member_since?: string; membership_status: 'pending' | 'active' | 'inactive' }>({
    first_name: '',
    last_name: '',
    phone_number: '',
    email: '',
    location: '',
    password: '',
    member_since: '',
    membership_status: 'active',
  });
  const [registerLocation, setRegisterLocation] = useState<RwandaLocationValue>({});

  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');
  const [editTarget, setEditTarget] = useState<AccountMembershipRow | null>(null);
  const [editForm, setEditForm] = useState<{ membership_status: 'pending' | 'active' | 'inactive'; member_since: string }>({
    membership_status: 'active',
    member_since: '',
  });

  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateSubmitting, setDeactivateSubmitting] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<AccountMembershipRow | null>(null);

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

  const openRegister = () => {
    setRegisterError('');
    setRegisterForm({
      first_name: '',
      last_name: '',
      phone_number: '',
      email: '',
      location: '',
      password: '',
      member_since: '',
      membership_status: 'active',
    });
    setRegisterLocation({});
    setRegisterOpen(true);
  };

  const submitRegister = async () => {
    if (!accountId) return;
    const fn = registerForm.first_name.trim();
    const ln = registerForm.last_name.trim();
    const phone = registerForm.phone_number.trim();
    const pwd = registerForm.password;
    if (!fn || !ln || !phone || !pwd) {
      setRegisterError('First name, last name, phone number, and password are required.');
      return;
    }
    setRegisterSubmitting(true);
    setRegisterError('');
    try {
      const userRes = await onboardApi.createUser({
        first_name: fn,
        last_name: ln,
        phone_number: phone,
        password: pwd,
        email: registerForm.email?.trim() || undefined,
        location: registerForm.location?.trim() || undefined,
      });
      if (userRes.code !== 201 || !userRes.data?.onboarded_user?.id) {
        setRegisterError(userRes.message || 'Failed to create user.');
        return;
      }

      const memberSinceIso = dateInputToIso(registerForm.member_since || '');
      const membershipRes = await accountMembershipsApi.create({
        account_id: accountId,
        user_id: userRes.data.onboarded_user.id,
        status: registerForm.membership_status,
        ...(memberSinceIso ? { member_since: memberSinceIso } : {}),
      });
      if (membershipRes.code !== 201) {
        setRegisterError(membershipRes.message || 'User created but membership creation failed.');
        return;
      }

      toast.success('Member registered successfully.');
      setRegisterOpen(false);
      await load();
    } catch (e: unknown) {
      setRegisterError(
        (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
          (e as Error)?.message ||
          'Registration failed.',
      );
    } finally {
      setRegisterSubmitting(false);
    }
  };

  const openEdit = (row: AccountMembershipRow) => {
    setEditTarget(row);
    setEditError('');
    setEditForm({
      membership_status: (row.status as 'pending' | 'active' | 'inactive') || 'active',
      member_since: toDateInputValue(row.member_since),
    });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!editTarget) return;
    setEditSubmitting(true);
    setEditError('');
    try {
      const memberSinceIso = dateInputToIso(editForm.member_since);
      const res = await accountMembershipsApi.update(editTarget.id, {
        status: editForm.membership_status,
        member_since: memberSinceIso,
      });
      if (res.code !== 200) {
        setEditError(res.message || 'Failed to update membership.');
        return;
      }
      toast.success('Membership updated.');
      setEditOpen(false);
      setEditTarget(null);
      await load();
    } catch (e: unknown) {
      setEditError(
        (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
          (e as Error)?.message ||
          'Failed to update membership.',
      );
    } finally {
      setEditSubmitting(false);
    }
  };

  const openDeactivate = (row: AccountMembershipRow) => {
    setDeactivateTarget(row);
    setDeactivateOpen(true);
  };

  const confirmDeactivate = async () => {
    if (!deactivateTarget) return;
    setDeactivateSubmitting(true);
    try {
      const res = await accountMembershipsApi.update(deactivateTarget.id, { status: 'inactive' });
      if (res.code !== 200) {
        toast.error(res.message || 'Failed to deactivate membership.');
        return;
      }
      toast.success('Membership deactivated.');
      setDeactivateOpen(false);
      setDeactivateTarget(null);
      await load();
    } finally {
      setDeactivateSubmitting(false);
    }
  };

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
      {
        key: 'actions',
        label: '',
        sortable: false,
        className: 'w-[160px]',
        render: (_value, row) => (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="btn btn-secondary h-8 px-3"
              onClick={(e) => {
                e.stopPropagation();
                openEdit(row);
              }}
              title="Edit membership"
            >
              <Icon icon={faEdit} size="xs" className="mr-1" />
              Edit
            </button>
            <button
              type="button"
              className="h-8 px-3 rounded-md text-sm font-medium border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                openDeactivate(row);
              }}
              title="Deactivate membership"
            >
              <Icon icon={faTrash} size="xs" className="mr-1" />
              Deactivate
            </button>
          </div>
        ),
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
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-primary" onClick={openRegister}>
            <Icon icon={faPlus} size="sm" className="mr-2" />
            Register member
          </button>
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

      <Modal
        open={registerOpen}
        onClose={() => (registerSubmitting ? null : setRegisterOpen(false))}
        title="Register member"
        maxWidth="max-w-2xl"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setRegisterOpen(false)} disabled={registerSubmitting}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={submitRegister} disabled={registerSubmitting}>
              {registerSubmitting ? <Icon icon={faSpinner} spin size="sm" className="mr-2" /> : null}
              Create member
            </button>
          </>
        }
      >
        {registerError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">{registerError}</div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
            <input
              value={registerForm.first_name}
              onChange={(e) => setRegisterForm((p) => ({ ...p, first_name: e.target.value }))}
              className="input w-full"
              disabled={registerSubmitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
            <input
              value={registerForm.last_name}
              onChange={(e) => setRegisterForm((p) => ({ ...p, last_name: e.target.value }))}
              className="input w-full"
              disabled={registerSubmitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone number</label>
            <input
              value={registerForm.phone_number}
              onChange={(e) => setRegisterForm((p) => ({ ...p, phone_number: e.target.value }))}
              className="input w-full"
              placeholder="+2507..."
              disabled={registerSubmitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email (optional)</label>
            <input
              value={registerForm.email ?? ''}
              onChange={(e) => setRegisterForm((p) => ({ ...p, email: e.target.value }))}
              className="input w-full"
              disabled={registerSubmitting}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Location (Rwanda)</label>
            <RwandaLocationPicker
              value={registerLocation}
              onChange={(next) => {
                setRegisterLocation(next);
                const labels = [next.village?.name, next.cell?.name, next.sector?.name, next.district?.name, next.province?.name].filter(Boolean);
                setRegisterForm((p) => ({ ...p, location: labels.join(', ') }));
              }}
              disabled={registerSubmitting}
            />
            <p className="text-xs text-gray-500 mt-2">
              Saved as descriptive text: <span className="font-medium text-gray-700">{registerForm.location ? registerForm.location : '—'}</span>
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={registerForm.password}
              onChange={(e) => setRegisterForm((p) => ({ ...p, password: e.target.value }))}
              className="input w-full"
              disabled={registerSubmitting}
              minLength={6}
            />
            <p className="text-xs text-gray-500 mt-1">Minimum 6 characters.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Membership status</label>
            <select
              className="input w-full"
              value={registerForm.membership_status}
              onChange={(e) => setRegisterForm((p) => ({ ...p, membership_status: e.target.value as any }))}
              disabled={registerSubmitting}
            >
              {MEMBERSHIP_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Member since (optional)</label>
            <input
              type="date"
              value={registerForm.member_since || ''}
              onChange={(e) => setRegisterForm((p) => ({ ...p, member_since: e.target.value }))}
              className="input w-full"
              disabled={registerSubmitting}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => (editSubmitting ? null : setEditOpen(false))}
        title="Edit membership"
        maxWidth="max-w-lg"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditOpen(false)} disabled={editSubmitting}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={submitEdit} disabled={editSubmitting}>
              {editSubmitting ? <Icon icon={faSpinner} spin size="sm" className="mr-2" /> : null}
              Save changes
            </button>
          </>
        }
      >
        {editError ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">{editError}</div> : null}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              className="input w-full"
              value={editForm.membership_status}
              onChange={(e) => setEditForm((p) => ({ ...p, membership_status: e.target.value as any }))}
              disabled={editSubmitting}
            >
              {MEMBERSHIP_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Member since</label>
            <input
              type="date"
              className="input w-full"
              value={editForm.member_since}
              onChange={(e) => setEditForm((p) => ({ ...p, member_since: e.target.value }))}
              disabled={editSubmitting}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deactivateOpen}
        onClose={() => (deactivateSubmitting ? null : setDeactivateOpen(false))}
        onConfirm={confirmDeactivate}
        title="Deactivate membership?"
        message={`This will mark ${deactivateTarget?.user?.name || 'this member'} as inactive for this cooperative.`}
        confirmText="Deactivate"
        cancelText="Cancel"
        type="danger"
        loading={deactivateSubmitting}
      />
    </div>
  );
}
