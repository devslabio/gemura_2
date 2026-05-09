import { apiClient } from './client';

export interface ManagedFarm {
  id: string;
  name: string;
  location?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface ManagedCollection {
  id: string;
  farm_id: string;
  farm_name?: string;
  source_type: 'own_farm' | 'external_farm';
  liters: number;
  quality_grade?: string;
  notes?: string;
  status: string;
  transferred: boolean;
  collected_at: string;
  created_at: string;
  updated_at: string;
}

export interface ManagedProduction {
  id: string;
  liters: number;
  produced_at: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ManagedTransfer {
  id: string;
  mcc_account_id?: string | null;
  collection_ids: string[];
  own_liters: number;
  external_liters: number;
  total_liters: number;
  notes?: string;
  status: 'draft' | 'submitted';
  created_at: string;
  updated_at: string;
  submitted_at?: string | null;
  db_transfer_id?: string;
  mcc_status?: 'submitted' | 'accepted' | 'partially_accepted' | 'rejected' | null;
  mcc_rejection_reason?: string | null;
  mcc_accepted_liters?: number | null;
  mcc_rejected_liters?: number | null;
  mcc_processed_at?: string | null;
  mcc_notes?: string | null;
}

interface ApiListResponse<T> {
  code: number;
  status: string;
  message: string;
  data: T;
}

export const supplierOperationsApi = {
  getSummary: () =>
    apiClient.get<ApiListResponse<{
      farms_total: number;
      own_collected_liters: number;
      external_collected_liters: number;
      total_collected_liters: number;
      own_production_liters: number;
      pending_transfers: number;
    }>>('/suppliers/ops/summary'),

  getFarms: () => apiClient.get<ApiListResponse<ManagedFarm[]>>('/suppliers/my-farms'),
  createFarm: (data: { name: string; location?: string; status?: 'active' | 'inactive' }) =>
    apiClient.post<ApiListResponse<ManagedFarm>>('/suppliers/my-farms', data),
  updateFarm: (data: { id: string; name?: string; location?: string; status?: 'active' | 'inactive' }) =>
    apiClient.put<ApiListResponse<ManagedFarm>>('/suppliers/my-farms', data),
  deleteFarm: (id: string) =>
    apiClient.delete<ApiListResponse<null>>('/suppliers/my-farms', { data: { id } }),

  getCollections: () => apiClient.get<ApiListResponse<ManagedCollection[]>>('/suppliers/my-collections'),
  createCollection: (data: {
    farm_id: string;
    farm_name?: string;
    source_type: 'own_farm' | 'external_farm';
    liters: number;
    collected_at: string;
    quality_grade?: string;
    notes?: string;
  }) => apiClient.post<ApiListResponse<ManagedCollection>>('/suppliers/my-collections', data),

  getProduction: () => apiClient.get<ApiListResponse<ManagedProduction[]>>('/suppliers/my-production'),
  createProduction: (data: { liters: number; produced_at: string; notes?: string }) =>
    apiClient.post<ApiListResponse<ManagedProduction>>('/suppliers/my-production', data),

  getTransfers: () => apiClient.get<ApiListResponse<ManagedTransfer[]>>('/suppliers/my-transfers'),
  createTransfer: (data: { collection_ids?: string[]; notes?: string }) =>
    apiClient.post<ApiListResponse<ManagedTransfer>>('/suppliers/my-transfers', data),
  submitTransfer: (id: string) =>
    apiClient.post<ApiListResponse<ManagedTransfer>>('/suppliers/my-transfers/submit', { id }),
};

