import { apiClient } from './client';

/** Set when this milk sale is linked to MCC gate or manifest trace data. */
export type MccCollectionContext = 'umucunda_manifest_line' | 'direct_gate' | null;

export interface Collection {
  id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'deleted';
  collection_at: string;
  collection_shift?: 'morning' | 'evening';
  notes?: string;
  created_at: string;
  updated_at?: string;
  mcc_gate_delivery_id?: string | null;
  mcc_manifest_line_id?: string | null;
  mcc_collection_context?: MccCollectionContext;
  supplier_account: {
    id: string;
    code: string;
    name: string;
    type: string;
    status: string;
  };
  customer_account: {
    id: string;
    code: string;
    name: string;
    type: string;
    status: string;
  };
  recorded_by?: {
    id: string;
    name: string;
    phone: string;
  };
}

export interface CollectionsFilters {
  /** Exact supplier account id (preferred over supplier_name when using dropdown filter). */
  supplier_account_id?: string;
  supplier_name?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  quantity_min?: number;
  quantity_max?: number;
  price_min?: number;
  price_max?: number;
}

export interface CreateCollectionData {
  supplier_account_code: string;
  collection_shift?: 'morning' | 'evening';
  quantity: number;
  status?: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  collection_at: string;
  notes?: string;
  payment_status?: 'paid' | 'unpaid';
  rejection_reason?: string;
  /** Direct farmer at gate; mutually exclusive with mcc_manifest_line_id. */
  mcc_gate_delivery_id?: string;
  /** Accepted manifest farmer line (Umucunda); mutually exclusive with mcc_gate_delivery_id. */
  mcc_manifest_line_id?: string;
}

export interface UpdateCollectionData {
  collection_id: string;
  quantity?: number;
  status?: string;
  collection_at?: string;
  notes?: string;
  rejection_reason?: string;
}

export interface RejectionReason {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface RejectionReasonsResponse {
  code: number;
  status: string;
  message: string;
  data: RejectionReason[];
}

export interface CollectionsResponse {
  code: number;
  status: string;
  message: string;
  data: Collection[];
}

export interface CollectionResponse {
  code: number;
  status: string;
  message: string;
  data: Collection;
}

export const collectionsApi = {
  getCollections: async (filters?: CollectionsFilters, accountId?: string): Promise<CollectionsResponse> => {
    const params = new URLSearchParams();
    if (accountId) params.append('account_id', accountId);
    if (filters?.supplier_account_id) params.append('supplier_account_id', filters.supplier_account_id);
    if (filters?.supplier_name) params.append('supplier_name', filters.supplier_name);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.date_from) params.append('date_from', filters.date_from);
    if (filters?.date_to) params.append('date_to', filters.date_to);
    if (filters?.quantity_min) params.append('quantity_min', filters.quantity_min.toString());
    if (filters?.quantity_max) params.append('quantity_max', filters.quantity_max.toString());
    if (filters?.price_min) params.append('price_min', filters.price_min.toString());
    if (filters?.price_max) params.append('price_max', filters.price_max.toString());
    
    return apiClient.get(`/collections?${params.toString()}`);
  },

  getCollectionById: async (collectionId: string, accountId?: string): Promise<CollectionResponse> => {
    const params = new URLSearchParams();
    if (accountId) params.append('account_id', accountId);
    const url = params.toString() ? `/collections/${collectionId}?${params.toString()}` : `/collections/${collectionId}`;
    const response = await apiClient.get(url);
    return response as CollectionResponse;
  },

  downloadTemplate: async (): Promise<void> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('gemura-auth-token') : null;
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://159.198.65.38:3004/api';
    const res = await fetch(`${baseURL}/collections/template`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to download template');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'collections-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  },

  bulkCreate: async (
    rows: CreateCollectionData[],
  ): Promise<{ code: number; data: { success: number; failed: number; errors: { row: number; phone: string; message: string }[] } }> => {
    return apiClient.post('/collections/bulk', { rows });
  },

  createCollection: async (data: CreateCollectionData): Promise<CollectionResponse> => {
    return apiClient.post('/collections/create', data);
  },

  updateCollection: async (data: UpdateCollectionData): Promise<CollectionResponse> => {
    return apiClient.put('/collections/update', data);
  },

  cancelCollection: async (collectionId: string): Promise<{ code: number; status: string; message: string }> => {
    return apiClient.delete('/collections/cancel', {
      data: { collection_id: collectionId },
    });
  },

  /** Record payment for a collection (reduces payables). */
  recordPayment: async (
    collectionId: string,
    data: { amount: number; payment_date?: string; notes?: string }
  ): Promise<{ code: number; status: string; message: string; data?: { payment_status: string } }> => {
    return apiClient.post(`/collections/${collectionId}/payment`, data);
  },

  getRejectionReasons: async (): Promise<RejectionReasonsResponse> => {
    return apiClient.get('/collections/rejection-reasons');
  },
};
