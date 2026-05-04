import { apiClient } from './client';

export interface DashboardStats {
  users: {
    total: number;
    active: number;
    inactive: number;
  };
  accounts: {
    total: number;
  };
  sales: {
    total: number;
    last30Days?: number;
    last7Days?: number;
    today?: number;
  };
  collections: {
    total: number;
  };
  suppliers: {
    total: number;
  };
  customers: {
    total: number;
  };
  revenue?: {
    total: number;
    last30Days: number;
    last7Days: number;
    today: number;
  };
  trends?: {
    daily: Array<{
      date: string;
      label: string;
      revenue: number;
      sales: number;
    }>;
  };
  salesByStatus?: Array<{
    status: string;
    count: number;
  }>;
  recentSales?: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    total: number;
    status: string;
    date: string;
    supplier: string;
    customer: string;
  }>;
}

export interface UserListItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  account_type: string;
  created_at: string;
  last_login: string | null;
  role: string | null;
  permissions: Record<string, boolean> | string[] | null;
}

export interface UsersResponse {
  code: number;
  status: string;
  message: string;
  data: {
    users: UserListItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface CreateUserData {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  password: string;
  account_type?: string;
  status?: string;
  role?: string;
  permissions?: Record<string, boolean>;
}

export interface UpdateUserData {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  password?: string;
  account_type?: string;
  status?: string;
  role?: string;
  permissions?: Record<string, boolean>;
}

export interface RoleItem {
  id?: string;
  code: string;
  name: string;
  description: string;
  permissions: string[];
  permissionCount: number;
  is_system?: boolean;
  is_active?: boolean;
  is_assignable?: boolean;
}

export interface PermissionItem {
  id?: string;
  code: string;
  name: string;
  description: string;
  category?: string;
  roles: Array<{ id?: string; code: string; name: string }>;
}

export const adminApi = {
  getDashboardStats: async (accountId?: string): Promise<{ code: number; status: string; message: string; data: DashboardStats }> => {
    const params = accountId ? { account_id: accountId } : {};
    return apiClient.get('/admin/dashboard/stats', { params });
  },

  getRoles: async (accountId?: string): Promise<{ code: number; status: string; message: string; data: { roles: RoleItem[] } }> => {
    const params = accountId ? { account_id: accountId } : {};
    return apiClient.get('/admin/roles', { params });
  },

  getPermissions: async (accountId?: string): Promise<{ code: number; status: string; message: string; data: { permissions: PermissionItem[] } }> => {
    const params = accountId ? { account_id: accountId } : {};
    return apiClient.get('/admin/permissions', { params });
  },

  getUsers: async (
    page: number = 1,
    limit: number = 10,
    search?: string,
    accountId?: string,
    filters?: { status?: string; role?: string },
  ): Promise<UsersResponse> => {
    const params: any = { page, limit };
    if (search) params.search = search;
    if (accountId) params.account_id = accountId;
    if (filters?.status) params.status = filters.status;
    if (filters?.role) params.role = filters.role;
    return apiClient.get('/admin/users', { params });
  },

  getUserById: async (userId: string, accountId?: string): Promise<any> => {
    const params = accountId ? { account_id: accountId } : {};
    return apiClient.get(`/admin/users/${userId}`, { params });
  },

  createUser: async (data: CreateUserData, accountId?: string): Promise<any> => {
    const body = accountId ? { ...data, account_id: accountId } : data;
    return apiClient.post('/admin/users', body);
  },

  updateUser: async (userId: string, data: UpdateUserData, accountId?: string): Promise<any> => {
    const body = accountId ? { ...data, account_id: accountId } : data;
    return apiClient.put(`/admin/users/${userId}`, body);
  },

  deleteUser: async (userId: string, accountId?: string): Promise<any> => {
    const params = accountId ? { account_id: accountId } : {};
    return apiClient.delete(`/admin/users/${userId}`, { params });
  },
};
