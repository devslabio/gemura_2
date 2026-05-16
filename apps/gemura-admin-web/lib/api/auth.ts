import { apiClient } from "./client";
import { LoginCredentials, RegisterData, User, UserAccount } from "@/types";

export interface LoginResponseData {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    account_type: string;
    status: string;
    token: string;
  };
  accounts?: UserAccount[];
}

export interface RegisterResponseData {
  user: {
    code?: string;
    name: string;
    email: string;
    phone: string;
    account_type: string;
    status: string;
    token: string;
  };
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

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse | ErrorResponse> => {
    if (!credentials.email || !credentials.email.trim()) {
      return { code: 400, status: "error", message: "Identifier is required" };
    }
    if (!credentials.password || !credentials.password.trim()) {
      return { code: 400, status: "error", message: "Password is required" };
    }

    return apiClient.post("/auth/login", {
      identifier: credentials.email.trim(),
      password: credentials.password,
    });
  },

  register: async (data: RegisterData): Promise<AuthResponse | ErrorResponse> => {
    return apiClient.post("/auth/register", {
      first_name: data.firstName.trim(),
      last_name: data.lastName.trim(),
      email: data.email,
      phone: data.phone,
      password: data.password,
      account_type: "mcc",
      role: "manager",
    });
  },
};

