'use client';

import type { UserAccount } from '@/types';
import { resolveSupplierDashboardProfile } from '@/lib/utils/supplierDashboardProfile';
import DirectFarmerSupplierDashboard from './DirectFarmerSupplierDashboard';
import FarmerCollectorSupplierDashboard from './FarmerCollectorSupplierDashboard';
import PureCollectorSupplierDashboard from './PureCollectorSupplierDashboard';
import ExternalCustomerHomeDashboard from './ExternalCustomerHomeDashboard';

interface Props {
  currentAccount: UserAccount | null;
  accountTypeLower: string;
}

/**
 * Picks the correct external dashboard: three supplier types + farmer (direct) + simple customer home.
 */
export default function ExternalUserDashboard({ currentAccount, accountTypeLower }: Props) {
  if (accountTypeLower === 'customer') {
    return <ExternalCustomerHomeDashboard />;
  }
  if (accountTypeLower === 'farmer') {
    return <DirectFarmerSupplierDashboard />;
  }
  if (accountTypeLower === 'supplier') {
    const profile = resolveSupplierDashboardProfile(currentAccount);
    if (profile === 'farmer_collector') return <FarmerCollectorSupplierDashboard />;
    if (profile === 'pure_collector') return <PureCollectorSupplierDashboard />;
    return <DirectFarmerSupplierDashboard />;
  }
  return <ExternalCustomerHomeDashboard />;
}
