import { useAuthStore } from '@/store/auth';
import { isPlatformSuperAdminRole, platformRolesMatch } from '@/lib/utils/platform-rbac';

export class PermissionService {
  static hasPermission(permission: string): boolean {
    const { user, currentAccount } = useAuthStore.getState();

    if (!user || !currentAccount) return false;

    if (isPlatformSuperAdminRole(currentAccount.role)) {
      return true;
    }

    const permissions = currentAccount.permissions;
    if (!permissions) return false;

    if (Array.isArray(permissions)) {
      return permissions.includes(permission);
    }
    if (typeof permissions === 'object') {
      return permissions[permission] === true;
    }

    return false;
  }

  static hasAnyPermission(permissions: string[]): boolean {
    return permissions.some((permission) => this.hasPermission(permission));
  }

  static hasAllPermissions(permissions: string[]): boolean {
    return permissions.every((permission) => this.hasPermission(permission));
  }

  static hasRole(role: string): boolean {
    const { currentAccount } = useAuthStore.getState();
    return platformRolesMatch(currentAccount?.role, role);
  }

  /** Platform super-admin tier or `admin` — client-side permission bypass. */
  static isSuperAdminOrAdmin(): boolean {
    const { currentAccount } = useAuthStore.getState();
    return isPlatformSuperAdminRole(currentAccount?.role);
  }

  /** @deprecated Prefer {@link isSuperAdminOrAdmin}; identical behavior. */
  static isAdmin(): boolean {
    return this.isSuperAdminOrAdmin();
  }

  static canManageUsers(): boolean {
    return this.isAdmin() || this.hasPermission('manage_users');
  }

  static canViewDashboard(): boolean {
    return this.isAdmin() || this.hasPermission('dashboard.view');
  }
}

