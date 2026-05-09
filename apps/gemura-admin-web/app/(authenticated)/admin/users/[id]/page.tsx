'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { PermissionService } from '@/lib/services/permission.service';
import { adminApi, type RoleItem } from '@/lib/api/admin';
import { selectPlatformRolesForAssignment } from '@/lib/utils/platform-roles-picker';
import { useAuthStore } from '@/store/auth';
import Icon, { faUser, faEnvelope, faPhone, faBuilding, faUserShield, faEdit, faTrash, faArrowLeft, faCalendar, faCheckCircle, faSpinner, faMinus } from '@/app/components/Icon';
import { useToastStore } from '@/store/toast';
import { DetailPageSkeleton } from '@/app/components/SkeletonLoader';
import ConfirmDialog from '@/app/components/ConfirmDialog';

type ActivityKey = 'suppliers' | 'customers' | 'sales' | 'collections' | 'farms' | 'accounts' | 'members';

function slugKey(s: string) {
  return s.trim().toLowerCase();
}

export default function UserDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  const { currentAccount } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [catalogRoles, setCatalogRoles] = useState<RoleItem[]>([]);
  const [draftPlatformRoleId, setDraftPlatformRoleId] = useState('');
  const [assigningRole, setAssigningRole] = useState(false);

  const [assignableAccounts, setAssignableAccounts] = useState<Array<{ id: string; code: string | null; name: string; type: string }>>([]);
  const [loadingAssignable, setLoadingAssignable] = useState(false);
  const [membershipSearch, setMembershipSearch] = useState('');
  const [draftLinkAccountId, setDraftLinkAccountId] = useState('');
  const [draftLinkRoleId, setDraftLinkRoleId] = useState('');
  const [membershipBusy, setMembershipBusy] = useState<'add' | false>(false);
  const [removingAccountId, setRemovingAccountId] = useState<string | null>(null);
  const [revokeMembershipTarget, setRevokeMembershipTarget] = useState<{
    accountId: string;
    accountLabel: string;
  } | null>(null);

  useEffect(() => {
    if (!PermissionService.canManageUsers() && !PermissionService.isAdmin()) {
      router.push('/admin/users');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    adminApi
      .getUserById(userId, currentAccount?.account_id)
      .then((response) => {
        if (!cancelled) {
          if (response.code === 200 && response.data) setUser(response.data);
          else setError('Failed to load user data');
        }
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.response?.data?.message || err?.message || 'Failed to load user.');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [router, userId, currentAccount?.account_id]);

  useEffect(() => {
    const aid = currentAccount?.account_id;
    if (!aid) return;
    adminApi.getRoles(aid).then((res) => {
      if (res.code === 200 && res.data?.roles?.length) setCatalogRoles(res.data.roles);
      else setCatalogRoles([]);
    });
  }, [currentAccount?.account_id]);

  useEffect(() => {
    const aid = currentAccount?.account_id;
    if (!aid || loading) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      setLoadingAssignable(true);
      adminApi
        .searchAssignableAccounts({ accountId: aid, search: membershipSearch.trim() || undefined, limit: 60 })
        .then((res) => {
          if (!cancelled && res.code === 200 && Array.isArray(res.data?.accounts)) {
            setAssignableAccounts(res.data.accounts);
          }
        })
        .catch(() => !cancelled && setAssignableAccounts([]))
        .finally(() => !cancelled && setLoadingAssignable(false));
    }, 340);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [currentAccount?.account_id, membershipSearch, loading]);

  useEffect(() => {
    if (!user) return;
    const cid = user.platform_role_id as string | undefined;
    if (cid) {
      setDraftPlatformRoleId(cid);
      return;
    }
    const slug = typeof user.role === 'string' ? user.role.replace(/^owner$/i, 'system_admin') : '';
    const match = catalogRoles.find((r) => r.code === slug || r.code === slugKey(slug));
    setDraftPlatformRoleId(match?.id ?? '');
  }, [user, catalogRoles]);

  const handleAssignRole = async () => {
    const aid = currentAccount?.account_id;
    if (!aid || !draftPlatformRoleId) {
      useToastStore.getState().error('Choose a platform role.');
      return;
    }
    setAssigningRole(true);
    try {
      const res = await adminApi.updateUser(userId, { platform_role_id: draftPlatformRoleId }, aid);
      if (res.code !== 200) {
        useToastStore.getState().error(res.message || 'Failed to update role');
        return;
      }
      useToastStore.getState().success('Platform role assigned.');
      const refreshed = await adminApi.getUserById(userId, aid);
      if (refreshed.code === 200 && refreshed.data) setUser(refreshed.data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        'Failed to update role.';
      useToastStore.getState().error(msg);
    } finally {
      setAssigningRole(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    if (!confirm(`Are you sure you want to delete "${user.name}"?`)) return;
    try {
      await adminApi.deleteUser(userId, currentAccount?.account_id);
      useToastStore.getState().success('User deleted successfully.');
      router.push('/admin/users');
    } catch (err: any) {
      useToastStore.getState().error(err?.response?.data?.message || 'Failed to delete user.');
    }
  };

  const selectableRoles = useMemo(
    () => selectPlatformRolesForAssignment(catalogRoles, user?.platform_role_id as string | undefined),
    [catalogRoles, user?.platform_role_id],
  );

  const stats = user?.stats || {
    accounts: 0,
    members: 0,
    suppliers: 0,
    customers: 0,
    sales: 0,
    collections: 0,
    farms: 0,
  };

  const userAccounts = Array.isArray(user?.user_accounts) ? user.user_accounts : [];

  const activeMemberships = useMemo(() => userAccounts.filter((u: any) => u.status === 'active'), [userAccounts]);

  const rolesForNewMembership = useMemo(
    () => selectPlatformRolesForAssignment(catalogRoles),
    [catalogRoles],
  );

  const activeMemberAccountIds = useMemo(() => {
    const s = new Set<string>();
    for (const row of activeMemberships as any[]) {
      const id = row.account_id ?? row.account?.id;
      if (id) s.add(id);
    }
    return s;
  }, [activeMemberships]);

  const filteredAssignableAccounts = useMemo(
    () => assignableAccounts.filter((a) => !activeMemberAccountIds.has(a.id)),
    [assignableAccounts, activeMemberAccountIds],
  );

  useEffect(() => {
    if (draftLinkRoleId) return;
    const rid = rolesForNewMembership.find((r) => r.id)?.id;
    if (rid) setDraftLinkRoleId(rid);
  }, [rolesForNewMembership, draftLinkRoleId]);

  const reloadUserFromApi = async () => {
    const aid = currentAccount?.account_id;
    if (!aid) return;
    const refreshed = await adminApi.getUserById(userId, aid);
    if (refreshed.code === 200 && refreshed.data) setUser(refreshed.data);
  };

  const handleAddMembership = async () => {
    const aid = currentAccount?.account_id;
    if (!aid || !draftLinkAccountId) {
      useToastStore.getState().error('Choose an account to grant access.');
      return;
    }
    setMembershipBusy('add');
    try {
      const res = await adminApi.assignUserAccountMembership(
        userId,
        { link_account_id: draftLinkAccountId, ...(draftLinkRoleId ? { platform_role_id: draftLinkRoleId } : {}) },
        aid,
      );
      if (res.code !== 200) {
        useToastStore.getState().error(res.message || 'Failed to grant access');
        return;
      }
      useToastStore.getState().success('Account access granted.');
      setDraftLinkAccountId('');
      await reloadUserFromApi();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        'Failed to grant access.';
      useToastStore.getState().error(msg);
    } finally {
      setMembershipBusy(false);
    }
  };

  const handleRevokeMembershipConfirm = async () => {
    const aid = currentAccount?.account_id;
    const target = revokeMembershipTarget;
    if (!target || !aid) {
      setRevokeMembershipTarget(null);
      return;
    }
    if (activeMemberships.length <= 1) {
      useToastStore.getState().error('Grant access to another account before removing the only membership.');
      setRevokeMembershipTarget(null);
      return;
    }

    setRemovingAccountId(target.accountId);
    try {
      const res = await adminApi.removeUserAccountMembership(userId, target.accountId, aid);
      if (res.code !== 200) {
        useToastStore.getState().error(res.message || 'Failed to remove access');
        return;
      }
      useToastStore.getState().success('Account access removed.');
      setRevokeMembershipTarget(null);
      await reloadUserFromApi();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        'Failed to remove access.';
      useToastStore.getState().error(msg);
    } finally {
      setRemovingAccountId(null);
    }
  };

  /** Account used for operational_account_id on Business Activity deep-links (session account if member, else first active membership). */
  const scopedListAccountId = useMemo(() => {
    if (!user) return null;
    const activeUa = userAccounts.filter((u: any) => u.status === 'active');
    const ids = activeUa.map((u: any) => u.account_id || u.account?.id).filter(Boolean) as string[];
    if (currentAccount?.account_id && ids.includes(currentAccount.account_id)) return currentAccount.account_id;
    return ids[0] ?? null;
  }, [user, userAccounts, currentAccount?.account_id]);

  const metricCards: Array<{ key: ActivityKey; label: string; value: number }> = [
    { key: 'suppliers', label: 'Suppliers', value: stats.suppliers },
    { key: 'customers', label: 'Customers', value: stats.customers },
    { key: 'sales', label: 'Sales', value: stats.sales },
    { key: 'collections', label: 'Collections', value: stats.collections },
    { key: 'farms', label: 'Farms', value: stats.farms },
    { key: 'accounts', label: 'Accounts', value: stats.accounts },
    { key: 'members', label: 'Members', value: stats.members },
  ];

  const recordsHref = useMemo(
    () => (metric: ActivityKey) => {
      if (metric === 'accounts') return `/admin/users/${userId}/records/accounts`;
      if (metric === 'members') {
        const q = scopedListAccountId ? `?operational_account_id=${encodeURIComponent(scopedListAccountId)}` : '';
        return `/admin/users/${userId}/records/members${q}`;
      }
      const q = scopedListAccountId ? `?operational_account_id=${encodeURIComponent(scopedListAccountId)}` : '';
      return `/admin/users/${userId}/records/${metric}${q}`;
    },
    [userId, scopedListAccountId],
  );

  const persistedPlatformRoleId = typeof user?.platform_role_id === 'string' ? user.platform_role_id : '';
  const sameAsSavedPlatformRole =
    !!draftPlatformRoleId && !!persistedPlatformRoleId && draftPlatformRoleId === persistedPlatformRoleId;

  if (loading) return <DetailPageSkeleton />;

  if (error && !user) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/users" className="text-sm text-gray-600 hover:text-[var(--primary)] mb-2 inline-flex items-center">
            <Icon icon={faArrowLeft} size="sm" className="mr-2" />
            Back to Users
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{user?.name || 'User Details'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/users/${userId}/edit`} className="btn btn-primary">
            <Icon icon={faEdit} size="sm" className="mr-2" />
            Edit User
          </Link>
          <button type="button" onClick={handleDelete} className="btn border border-red-300 text-red-700 bg-white hover:bg-red-50">
            <Icon icon={faTrash} size="sm" className="mr-2" />
            Delete
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-sm p-4 text-sm text-red-600">{error}</div>}

      {user && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-500 mb-1">Full Name</label><div className="flex items-center"><Icon icon={faUser} size="sm" className="mr-2 text-gray-400" />{user.name || 'N/A'}</div></div>
                <div><label className="block text-sm text-gray-500 mb-1">Email</label><div className="flex items-center"><Icon icon={faEnvelope} size="sm" className="mr-2 text-gray-400" />{user.email || 'N/A'}</div></div>
                <div><label className="block text-sm text-gray-500 mb-1">Phone</label><div className="flex items-center"><Icon icon={faPhone} size="sm" className="mr-2 text-gray-400" />{user.phone || 'N/A'}</div></div>
                <div><label className="block text-sm text-gray-500 mb-1">Status</label><span className={`inline-flex px-2 py-1 text-xs rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{user.status || 'N/A'}</span></div>
              </div>
            </div>

            {user.mcc_onboarding && (
              <div className="bg-white border border-gray-200 rounded-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">MCC onboarding (linked)</h2>
                <p className="text-sm text-gray-600 mb-3">
                  Data from the public onboarding wizard for this user&apos;s approved submission.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Business</span>
                    <div className="font-medium">{user.mcc_onboarding.business_name}</div>
                    {user.mcc_onboarding.common_name && (
                      <div className="text-gray-600 text-xs">{user.mcc_onboarding.common_name}</div>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-500">Submission</span>
                    <div className="font-mono text-xs">{user.mcc_onboarding.submission_code}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Manager</span>
                    <div>
                      {user.mcc_onboarding.manager_first_name} {user.mcc_onboarding.manager_last_name}
                    </div>
                    <div className="font-mono text-xs">{user.mcc_onboarding.manager_phone}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Review / wizard</span>
                    <div>
                      {user.mcc_onboarding.review_status} · {user.mcc_onboarding.final_decision} (
                      {user.mcc_onboarding.pass_count})
                    </div>
                  </div>
                </div>
                <Link
                  href={`/admin/onboarding/${user.mcc_onboarding.id}`}
                  className="inline-block mt-4 text-sm text-primary font-medium hover:underline"
                >
                  Open full submission
                </Link>
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Account settings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Account type</label>
                  <div className="flex items-center text-gray-900">
                    <Icon icon={faBuilding} size="sm" className="mr-2 text-gray-400" />
                    {user.account_type || 'N/A'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Current platform role</label>
                  <div className="flex items-start text-gray-900">
                    <Icon icon={faUserShield} size="sm" className="mr-2 mt-0.5 text-gray-400" />
                    <div>
                      <div className="font-medium">{user.platform_role_name || user.role || '—'}</div>
                      {(user.platform_role_slug || user.role) && (
                        <div className="text-xs font-mono text-gray-500 mt-0.5">{user.platform_role_slug || user.role}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100">
                <label className="block text-sm font-medium text-gray-700 mb-2">Assign platform role (this account)</label>
                <p className="text-xs text-gray-500 mb-3">
                  Permissions come from the role definition; assigning a role clears legacy per-user permission overrides here.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <div className="flex-1 min-w-[200px]">
                    <select
                      value={draftPlatformRoleId}
                      onChange={(e) => setDraftPlatformRoleId(e.target.value)}
                      className="input w-full text-sm text-gray-900"
                      disabled={!selectableRoles.length}
                    >
                      <option value="">{catalogRoles.length ? 'Select role…' : 'Loading roles…'}</option>
                      {selectableRoles.map((r) => (
                        <option key={r.id} value={r.id!}>
                          {r.name} ({r.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleAssignRole()}
                    disabled={assigningRole || !draftPlatformRoleId || sameAsSavedPlatformRole}
                    className="btn btn-primary h-10 px-4 text-sm inline-flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    {assigningRole ? (
                      <>
                        <Icon icon={faSpinner} size="sm" spin />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Icon icon={faCheckCircle} size="sm" />
                        Assign role
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Account memberships</h2>
              <p className="text-xs text-gray-500 mb-4">
                Operational accounts this user can open in the app. You cannot revoke the last remaining membership until another account is granted.
              </p>
              <div className="divide-y divide-gray-100 rounded-sm border border-gray-100 mb-6">
                {activeMemberships.length === 0 ? (
                  <p className="p-4 text-sm text-gray-500">No active memberships.</p>
                ) : (
                  activeMemberships.map((row: any) => {
                    const accId = row.account_id ?? row.account?.id;
                    if (!accId) return null;
                    const label =
                      row.account?.name != null
                        ? `${row.account.name}${row.account?.code ? ` (${row.account.code})` : ''}`
                        : row.account?.code ?? accId;
                    const onlyOne = activeMemberships.length <= 1;
                    return (
                      <div key={accId} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{label}</div>
                          {(row.role || row.account?.role) && (
                            <div className="text-xs text-gray-500 mt-1">Role in account: {row.role ?? row.account?.role}</div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (activeMemberships.length <= 1) {
                              useToastStore.getState().error(
                                'Grant access to another account before removing the only membership.',
                              );
                              return;
                            }
                            setRevokeMembershipTarget({ accountId: accId, accountLabel: label });
                          }}
                          disabled={
                            onlyOne ||
                            removingAccountId !== null ||
                            !!membershipBusy ||
                            revokeMembershipTarget !== null
                          }
                          className="btn btn-secondary text-sm px-3 py-2 inline-flex items-center gap-2 border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50 whitespace-nowrap"
                          title={
                            onlyOne
                              ? 'Grant access to another account before removing this one'
                              : 'Remove access to this account'
                          }
                        >
                          {removingAccountId === accId ? (
                            <Icon icon={faSpinner} size="sm" spin />
                          ) : (
                            <Icon icon={faMinus} size="sm" />
                          )}
                          Remove access
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <h3 className="text-sm font-medium text-gray-800 mb-2">Grant access to another account</h3>
              <div className="space-y-3">
                <input
                  type="search"
                  placeholder="Search by account name or code…"
                  value={membershipSearch}
                  onChange={(e) => setMembershipSearch(e.target.value)}
                  className="input w-full max-w-xl text-sm"
                />
                <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Account</label>
                    <select
                      value={draftLinkAccountId}
                      onChange={(e) => setDraftLinkAccountId(e.target.value)}
                      className="input w-full max-w-xl text-sm text-gray-900"
                      disabled={loadingAssignable || filteredAssignableAccounts.length === 0}
                    >
                      <option value="">
                        {loadingAssignable
                          ? 'Loading accounts…'
                          : filteredAssignableAccounts.length
                            ? 'Select account…'
                            : membershipSearch.trim()
                              ? 'No matching accounts'
                              : 'No accounts left to add'}
                      </option>
                      {filteredAssignableAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}{a.code ? ` (${a.code})` : ''} · {a.type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Platform role in new account</label>
                    <select
                      value={draftLinkRoleId}
                      onChange={(e) => setDraftLinkRoleId(e.target.value)}
                      className="input w-full max-w-xl text-sm text-gray-900"
                      disabled={!rolesForNewMembership.length}
                    >
                      {rolesForNewMembership.map((r) => (
                        <option key={r.id} value={r.id!}>
                          {r.name} ({r.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleAddMembership()}
                    disabled={
                      !!membershipBusy || removingAccountId !== null || !draftLinkAccountId || !rolesForNewMembership.length
                    }
                    className="btn btn-primary h-10 px-4 text-sm inline-flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    {membershipBusy ? (
                      <>
                        <Icon icon={faSpinner} size="sm" spin />
                        Granting…
                      </>
                    ) : (
                      <>Grant access</>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Business Activity</h2>
              <p className="text-sm text-gray-600 mb-3">
                Open a full admin list (filters, export, pagination). Lists use your current admin account when this user is a member there;
                otherwise the first active membership — same fields as app.gemura.rw.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {metricCards.map((item) => (
                  <Link
                    key={item.key}
                    href={recordsHref(item.key)}
                    className={[
                      'rounded-sm border p-4 transition-colors text-left block',
                      'border-gray-200 bg-white hover:border-[var(--primary)] hover:bg-blue-50/40',
                    ].join(' ')}
                  >
                    <div className="text-xs uppercase tracking-wide text-gray-500">{item.label}</div>
                    <div className="mt-2 text-2xl font-semibold text-gray-900">{item.value}</div>
                    <div className="mt-2 text-xs font-medium text-[var(--primary)]">View full list →</div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Meta</h2>
            <div className="space-y-3">
              <div><label className="block text-sm text-gray-500 mb-1">Created At</label><div className="flex items-center text-sm"><Icon icon={faCalendar} size="sm" className="mr-2 text-gray-400" />{user.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}</div></div>
              {user.last_login && <div><label className="block text-sm text-gray-500 mb-1">Last Login</label><div className="flex items-center text-sm"><Icon icon={faCalendar} size="sm" className="mr-2 text-gray-400" />{new Date(user.last_login).toLocaleString()}</div></div>}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!revokeMembershipTarget}
        onClose={() => !removingAccountId && setRevokeMembershipTarget(null)}
        onConfirm={() => void handleRevokeMembershipConfirm()}
        title="Revoke account access?"
        message={
          revokeMembershipTarget && user?.name
            ? `Revoke ${user.name}'s access to “${revokeMembershipTarget.accountLabel}”? Tenant data stays.`
            : revokeMembershipTarget
              ? `Revoke access to “${revokeMembershipTarget.accountLabel}”? Tenant data stays.`
              : ''
        }
        confirmText="Revoke access"
        cancelText="Cancel"
        type="danger"
        loading={Boolean(removingAccountId && revokeMembershipTarget?.accountId === removingAccountId)}
        closeOnOverlayClick={!removingAccountId}
      />
    </div>
  );
}
