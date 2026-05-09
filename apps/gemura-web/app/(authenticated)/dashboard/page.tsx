'use client';

import { useAuthStore } from '@/store/auth';
import { isBusinessAccount } from '@/lib/config/nav.config';
import MccOperationsDashboard from './MccOperationsDashboard';
import ExternalUserDashboard from './supplier/ExternalUserDashboard';

export default function Dashboard() {
  const { currentAccount } = useAuthStore();
  const accountTypeLower = (currentAccount?.account_type ?? '').toLowerCase();

  if (!isBusinessAccount(accountTypeLower)) {
    return (
      <ExternalUserDashboard
        currentAccount={currentAccount}
        accountTypeLower={accountTypeLower}
      />
    );
  }

  return <MccOperationsDashboard />;
}
