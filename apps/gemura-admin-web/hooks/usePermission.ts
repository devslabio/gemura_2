import { useCallback } from 'react';
import { useAuthStore } from '@/store/auth';
import { PermissionService } from '@/lib/services/permission.service';

/**
 * Permission helpers read live auth via PermissionService + Zustand getState().
 * Callbacks are memoized so dependency arrays (e.g. on admin list pages) stay stable.
 */
export function usePermission() {
  const { user, currentAccount } = useAuthStore();

  const hasPermission = useCallback((permission: string) => PermissionService.hasPermission(permission), []);
  const hasAnyPermission = useCallback((permissions: string[]) => PermissionService.hasAnyPermission(permissions), []);
  const hasAllPermissions = useCallback((permissions: string[]) => PermissionService.hasAllPermissions(permissions), []);
  const hasRole = useCallback((role: string) => PermissionService.hasRole(role), []);
  const isSuperAdminOrAdmin = useCallback(() => PermissionService.isSuperAdminOrAdmin(), []);
  const isAdmin = useCallback(() => PermissionService.isAdmin(), []);
  const canManageUsers = useCallback(() => PermissionService.canManageUsers(), []);
  const canViewDashboard = useCallback(() => PermissionService.canViewDashboard(), []);

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    isSuperAdminOrAdmin,
    isAdmin,
    canManageUsers,
    canViewDashboard,
    user,
    currentAccount,
  };
}
