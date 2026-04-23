import { apiClient } from './client';

export interface Breed {
  id: string;
  name: string;
  code: string | null;
  description?: string | null;
  species_id?: string;
  species?: { id: string; code: string; name: string } | null;
}

export interface ApiResponse<T> {
  code: number;
  status: string;
  message: string;
  data: T;
}

export const breedsApi = {
  getList: (speciesId?: string) =>
    apiClient.get<ApiResponse<Breed[]>>('/breeds', {
      params: speciesId ? { species_id: speciesId } : {},
    }),
};
