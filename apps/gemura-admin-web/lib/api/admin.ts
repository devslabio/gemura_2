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
    /** Liters — accepted incoming milk for current account in selected dashboard period */
    liters?: number;
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
  stats?: {
    accounts: number;
    suppliers: number;
    customers: number;
    sales: number;
    collections: number;
    farms: number;
  };
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
  /** PlatformRole.slug (optional if platform_role_id is set) */
  role?: string;
  platform_role_id?: string;
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
  platform_role_id?: string;
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

export interface CreatePlatformRolePayload {
  name: string;
  slug?: string;
  description?: string;
  permission_ids: string[];
  is_active?: boolean;
  is_assignable?: boolean;
}

export interface UpdatePlatformRolePayload {
  name?: string;
  slug?: string;
  description?: string | null;
  permission_ids?: string[];
  is_active?: boolean;
  is_assignable?: boolean;
}

export type UserActivityMetric = 'suppliers' | 'customers' | 'sales' | 'collections' | 'farms' | 'accounts';

export type UserBusinessResource =
  | 'collections'
  | 'sales'
  | 'suppliers'
  | 'customers'
  | 'farms'
  | 'accounts'
  | 'members';

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

  createPlatformRole: async (
    payload: CreatePlatformRolePayload,
    accountId?: string,
  ): Promise<{ code: number; status: string; message: string; data: { role: RoleItem } }> => {
    const body = accountId ? { ...payload, account_id: accountId } : payload;
    return apiClient.post('/admin/platform-roles', body);
  },

  updatePlatformRole: async (
    roleId: string,
    payload: UpdatePlatformRolePayload,
    accountId?: string,
  ): Promise<{ code: number; status: string; message: string; data: { role: RoleItem } }> => {
    const params = accountId ? { account_id: accountId } : {};
    return apiClient.put(`/admin/platform-roles/${roleId}`, payload, { params });
  },

  deletePlatformRole: async (
    roleId: string,
    accountId?: string,
  ): Promise<{ code: number; status: string; message: string; data: unknown }> => {
    const params = accountId ? { account_id: accountId } : {};
    return apiClient.delete(`/admin/platform-roles/${roleId}`, { params });
  },

  getUsers: async (
    page: number = 1,
    limit: number = 10,
    search?: string,
    accountId?: string,
    filters?: { status?: string; role?: string; account_type?: string },
    sort?: { sortBy?: string; sortDir?: 'asc' | 'desc' },
  ): Promise<UsersResponse> => {
    const params: any = { page, limit };
    if (search) params.search = search;
    if (accountId) params.account_id = accountId;
    if (filters?.status) params.status = filters.status;
    if (filters?.role) params.role = filters.role;
    if (filters?.account_type) params.account_type = filters.account_type;
    if (sort?.sortBy) params.sort_by = sort.sortBy;
    if (sort?.sortDir) params.sort_dir = sort.sortDir;
    return apiClient.get('/admin/users', { params });
  },

  getUserById: async (userId: string, accountId?: string): Promise<any> => {
    const params = accountId ? { account_id: accountId } : {};
    return apiClient.get(`/admin/users/${userId}`, { params });
  },

  getUserActivity: async (userId: string, metric: UserActivityMetric, accountId?: string): Promise<{
    code: number;
    status: string;
    message: string;
    data: any[];
  }> => {
    const params: Record<string, unknown> = { metric };
    if (accountId) params.account_id = accountId;
    return apiClient.get(`/admin/users/${userId}/activity`, { params });
  },

  getUserBusinessRecords: async (
    userId: string,
    resource: UserBusinessResource,
    options?: {
      accountId?: string;
      operationalAccountId?: string;
      status?: string;
      date_from?: string;
      date_to?: string;
      supplier_name?: string;
      customer_account_code?: string;
      search?: string;
    },
  ): Promise<{ code: number; status: string; message: string; data: unknown[] }> => {
    const params: Record<string, unknown> = { resource };
    if (options?.accountId) params.account_id = options.accountId;
    if (options?.operationalAccountId) params.operational_account_id = options.operationalAccountId;
    if (options?.status) params.status = options.status;
    if (options?.date_from) params.date_from = options.date_from;
    if (options?.date_to) params.date_to = options.date_to;
    if (options?.supplier_name) params.supplier_name = options.supplier_name;
    if (options?.customer_account_code) params.customer_account_code = options.customer_account_code;
    if (options?.search) params.search = options.search;
    return apiClient.get(`/admin/users/${userId}/business-records`, { params });
  },

  createUser: async (data: CreateUserData, accountId?: string): Promise<any> => {
    const body = accountId ? { ...data, account_id: accountId } : data;
    return apiClient.post('/admin/users', body);
  },

  updateUser: async (userId: string, data: UpdateUserData, accountId?: string): Promise<any> => {
    const body = accountId ? { ...data, account_id: accountId } : data;
    return apiClient.put(`/admin/users/${userId}`, body);
  },

  exportUsersCsv: async (
    accountId?: string,
    filters?: { search?: string; status?: string; role?: string; account_type?: string },
  ): Promise<Blob> => {
    const params: Record<string, unknown> = {};
    if (accountId) params.account_id = accountId;
    if (filters?.search) params.search = filters.search;
    if (filters?.status) params.status = filters.status;
    if (filters?.role) params.role = filters.role;
    if (filters?.account_type) params.account_type = filters.account_type;
    return apiClient.getBlob('/admin/users/export-csv', { params });
  },

  deleteUser: async (userId: string, accountId?: string): Promise<any> => {
    const params = accountId ? { account_id: accountId } : {};
    return apiClient.delete(`/admin/users/${userId}`, { params });
  },

  searchAssignableAccounts: async (options?: {
    accountId?: string;
    search?: string;
    limit?: number;
  }): Promise<{
    code: number;
    status: string;
    message: string;
    data: { accounts: Array<{ id: string; code: string | null; name: string; type: string }> };
  }> => {
    const params: Record<string, unknown> = {};
    if (options?.accountId) params.account_id = options.accountId;
    if (options?.search?.trim()) params.search = options.search.trim();
    if (options?.limit != null) params.limit = options.limit;
    return apiClient.get('/admin/accounts/assignable', { params });
  },

  assignUserAccountMembership: async (
    targetUserId: string,
    body: { link_account_id: string; platform_role_id?: string },
    accountId?: string,
  ): Promise<{ code: number; status: string; message: string; data?: unknown }> => {
    const params = accountId ? { account_id: accountId } : {};
    return apiClient.post(`/admin/users/${targetUserId}/account-memberships`, body, { params });
  },

  removeUserAccountMembership: async (
    targetUserId: string,
    membershipAccountId: string,
    accountId?: string,
  ): Promise<{ code: number; status: string; message: string; data?: unknown }> => {
    const params: Record<string, unknown> = {};
    if (accountId) params.account_id = accountId;
    return apiClient.delete(`/admin/users/${targetUserId}/account-memberships/${membershipAccountId}`, { params });
  },

  /** Link Gemura user to IMMIS member, or pass null to unlink. Requires manage_users. */
  linkUserImmis: async (userId: string, immis_member_id: number | null, accountId?: string): Promise<{ code: number; status: string; message: string; data?: unknown }> => {
    const params = accountId ? { account_id: accountId } : {};
    return apiClient.put(`/admin/users/${userId}/immis-link`, { immis_member_id }, { params });
  },

  getOnboardingPendingCount: async (
    accountId?: string,
  ): Promise<{ code: number; status: string; message: string; data: { pendingCount: number } }> => {
    const params = accountId ? { account_id: accountId } : {};
    return apiClient.get('/admin/onboarding-submissions/pending-count', { params });
  },

  listOnboardingSubmissions: async (
    page = 1,
    limit = 20,
    accountId?: string,
    reviewStatus?: string,
    search?: string,
    onboardedFrom?: string,
    onboardedTo?: string,
    tzOffsetMinutes?: number,
  ): Promise<{
    code: number;
    status: string;
    message: string;
    data: {
      submissions: Array<{
        id: string;
        submission_code: string;
        business_name: string;
        common_name: string | null;
        manager_first_name: string;
        manager_last_name: string;
        manager_phone: string;
        final_decision: string;
        pass_count: number;
        review_status: string;
        created_at: string;
        reviewed_at: string | null;
        linked_user_id: string | null;
        linked_account_id: string | null;
        linked_account: {
          code: string;
          name: string;
        } | null;
      }>;
      pendingCount: number;
      pagination: { page: number; limit: number; total: number; totalPages: number };
    };
  }> => {
    const params: Record<string, unknown> = { page, limit };
    if (accountId) params.account_id = accountId;
    if (reviewStatus) params.review_status = reviewStatus;
    if (search) params.search = search;
    if (onboardedFrom) params.onboarded_from = onboardedFrom;
    if (onboardedTo) params.onboarded_to = onboardedTo;
    if (typeof tzOffsetMinutes === 'number') params.tz_offset_minutes = tzOffsetMinutes;
    return apiClient.get('/admin/onboarding-submissions', { params });
  },

  /**
   * Full CSV: DB columns, location labels, flattened wizard (wizard_*) and gs_response_* columns.
   * Same `review_status` filter as the list; omit for all statuses.
   */
  exportOnboardingSubmissionsCsv: async (
    accountId?: string,
    reviewStatus?: string,
    onboardedFrom?: string,
    onboardedTo?: string,
    tzOffsetMinutes?: number,
  ): Promise<Blob> => {
    const params: Record<string, unknown> = {};
    if (accountId) params.account_id = accountId;
    if (reviewStatus) params.review_status = reviewStatus;
    if (onboardedFrom) params.onboarded_from = onboardedFrom;
    if (onboardedTo) params.onboarded_to = onboardedTo;
    if (typeof tzOffsetMinutes === 'number') params.tz_offset_minutes = tzOffsetMinutes;
    return apiClient.getBlob('/admin/onboarding-submissions/export-csv', { params });
  },

  exportOnboardingSubmissionsXlsx: async (
    accountId?: string,
    reviewStatus?: string,
    onboardedFrom?: string,
    onboardedTo?: string,
    tzOffsetMinutes?: number,
  ): Promise<Blob> => {
    const params: Record<string, unknown> = {};
    if (accountId) params.account_id = accountId;
    if (reviewStatus) params.review_status = reviewStatus;
    if (onboardedFrom) params.onboarded_from = onboardedFrom;
    if (onboardedTo) params.onboarded_to = onboardedTo;
    if (typeof tzOffsetMinutes === 'number') params.tz_offset_minutes = tzOffsetMinutes;
    return apiClient.getBlob('/admin/onboarding-submissions/export-xlsx', { params });
  },

  getOnboardingSubmission: async (submissionId: string, accountId?: string): Promise<{ code: number; data: Record<string, unknown> }> => {
    const params = accountId ? { account_id: accountId } : {};
    return apiClient.get(`/admin/onboarding-submissions/${submissionId}`, { params });
  },

  linkOnboardingSubmission: async (
    submissionId: string,
    body: { linkUserId: string; linkAccountId?: string },
    accountId?: string,
  ): Promise<{ code: number; status: string; message: string; data: Record<string, unknown> }> => {
    const params = accountId ? { account_id: accountId } : {};
    return apiClient.post(`/admin/onboarding-submissions/${submissionId}/link`, body, { params });
  },

  approveOnboardingSubmission: async (
    submissionId: string,
    body: {
      password?: string;
      linkExistingUserId?: string;
      /** With linkExistingUserId: KYC-only — no new tenant; phone match not required. */
      linkExistingAccountId?: string;
      reviewNotes?: string;
    },
    accountId?: string,
  ): Promise<{ code: number; status: string; message: string; data: Record<string, unknown> }> => {
    const params = accountId ? { account_id: accountId } : {};
    return apiClient.post(`/admin/onboarding-submissions/${submissionId}/approve`, body, { params });
  },

  rejectOnboardingSubmission: async (
    submissionId: string,
    notes: string,
    accountId?: string,
  ): Promise<{ code: number; status: string; message: string; data: unknown }> => {
    const params = accountId ? { account_id: accountId } : {};
    return apiClient.post(`/admin/onboarding-submissions/${submissionId}/reject`, { notes }, { params });
  },

  needsChangesOnboardingSubmission: async (
    submissionId: string,
    notes: string,
    accountId?: string,
  ): Promise<{ code: number; status: string; message: string; data: unknown }> => {
    const params = accountId ? { account_id: accountId } : {};
    return apiClient.post(`/admin/onboarding-submissions/${submissionId}/needs-changes`, { notes }, { params });
  },
};
