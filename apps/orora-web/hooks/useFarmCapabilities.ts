'use client';

import { useMemo } from 'react';
import { useAuthStore } from '@/store/auth';
import { useFarmStore } from '@/store/farms';
import { farmGateOpen } from '@/lib/config/farmCapabilities';

export interface FarmCapabilityFlags {
  milk: boolean;
  poultry: boolean;
  pigs: boolean;
}

export function useFarmCapabilities(): FarmCapabilityFlags {
  const { currentAccount } = useAuthStore();
  const accountId = currentAccount?.account_id;
  const { farmsByAccount, selectedFarmByAccount } = useFarmStore();

  return useMemo(() => {
    const selectedFarmId = accountId ? selectedFarmByAccount[accountId] ?? null : null;
    const farms = accountId ? farmsByAccount[accountId] ?? [] : [];
    const farm = selectedFarmId ? farms.find((f) => f.id === selectedFarmId) : null;

    if (selectedFarmId && farm === undefined) {
      return { milk: true, poultry: true, pigs: true };
    }

    return {
      milk: farmGateOpen('milk', farm ?? null),
      poultry: farmGateOpen('poultry', farm ?? null),
      pigs: farmGateOpen('pigs', farm ?? null),
    };
  }, [accountId, farmsByAccount, selectedFarmByAccount]);
}
