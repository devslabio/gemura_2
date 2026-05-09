import { apiClient } from './client';

export interface OnboardCreateUserRequest {
  first_name: string;
  last_name: string;
  phone_number: string;
  password: string;
  email?: string;
  location?: string;
}

export interface OnboardCreateUserResponse {
  code: number;
  status: string;
  message: string;
  data?: {
    onboarded_user?: {
      id: string;
      name: string;
      phone_number: string;
      email: string | null;
      location: string | null;
      token: string | null;
      created_at: string;
    };
  };
}

export const onboardApi = {
  createUser: async (payload: OnboardCreateUserRequest): Promise<OnboardCreateUserResponse> => {
    return apiClient.post('/onboard/create-user', payload);
  },
};

