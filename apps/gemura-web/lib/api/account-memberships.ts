import { apiClient } from './client';

export interface AccountMembershipRow {
  id: string;
  account_id: string;
  user_id: string;
  status: string;
  member_since: string | null;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    code: string | null;
    name: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string | null;
    status: string;
  };
}

export interface AccountMembershipsListResponse {
  code: number;
  status: string;
  message: string;
  data: AccountMembershipRow[];
}

export const accountMembershipsApi = {
  listForAccount: async (
    accountId: string,
    status?: 'pending' | 'active' | 'inactive',
  ): Promise<AccountMembershipsListResponse> => {
    return apiClient.get('/account-memberships', {
      params: {
        account_id: accountId,
        ...(status ? { status } : {}),
      },
    });
  },

  create: async (payload: {
    account_id: string;
    user_id: string;
    status?: 'pending' | 'active' | 'inactive';
    member_since?: string;
  }): Promise<{ code: number; status: string; message: string; data?: AccountMembershipRow }> => {
    return apiClient.post('/account-memberships', payload);
  },

  update: async (
    id: string,
    payload: { status?: 'pending' | 'active' | 'inactive'; member_since?: string | null },
  ): Promise<{ code: number; status: string; message: string; data?: AccountMembershipRow }> => {
    return apiClient.patch(`/account-memberships/${id}`, payload);
  },
};
