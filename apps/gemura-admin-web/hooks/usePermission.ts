import { useAuthStore } from '@/store/auth';
import { PermissionService } from '@/lib/services/permission.service';

export function usePermission() {
  const { user, currentAccount } = useAuthStore();

  return {
    hasPermission: (permission: string) => PermissionService.hasPermission(permission),
    hasAnyPermission: (permissions: string[]) => PermissionService.hasAnyPermission(permissions),
    hasAllPermissions: (permissions: string[]) => PermissionService.hasAllPermissions(permissions),
    hasRole: (role: string) => PermissionService.hasRole(role),
    isAdmin: () => PermissionService.isAdmin(),
    canManageUsers: () => PermissionService.canManageUsers(),
    canViewDashboard: () => PermissionService.canViewDashboard(),
    user,
    currentAccount,
  };
}

