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
    /** Liters — platform-wide milk in selected dashboard period */
    liters?: number;
    last30Days?: number;
    last7Days?: number;
    today?: number;
  };
  /** Milk transactions in the selected dashboard period (platform-wide; mirrors sales.total txns). */
  collections: {
    total: number;
  };
  /** Milk sale rows with status `rejected` in the selected dashboard period (platform-wide). */
  rejections?: {
    transactions: number;
    liters: number;
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
  overview?: {
    pendingOnboarding: number;
    collectionsByMcc: Array<{
      mcc: string;
      collections_liters: number;
      sales_rf: number;
    }>;
    healthRows: Array<{
      accountId?: string;
      userId?: string;
      mcc: string;
      litersToday: string;
      manifestPct: number;
      rejectionPct: number;
      tankPct: number;
      alerts: number;
      health: 'Excellent' | 'Good' | 'Moderate' | 'At risk' | 'Critical';
    }>;
    onboardingQueue: Array<{
      id: string;
      applicant: string;
      region: string;
      appliedOn: string;
      status: string;
      statusTone: 'pending' | 'review' | 'kyc';
    }>;
    alerts: Array<{
      id: string;
      severity: 'high' | 'medium' | 'info';
      title: string;
      when: string;
    }>;
    adoption: Array<{
      accountId?: string;
      userId?: string;
      mcc: string;
      milk: number;
      finance: number;
      usage: number;
      inventory: number;
      loans: number;
    }>;
    activity: Array<{
      id: string;
      label: string;
      actor: string;
      when: string;
    }>;
  };
}

export interface FinanceDashboardData {
  summary: {
    disbursements: { amount: number; count: number };
    repayments: { amount: number; count: number };
    payroll: { amount: number; runs: number };
    milk_payments_recorded: { amount: number };
    inventory_sales: { amount: number; count: number };
    portfolio_active: { loan_count: number; principal_outstanding: number };
  };
  loans_by_status: Array<{ status: string; count: number }>;
  breakdown: Array<{
    date: string;
    label: string;
    disbursements: number;
    repayments: number;
    payroll: number;
    inventory_sales: number;
  }>;
  recent_disbursements: Array<{
    id: string;
    principal: number;
    status: string;
    disbursement_date: string;
    borrower_label: string;
    lender_name: string | null;
  }>;
}

export interface UsageDashboardData {
  summary: {
    users: {
      active_platform_total: number;
      last_login_in_period: number;
      registered_in_period: number;
    };
    audit: {
      events: number;
      distinct_users: number;
    };
    milk: {
      transactions: number;
      distinct_operators: number;
    };
    mcc_gate_deliveries: number;
    payroll_runs_created: number;
    supplier_customer_links_created: number;
    feed_posts_created: number;
    inventory_sales_created: number;
  };
  breakdown: Array<{
    date: string;
    label: string;
    audit_events: number;
    audit_users: number;
    milk_transactions: number;
    milk_operators: number;
    gate_deliveries: number;
  }>;
}

export type AdminPlatformPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export interface PlatformMilkSaleRow {
  id: string;
  quantity: number;
  unit_price: number;
  amount_paid: number;
  status: string;
  sale_at: string;
  supplier_name: string | null;
  supplier_code: string | null;
  customer_name: string | null;
  customer_code: string | null;
}

export interface PlatformLoanRow {
  id: string;
  principal: number;
  amount_repaid: number;
  status: string;
  disbursement_date: string;
  borrower_label: string;
  borrower_code: string | null;
  lender_name: string | null;
  lender_code: string | null;
}

export interface PlatformLoanRepaymentRow {
  id: string;
  amount: number;
  repayment_date: string;
  source: string;
  loan_id: string;
  borrower_label: string;
  lender_name: string | null;
}

export interface PlatformPayrollRunRow {
  id: string;
  run_name: string;
  run_date: string;
  total_amount: number;
  status: string;
  account_name: string | null;
  account_code: string | null;
}

export interface PlatformInventorySaleRow {
  id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  sale_date: string;
  buyer_label: string;
  buyer_code: string | null;
  product_name: string;
  payment_status: string;
}

export interface PlatformAuditEventRow {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  user_id: string | null;
  user_label: string | null;
  created_at: string;
  ip_address: string | null;
}

export interface PlatformChargeRow {
  id: string;
  name: string;
  kind: string;
  amount_type: string;
  amount: number;
  recurrence: string | null;
  is_active: boolean;
  apply_to_all_suppliers: boolean;
  effective_from: string | null;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
  mcc_name: string | null;
  mcc_code: string | null;
}

export interface PlatformSupplierCustomerLinkRow {
  id: string;
  price_per_liter: number;
  relationship_status: string;
  created_at: string;
  supplier_name: string | null;
  supplier_code: string | null;
  customer_name: string | null;
  customer_code: string | null;
}

export interface PlatformAccountingTransactionRow {
  id: string;
  transaction_date: string;
  reference_number: string | null;
  description: string | null;
  total_amount: number;
  farm_id: string | null;
  farm_name: string | null;
  entry_lines: number;
  created_at: string;
}

export interface PlatformGateDeliveryRow {
  id: string;
  source_type: string;
  gate_volume_litres: number;
  arrived_at: string;
  notes: string | null;
  mcc_name: string | null;
  mcc_code: string | null;
  source_name: string | null;
  source_code: string | null;
  recorded_by_label: string | null;
}

export interface PlatformMilkManifestRow {
  id: string;
  manifest_ref: string;
  status: string;
  created_at: string;
  submitted_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  line_count: number;
  mcc_name: string | null;
  mcc_code: string | null;
  umucunda_name: string | null;
  umucunda_code: string | null;
  gate_arrived_at: string | null;
  gate_volume_litres: number | null;
}

export interface TenantAccountRow {
  id: string;
  code: string | null;
  name: string;
  type: string;
  status: string;
  operational_location_id: string | null;
  operational_district_id: string | null;
  operational_location_label: string | null;
  /** Administrative district name (Rwanda hierarchy); list/table display. */
  operational_district_label: string | null;
  /** Active members, relationships, milk rows, farms — same semantics as former user-list aggregates but per account. */
  stats?: {
    members: number;
    suppliers: number;
    customers: number;
    sales: number;
    collections: number;
    farms: number;
  };
}

/** Extended tenant account payload from GET /admin/tenant-accounts/:id */
export interface TenantAccountOperationalProfileDTO {
  id: string;
  account_id: string;
  expected_daily_deliveries: number | null;
  daily_milk_volume_litres: number | null;
  max_milk_one_day_litres: number | null;
  tank_capacity_sufficiency: string | null;
  insufficient_capacity_plan: string | null;
  power_supply_sources: unknown | null;
  generator_capacity_kva: number | null;
  mobile_connectivity: string | null;
  total_farmers_supplying: number | null;
  new_farmers_last_3_months: number | null;
  milk_transporters_count: number | null;
  average_distance_km: number | null;
  furthest_farm_km: number | null;
  evening_milk_pattern: string | null;
  own_milk_transport_type: string | null;
  record_system: string | null;
  avg_days_delivery_to_payment: number | null;
  average_annual_revenue_rwf: number | null;
  main_buyer_name: string | null;
  formal_supply_agreement_details: string | null;
  source_submission_id: string | null;
  source_submission_code: string | null;
  captured_at: string;
  updated_at: string;
}

export interface TenantAccountCoolingTankProfileDTO {
  id: string;
  account_id: string;
  tank_number: string | null;
  capacity_litres: number | null;
  year_or_age: string | null;
  condition: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantAccountFacilitySnapshotDTO {
  id: string;
  account_id: string;
  tank_used_litres: number | null;
  tank_used_pct: number | null;
  cooling_temperature_c: number | null;
  power_status: string | null;
  generator_status: string | null;
  generator_fuel_pct: number | null;
  observed_at: string | null;
  source: string | null;
  updated_at: string;
}

export type TenantAccountAdminDetail = TenantAccountRow & {
  operational_profile: TenantAccountOperationalProfileDTO | null;
  cooling_tank_profiles: TenantAccountCoolingTankProfileDTO[];
  facility_snapshot: TenantAccountFacilitySnapshotDTO | null;
};

export interface RegionalSupervisorDistrictRef {
  id: string;
  code: string;
  name: string;
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
    members: number;
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

export type UserActivityMetric = 'suppliers' | 'customers' | 'sales' | 'collections' | 'farms' | 'accounts' | 'members';

export type UserBusinessResource = 'collections' | 'sales' | 'suppliers' | 'customers' | 'farms' | 'accounts' | 'members';

export interface OnboardingOperationalConfigData {
  submission_id: string;
  account: { id: string; code: string | null; name: string };
  profile: {
    expected_daily_deliveries: number | null;
  };
  facility_snapshot: {
    tank_used_litres: number | null;
    tank_used_pct: number | null;
    cooling_temperature_c: number | null;
    power_status: string | null;
    generator_status: string | null;
    generator_fuel_pct: number | null;
    observed_at: string | null;
  };
}

export interface UpdateOnboardingOperationalConfigPayload {
  expected_daily_deliveries?: number | null;
  tank_used_litres?: number | null;
  tank_used_pct?: number | null;
  cooling_temperature_c?: number | null;
  power_status?: string | null;
  generator_status?: string | null;
  generator_fuel_pct?: number | null;
  observed_at?: string | null;
}

export const adminApi = {
  getDashboardStats: async (
    accountId?: string,
    params?: { date_from?: string; date_to?: string; tz_offset_minutes?: number },
  ): Promise<{ code: number; status: string; message: string; data: DashboardStats }> => {
    const q: Record<string, unknown> = {};
    if (accountId) q.account_id = accountId;
    if (params?.date_from) q.date_from = params.date_from;
    if (params?.date_to) q.date_to = params.date_to;
    if (params?.tz_offset_minutes !== undefined) q.tz_offset_minutes = params.tz_offset_minutes;
    return apiClient.get('/admin/dashboard/stats', { params: q });
  },

  getFinanceDashboardStats: async (
    accountId?: string,
    params?: { date_from?: string; date_to?: string; tz_offset_minutes?: number },
  ): Promise<{ code: number; status: string; message: string; data: FinanceDashboardData }> => {
    const q: Record<string, unknown> = {};
    if (accountId) q.account_id = accountId;
    if (params?.date_from) q.date_from = params.date_from;
    if (params?.date_to) q.date_to = params.date_to;
    if (params?.tz_offset_minutes !== undefined) q.tz_offset_minutes = params.tz_offset_minutes;
    return apiClient.get('/admin/dashboard/finance-stats', { params: q });
  },

  getUsageDashboardStats: async (
    accountId?: string,
    params?: { date_from?: string; date_to?: string; tz_offset_minutes?: number },
  ): Promise<{ code: number; status: string; message: string; data: UsageDashboardData }> => {
    const q: Record<string, unknown> = {};
    if (accountId) q.account_id = accountId;
    if (params?.date_from) q.date_from = params.date_from;
    if (params?.date_to) q.date_to = params.date_to;
    if (params?.tz_offset_minutes !== undefined) q.tz_offset_minutes = params.tz_offset_minutes;
    return apiClient.get('/admin/dashboard/usage-stats', { params: q });
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

  getOnboardingOperationalConfig: async (
    submissionId: string,
    accountId?: string,
  ): Promise<{ code: number; status: string; message: string; data: OnboardingOperationalConfigData }> => {
    const params = accountId ? { account_id: accountId } : {};
    return apiClient.get(`/admin/onboarding-submissions/${submissionId}/operational-config`, { params });
  },

  updateOnboardingOperationalConfig: async (
    submissionId: string,
    body: UpdateOnboardingOperationalConfigPayload,
    accountId?: string,
  ): Promise<{ code: number; status: string; message: string; data: OnboardingOperationalConfigData }> => {
    const params = accountId ? { account_id: accountId } : {};
    return apiClient.put(`/admin/onboarding-submissions/${submissionId}/operational-config`, body, { params });
  },

  syncOnboardingOperationalConfigDefaults: async (
    submissionId: string,
    accountId?: string,
  ): Promise<{ code: number; status: string; message: string; data: OnboardingOperationalConfigData }> => {
    const params = accountId ? { account_id: accountId } : {};
    return apiClient.post(`/admin/onboarding-submissions/${submissionId}/operational-config/sync-defaults`, {}, { params });
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

  listPlatformMilkSales: async (
    accountId: string | undefined,
    params: {
      scope: 'collections' | 'rejections';
      page?: number;
      limit?: number;
      date_from?: string;
      date_to?: string;
      tz_offset_minutes?: number;
    },
  ): Promise<{
    code: number;
    status: string;
    message: string;
    data: {
      scope: string;
      period: { start: string; end: string };
      rows: PlatformMilkSaleRow[];
      pagination: AdminPlatformPagination;
    };
  }> => {
    const q: Record<string, unknown> = {
      scope: params.scope,
      page: params.page ?? 1,
      limit: params.limit ?? 25,
    };
    if (accountId) q.account_id = accountId;
    if (params.date_from) q.date_from = params.date_from;
    if (params.date_to) q.date_to = params.date_to;
    if (params.tz_offset_minutes !== undefined) q.tz_offset_minutes = params.tz_offset_minutes;
    return apiClient.get('/admin/platform/milk-sales', { params: q });
  },

  listPlatformLoans: async (
    accountId: string | undefined,
    params: {
      mode: 'active_portfolio' | 'disbursed_in_period';
      page?: number;
      limit?: number;
      date_from?: string;
      date_to?: string;
      tz_offset_minutes?: number;
    },
  ): Promise<{
    code: number;
    status: string;
    message: string;
    data: { mode: string; rows: PlatformLoanRow[]; pagination: AdminPlatformPagination };
  }> => {
    const q: Record<string, unknown> = {
      mode: params.mode,
      page: params.page ?? 1,
      limit: params.limit ?? 25,
    };
    if (accountId) q.account_id = accountId;
    if (params.date_from) q.date_from = params.date_from;
    if (params.date_to) q.date_to = params.date_to;
    if (params.tz_offset_minutes !== undefined) q.tz_offset_minutes = params.tz_offset_minutes;
    return apiClient.get('/admin/platform/loans', { params: q });
  },

  listPlatformLoanRepayments: async (
    accountId: string | undefined,
    params: {
      page?: number;
      limit?: number;
      date_from?: string;
      date_to?: string;
      tz_offset_minutes?: number;
    },
  ): Promise<{
    code: number;
    status: string;
    message: string;
    data: { period: { start: string; end: string }; rows: PlatformLoanRepaymentRow[]; pagination: AdminPlatformPagination };
  }> => {
    const q: Record<string, unknown> = { page: params.page ?? 1, limit: params.limit ?? 25 };
    if (accountId) q.account_id = accountId;
    if (params.date_from) q.date_from = params.date_from;
    if (params.date_to) q.date_to = params.date_to;
    if (params.tz_offset_minutes !== undefined) q.tz_offset_minutes = params.tz_offset_minutes;
    return apiClient.get('/admin/platform/loan-repayments', { params: q });
  },

  listPlatformPayrollRuns: async (
    accountId: string | undefined,
    params: {
      page?: number;
      limit?: number;
      date_from?: string;
      date_to?: string;
      tz_offset_minutes?: number;
    },
  ): Promise<{
    code: number;
    status: string;
    message: string;
    data: { period: { start: string; end: string }; rows: PlatformPayrollRunRow[]; pagination: AdminPlatformPagination };
  }> => {
    const q: Record<string, unknown> = { page: params.page ?? 1, limit: params.limit ?? 25 };
    if (accountId) q.account_id = accountId;
    if (params.date_from) q.date_from = params.date_from;
    if (params.date_to) q.date_to = params.date_to;
    if (params.tz_offset_minutes !== undefined) q.tz_offset_minutes = params.tz_offset_minutes;
    return apiClient.get('/admin/platform/payroll-runs', { params: q });
  },

  listPlatformInventorySales: async (
    accountId: string | undefined,
    params: {
      page?: number;
      limit?: number;
      date_from?: string;
      date_to?: string;
      tz_offset_minutes?: number;
    },
  ): Promise<{
    code: number;
    status: string;
    message: string;
    data: { period: { start: string; end: string }; rows: PlatformInventorySaleRow[]; pagination: AdminPlatformPagination };
  }> => {
    const q: Record<string, unknown> = { page: params.page ?? 1, limit: params.limit ?? 25 };
    if (accountId) q.account_id = accountId;
    if (params.date_from) q.date_from = params.date_from;
    if (params.date_to) q.date_to = params.date_to;
    if (params.tz_offset_minutes !== undefined) q.tz_offset_minutes = params.tz_offset_minutes;
    return apiClient.get('/admin/platform/inventory-sales', { params: q });
  },

  listPlatformAuditEvents: async (
    accountId: string | undefined,
    params: {
      page?: number;
      limit?: number;
      date_from?: string;
      date_to?: string;
      tz_offset_minutes?: number;
    },
  ): Promise<{
    code: number;
    status: string;
    message: string;
    data: { period: { start: string; end: string }; rows: PlatformAuditEventRow[]; pagination: AdminPlatformPagination };
  }> => {
    const q: Record<string, unknown> = { page: params.page ?? 1, limit: params.limit ?? 25 };
    if (accountId) q.account_id = accountId;
    if (params.date_from) q.date_from = params.date_from;
    if (params.date_to) q.date_to = params.date_to;
    if (params.tz_offset_minutes !== undefined) q.tz_offset_minutes = params.tz_offset_minutes;
    return apiClient.get('/admin/platform/audit-events', { params: q });
  },

  listPlatformCharges: async (
    accountId: string | undefined,
    params: {
      page?: number;
      limit?: number;
      date_from?: string;
      date_to?: string;
      tz_offset_minutes?: number;
    },
  ): Promise<{
    code: number;
    status: string;
    message: string;
    data: { period: { start: string; end: string }; rows: PlatformChargeRow[]; pagination: AdminPlatformPagination };
  }> => {
    const q: Record<string, unknown> = { page: params.page ?? 1, limit: params.limit ?? 25 };
    if (accountId) q.account_id = accountId;
    if (params.date_from) q.date_from = params.date_from;
    if (params.date_to) q.date_to = params.date_to;
    if (params.tz_offset_minutes !== undefined) q.tz_offset_minutes = params.tz_offset_minutes;
    return apiClient.get('/admin/platform/charges', { params: q });
  },

  listPlatformSupplierCustomerLinks: async (
    accountId: string | undefined,
    params: {
      page?: number;
      limit?: number;
      date_from?: string;
      date_to?: string;
      tz_offset_minutes?: number;
    },
  ): Promise<{
    code: number;
    status: string;
    message: string;
    data: {
      period: { start: string; end: string };
      rows: PlatformSupplierCustomerLinkRow[];
      pagination: AdminPlatformPagination;
    };
  }> => {
    const q: Record<string, unknown> = { page: params.page ?? 1, limit: params.limit ?? 25 };
    if (accountId) q.account_id = accountId;
    if (params.date_from) q.date_from = params.date_from;
    if (params.date_to) q.date_to = params.date_to;
    if (params.tz_offset_minutes !== undefined) q.tz_offset_minutes = params.tz_offset_minutes;
    return apiClient.get('/admin/platform/supplier-customer-links', { params: q });
  },

  listPlatformAccountingTransactions: async (
    accountId: string | undefined,
    params: {
      page?: number;
      limit?: number;
      date_from?: string;
      date_to?: string;
      tz_offset_minutes?: number;
    },
  ): Promise<{
    code: number;
    status: string;
    message: string;
    data: {
      period: { start: string; end: string };
      rows: PlatformAccountingTransactionRow[];
      pagination: AdminPlatformPagination;
    };
  }> => {
    const q: Record<string, unknown> = { page: params.page ?? 1, limit: params.limit ?? 25 };
    if (accountId) q.account_id = accountId;
    if (params.date_from) q.date_from = params.date_from;
    if (params.date_to) q.date_to = params.date_to;
    if (params.tz_offset_minutes !== undefined) q.tz_offset_minutes = params.tz_offset_minutes;
    return apiClient.get('/admin/platform/accounting-transactions', { params: q });
  },

  listPlatformGateDeliveries: async (
    accountId: string | undefined,
    params: {
      page?: number;
      limit?: number;
      date_from?: string;
      date_to?: string;
      tz_offset_minutes?: number;
    },
  ): Promise<{
    code: number;
    status: string;
    message: string;
    data: { period: { start: string; end: string }; rows: PlatformGateDeliveryRow[]; pagination: AdminPlatformPagination };
  }> => {
    const q: Record<string, unknown> = { page: params.page ?? 1, limit: params.limit ?? 25 };
    if (accountId) q.account_id = accountId;
    if (params.date_from) q.date_from = params.date_from;
    if (params.date_to) q.date_to = params.date_to;
    if (params.tz_offset_minutes !== undefined) q.tz_offset_minutes = params.tz_offset_minutes;
    return apiClient.get('/admin/platform/gate-deliveries', { params: q });
  },

  listPlatformMilkManifests: async (
    accountId: string | undefined,
    params: {
      page?: number;
      limit?: number;
      date_from?: string;
      date_to?: string;
      tz_offset_minutes?: number;
    },
  ): Promise<{
    code: number;
    status: string;
    message: string;
    data: { period: { start: string; end: string }; rows: PlatformMilkManifestRow[]; pagination: AdminPlatformPagination };
  }> => {
    const q: Record<string, unknown> = { page: params.page ?? 1, limit: params.limit ?? 25 };
    if (accountId) q.account_id = accountId;
    if (params.date_from) q.date_from = params.date_from;
    if (params.date_to) q.date_to = params.date_to;
    if (params.tz_offset_minutes !== undefined) q.tz_offset_minutes = params.tz_offset_minutes;
    return apiClient.get('/admin/platform/milk-manifests', { params: q });
  },

  listTenantAccountsForAdmin: async (
    accountId: string | undefined,
    params: {
      page?: number;
      limit?: number;
      search?: string;
      account_type?: 'tenant' | 'branch' | 'admin' | 'all';
      district_location_id?: string;
    },
  ): Promise<{
    code: number;
    status: string;
    message: string;
    data: { rows: TenantAccountRow[]; pagination: AdminPlatformPagination };
  }> => {
    const q: Record<string, unknown> = { page: params.page ?? 1, limit: params.limit ?? 20 };
    if (accountId) q.account_id = accountId;
    if (params.search?.trim()) q.search = params.search.trim();
    if (params.account_type) q.account_type = params.account_type;
    if (params.district_location_id) q.district_location_id = params.district_location_id;
    return apiClient.get('/admin/tenant-accounts', { params: q });
  },

  getTenantAccountForAdmin: async (
    accountId: string | undefined,
    targetAccountId: string,
  ): Promise<{
    code: number;
    status: string;
    message: string;
    data: TenantAccountAdminDetail;
  }> => {
    const q: Record<string, unknown> = {};
    if (accountId) q.account_id = accountId;
    return apiClient.get(`/admin/tenant-accounts/${targetAccountId}`, { params: q });
  },

  updateTenantAccountOperationalMetrics: async (
    accountId: string | undefined,
    targetAccountId: string,
    body: {
      profile?: Record<string, unknown>;
      facility_snapshot?: Record<string, unknown>;
      cooling_tanks?: Array<{
        tank_number?: string | null;
        capacity_litres?: number | string | null;
        year_or_age?: string | null;
        condition?: string | null;
      }>;
    },
  ): Promise<{
    code: number;
    status: string;
    message: string;
    data: TenantAccountAdminDetail;
  }> => {
    const q: Record<string, unknown> = {};
    if (accountId) q.account_id = accountId;
    return apiClient.put(`/admin/tenant-accounts/${targetAccountId}/operational-metrics`, body, { params: q });
  },

  updateTenantAccountOperationalLocation: async (
    accountId: string | undefined,
    targetAccountId: string,
    body: { operational_location_id?: string | null },
  ): Promise<{
    code: number;
    status: string;
    message: string;
    data: {
      id: string;
      operational_location_id: string | null;
      operational_district_id: string | null;
      operational_location_label: string | null;
    };
  }> => {
    const q: Record<string, unknown> = {};
    if (accountId) q.account_id = accountId;
    return apiClient.put(`/admin/tenant-accounts/${targetAccountId}/operational-location`, body, { params: q });
  },

  getRegionalSupervisorScope: async (
    accountId: string | undefined,
    userId: string,
  ): Promise<{
    code: number;
    status: string;
    message: string;
    data: { user_id: string; districts: RegionalSupervisorDistrictRef[] };
  }> => {
    const q: Record<string, unknown> = {};
    if (accountId) q.account_id = accountId;
    return apiClient.get(`/admin/users/${userId}/regional-supervisor-scope`, { params: q });
  },

  setRegionalSupervisorScope: async (
    accountId: string | undefined,
    userId: string,
    body: { district_location_ids: string[] },
  ): Promise<{
    code: number;
    status: string;
    message: string;
    data: { user_id: string; districts: RegionalSupervisorDistrictRef[] };
  }> => {
    const q: Record<string, unknown> = {};
    if (accountId) q.account_id = accountId;
    return apiClient.put(`/admin/users/${userId}/regional-supervisor-scope`, body, { params: q });
  },
};
