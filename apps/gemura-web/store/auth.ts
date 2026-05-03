import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User, LoginCredentials, RegisterData, UserAccount } from '@/types';
import { authApi } from '@/lib/api/auth';

/** Nest may put a string or a nested object in `message`. */
function apiErrorMessage(error: unknown): string {
  const err = error as { response?: { data?: { message?: unknown } }; code?: string; message?: string };
  const raw = err?.response?.data?.message;
  if (typeof raw === 'string' && raw.trim()) return raw;
  if (raw && typeof raw === 'object' && 'message' in raw && typeof (raw as { message: unknown }).message === 'string') {
    return String((raw as { message: string }).message);
  }
  if (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error') {
    return 'Cannot reach the API. Start the Gemura backend (default port 3004) and confirm NEXT_PUBLIC_API_URL in .env.local.';
  }
  if (err?.code === 'ECONNREFUSED') {
    return 'Cannot reach the API (connection refused). Is the backend running on the configured port?';
  }
  if (typeof err?.message === 'string' && err.message.trim()) return err.message;
  return 'Login failed. Please try again.';
}

interface AuthStore {
  user: User | null;
  token: string | null;
  accounts: UserAccount[];
  currentAccount: UserAccount | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
  login: (credentials: LoginCredentials) => Promise<{ user: User; token: string; accounts: UserAccount[] } | { error: string }>;
  register: (data: RegisterData) => Promise<{ user: User; token: string; accounts: UserAccount[] } | { error: string }>;
  logout: () => void;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setCurrentAccount: (account: UserAccount | null) => void;
  setAccounts: (accounts: UserAccount[]) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      accounts: [],
      currentAccount: null,
      isAuthenticated: false,
      _hasHydrated: false,
      setHasHydrated: (state: boolean) => {
        set({
          _hasHydrated: state,
        });
      },
      
      login: async (credentials: LoginCredentials) => {
        try {
          // authApi.login expects LoginCredentials (email, password) and converts to identifier internally
          const result = await authApi.login(credentials);
          
          if ('code' in result && result.code !== 200) {
            const m = result.message;
            const msg =
              typeof m === 'string'
                ? m
                : m && typeof m === 'object' && 'message' in m && typeof (m as { message: string }).message === 'string'
                  ? (m as { message: string }).message
                  : 'Login failed';
            return { error: msg };
          }

          if ('data' in result) {
            const data = result.data;
            // Login response has user with token inside, and accounts array
            if ('accounts' in data) {
              const { user, accounts = [] } = data;
              // Token is inside user object, not at top level
              const token = user.token;
              
              if (!token) {
                return { error: 'No token received from server' };
              }
              
              // Store token in localStorage for API client
              if (typeof window !== 'undefined') {
                localStorage.setItem('gemura-auth-token', token);
              }

              // Map backend user to frontend User type
              const nameParts = user.name.split(' ');
              const frontendUser: User = {
                id: user.id,
                email: user.email || '',
                firstName: nameParts[0] || user.name,
                lastName: nameParts.slice(1).join(' ') || '',
                role: user.account_type as any, // This will be updated from accounts
                phone: user.phone || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };

              // Find default account or use first account
              const defaultAccount = accounts.find((acc: UserAccount) => acc.is_default) || accounts[0] || null;

              set({
                user: frontendUser,
                token,
                accounts,
                currentAccount: defaultAccount,
                isAuthenticated: true,
              });

              return { user: frontendUser, token, accounts };
            }
          }

          return { error: 'Login failed' };
        } catch (error: unknown) {
          return { error: apiErrorMessage(error) };
        }
      },

      register: async (data: RegisterData) => {
        try {
          const result = await authApi.register(data);
          
          if ('code' in result && result.code !== 200 && result.code !== 201) {
            return { error: result.message || 'Registration failed' };
          }

          if ('data' in result) {
            const data = result.data;
            // Register response structure is different - user has token but no accounts
            if ('user' in data && !('accounts' in data)) {
              const { user } = data;
              // Token is inside user object
              const token = user.token;
              
              if (!token) {
                return { error: 'No token received from server' };
              }
              
              // Store token in localStorage for API client
              if (typeof window !== 'undefined') {
                localStorage.setItem('gemura-auth-token', token);
              }

              // Map backend user to frontend User type
              const nameParts = user.name.split(' ');
              const frontendUser: User = {
                id: '', // Register response doesn't include id, will be set after login
                email: user.email || '',
                firstName: nameParts[0] || user.name,
                lastName: nameParts.slice(1).join(' ') || '',
                role: user.account_type as any,
                phone: user.phone || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };

              // Register response doesn't include accounts, set empty
              const accounts: UserAccount[] = [];

              set({
                user: frontendUser,
                token,
                accounts,
                currentAccount: null,
                isAuthenticated: true,
              });

              return { user: frontendUser, token, accounts };
            }
          }

          return { error: 'Registration failed' };
        } catch (error: any) {
          return { error: error?.response?.data?.message || 'Registration failed. Please try again.' };
        }
      },

      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('gemura-auth-token');
        }
        set({
          user: null,
          token: null,
          accounts: [],
          currentAccount: null,
          isAuthenticated: false,
        });
      },

      setUser: (user: User | null) => {
        set({ user, isAuthenticated: !!user });
      },

      setToken: (token: string | null) => {
        set({ token });
        if (typeof window !== 'undefined') {
          if (token) {
            localStorage.setItem('gemura-auth-token', token);
          } else {
            localStorage.removeItem('gemura-auth-token');
          }
        }
      },

      setCurrentAccount: (account: UserAccount | null) => {
        set({ currentAccount: account });
      },

      setAccounts: (accounts: UserAccount[]) => {
        set({ accounts });
        // Update current account if it's in the new list
        const current = accounts.find((acc) => acc.is_default) || accounts[0] || null;
        set({ currentAccount: current });
      },
    }),
    {
      name: 'gemura-auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        accounts: state.accounts,
        currentAccount: state.currentAccount,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        // Sync token to localStorage if it exists
        if (state?.token && typeof window !== 'undefined') {
          localStorage.setItem('gemura-auth-token', state.token);
        }
      },
    }
  )
);

// Hook to check if store has hydrated
export const useAuthHydrated = () => {
  return useAuthStore((state) => state._hasHydrated);
};
