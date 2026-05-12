'use client';

import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import Icon, { faDollarSign, faCog } from '@/app/components/Icon';
import { formatSupplierCurrency, useSupplierOverview } from './useSupplierOverview';
import { useState, useCallback } from 'react';
import { type PeriodKey } from '@/lib/utils/dashboardPeriod';
import { DashboardSkeleton } from '@/app/components/SkeletonLoader';

/**
 * Non-supplier external account: generic home. If they have stats overview, show a light summary.
 */
export default function ExternalCustomerHomeDashboard() {
  const { currentAccount } = useAuthStore();
  const [period] = useState<PeriodKey>('month');
  const [customFrom] = useState('');
  const [customTo] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const { loading, data, error } = useSupplierOverview(
    currentAccount?.account_id,
    period,
    customFrom,
    customTo,
    refreshKey
  );

  const onRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  const sum = data?.summary;

  return (
    <div className="-mt-1 space-y-4">
      <div className="border-b-2 border-gray-200 pb-3">
        <h1 className="text-2xl font-semibold text-gray-900">Welcome</h1>
        <p className="text-sm text-gray-600 mt-1">
          {currentAccount?.account_name ? `Signed in as ${currentAccount.account_name}.` : 'Your account overview.'}
        </p>
        <button
          type="button"
          onClick={onRefresh}
          className="mt-2 rounded border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>
      {error && <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3 rounded-sm">{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <div className="text-xs font-medium text-gray-500 uppercase">Activity (period)</div>
          <p className="text-lg font-semibold text-gray-900 mt-1">
            {sum ? formatSupplierCurrency(sum.sales.value + sum.collection.value) : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-1">From your account&apos;s linked transactions when available</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <div className="text-xs font-medium text-gray-500 uppercase">Quick links</div>
          <ul className="mt-2 space-y-2 text-sm">
            <li>
              <Link href="/accounts" className="text-primary font-medium flex items-center gap-2">
                <Icon icon={faDollarSign} className="w-4" size="sm" />
                Accounts
              </Link>
            </li>
            <li>
              <Link href="/settings" className="text-primary font-medium flex items-center gap-2">
                <Icon icon={faCog} className="w-4" size="sm" />
                Settings
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
