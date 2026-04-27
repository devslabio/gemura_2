import { apiClient } from './client';

export type FarmStatus = 'active' | 'inactive' | 'archived';

export type FarmProductionMode = 'dairy' | 'meat' | 'eggs' | 'breeding';

export interface FarmSpeciesFocus {
  farm_id: string;
  species_id: string;
  modes: FarmProductionMode[];
  /** Present when loaded from the farms API with includes */
  species?: { id: string; code: string; name: string };
}

export interface FarmLocationRef {
  id: string;
  code: string;
  name: string;
  location_type: string;
}

export interface Farm {
  id: string;
  account_id: string;
  name: string;
  code: string | null;
  description: string | null;
  location: string | null;
  location_id: string | null;
  locationRef?: FarmLocationRef | null;
  status: FarmStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  _count?: {
    animals: number;
  };
  farm_species_focus?: FarmSpeciesFocus[];
}

export interface ApiResponse<T> {
  code: number;
  status: string;
  message: string;
  data: T;
}

export interface FarmFilters {
  status?: FarmStatus | '';
  search?: string;
}

const buildParams = (accountId?: string, filters?: FarmFilters) => {
  const params: Record<string, string> = {};
  if (accountId) params.account_id = accountId;
  if (filters?.status) params.status = filters.status;
  if (filters?.search) params.search = filters.search;
  return params;
};

export const farmsApi = {
  list: (accountId?: string, filters?: FarmFilters) =>
    apiClient.get<ApiResponse<Farm[]>>('/farms', {
      params: buildParams(accountId, filters),
    }),

  getById: (id: string, accountId?: string) =>
    apiClient.get<ApiResponse<Farm>>(`/farms/${id}`, {
      params: accountId ? { account_id: accountId } : {},
    }),

  create: (
    data: {
      name: string;
      location_id?: string;
      location?: string;
      description?: string;
      species_focus?: { species_id: string; modes: FarmProductionMode[] }[];
    },
    accountId?: string,
  ) =>
    apiClient.post<ApiResponse<Farm>>('/farms', data, {
      params: accountId ? { account_id: accountId } : {},
    }),

  update: (
    id: string,
    data: {
      name?: string;
      location_id?: string;
      location?: string;
      description?: string;
      status?: FarmStatus;
      species_focus?: { species_id: string; modes: FarmProductionMode[] }[];
    },
    accountId?: string,
  ) =>
    apiClient.patch<ApiResponse<Farm>>(`/farms/${id}`, data, {
      params: accountId ? { account_id: accountId } : {},
    }),

  delete: (id: string, accountId?: string) =>
    apiClient.delete<ApiResponse<{ message: string | null }>>(`/farms/${id}`, {
      params: accountId ? { account_id: accountId } : {},
    }),
};

