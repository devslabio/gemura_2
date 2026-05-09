import { apiClient } from './client';

export type LocationType = 'COUNTRY' | 'PROVINCE' | 'DISTRICT' | 'SECTOR' | 'CELL' | 'VILLAGE';

export interface Location {
  id: string;
  code: string;
  name: string;
  location_type: LocationType;
  parent_id: string | null;
}

interface ApiResponse<T> {
  code: number;
  data: T;
  message?: string;
}

export const locationsApi = {
  getProvinces: () => apiClient.get<ApiResponse<Location[]>>('/locations/provinces'),

  getChildren: (parentId: string) =>
    apiClient.get<ApiResponse<Location[]>>('/locations', { params: { parent_id: parentId } }),

  getPath: (id: string) =>
    apiClient.get<ApiResponse<{ id: string; code: string; name: string; location_type: string }[]>>(`/locations/${id}/path`),
};
