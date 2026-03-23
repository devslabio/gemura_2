import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { LoginCredentials, RegisterData, User, UserAccount } from "@/types";
import { authApi } from "@/lib/api/auth";

interface AuthStore {
  user: User | null;
  token: string | null;
  accounts: UserAccount[];
  currentAccount: UserAccount | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
  login: (
    credentials: LoginCredentials,
  ) => Promise<{ user: User; token: string; accounts: UserAccount[] } | { error: string }>;
  register: (
    data: RegisterData,
  ) => Promise<{ user: User; token: string; accounts: UserAccount[] } | { error: string }>;
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
        set({ _hasHydrated: state });
      },

      login: async (credentials: LoginCredentials) => {
        try {
          const result = await authApi.login(credentials);

          if ("code" in result && result.code !== 200) {
            return { error: result.message || "Login failed" };
          }

          if ("data" in result) {
            const data = result.data;
            if ("accounts" in data) {
              const { user, accounts = [] } = data;
              const token = user.token;
              if (!token) return { error: "No token received from server" };

              if (typeof window !== "undefined") localStorage.setItem("gemura-auth-token", token);

              const nameParts = user.name.split(" ");
              const frontendUser: User = {
                id: user.id,
                email: user.email || "",
                firstName: nameParts[0] || user.name,
                lastName: nameParts.slice(1).join(" ") || "",
                role: user.account_type as any,
                phone: user.phone || "",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };

              const defaultAccount = (accounts as UserAccount[]).find((acc) => acc.is_default) || (accounts as UserAccount[])[0] || null;

              set({
                user: frontendUser,
                token,
                accounts: accounts as UserAccount[],
                currentAccount: defaultAccount,
                isAuthenticated: true,
              });

              return { user: frontendUser, token, accounts: accounts as UserAccount[] };
            }
          }

          return { error: "Login failed" };
        } catch (error: any) {
          return { error: error?.response?.data?.message || "Login failed. Please try again." };
        }
      },

      register: async (data: RegisterData) => {
        try {
          const result = await authApi.register(data);
          if ("code" in result && result.code !== 200 && result.code !== 201) {
            return { error: result.message || "Registration failed" };
          }

          if ("data" in result) {
            const dataResp = result.data;
            if ("user" in dataResp && !("accounts" in (dataResp as any))) {
              const { user } = dataResp as any;
              const token = user.token;
              if (!token) return { error: "No token received from server" };

              if (typeof window !== "undefined") localStorage.setItem("gemura-auth-token", token);

              const nameParts = user.name.split(" ");
              const frontendUser: User = {
                id: "",
                email: user.email || "",
                firstName: nameParts[0] || user.name,
                lastName: nameParts.slice(1).join(" ") || "",
                role: user.account_type as any,
                phone: user.phone || "",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };

              set({
                user: frontendUser,
                token,
                accounts: [],
                currentAccount: null,
                isAuthenticated: true,
              });

              return { user: frontendUser, token, accounts: [] };
            }
          }

          return { error: "Registration failed" };
        } catch (error: any) {
          return { error: error?.response?.data?.message || "Registration failed. Please try again." };
        }
      },

      logout: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("gemura-auth-token");
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
        if (typeof window !== "undefined") {
          if (token) localStorage.setItem("gemura-auth-token", token);
          else localStorage.removeItem("gemura-auth-token");
        }
      },

      setCurrentAccount: (account: UserAccount | null) => {
        set({ currentAccount: account });
      },

      setAccounts: (accounts: UserAccount[]) => {
        set({ accounts });
        const current = accounts.find((acc) => acc.is_default) || accounts[0] || null;
        set({ currentAccount: current });
      },
    }),
    {
      name: "gemura-auth-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        accounts: state.accounts,
        currentAccount: state.currentAccount,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        (state as any)?.setHasHydrated?.(true);
        if ((state as any)?.token && typeof window !== "undefined") {
          localStorage.setItem("gemura-auth-token", (state as any).token);
        }
      },
    },
  ),
);

export const useAuthHydrated = () => {
  return useAuthStore((state) => state._hasHydrated);
};

