'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  mccOperationsApi,
  type MccShiftRow,
  type MccStaffOption,
} from '@/lib/api/mcc-operations';
import { employeesApi } from '@/lib/api/employees';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import { usePermission } from '@/hooks/usePermission';
import { useClientPagination } from '@/hooks/useClientPagination';
import Icon, { faClock, faSpinner, faUserPlus } from '@/app/components/Icon';
import Modal from '@/app/components/Modal';
import Pagination from '@/app/components/Pagination';
import FilterBar, { FilterBarGroup, FilterBarActions, FilterBarApply, FilterBarExport } from '@/app/components/FilterBar';
import SearchableSelect from '@/app/components/SearchableSelect';

type TeamAccessGroup = 'general_access' | 'limited_access';
type InviteProfileKey = 'manager' | 'accountant' | 'milk_receptionist' | 'veterinary';

const INVITE_ROLE_PROFILES: Record<
  InviteProfileKey,
  { label: string; description: string; accessGroup: TeamAccessGroup; backendRole: 'manager' | 'accountant' | 'collector' | 'agent' }
> = {
  manager: {
    label: 'Manager',
    description: 'Oversees center-wide activities and team operations.',
    accessGroup: 'general_access',
    backendRole: 'manager',
  },
  accountant: {
    label: 'Accountant',
    description: 'Dashboard, payroll, loans, charges, and finance.',
    accessGroup: 'general_access',
    backendRole: 'accountant',
  },
  milk_receptionist: {
    label: 'Milk receptionist',
    description: 'Sales, collections, suppliers, customers, inventory.',
    accessGroup: 'limited_access',
    backendRole: 'collector',
  },
  veterinary: {
    label: 'Veterinary',
    description: 'Same as receptionist with expanded inventory options.',
    accessGroup: 'limited_access',
    backendRole: 'agent',
  },
};

const INVITE_PROFILE_KEYS: InviteProfileKey[] = ['manager', 'accountant', 'milk_receptionist', 'veterinary'];

const INVITE_ROLE_SELECT_OPTIONS = INVITE_PROFILE_KEYS.map((key) => ({
  value: key,
  label: INVITE_ROLE_PROFILES[key].label,
}));

function toRoleLabel(role: string): string {
  return role
    .replace(/_/g, ' ')
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function roleBadgeClass(role: string): string {
  const normalized = (role || '').toLowerCase();
  const palette: Record<string, string> = {
    manager: 'bg-blue-50 text-blue-700 border-blue-200',
    accountant: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    collector: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    agent: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    casual_laborer: 'bg-amber-50 text-amber-700 border-amber-200',
    veterinary_officer: 'bg-violet-50 text-violet-700 border-violet-200',
    leadership: 'bg-slate-100 text-slate-700 border-slate-200',
    regulator: 'bg-rose-50 text-rose-700 border-rose-200',
    viewer: 'bg-gray-100 text-gray-700 border-gray-200',
    umucunda_a: 'bg-sky-50 text-sky-700 border-sky-200',
    umucunda_b: 'bg-sky-50 text-sky-700 border-sky-200',
  };
  return palette[normalized] || 'bg-gray-100 text-gray-700 border-gray-200';
}

const INPUT_FULL =
  'input h-9 min-h-[2.25rem] !py-1.5 !px-3 text-sm w-full text-gray-900';

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function defaultStaffStatsFrom() {
  const x = new Date();
  x.setUTCDate(x.getUTCDate() - 13);
  return isoDate(x);
}

function sanitizeDateParam(value: string | null, fallback: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

type StaffExportRow = {
  name: string;
  role: string;
  phone: string;
  status: string;
  on_shift: string;
  shifts_completed: string;
  last_shift_ended: string;
};

function shiftSummaryForUser(shifts: MccShiftRow[], userId: string) {
  let open: MccShiftRow | null = null;
  let completed = 0;
  let lastEnded: string | null = null;
  for (const s of shifts) {
    if (s.user_id !== userId) continue;
    if (s.open) open = s;
    if (s.ended_at) {
      completed += 1;
      if (!lastEnded || new Date(s.ended_at) > new Date(lastEnded)) lastEnded = s.ended_at;
    }
  }
  return { openShift: open, completedCount: completed, lastEndedAt: lastEnded };
}

export default function OperationsStaffPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { currentAccount, user } = useAuthStore();
  const { hasAnyPermission, canManageUsers } = usePermission();
  const toast = useToastStore();
  const accountId = currentAccount?.account_id ?? '';
  const canViewOps = hasAnyPermission(['mcc_view_operations', 'view_collections']);
  const canManageShifts = hasAnyPermission([
    'mcc_manage_operations',
    'mcc_manage_own_operations',
    'mcc_floor_operations',
  ]);
  const canManageTeam = canManageUsers();
  const roleLower = (currentAccount?.role ?? '').toLowerCase();
  const canStartShiftForOthers = ['manager', 'system_admin', 'admin', 'owner'].includes(roleLower);

  const [staff, setStaff] = useState<MccStaffOption[]>([]);
  const [shifts, setShifts] = useState<MccShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [from, setFrom] = useState(() => sanitizeDateParam(searchParams.get('from'), defaultStaffStatsFrom()));
  const [to, setTo] = useState(() => sanitizeDateParam(searchParams.get('to'), isoDate(new Date())));
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    profileKey: 'milk_receptionist' as InviteProfileKey,
  });

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('from', from);
    params.set('to', to);
    const current = searchParams.toString();
    const next = params.toString();
    if (next !== current) {
      router.replace(`${pathname}?${next}`, { scroll: false });
    }
  }, [from, to, pathname, router, searchParams]);

  const load = useCallback(async () => {
    if (!accountId || !canViewOps) return;
    setLoading(true);
    try {
      const [stRes, shRes] = await Promise.all([
        mccOperationsApi.staffOptions(accountId),
        mccOperationsApi.listShifts(accountId, from, to),
      ]);
      setStaff(stRes.data ?? []);
      setShifts(shRes.data ?? []);
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to load staff',
      );
    } finally {
      setLoading(false);
    }
  }, [accountId, canViewOps, from, to, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const sortedStaff = useMemo(() => {
    return [...staff].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [staff]);
  const {
    page: staffPage,
    setPage: setStaffPage,
    paginatedItems: paginatedStaff,
    totalPages: staffTotalPages,
    totalItems: staffTotalItems,
    startIndex: staffStartIndex,
    pageSize: staffPageSize,
  } = useClientPagination(sortedStaff, { resetKey: `${from}-${to}` });

  const staffExportData = useMemo((): StaffExportRow[] => {
    return sortedStaff.map((s) => {
      const agg = shiftSummaryForUser(shifts, s.user_id);
      return {
        name: s.name,
        role: s.role,
        phone: s.phone ?? '',
        status: s.status,
        on_shift: agg.openShift ? 'Yes' : 'No',
        shifts_completed: String(agg.completedCount),
        last_shift_ended: agg.lastEndedAt ? new Date(agg.lastEndedAt).toLocaleString() : '',
      };
    });
  }, [sortedStaff, shifts]);

  const handleClearFilters = () => {
    setFrom(defaultStaffStatsFrom());
    setTo(isoDate(new Date()));
  };

  const startShiftFor = async (targetUserId: string) => {
    if (!accountId) return;
    setBusyUserId(targetUserId);
    try {
      await mccOperationsApi.startShift({
        account_id: accountId,
        user_id: canStartShiftForOthers ? targetUserId : undefined,
      });
      toast.success('Shift started.');
      await load();
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not start shift',
      );
    } finally {
      setBusyUserId(null);
    }
  };

  const endShiftFor = async (shiftId: string) => {
    if (!accountId) return;
    setBusyUserId(shiftId);
    try {
      await mccOperationsApi.endShift(shiftId, accountId);
      toast.success('Shift ended.');
      await load();
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not end shift',
      );
    } finally {
      setBusyUserId(null);
    }
  };

  const submitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.email.trim() && !inviteForm.phone.trim()) {
      toast.error('Email or phone is required');
      return;
    }
    if (!inviteForm.firstName.trim() || !inviteForm.lastName.trim()) {
      toast.error('First and last name are required');
      return;
    }
    if (!accountId) return;
    setInviteSaving(true);
    try {
      const selected = INVITE_ROLE_PROFILES[inviteForm.profileKey];
      const res = await employeesApi.inviteEmployee({
        first_name: inviteForm.firstName.trim(),
        last_name: inviteForm.lastName.trim(),
        email: inviteForm.email.trim() || undefined,
        phone: inviteForm.phone.trim() || undefined,
        password: inviteForm.password.trim() || undefined,
        role: selected.backendRole,
        access_group: selected.accessGroup,
        account_id: accountId,
      });
      if (res.code === 201 || res.code === 200) {
        toast.success('Team member added.');
        setInviteOpen(false);
        setInviteForm({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          password: '',
          profileKey: 'milk_receptionist',
        });
        await load();
      } else {
        toast.error((res as { message?: string }).message ?? 'Invite failed');
      }
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Invite failed',
      );
    } finally {
      setInviteSaving(false);
    }
  };

  if (!canViewOps) {
    return (
      <div className="rounded-sm border border-gray-200 bg-white p-6 text-sm text-gray-600">
        You don&apos;t have permission to view MCC staff.
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full min-w-0">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
          {canManageTeam ? (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="btn btn-primary inline-flex items-center gap-2 shrink-0"
            >
              <Icon icon={faUserPlus} size="sm" />
              Invite member
            </button>
          ) : null}
        </div>
      </div>

      <FilterBar>
        <FilterBarGroup label="Date From">
          <input
            type="date"
            value={from}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setFrom(e.target.value)}
            className={INPUT_FULL}
          />
        </FilterBarGroup>
        <FilterBarGroup label="Date To">
          <input
            type="date"
            value={to}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setTo(e.target.value)}
            className={INPUT_FULL}
          />
        </FilterBarGroup>
        <FilterBarActions onClear={handleClearFilters} />
        <FilterBarApply onApply={() => void load()} />
        <FilterBarExport<StaffExportRow>
          data={staffExportData}
          exportFilename="mcc-staff-shift-stats"
          exportColumns={[
            { key: 'name', label: 'Name' },
            { key: 'role', label: 'Role' },
            { key: 'phone', label: 'Phone' },
            { key: 'status', label: 'Status' },
            { key: 'on_shift', label: 'On shift' },
            { key: 'shifts_completed', label: `Shifts completed (${from}–${to})` },
            { key: 'last_shift_ended', label: 'Last shift ended' },
          ]}
          disabled={loading || sortedStaff.length === 0}
        />
      </FilterBar>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="card-body">
            <p className="text-gray-500 text-sm">Loading…</p>
          </div>
        ) : sortedStaff.length === 0 ? (
          <div className="card-body">
            <p className="text-gray-500 text-sm">No active staff linked to this account.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600 bg-gray-50/80">
                  <th className="py-2.5 px-3 sm:px-4 font-medium w-10 text-right tabular-nums">#</th>
                  <th className="py-2.5 px-3 sm:px-4 font-medium">Name</th>
                  <th className="py-2.5 px-4 font-medium">Role</th>
                  <th className="py-2.5 px-4 font-medium hidden md:table-cell">Phone</th>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                  <th className="py-2.5 px-4 font-medium">On shift</th>
                  <th className="py-2.5 px-4 font-medium text-right tabular-nums">Shifts ({from}–{to})</th>
                  <th className="py-2.5 px-4 font-medium hidden lg:table-cell">Last ended</th>
                  <th className="py-2.5 px-4 font-medium w-[1%] whitespace-nowrap"> </th>
                </tr>
              </thead>
              <tbody>
                {paginatedStaff.map((row, index) => {
                  const agg = shiftSummaryForUser(shifts, row.user_id);
                  const inactive = (row.status || '').toLowerCase() === 'inactive';
                  const isSelf = user?.id === row.user_id;
                  const showStart =
                    canManageShifts &&
                    !inactive &&
                    !agg.openShift &&
                    (isSelf || canStartShiftForOthers);
                  const showEnd = canManageShifts && agg.openShift;

                  return (
                    <tr
                      key={row.user_account_id}
                      className={`border-b border-gray-100 last:border-0 ${inactive ? 'opacity-60' : ''}`}
                    >
                      <td className="py-2.5 px-3 sm:px-4 text-right tabular-nums text-gray-500">{staffStartIndex + index + 1}</td>
                      <td className="py-2.5 px-3 sm:px-4 text-gray-900 font-medium">
                        {row.name}
                        {isSelf ? (
                          <span className="ml-2 text-xs font-normal text-gray-500">(you)</span>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-4 text-gray-800">
                        <span className={`inline-flex rounded-sm border px-2 py-0.5 text-xs font-semibold ${roleBadgeClass(row.role)}`}>
                          {toRoleLabel(row.role)}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-gray-600 hidden md:table-cell">{row.phone || '—'}</td>
                      <td className="py-2.5 px-4">
                        <span
                          className={
                            inactive
                              ? 'inline-flex rounded-sm bg-gray-100 px-2 py-0.5 text-xs text-gray-700'
                              : 'inline-flex rounded-sm bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800'
                          }
                        >
                          {inactive ? 'Inactive' : 'Active'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-gray-800">
                        {agg.openShift ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-800">
                            <Icon icon={faClock} size="xs" className="opacity-80" />
                            <span className="text-xs sm:text-sm whitespace-nowrap">
                              Since {new Date(agg.openShift.started_at).toLocaleString()}
                            </span>
                          </span>
                        ) : (
                          <span className="text-gray-500">Off</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-gray-800">{agg.completedCount}</td>
                      <td className="py-2.5 px-4 text-gray-600 text-xs whitespace-nowrap hidden lg:table-cell">
                        {agg.lastEndedAt ? new Date(agg.lastEndedAt).toLocaleString() : '—'}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex flex-col gap-1 items-end">
                          {showEnd && agg.openShift ? (
                            <button
                              type="button"
                              disabled={busyUserId === agg.openShift.id}
                              onClick={() => endShiftFor(agg.openShift!.id)}
                              className="btn btn-secondary btn-sm whitespace-nowrap"
                            >
                              {busyUserId === agg.openShift.id ? '…' : 'End shift'}
                            </button>
                          ) : null}
                          {showStart ? (
                            <button
                              type="button"
                              disabled={busyUserId === row.user_id}
                              onClick={() => startShiftFor(row.user_id)}
                              className="btn btn-primary btn-sm whitespace-nowrap"
                            >
                              {busyUserId === row.user_id ? '…' : 'Start shift'}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!loading && sortedStaff.length > 0 && (
        <Pagination
          currentPage={staffPage}
          totalPages={staffTotalPages}
          totalItems={staffTotalItems}
          pageSize={staffPageSize}
          itemLabel="staff"
          onPageChange={setStaffPage}
        />
      )}

      <Modal open={inviteOpen} onClose={() => !inviteSaving && setInviteOpen(false)} title="Invite member" maxWidth="max-w-md">
        <p className="text-sm text-gray-600 mb-4">
          Add someone by email or phone. Existing users are linked to this account; new users need a password below.
        </p>
        <form onSubmit={submitInvite} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={inviteForm.email}
              onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
              className="input w-full text-gray-900"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={inviteForm.phone}
              onChange={(e) => setInviteForm((f) => ({ ...f, phone: e.target.value }))}
              className="input w-full text-gray-900"
              placeholder="250788123456"
            />
          </div>
          <p className="text-xs text-gray-500">At least one of email or phone.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First name *</label>
              <input
                type="text"
                value={inviteForm.firstName}
                onChange={(e) => setInviteForm((f) => ({ ...f, firstName: e.target.value }))}
                className="input w-full text-gray-900"
                placeholder="Given name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last name *</label>
              <input
                type="text"
                value={inviteForm.lastName}
                onChange={(e) => setInviteForm((f) => ({ ...f, lastName: e.target.value }))}
                className="input w-full text-gray-900"
                placeholder="Family name"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={inviteForm.password}
              onChange={(e) => setInviteForm((f) => ({ ...f, password: e.target.value }))}
              className="input w-full text-gray-900"
              placeholder="Min 6 characters (new users only)"
              minLength={6}
            />
            <p className="text-xs text-gray-500 mt-1">Required only when they don&apos;t have an account yet.</p>
          </div>
          <div>
            <label htmlFor="invite-role" className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <SearchableSelect
              id="invite-role"
              options={INVITE_ROLE_SELECT_OPTIONS}
              value={inviteForm.profileKey}
              onChange={(v) => {
                if (INVITE_PROFILE_KEYS.includes(v as InviteProfileKey)) {
                  setInviteForm((f) => ({ ...f, profileKey: v as InviteProfileKey }));
                }
              }}
              placeholder="Select role"
              portalDropdown
              showSearch={false}
              maxListHeight={200}
            />
            <p className="text-xs text-gray-500 mt-1">{INVITE_ROLE_PROFILES[inviteForm.profileKey].description}</p>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={() => setInviteOpen(false)} className="btn btn-secondary" disabled={inviteSaving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={inviteSaving}>
              {inviteSaving ? (
                <>
                  <Icon icon={faSpinner} spin size="sm" className="mr-2" />
                  Adding…
                </>
              ) : (
                'Add'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
