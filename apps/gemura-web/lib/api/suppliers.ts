import { apiClient } from './client';

export interface Supplier {
  relationship_id: string;
  code: string;
  name: string;
  phone: string;
  email?: string;
  nid?: string;
  address?: string;
  bank_name?: string;
  bank_account_number?: string;
  type?: string;
  account: {
    id: string;
    code: string;
    name: string;
  };
  price_per_liter?: number;
  average_supply_quantity?: number;
  relationship_status: string;
  created_at: string;
  updated_at: string;
}

export interface SupplierDetails {
  account_id: string;
  account_code: string;
  name: string;
  bank_name?: string;
  bank_account_number?: string;
  type: string;
  status: string;
  user: {
    id: string;
    first_name?: string;
    last_name?: string;
    name: string;
    phone: string;
    email?: string;
    nid?: string;
    address?: string;
    account_type: string;
  };
  relationship: {
    price_per_liter: number;
    average_supply_quantity?: number;
    relationship_status: string;
    created_at: string;
    updated_at: string;
  };
}

export interface CreateSupplierData {
  first_name: string;
  last_name: string;
  phone: string;
  price_per_liter: number;
  email?: string;
  nid?: string;
  address?: string;
  bank_name?: string;
  bank_account_number?: string;
  /** Cooperative membership on the registering MCC account */
  add_as_cooperative_member?: boolean;
  /** Create UserAccount on the MCC for staff-style access */
  grant_mcc_staff_access?: boolean;
  /** Platform role slug when grant_mcc_staff_access is true (e.g. collector, manager) */
  mcc_staff_role?: string;
}

export interface MccAffiliationResult {
  cooperative_member_recorded: boolean;
  mcc_staff: 'created' | 'skipped_already_linked' | 'not_requested';
  mcc_staff_role?: string;
}

export interface UpdateSupplierData {
  supplier_account_code: string;
  price_per_liter?: number;
  relationship_status?: 'active' | 'inactive';
  bank_name?: string;
  bank_account_number?: string;
  type?: string;
}

export interface SuppliersResponse {
  code: number;
  status: string;
  message: string;
  data: Supplier[];
}

/** Returned with supplier detail when the MCC has an active relationship and a linked supplier user */
export interface SupplierMilkOnboardingBundle {
  onboarding: Record<string, unknown> | null;
  updated_at: string | null;
}

export interface SupplierResponse {
  code: number;
  status: string;
  message: string;
  data: {
    supplier: SupplierDetails;
    /** Present on newer APIs; omit on older backends */
    milk_onboarding?: SupplierMilkOnboardingBundle | null;
  };
}

export const suppliersApi = {
  getAllSuppliers: async (accountId?: string): Promise<SuppliersResponse> => {
    return apiClient.post('/suppliers/get', accountId ? { account_id: accountId } : {});
  },

  getSupplierById: async (id: string): Promise<SupplierResponse> => {
    return apiClient.get(`/suppliers/by-id/${id}`);
  },

  getSupplierByCode: async (code: string): Promise<SupplierResponse> => {
    return apiClient.get(`/suppliers/${code}`);
  },

  createSupplier: async (
    data: CreateSupplierData,
  ): Promise<{
    code: number;
    status: string;
    message: string;
    data?: { supplier: Record<string, unknown>; mcc_affiliation?: MccAffiliationResult };
  }> => {
    return apiClient.post('/suppliers/create', data);
  },

  updateSupplier: async (data: UpdateSupplierData): Promise<SupplierResponse> => {
    return apiClient.put('/suppliers/update', data);
  },

  /** Download suppliers CSV template (triggers file download in browser). */
  downloadTemplate: async (): Promise<void> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('gemura-auth-token') : null;
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://159.198.65.38:3004/api';
    const res = await fetch(`${baseURL}/suppliers/template`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to download template');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'suppliers-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  },

  /** Bulk create or update suppliers. Returns { success, failed, errors }. */
  bulkCreate: async (
    rows: CreateSupplierData[],
  ): Promise<{ code: number; data: { success: number; failed: number; errors: { row: number; phone: string; message: string }[] } }> => {
    return apiClient.post('/suppliers/bulk', { rows });
  },
};
