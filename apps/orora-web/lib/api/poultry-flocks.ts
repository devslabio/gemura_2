import { apiClient } from './client';

export interface ApiResponse<T> {
  code: number;
  status: string;
  message: string;
  data: T;
}

export interface PoultryFlock {
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

export interface FlockDailyRecord {
  id: string;
  flock_id: string;
  record_date: string;
  eggs_collected: number;
  mortality_count: number;
  notes: string | null;
}

export type FlockMovementType =
  | 'intake'
  | 'sale'
  | 'transfer_out'
  | 'transfer_in'
  | 'adjustment';

export interface FlockMovement {
  id: string;
  flock_id: string;
  movement_date: string;
  type: FlockMovementType;
  quantity: number;
  notes: string | null;
}

const params = (accountId?: string, farmId?: string) => {
  const p: Record<string, string> = {};
  if (accountId) p.account_id = accountId;
  if (farmId) p.farm_id = farmId;
  return p;
};

export const poultryFlocksApi = {
  list: (accountId?: string, farmId?: string) =>
    apiClient.get<ApiResponse<PoultryFlock[]>>('/poultry-flocks', { params: params(accountId, farmId) }),

  get: (id: string, accountId?: string) =>
    apiClient.get<ApiResponse<PoultryFlock>>(`/poultry-flocks/${id}`, {
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
    apiClient.post<ApiResponse<PoultryFlock>>('/poultry-flocks', body, {
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
    apiClient.patch<ApiResponse<PoultryFlock>>(`/poultry-flocks/${id}`, body, {
      params: accountId ? { account_id: accountId } : {},
    }),

  listDaily: (id: string, accountId?: string, from?: string, to?: string) => {
    const p: Record<string, string> = {};
    if (accountId) p.account_id = accountId;
    if (from) p.from = from;
    if (to) p.to = to;
    return apiClient.get<ApiResponse<FlockDailyRecord[]>>(`/poultry-flocks/${id}/daily`, { params: p });
  },

  upsertDaily: (
    id: string,
    body: { record_date: string; eggs_collected?: number; mortality_count?: number; notes?: string },
    accountId?: string,
  ) =>
    apiClient.post<ApiResponse<FlockDailyRecord>>(`/poultry-flocks/${id}/daily`, body, {
      params: accountId ? { account_id: accountId } : {},
    }),

  deleteDaily: (id: string, recordId: string, accountId?: string) =>
    apiClient.delete<ApiResponse<{ message?: string }>>(`/poultry-flocks/${id}/daily/${recordId}`, {
      params: accountId ? { account_id: accountId } : {},
    }),

  listMovements: (id: string, accountId?: string) =>
    apiClient.get<ApiResponse<FlockMovement[]>>(`/poultry-flocks/${id}/movements`, {
      params: accountId ? { account_id: accountId } : {},
    }),

  addMovement: (
    id: string,
    body: {
      movement_date: string;
      type: FlockMovementType;
      quantity: number;
      notes?: string;
    },
    accountId?: string,
  ) =>
    apiClient.post<ApiResponse<FlockMovement>>(`/poultry-flocks/${id}/movements`, body, {
      params: accountId ? { account_id: accountId } : {},
    }),
};
