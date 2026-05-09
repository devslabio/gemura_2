import { apiClient } from './client';

export interface TransferSupplier {
  id: string;
  name: string;
  phone: string | null;
  code: string | null;
}

export interface IncomingTransfer {
  id: string;
  supplier: TransferSupplier;
  own_liters: number;
  external_liters: number;
  total_liters: number;
  status: 'submitted' | 'accepted' | 'partially_accepted' | 'rejected';
  rejection_reason: string | null;
  accepted_liters: number | null;
  rejected_liters: number | null;
  supplier_notes: string | null;
  notes: string | null;
  milk_sale_id?: string | null;
  submitted_at: string;
  processed_at: string | null;
  created_at: string;
}

export interface ProcessTransferPayload {
  status: 'accepted' | 'rejected';
  accepted_liters?: number;
  rejection_reason?: string;
  notes?: string;
}

interface ApiResponse<T> {
  code: number;
  status: string;
  message: string;
  data: T;
}

export const transfersApi = {
  getIncoming: async (status?: string): Promise<ApiResponse<IncomingTransfer[]>> => {
    const params = status ? `?status=${status}` : '';
    return apiClient.get(`/transfers/incoming${params}`);
  },

  getById: async (id: string): Promise<ApiResponse<IncomingTransfer>> => {
    return apiClient.get(`/transfers/${id}`);
  },

  process: async (id: string, payload: ProcessTransferPayload): Promise<ApiResponse<IncomingTransfer>> => {
    return apiClient.post(`/transfers/${id}/process`, payload);
  },
};
