import { useAuthStore } from '@/store/auth';

export class PermissionService {
  static hasPermission(permission: string): boolean {
    const { user, currentAccount } = useAuthStore.getState();

    if (!user || !currentAccount) return false;

    if (currentAccount.role === 'owner' || currentAccount.role === 'admin') {
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
    return currentAccount?.role === role;
  }

  static isAdmin(): boolean {
    const { currentAccount } = useAuthStore.getState();
    return currentAccount?.role === 'admin' || currentAccount?.role === 'owner';
  }

  static canManageUsers(): boolean {
    return this.isAdmin() || this.hasPermission('manage_users');
  }

  static canViewDashboard(): boolean {
    return this.isAdmin() || this.hasPermission('dashboard.view');
  }
}

