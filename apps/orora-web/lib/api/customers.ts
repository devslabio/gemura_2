import { apiClient } from './client';

export interface Customer {
  relationship_id: string;
  code: string;
  name: string;
  phone: string;
  email?: string;
  nid?: string;
  address?: string;
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

export interface CustomerDetails {
  account_id: string;
  account_code: string;
  name: string;
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

export interface CreateCustomerData {
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  nid?: string;
  address?: string;
  price_per_liter?: number;
}

export interface UpdateCustomerData {
  customer_account_code: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  nid?: string;
  address?: string;
  price_per_liter?: number;
  relationship_status?: 'active' | 'inactive';
}

export interface CustomersResponse {
  code: number;
  status: string;
  message: string;
  data: Customer[];
}

export interface CustomerResponse {
  code: number;
  status: string;
  message: string;
  data: {
    customer: CustomerDetails;
  };
}

export const customersApi = {
  getAllCustomers: async (accountId?: string): Promise<CustomersResponse> => {
    return apiClient.post('/customers/get', accountId ? { account_id: accountId } : {});
  },

  getCustomerById: async (id: string): Promise<CustomerResponse> => {
    return apiClient.get(`/customers/by-id/${id}`);
  },

  getCustomerByCode: async (code: string): Promise<CustomerResponse> => {
    return apiClient.get(`/customers/${code}`);
  },

  createCustomer: async (data: CreateCustomerData): Promise<CustomerResponse> => {
    return apiClient.post('/customers', data);
  },

  updateCustomer: async (data: UpdateCustomerData): Promise<CustomerResponse> => {
    return apiClient.put('/customers/update', data);
  },

  /** Download customers CSV template (triggers file download in browser). */
  downloadTemplate: async (): Promise<void> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('orora-auth-token') : null;
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://159.198.65.38:3004/api';
    const res = await fetch(`${baseURL}/customers/template`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to download template');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customers-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  },

  /** Bulk create or update customers. Returns { success, failed, errors }. */
  bulkCreate: async (
    rows: CreateCustomerData[],
  ): Promise<{ code: number; data: { success: number; failed: number; errors: { row: number; phone: string; message: string }[] } }> => {
    return apiClient.post('/customers/bulk', { rows });
  },
};
