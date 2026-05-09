import { useMemo } from 'react';
import { useAuthStore } from '@/store/auth';
import { PermissionService } from '@/lib/services/permission.service';

/**
 * Aggregates common CRUD-style permission checks for Gemura web.
 * Super-admin / admin bypass is handled inside {@link PermissionService}.
 */
export function useCrudPermissions() {
  const { user, currentAccount } = useAuthStore();

  return useMemo(
    () => ({
      collections: {
        create: PermissionService.hasPermission('create_collections'),
        update: PermissionService.hasPermission('update_collections'),
      },
      sales: {
        create: PermissionService.hasPermission('create_sales'),
        update: PermissionService.hasPermission('update_sales'),
      },
      suppliers: {
        create: PermissionService.hasPermission('create_suppliers'),
        update: PermissionService.hasPermission('update_suppliers'),
      },
      customers: {
        create: PermissionService.hasPermission('create_customers'),
        update: PermissionService.hasPermission('update_customers'),
      },
      inventory: {
        manage: PermissionService.hasPermission('manage_inventory'),
      },
      /** Charges / loans / finance record flows — APIs use coarse guards; align with finance nav (`view_analytics`). */
      financeMutations: PermissionService.hasPermission('view_analytics'),
      mccShiftMutations: PermissionService.hasAnyPermission([
        'mcc_manage_operations',
        'mcc_manage_own_operations',
        'mcc_floor_operations',
      ]),
      mccTraceabilityMutations: PermissionService.hasPermission('mcc_manage_operations'),
    }),
    [user, currentAccount],
  );
}
