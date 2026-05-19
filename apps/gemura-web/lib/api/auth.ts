import { apiClient } from './client';
import { LoginCredentials, RegisterData, User, UserAccount } from '@/types';

export interface LoginResponseData {
  user: {
    id: string;
    first_name?: string;
    last_name?: string;
    name: string;
    email: string;
    phone: string;
    account_type: string;
    status: string;
    token: string;
  };
  account?: any;
  accounts?: UserAccount[];
  total_accounts?: number;
  profile_completion?: number;
}

export interface RegisterResponseData {
  user: {
    code?: string;
    first_name?: string;
    last_name?: string;
    name: string;
    email: string;
    phone: string;
    nid?: string;
    account_type: string;
    status: string;
    token: string;
  };
  account?: any;
  wallet?: any;
  sms_sent?: boolean;
}

export interface AuthResponse {
  code: number;
  status: string;
  message: string;
  data: LoginResponseData | RegisterResponseData;
}

export interface ErrorResponse {
  code: number;
  status: string;
  message: string;
}

export interface ForgotPasswordResponse {
  code: number;
  status: string;
  message: string;
  data: {
    user_id: string;
    legacy_user_id?: number | null;
    sms_sent: boolean;
    email_sent: boolean;
    contact_info: {
      phone?: string | null;
      email?: string | null;
    };
  };
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse | ErrorResponse> => {
    // Validate credentials before sending
    if (!credentials.email || !credentials.email.trim()) {
      return {
        code: 400,
        status: 'error',
        message: 'Identifier is required',
      };
    }
    
    if (!credentials.password || !credentials.password.trim()) {
      return {
        code: 400,
        status: 'error',
        message: 'Password is required',
      };
    }
    
    // Backend expects 'identifier' (can be email or phone), not 'email'
    return apiClient.post('/auth/login', {
      identifier: credentials.email.trim(), // Use email as identifier
      password: credentials.password,
    });
  },

  register: async (data: RegisterData): Promise<AuthResponse | ErrorResponse> => {
    if (!data.phone) {
      throw new Error('Phone number is required');
    }

    return apiClient.post('/auth/register', {
      first_name: data.firstName.trim(),
      last_name: data.lastName.trim(),
      email: data.email,
      phone: data.phone,
      password: data.password,
      account_type: 'mcc',
      role: 'manager',
    });
  },

  verify: async (token: string): Promise<AuthResponse | ErrorResponse> => {
    return apiClient.post('/auth/verify', { token });
  },

  forgotPassword: async (payload: { phone?: string; email?: string }): Promise<ForgotPasswordResponse> => {
    return apiClient.post('/auth/forgot-password', payload);
  },

  resetPassword: async (payload: {
    user_id: string;
    reset_code: string;
    new_password: string;
  }): Promise<{ code: number; status: string; message: string }> => {
    return apiClient.post('/auth/reset-password', payload);
  },
};
