import { apiClient } from './client';

export interface Farm {
  id: string;
  code: string;
  name: string;
  location: string | null;
  description: string | null;
  status: 'active' | 'inactive' | 'archived';
  animals_count?: number;
  created_at?: string;
}

export interface FarmsResponse {
  code: number;
  status: string;
  message: string;
  data: {
    farms: Farm[];
  };
}

export const farmsApi = {
  getFarms: async (accountId?: string, filters?: { status?: string; search?: string }): Promise<FarmsResponse> => {
    const params: Record<string, string> = {};
    if (accountId) params.account_id = accountId;
    if (filters?.status) params.status = filters.status;
    if (filters?.search) params.search = filters.search;
    return apiClient.get('/farms', { params });
  },
};

