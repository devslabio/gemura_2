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
  immis_member_id?: number | null;
  immis_linked_at?: string | null;
}

export interface ProfileAccount {
  id: string;
  code: string;
  name: string;
  type: string;
}

/** MCC gate wizard rows linked to this user (admin sets `linked_user_id`). */
export interface ProfileMccOnboardingSummary {
  id: string;
  submission_code: string;
  business_name: string;
  common_name: string | null;
  review_status: string;
  final_decision: string;
  pass_count: number;
  created_at: string;
  reviewed_at: string | null;
  linked_account_id: string | null;
  linked_account: { id: string; name: string; code: string | null } | null;
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
    mcc_onboardings?: ProfileMccOnboardingSummary[];
  };
}

export type MccOnboardingDetailResponse = {
  code: number;
  status: string;
  message?: string;
  data?: Record<string, unknown>;
};

export interface UpdateProfilePayload {
  name?: string;
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

  getOwnMccOnboarding: (submissionId: string): Promise<MccOnboardingDetailResponse> =>
    apiClient.get<MccOnboardingDetailResponse>(`/profile/mcc-onboarding/${submissionId}`),

  updateProfile: (data: UpdateProfilePayload): Promise<GetProfileResponse> =>
    apiClient.put<GetProfileResponse>('/profile/update', data),

  linkImmis: (immis_member_id: number): Promise<GetProfileResponse> =>
    apiClient.post<GetProfileResponse>('/profile/immis-link', { immis_member_id }),

  unlinkImmis: (): Promise<GetProfileResponse> =>
    apiClient.delete<GetProfileResponse>('/profile/immis-link'),
};
