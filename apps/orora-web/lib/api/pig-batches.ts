import { apiClient } from './client';

export interface ApiResponse<T> {
  code: number;
  status: string;
  message: string;
  data: T;
}

export interface PigBatch {
  id: string;
  account_id: string;
  farm_id: string | null;
  breed_id: string | null;
  name: string;
  code: string | null;
  started_at: string;
  opening_head_count: number;
  current_head_count: number;
  status: string;
  notes: string | null;
  farm?: { id: string; name: string; code: string | null } | null;
  breed?: { id: string; name: string; code: string } | null;
}

export interface PigBatchWeight {
  id: string;
  batch_id: string;
  weighed_date: string;
  avg_weight_kg: string | number;
  min_weight_kg?: string | number | null;
  max_weight_kg?: string | number | null;
  animals_weighed?: number | null;
  weight_band?: string | null;
  notes?: string | null;
}

export interface PigFarrowing {
  id: string;
  account_id: string;
  farm_id: string | null;
  pig_batch_id: string | null;
  sow_animal_id: string | null;
  farrowing_date: string;
  live_born: number;
  stillborn: number;
  mummified: number;
  notes: string | null;
  farm?: { id: string; name: string } | null;
  batch?: { id: string; name: string; code: string | null } | null;
  sow?: { id: string; tag_number: string; name: string | null } | null;
}

const batchParams = (accountId?: string, farmId?: string) => {
  const p: Record<string, string> = {};
  if (accountId) p.account_id = accountId;
  if (farmId) p.farm_id = farmId;
  return p;
};

export const pigBatchesApi = {
  list: (accountId?: string, farmId?: string) =>
    apiClient.get<ApiResponse<PigBatch[]>>('/pig-batches', { params: batchParams(accountId, farmId) }),

  get: (id: string, accountId?: string) =>
    apiClient.get<ApiResponse<PigBatch>>(`/pig-batches/${id}`, {
      params: accountId ? { account_id: accountId } : {},
    }),

  create: (
    body: {
      name: string;
      farm_id?: string;
      breed_id?: string;
      started_at: string;
      opening_head_count: number;
      notes?: string;
    },
    accountId?: string,
  ) =>
    apiClient.post<ApiResponse<PigBatch>>('/pig-batches', body, {
      params: accountId ? { account_id: accountId } : {},
    }),

  update: (
    id: string,
    body: {
      name?: string;
      farm_id?: string | null;
      breed_id?: string | null;
      status?: 'active' | 'closed' | 'archived';
      notes?: string | null;
    },
    accountId?: string,
  ) =>
    apiClient.patch<ApiResponse<PigBatch>>(`/pig-batches/${id}`, body, {
      params: accountId ? { account_id: accountId } : {},
    }),

  listWeights: (id: string, accountId?: string) =>
    apiClient.get<ApiResponse<PigBatchWeight[]>>(`/pig-batches/${id}/weights`, {
      params: accountId ? { account_id: accountId } : {},
    }),

  upsertWeight: (
    id: string,
    body: {
      weighed_date: string;
      avg_weight_kg: number;
      min_weight_kg?: number;
      max_weight_kg?: number;
      animals_weighed?: number;
      weight_band?: string;
      notes?: string;
    },
    accountId?: string,
  ) =>
    apiClient.post<ApiResponse<PigBatchWeight>>(`/pig-batches/${id}/weights`, body, {
      params: accountId ? { account_id: accountId } : {},
    }),

  deleteWeight: (id: string, weightId: string, accountId?: string) =>
    apiClient.delete<ApiResponse<{ message?: string }>>(`/pig-batches/${id}/weights/${weightId}`, {
      params: accountId ? { account_id: accountId } : {},
    }),
};

export const pigFarrowingsApi = {
  list: (accountId?: string, farmId?: string, pig_batch_id?: string) => {
    const p: Record<string, string> = {};
    if (accountId) p.account_id = accountId;
    if (farmId) p.farm_id = farmId;
    if (pig_batch_id) p.pig_batch_id = pig_batch_id;
    return apiClient.get<ApiResponse<PigFarrowing[]>>('/pig-farrowings', { params: p });
  },

  create: (
    body: {
      farm_id?: string;
      pig_batch_id?: string;
      sow_animal_id?: string;
      farrowing_date: string;
      live_born?: number;
      stillborn?: number;
      mummified?: number;
      notes?: string;
    },
    accountId?: string,
  ) =>
    apiClient.post<ApiResponse<PigFarrowing>>('/pig-farrowings', body, {
      params: accountId ? { account_id: accountId } : {},
    }),

  delete: (id: string, accountId?: string) =>
    apiClient.delete<ApiResponse<{ message?: string }>>(`/pig-farrowings/${id}`, {
      params: accountId ? { account_id: accountId } : {},
    }),
};
