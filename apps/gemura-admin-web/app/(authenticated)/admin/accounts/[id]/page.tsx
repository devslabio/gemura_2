'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { accountsApi, type Account } from '@/lib/api/accounts';
import { adminApi, type TenantAccountAdminDetail } from '@/lib/api/admin';
import AccountOperationalMetricsSection from './AccountOperationalMetricsSection';
import Modal from '@/app/components/Modal';
import AccountLocationEditor from '@/app/components/admin/AccountLocationEditor';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import { usePermission } from '@/hooks/usePermission';
import Icon, {
  faBuilding,
  faArrowsUpDown,
  faArrowLeft,
  faSpinner,
  faCalendar,
  faTag,
  faMapPin,
  faClipboardList,
  faChartBar,
  faEdit,
  faUserPlus,
} from '@/app/components/Icon';

function SidebarStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-sm border border-gray-100 bg-gray-50/90 px-3 py-2.5 min-h-[4rem] flex flex-col justify-center">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 leading-tight">{label}</p>
      <p className="text-sm font-medium text-gray-900 mt-1 tabular-nums leading-snug break-words">{value}</p>
    </div>
  );
}
import { DetailPageSkeleton } from '@/app/components/SkeletonLoader';

export default function AccountDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const accountId = params.id as string;
  const { setCurrentAccount } = useAuthStore();
  const { currentAccount } = useAuthStore();
  const { canManageUsers, isAdmin, canViewPlatformAccounts } = usePermission();
  const allowed = canViewPlatformAccounts();
  const canEditPlatformAccount = canManageUsers() || isAdmin();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [platform, setPlatform] = useState<TenantAccountAdminDetail | null>(null);
  const [membership, setMembership] = useState<Account | null>(null);
  const [switching, setSwitching] = useState(false);
  const [geolocationModalOpen, setGeolocationModalOpen] = useState(false);

  const adminAccountId = currentAccount?.account_id;

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError('');
    try {
      const [platformRes, mineRes] = await Promise.all([
        adminApi.getTenantAccountForAdmin(adminAccountId, accountId),
        accountsApi.getUserAccounts(),
      ]);

      if (platformRes.code === 200 && platformRes.data) {
        setPlatform(platformRes.data);
      } else {
        setPlatform(null);
        setError(platformRes.message || 'Account not found');
      }

      if (mineRes.code === 200 && mineRes.data?.accounts) {
        const m = mineRes.data.accounts.find((a) => a.account_id === accountId);
        setMembership(m ?? null);
      } else {
        setMembership(null);
      }
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to load account.');
      setPlatform(null);
    } finally {
      setLoading(false);
    }
  }, [allowed, adminAccountId, accountId]);

  useEffect(() => {
    if (!allowed) {
      router.replace('/dashboard');
      return;
    }
    load();
  }, [allowed, load, router]);

  const handleSwitchAccount = async () => {
    if (!membership || switching) return;
    try {
      setSwitching(true);
      const response = await accountsApi.switchAccount({ account_id: membership.account_id });
      if (response.code === 200) {
        const newAccount = response.data.accounts.find((acc) => acc.account_id === membership.account_id);
        if (newAccount) setCurrentAccount(newAccount);
        await load();
        useToastStore.getState().success('Account switched successfully!');
        router.push('/admin/accounts');
      } else {
        setError(response.message || 'Failed to switch account');
      }
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to switch account.');
    } finally {
      setSwitching(false);
    }
  };

  if (!allowed) return null;

  if (loading) return <DetailPageSkeleton />;

  if (error && !platform) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
        <Link href="/admin/accounts" className="text-sm text-[var(--primary)]">
          ← Back to accounts
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/admin/accounts" className="text-sm text-gray-600 hover:text-[var(--primary)] mb-2 inline-flex items-center">
            <Icon icon={faArrowLeft} size="sm" className="mr-2" />
            Back to Accounts
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{platform?.name || 'Account'}</h1>
        </div>
        {membership && !membership.is_default && (
          <button type="button" onClick={handleSwitchAccount} disabled={switching} className="btn btn-primary">
            {switching ? (
              <>
                <Icon icon={faSpinner} size="sm" spin className="mr-2" />
                Switching...
              </>
            ) : (
              <>
                <Icon icon={faArrowsUpDown} size="sm" className="mr-2" />
                Switch session to this account
              </>
            )}
          </button>
        )}
      </div>

      {error ? <div className="bg-red-50 border border-red-200 rounded-sm p-4 text-sm text-red-600">{error}</div> : null}

      {platform && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Platform account</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Name</label>
                  <div className="flex items-center">
                    <Icon icon={faBuilding} size="sm" className="mr-2 text-gray-400" />
                    {platform.name}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Code</label>
                  <div className="flex items-center">
                    <Icon icon={faTag} size="sm" className="mr-2 text-gray-400" />
                    {platform.code || '—'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Type</label>
                  <span className="capitalize text-gray-900">{platform.type}</span>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Status</label>
                  <span className="capitalize text-gray-900">{platform.status}</span>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-500 mb-1">Operational location</label>
                  <div className="flex items-start gap-2">
                    <Icon icon={faMapPin} size="sm" className="mr-2 text-gray-400 mt-0.5" />
                    <span className="text-gray-900">{platform.operational_location_label || 'Not set'}</span>
                  </div>
                  {canEditPlatformAccount ? (
                    <div className="mt-3">
                      <Link
                        href="/admin/regional-supervision"
                        className="btn btn-secondary text-sm inline-flex items-center w-fit"
                      >
                        <Icon icon={faUserPlus} size="sm" className="mr-2" />
                        Add supervisor
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {!membership && (
              <div className="bg-gray-50 border border-gray-200 rounded-sm p-6">
                <p className="text-sm text-gray-700">
                  You are not linked to this account as a user. Platform admins can still view directory data; switch session is only
                  available for accounts you belong to.
                </p>
              </div>
            )}

            {(platform.type === 'tenant' || platform.type === 'branch') && (
              <AccountOperationalMetricsSection
                adminAccountId={adminAccountId}
                detail={platform}
                onReload={load}
                allowEdit={canEditPlatformAccount}
              />
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <Icon icon={faCalendar} size="sm" className="text-gray-400" />
                Membership timeline
              </h2>
              <p className="text-xs text-gray-500 mb-4">Dates for your user link to this account.</p>
              {membership ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Account created</label>
                    <div className="flex items-center text-sm text-gray-900">
                      <Icon icon={faCalendar} size="sm" className="mr-2 text-gray-400 shrink-0" />
                      {new Date(membership.account_created_at).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Access granted</label>
                    <div className="flex items-center text-sm text-gray-900">
                      <Icon icon={faCalendar} size="sm" className="mr-2 text-gray-400 shrink-0" />
                      {new Date(membership.access_granted_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600 leading-relaxed">
                  No personal membership on this account. You still have directory visibility as a platform admin.
                </p>
              )}
            </div>

            {(platform.type === 'tenant' || platform.type === 'branch') && (
              <>
                <div className="bg-white border border-gray-200 rounded-sm p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Icon icon={faMapPin} size="sm" className="text-gray-400" />
                        Geolocation
                      </h2>
                    </div>
                    {canEditPlatformAccount ? (
                      <button
                        type="button"
                        className="btn btn-primary text-sm shrink-0 self-start sm:self-auto"
                        onClick={() => setGeolocationModalOpen(true)}
                      >
                        <Icon icon={faEdit} size="sm" className="mr-2" />
                        Edit geolocation
                      </button>
                    ) : null}
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Location</label>
                    <p className="text-sm text-gray-900 leading-snug">{platform.operational_location_label || 'Not set'}</p>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-sm p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
                    <Icon icon={faChartBar} size="sm" className="text-gray-400" />
                    Operations snapshot
                  </h2>
                  <p className="text-xs text-gray-500 mb-4">Quick read-only context; full metrics below.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <SidebarStat
                      label="Expected deliveries / day"
                      value={
                        platform.operational_profile?.expected_daily_deliveries != null
                          ? platform.operational_profile.expected_daily_deliveries
                          : '—'
                      }
                    />
                    <SidebarStat
                      label="Cooling tanks"
                      value={platform.cooling_tank_profiles?.length ?? 0}
                    />
                    <SidebarStat
                      label="Farmers supplying"
                      value={
                        platform.operational_profile?.total_farmers_supplying != null
                          ? platform.operational_profile.total_farmers_supplying
                          : '—'
                      }
                    />
                    <SidebarStat
                      label="Tank used"
                      value={
                        platform.facility_snapshot?.tank_used_pct != null
                          ? `${platform.facility_snapshot.tank_used_pct}%`
                          : '—'
                      }
                    />
                  </div>
                  {platform.facility_snapshot?.power_status ? (
                    <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">
                      Power:{' '}
                      <span className="font-medium text-gray-800 capitalize">{platform.facility_snapshot.power_status}</span>
                      {platform.facility_snapshot.updated_at
                        ? ` · updated ${new Date(platform.facility_snapshot.updated_at).toLocaleString()}`
                        : null}
                    </p>
                  ) : null}
                </div>
              </>
            )}

            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <Icon icon={faClipboardList} size="sm" className="text-gray-400" />
                Directory shortcuts
              </h2>
              <p className="text-xs text-gray-500 mb-4">Jump to related admin lists.</p>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/admin/accounts" className="text-[var(--primary)] hover:underline">
                    All platform accounts
                  </Link>
                </li>
                {canEditPlatformAccount ? (
                  <li>
                    <Link href="/admin/regional-supervision" className="text-[var(--primary)] hover:underline">
                      Regional supervision
                    </Link>
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </div>
      )}

      {canEditPlatformAccount && platform && (platform.type === 'tenant' || platform.type === 'branch') ? (
        <Modal
          open={geolocationModalOpen}
          onClose={() => setGeolocationModalOpen(false)}
          title={`Geolocation — ${platform.name}`}
          maxWidth="max-w-2xl"
        >
          <AccountLocationEditor
            accountId={platform.id}
            adminAccountId={adminAccountId}
            initialLocationId={platform.operational_location_id}
            onCancel={() => setGeolocationModalOpen(false)}
            onSaved={async () => {
              setGeolocationModalOpen(false);
              const res = await adminApi.getTenantAccountForAdmin(adminAccountId, accountId);
              if (res.code === 200 && res.data) setPlatform(res.data);
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}
