'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { accountsApi, type Account } from '@/lib/api/accounts';
import { adminApi } from '@/lib/api/admin';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import { usePermission } from '@/hooks/usePermission';
import Icon, {
  faBuilding,
  faUserShield,
  faCheckCircle,
  faArrowsUpDown,
  faArrowLeft,
  faSpinner,
  faCalendar,
  faTag,
  faMapPin,
} from '@/app/components/Icon';
import { DetailPageSkeleton } from '@/app/components/SkeletonLoader';

export default function AccountDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const accountId = params.id as string;
  const { setCurrentAccount } = useAuthStore();
  const { currentAccount } = useAuthStore();
  const { canManageUsers, isAdmin } = usePermission();
  const allowed = canManageUsers() || isAdmin();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [platform, setPlatform] = useState<{
    id: string;
    code: string | null;
    name: string;
    type: string;
    status: string;
    operational_location_label: string | null;
  } | null>(null);
  const [membership, setMembership] = useState<Account | null>(null);
  const [switching, setSwitching] = useState(false);

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

  const getPermissions = () => {
    if (!membership?.permissions) return [];
    if (Array.isArray(membership.permissions)) return membership.permissions;
    if (typeof membership.permissions === 'object') {
      const perms = membership.permissions as Record<string, boolean>;
      return Object.keys(perms).filter((key) => perms[key] === true);
    }
    return [];
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

  const permissions = getPermissions();

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
                  <p className="text-xs text-gray-500 mt-2">
                    Edit geography on{' '}
                    <Link href="/admin/regional-supervision" className="text-[var(--primary)] hover:underline">
                      Regional supervision
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </div>

            {membership ? (
              <>
                <div className="bg-white border border-gray-200 rounded-sm p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Your access</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">Your role</label>
                      <div className="flex items-center">
                        <Icon icon={faUserShield} size="sm" className="mr-2 text-gray-400" />
                        {membership.role || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">Default account</label>
                      {membership.is_default ? (
                        <div className="flex items-center text-green-600">
                          <Icon icon={faCheckCircle} size="sm" className="mr-2" />
                          Yes
                        </div>
                      ) : (
                        'No'
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-sm p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Permissions (your membership)</h2>
                  {permissions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {permissions.map((permission: string) => (
                        <span key={permission} className="inline-flex px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                          {permission.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No specific permission flags on this membership snapshot.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-sm p-6">
                <p className="text-sm text-gray-700">
                  You are not linked to this account as a user. platform admins can still view directory data; switch session is only
                  available for accounts you belong to.
                </p>
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Identifiers</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-500 mb-1">Account ID</label>
                <p className="text-sm font-mono break-all">{platform.id}</p>
              </div>
              {membership && (
                <>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Account created</label>
                    <div className="flex items-center text-sm">
                      <Icon icon={faCalendar} size="sm" className="mr-2 text-gray-400" />
                      {new Date(membership.account_created_at).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Access granted</label>
                    <div className="flex items-center text-sm">
                      <Icon icon={faCalendar} size="sm" className="mr-2 text-gray-400" />
                      {new Date(membership.access_granted_at).toLocaleString()}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
