'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { accountsApi, Account } from '@/lib/api/accounts';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import DataTableWithPagination from '@/app/components/DataTableWithPagination';
import type { TableColumn } from '@/app/components/DataTable';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';
import FilterBar, { FilterBarExport } from '@/app/components/FilterBar';
import Icon, { faUserShield, faCheckCircle, faArrowsUpDown, faSpinner, faEye } from '@/app/components/Icon';

export default function AccountsPage() {
  const { setCurrentAccount } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState('');
  const [switching, setSwitching] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await accountsApi.getUserAccounts();
      if (response.code === 200) setAccounts(response.data.accounts || []);
      else setError(response.message || 'Failed to load accounts');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as { message?: string })?.message || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleSwitchAccount = async (accountId: string) => {
    if (switching) return;
    try {
      setSwitching(accountId);
      const response = await accountsApi.switchAccount({ account_id: accountId });
      if (response.code === 200) {
        const newAccount = response.data.accounts.find((acc) => acc.account_id === accountId);
        if (newAccount) setCurrentAccount(newAccount);
        setAccounts(response.data.accounts);
        await loadAccounts();
        useToastStore.getState().success('Account switched successfully!');
      } else {
        setError(response.message || 'Failed to switch account');
      }
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as { message?: string })?.message || 'Failed to switch account.');
    } finally {
      setSwitching(null);
    }
  };

  const columns: TableColumn<Account>[] = [
    {
      key: 'account_name',
      label: 'Account Name',
      sortable: true,
      render: (value, row) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          <div className="text-xs text-gray-500">{row.account_code}</div>
        </div>
      ),
    },
    { key: 'account_type', label: 'Type', sortable: true, render: (value) => <span className="capitalize text-gray-900">{String(value)}</span> },
    {
      key: 'role',
      label: 'Role',
      sortable: true,
      render: (value) => (
        <div className="flex items-center">
          <Icon icon={faUserShield} size="sm" className="mr-2 text-gray-400" />
          <span className="capitalize text-gray-900">{String(value) || 'N/A'}</span>
        </div>
      ),
    },
    {
      key: 'account_status',
      label: 'Status',
      sortable: true,
      render: (value) => <span className={`px-2 py-1 rounded text-xs font-medium ${value === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{String(value)}</span>,
    },
    {
      key: 'is_default',
      label: 'Default',
      sortable: true,
      render: (value) => (value ? <div className="flex items-center text-green-600"><Icon icon={faCheckCircle} size="sm" className="mr-1" /><span className="text-xs font-medium">Default</span></div> : null),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          {!row.is_default && (
            <button onClick={() => handleSwitchAccount(row.account_id)} disabled={switching === row.account_id} className="p-1.5 text-gray-600 hover:text-[var(--primary)] transition-colors disabled:opacity-50" title="Switch to this account">
              {switching === row.account_id ? <Icon icon={faSpinner} size="sm" spin /> : <Icon icon={faArrowsUpDown} size="sm" />}
            </button>
          )}
          <Link href={`/admin/accounts/${row.account_id}`} className="p-1.5 text-gray-600 hover:text-[var(--primary)] transition-colors" title="View Details">
            <Icon icon={faEye} size="sm" />
          </Link>
        </div>
      ),
    },
  ];

  if (loading) return <ListPageSkeleton title="Accounts" filterFields={0} tableRows={10} tableCols={4} />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>

      <FilterBar>
        <FilterBarExport<Account>
          data={accounts}
          exportFilename="accounts"
          exportColumns={[
            { key: 'account_name', label: 'Account Name' },
            { key: 'account_code', label: 'Code' },
            { key: 'account_type', label: 'Type' },
            { key: 'role', label: 'Role' },
            { key: 'account_status', label: 'Status' },
          ]}
          disabled={loading}
        />
      </FilterBar>

      {error && <div className="bg-red-50 border border-red-200 rounded-sm p-4 text-sm text-red-600">{error}</div>}

      <DataTableWithPagination<Account> data={accounts} columns={columns} loading={loading} emptyMessage="No accounts found" itemLabel="accounts" />
    </div>
  );
}

