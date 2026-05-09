import { useAuthStore } from '@/store/auth';
import { isExternalCustomer, isExternalSupplier } from '@/lib/config/nav.config';

export interface Permission {
  [key: string]: boolean;
}

/** Milk app “external” accounts: must not inherit MCC owner/admin powers from UserAccount.role. */
function isExternalMilkAccount(accountType: string | undefined): boolean {
  const t = (accountType || '').toLowerCase();
  return isExternalSupplier(t) || isExternalCustomer(t);
}

export class PermissionService {
  /**
   * Check if user has a specific permission
   */
  static hasPermission(permission: string): boolean {
    const { user, currentAccount } = useAuthStore.getState();
    
    if (!user || !currentAccount) {
      return false;
    }

    // Owner and admin have all permissions on MCC/operations accounts only — not on farmer/supplier/customer logins.
    if (
      !isExternalMilkAccount(currentAccount.account_type) &&
      (currentAccount.role === 'owner' || currentAccount.role === 'admin')
    ) {
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
    return currentAccount?.role === role;
  }

  /**
   * Check if user is admin or owner
   */
  static isAdmin(): boolean {
    const { currentAccount } = useAuthStore.getState();
    if (!currentAccount) return false;
    if (isExternalMilkAccount(currentAccount.account_type)) {
      return false;
    }
    return currentAccount.role === 'admin' || currentAccount.role === 'owner';
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
