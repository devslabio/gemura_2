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
  name: string;
  email?: string;
  phone?: string;
  password: string;
  account_type?: string;
  status?: string;
  role?: string;
  permissions?: Record<string, boolean>;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  account_type?: string;
  status?: string;
  role?: string;
  permissions?: Record<string, boolean>;
}

export interface RoleItem {
  code: string;
  name: string;
  description: string;
  permissions: string[];
  permissionCount: number;
}

export interface PermissionItem {
  code: string;
  name: string;
  description: string;
  category?: string;
  roles: Array<{ code: string; name: string }>;
}

export const adminApi = {
  getDashboardStats: async (
    accountId?: string,
    params?: { date_from?: string; date_to?: string },
  ): Promise<{ code: number; status: string; message: string; data: DashboardStats }> => {
    const q: Record<string, unknown> = {};
    if (accountId) q.account_id = accountId;
    if (params?.date_from) q.date_from = params.date_from;
    if (params?.date_to) q.date_to = params.date_to;
    return apiClient.get('/admin/dashboard/stats', { params: q });
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

  /** Link Gemura user to IMMIS member, or pass null to unlink. Requires manage_users. */
  linkUserImmis: async (userId: string, immis_member_id: number | null, accountId?: string): Promise<{ code: number; status: string; message: string; data?: unknown }> => {
    const params = accountId ? { account_id: accountId } : {};
    return apiClient.put(`/admin/users/${userId}/immis-link`, { immis_member_id }, { params });
  },
};

