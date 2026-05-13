import { apiClient } from './client';

export type SupervisorScope = {
  provinces: Array<{ id: string; code: string; name: string }>;
  districts: Array<{ id: string; code: string; name: string; province_id: string }>;
};

export type SupervisorAccountRow = {
  id: string;
  code: string | null;
  name: string;
  type: string;
  status: string;
  operational_location_id: string | null;
  operational_district_id: string | null;
  operational_location_label: string | null;
  operational_district_label: string | null;
  regional_supervisor_user_id: string | null;
  regional_supervisor: { id: string; name: string; email: string | null; phone: string } | null;
  /** Business KPIs per account (Nest admin listing uses `stats`). */
  stats: {
    members: number;
    suppliers: number;
    customers: number;
    sales: number;
    collections: number;
    farms: number;
  };
};

export type SupervisorAccountsResponse = {
  code: number;
  status: string;
  message: string;
  data: {
    rows: SupervisorAccountRow[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  };
};

export type SupervisorSummaryResponse = {
  code: number;
  status: string;
  message: string;
  data: {
    mcc_count: number;
    members: number;
    suppliers: number;
    customers: number;
    farms: number;
    sales: number;
    collections: number;
    /** % accepted among manifests with status accepted or rejected (null if none). */
    manifest_acceptance_pct: number | null;
    /** % rejected among gate milk tests with outcome accepted or rejected (null if none). */
    quality_test_rejection_pct: number | null;
    /** Mean `tank_used_pct` from facility snapshots (null if no snapshots). */
    avg_tank_utilization_pct: number | null;
    /** Staff shifts with no `ended_at` (open gate shifts). */
    open_staff_shifts: number;
  };
};

export const supervisorApi = {
  getScope: async (params?: { account_id?: string }): Promise<{ code: number; status: string; message: string; data: SupervisorScope }> => {
    return apiClient.get('/supervisor/scope', { params });
  },
  getSummary: async (params?: { account_id?: string; district_location_id?: string; region_id?: string }): Promise<SupervisorSummaryResponse> => {
    return apiClient.get('/supervisor/summary', { params });
  },
  getAccounts: async (params?: {
    account_id?: string;
    page?: number;
    limit?: number;
    search?: string;
    account_type?: 'tenant' | 'branch' | 'admin' | 'all';
    district_location_id?: string;
    region_id?: string;
  }): Promise<SupervisorAccountsResponse> => {
    return apiClient.get('/supervisor/accounts', { params });
  },
};

