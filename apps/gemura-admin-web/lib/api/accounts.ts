import { apiClient } from './client';

export interface Account {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  account_status: string;
  account_created_at: string;
  role: string;
  permissions: Record<string, boolean> | string[] | null;
  user_account_status: string;
  access_granted_at: string;
  is_default: boolean;
}

export interface UserAccountsData {
  user: {
    id: string;
    name: string;
    email: string | null;
    phone: string;
    default_account_id: string | null;
  };
  accounts: Account[];
  total_accounts: number;
}

export interface SwitchAccountData {
  account_id: string;
}

export interface AccountsResponse {
  code: number;
  status: string;
  message: string;
  data: UserAccountsData;
}

export interface SwitchAccountResponse {
  code: number;
  status: string;
  message: string;
  data: {
    user: {
      id: string;
      name: string;
      default_account_id: string;
    };
    account: {
      id: string;
      code: string;
      name: string;
      type: string;
    };
    accounts: Account[];
  };
}

export const accountsApi = {
  getUserAccounts: async (): Promise<AccountsResponse> => {
    return apiClient.get('/accounts');
  },

  switchAccount: async (data: SwitchAccountData): Promise<SwitchAccountResponse> => {
    return apiClient.post('/accounts/switch', data);
  },
};

