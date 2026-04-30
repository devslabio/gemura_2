import { useAuthStore } from '@/store/auth';

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

    const role = this.normalizeRole(currentAccount.role);

    // Owner and admin have all permissions
    if (role === 'owner' || role === 'admin') {
      return true;
    }

    // Managers should have full operations access even if explicit
    // permission payload is missing/incomplete on the account object.
    if (role === 'manager') {
      return true;
    }

    const permissions = currentAccount.permissions;
    if (!permissions) {
      return false;
    }

    // Check if permissions is array or object
    if (Array.isArray(permissions)) {
      return permissions.includes(permission);
    } else if (typeof permissions === 'object') {
      return permissions[permission] === true;
    }

    return false;
  }

  /**
   * Check if user has any of the specified permissions
   */
  static hasAnyPermission(permissions: string[]): boolean {
    return permissions.some(permission => this.hasPermission(permission));
  }

  /**
   * Check if user has all of the specified permissions
   */
  static hasAllPermissions(permissions: string[]): boolean {
    return permissions.every(permission => this.hasPermission(permission));
  }

  /**
   * Check if user has a specific role
   */
  static hasRole(role: string): boolean {
    const { currentAccount } = useAuthStore.getState();
    return this.normalizeRole(currentAccount?.role) === this.normalizeRole(role);
  }

  /**
   * Check if user is admin or owner
   */
  static isAdmin(): boolean {
    const { currentAccount } = useAuthStore.getState();
    const role = this.normalizeRole(currentAccount?.role);
    return role === 'admin' || role === 'owner';
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
