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
  const canViewPlatformAccounts = useCallback(() => PermissionService.canViewPlatformAccounts(), []);
  const canViewDashboard = useCallback(() => PermissionService.canViewDashboard(), []);
  const isPlatformOperator = useCallback(() => PermissionService.isPlatformOperator(), []);
  const canViewOperatorDashboard = useCallback(() => PermissionService.canViewOperatorDashboard(), []);
  const canViewSystemAdminDashboard = useCallback(() => PermissionService.canViewSystemAdminDashboard(), []);
  const canAccessAdminPortal = useCallback(() => PermissionService.canAccessAdminPortal(), []);

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    isSuperAdminOrAdmin,
    isAdmin,
    canManageUsers,
    canViewPlatformAccounts,
    canViewDashboard,
    isPlatformOperator,
    canViewOperatorDashboard,
    canViewSystemAdminDashboard,
    canAccessAdminPortal,
    user,
    currentAccount,
  };
}
