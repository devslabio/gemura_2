import { apiClient } from './client';

export type LocationType = 'COUNTRY' | 'PROVINCE' | 'DISTRICT' | 'SECTOR' | 'CELL' | 'VILLAGE';

export interface Location {
  id: string;
  code: string;
  name: string;
  location_type: LocationType;
  parent_id: string | null;
}

export interface LocationsListResponse {
  code: number;
  status?: string;
  message?: string;
  data: Location[];
}

export interface LocationPathResponse {
  code: number;
  status?: string;
  message?: string;
  data: { id: string; code: string; name: string; location_type: string }[];
}

export const locationsApi = {
  getProvinces: () => apiClient.get<LocationsListResponse>('/locations/provinces'),

  getChildren: (parentId: string) =>
    apiClient.get<LocationsListResponse>('/locations', { params: { parent_id: parentId } }),

  getPath: (id: string) => apiClient.get<LocationPathResponse>(`/locations/${id}/path`),

  /** Pre-login MCC onboarding wizard (no auth required). */
  getProvincesPublic: () => apiClient.get<LocationsListResponse>('/public/locations/provinces'),

  getChildrenPublic: (parentId: string) =>
    apiClient.get<LocationsListResponse>('/public/locations', { params: { parent_id: parentId } }),

  getPathPublic: (id: string) => apiClient.get<LocationPathResponse>(`/public/locations/${id}/path`),
};
