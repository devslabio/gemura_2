import { apiClient } from './client';
import type { SupplierSegment } from '@/types';

/**
 * Request body for POST /suppliers/onboarding/register
 * (backend should create user + supplier/farmer account, store full onboarding JSON, return credentials hint).
 */
export interface RegisterFromOnboardingBody {
  mcc_account_id: string;
  name: string;
  phone: string;
  email?: string;
  password: string;
  /** Account type in Gemura: farmer = direct farmer; supplier = milk collector profiles */
  account_type: 'farmer' | 'supplier';
  /** When account_type is supplier and collector on onboarding */
  supplier_segment?: SupplierSegment;
  /** Full output from buildOnboardingPayload (farmer or collector) */
  onboarding: Record<string, unknown>;
  /** MCC commercial link — same semantics as suppliers create */
  price_per_liter: number;
  nid: string;
  address?: string;
  bank_name?: string;
  bank_account_number?: string;
}

export interface RegisterFromOnboardingResponse {
  code: number;
  status?: string;
  message?: string;
  data?: {
    user_id?: string;
    account_id?: string;
    message?: string;
  };
}

export const supplierOnboardingApi = {
  register: (body: RegisterFromOnboardingBody) =>
    apiClient.post<RegisterFromOnboardingResponse>('/suppliers/onboarding/register', body),

  /** Current user’s stored onboarding (draft + agent fields) for profile / completion % */
  getMy: async (): Promise<{
    code: number;
    message?: string;
    data?: { onboarding: Record<string, unknown>; updated_at?: string } | null;
  }> => {
    return apiClient.get('/suppliers/my-onboarding');
  },

  /** Optional: supplier updates their own draft */
  putMy: async (payload: { draft: Record<string, unknown> }) =>
    apiClient.put<{ code: number; message?: string }>('/suppliers/my-onboarding', payload),
};
