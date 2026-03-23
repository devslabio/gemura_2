'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { accountsApi, Account } from '@/lib/api/accounts';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import Icon, { faBuilding, faUserShield, faCheckCircle, faArrowsUpDown, faArrowLeft, faSpinner, faCalendar, faTag } from '@/app/components/Icon';
import { DetailPageSkeleton } from '@/app/components/SkeletonLoader';

export default function AccountDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const accountId = params.id as string;
  const { setCurrentAccount } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [account, setAccount] = useState<Account | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    loadAccount();
  }, [accountId]);

  const loadAccount = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await accountsApi.getUserAccounts();
      if (response.code === 200) {
        const foundAccount = response.data.accounts.find((acc) => acc.account_id === accountId);
        if (foundAccount) setAccount(foundAccount);
        else setError('Account not found');
      } else {
        setError(response.message || 'Failed to load account data');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load account.');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchAccount = async () => {
    if (!account || switching) return;
    try {
      setSwitching(true);
      const response = await accountsApi.switchAccount({ account_id: account.account_id });
      if (response.code === 200) {
        const newAccount = response.data.accounts.find((acc) => acc.account_id === account.account_id);
        if (newAccount) setCurrentAccount(newAccount);
        await loadAccount();
        useToastStore.getState().success('Account switched successfully!');
        router.push('/admin/accounts');
      } else {
        setError(response.message || 'Failed to switch account');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to switch account.');
    } finally {
      setSwitching(false);
    }
  };

  const getPermissions = () => {
    if (!account?.permissions) return [];
    if (Array.isArray(account.permissions)) return account.permissions;
    if (typeof account.permissions === 'object') {
      const perms = account.permissions as Record<string, boolean>;
      return Object.keys(perms).filter((key) => perms[key] === true);
    }
    return [];
  };

  if (loading) return <DetailPageSkeleton />;

  if (error && !account) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  const permissions = getPermissions();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/accounts" className="text-sm text-gray-600 hover:text-[var(--primary)] mb-2 inline-flex items-center">
            <Icon icon={faArrowLeft} size="sm" className="mr-2" />
            Back to Accounts
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{account?.account_name || 'Account Details'}</h1>
        </div>
        {account && !account.is_default && (
          <button onClick={handleSwitchAccount} disabled={switching} className="btn btn-primary">
            {switching ? <><Icon icon={faSpinner} size="sm" spin className="mr-2" />Switching...</> : <><Icon icon={faArrowsUpDown} size="sm" className="mr-2" />Switch to This Account</>}
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-sm p-4 text-sm text-red-600">{error}</div>}

      {account && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-500 mb-1">Account Name</label><div className="flex items-center"><Icon icon={faBuilding} size="sm" className="mr-2 text-gray-400" />{account.account_name}</div></div>
                <div><label className="block text-sm text-gray-500 mb-1">Account Code</label><div className="flex items-center"><Icon icon={faTag} size="sm" className="mr-2 text-gray-400" />{account.account_code}</div></div>
                <div><label className="block text-sm text-gray-500 mb-1">Account Type</label><span className="capitalize text-gray-900">{account.account_type}</span></div>
                <div><label className="block text-sm text-gray-500 mb-1">Your Role</label><div className="flex items-center"><Icon icon={faUserShield} size="sm" className="mr-2 text-gray-400" />{account.role || 'N/A'}</div></div>
                <div><label className="block text-sm text-gray-500 mb-1">Default</label>{account.is_default ? <div className="flex items-center text-green-600"><Icon icon={faCheckCircle} size="sm" className="mr-2" />Yes</div> : 'No'}</div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Permissions</h2>
              {permissions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {permissions.map((permission: string) => (
                    <span key={permission} className="inline-flex px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                      {permission.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No specific permissions assigned.</p>
              )}
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Meta</h2>
            <div className="space-y-3">
              <div><label className="block text-sm text-gray-500 mb-1">Account ID</label><p className="text-sm font-mono">{account.account_id}</p></div>
              <div><label className="block text-sm text-gray-500 mb-1">Account Created</label><div className="flex items-center text-sm"><Icon icon={faCalendar} size="sm" className="mr-2 text-gray-400" />{new Date(account.account_created_at).toLocaleString()}</div></div>
              <div><label className="block text-sm text-gray-500 mb-1">Access Granted</label><div className="flex items-center text-sm"><Icon icon={faCalendar} size="sm" className="mr-2 text-gray-400" />{new Date(account.access_granted_at).toLocaleString()}</div></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

