import { useAuthStore } from '@/store/auth';
import { isPlatformSuperAdminRole, platformRolesMatch } from '@/lib/utils/platform-rbac';

export interface Permission {
  [key: string]: boolean;
}

export class PermissionService {
  private static normalizeRole(role?: string | null): string {
    return (role || '').trim().toLowerCase().replace(/\s+/g, '_');
  }

  /**
   * Check if user has a specific permission
   */
  static hasPermission(permission: string): boolean {
    const { user, currentAccount } = useAuthStore.getState();

    if (!user || !currentAccount) {
      return false;
    }

    // System admin tier and admin receive full checks (matches backend RBAC).
    if (isPlatformSuperAdminRole(currentAccount.role)) {
      return true;
    }

    const permissions = currentAccount.permissions;
    if (!permissions) {
      return false;
    }

    if (Array.isArray(permissions)) {
      return permissions.includes(permission);
    }
    if (typeof permissions === 'object') {
      return permissions[permission] === true;
    }

    return false;
  }

  /**
   * Check if user has any of the specified permissions
   */
  static hasAnyPermission(permissions: string[]): boolean {
    return permissions.some((permission) => this.hasPermission(permission));
  }

  /**
   * Check if user has all of the specified permissions
   */
  static hasAllPermissions(permissions: string[]): boolean {
    return permissions.every((permission) => this.hasPermission(permission));
  }

  /**
   * Check if user has a specific role
   */
  static hasRole(role: string): boolean {
    const { currentAccount } = useAuthStore.getState();
    return platformRolesMatch(currentAccount?.role, role);
  }

  /**
   * Platform super-admin tier (`system_admin`, legacy `owner`) or `admin` role — client-side permission bypass.
   */
  static isSuperAdminOrAdmin(): boolean {
    const { currentAccount } = useAuthStore.getState();
    return isPlatformSuperAdminRole(currentAccount?.role);
  }

  /** @deprecated Prefer {@link isSuperAdminOrAdmin}; identical behavior. */
  static isAdmin(): boolean {
    return this.isSuperAdminOrAdmin();
  }

  /**
   * Check if user can manage users
   */
  static canManageUsers(): boolean {
    return this.isAdmin() || this.hasPermission('manage_users');
  }

  /**
   * Check if user can view dashboard
   */
  static canViewDashboard(): boolean {
    return this.isAdmin() || this.hasPermission('dashboard.view');
  }
}
