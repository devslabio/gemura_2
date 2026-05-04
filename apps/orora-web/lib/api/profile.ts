import { apiClient } from './client';

export interface ProfileUser {
  id: string;
  first_name?: string;
  last_name?: string;
  name: string;
  email: string | null;
  phone: string | null;
  account_type?: string;
  status?: string;
  token?: string;
}

export interface ProfileAccount {
  id: string;
  code: string;
  name: string;
  type: string;
}

export interface GetProfileResponse {
  code: number;
  status: string;
  message?: string;
  data?: {
    user: ProfileUser;
    account: ProfileAccount | null;
    accounts: Array<{
      account_id: string;
      account_code: string;
      account_name: string;
      account_type: string;
      role: string;
      is_default: boolean;
    }>;
    total_accounts?: number;
    profile_completion?: number;
  };
}

export interface UpdateProfilePayload {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  nid?: string;
  address?: string;
  province?: string;
  district?: string;
  sector?: string;
  cell?: string;
  village?: string;
  id_number?: string;
  id_front_photo_url?: string;
  id_back_photo_url?: string;
  selfie_photo_url?: string;
}

export const profileApi = {
  getProfile: (): Promise<GetProfileResponse> =>
    apiClient.get<GetProfileResponse>('/profile/get'),

  updateProfile: (data: UpdateProfilePayload): Promise<GetProfileResponse> =>
    apiClient.put<GetProfileResponse>('/profile/update', data),
};
