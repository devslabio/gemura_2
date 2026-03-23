export type UserRole = "admin" | "merchant" | "supplier" | "customer" | string;

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginCredentials {
  email: string; // backend expects identifier in this field (email or phone)
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export interface UserAccount {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  account_status: string;
  role: string;
  permissions: Record<string, boolean> | string[] | null;
  user_account_status: string;
  access_granted_at: string;
  is_default: boolean;
}

