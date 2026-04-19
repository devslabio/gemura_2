import { apiClient } from './client';

export interface Species {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
}

export interface ApiResponse<T> {
  code: number;
  status: string;
  message: string;
  data: T;
}

export const speciesApi = {
  getList: () => apiClient.get<ApiResponse<Species[]>>('/species'),
};
