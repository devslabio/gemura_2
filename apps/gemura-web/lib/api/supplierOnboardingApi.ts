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

export type MyOnboardingApiResponse = {
  code: number;
  message?: string;
  data?: {
    onboarding: Record<string, unknown> | null;
    updated_at?: string | null;
  };
};

export const supplierOnboardingApi = {
  register: (body: RegisterFromOnboardingBody) =>
    apiClient.post<RegisterFromOnboardingResponse>('/suppliers/onboarding/register', body),

  /** Current user’s stored onboarding (draft + agent fields) for profile / completion % */
  getMy: () => apiClient.get<MyOnboardingApiResponse>('/suppliers/my-onboarding'),

  /** Farmer/supplier: create supplier_milk_onboardings row when missing (idempotent). */
  initMyOnboarding: () =>
    apiClient.post<MyOnboardingApiResponse>('/suppliers/my-onboarding/init'),

  /** Merge `draft` into payload, or replace entire payload with `onboarding`. */
  putMy: (payload: { draft?: Record<string, unknown>; onboarding?: Record<string, unknown> }) =>
    apiClient.put<MyOnboardingApiResponse>('/suppliers/my-onboarding', payload),
};
