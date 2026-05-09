import type { UserAccount, SupplierSegment } from '@/types';

const DEV_KEY = 'gemura-dev-supplier-segment';

function readDevOverride(): SupplierSegment | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(DEV_KEY);
    if (v === 'direct_farmer' || v === 'farmer_collector' || v === 'pure_collector') return v;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Resolves which supplier/farmer dashboard to show.
 * - `farmer` account → direct (own milk to MCC).
 * - `supplier` → uses `supplier_segment` or dev localStorage override, else direct_farmer.
 */
export function resolveSupplierDashboardProfile(account: UserAccount | null): SupplierSegment {
  if (!account) return 'direct_farmer';
  const t = (account.account_type || '').toLowerCase();
  if (t === 'farmer') return 'direct_farmer';
  if (t === 'supplier') {
    const fromApi = account.supplier_segment;
    if (fromApi === 'farmer_collector' || fromApi === 'pure_collector' || fromApi === 'direct_farmer') {
      return fromApi;
    }
    const dev = readDevOverride();
    if (dev) return dev;
    return 'direct_farmer';
  }
  return 'direct_farmer';
}
