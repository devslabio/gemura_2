export type UserRole = 'admin' | 'merchant' | 'supplier' | 'customer';

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

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string; // Required by backend
}

export interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

/** Segment for supplier accounts: mirrors onboarding collector_kind + direct farm supply. */
export type SupplierSegment = 'direct_farmer' | 'farmer_collector' | 'pure_collector';

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
  /** When account_type is supplier, set from backend after onboarding. */
  supplier_segment?: SupplierSegment;
}

export interface Sale {
  id: string;
  accountId: string;
  customerAccountId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: string;
  saleAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Collection {
  id: string;
  accountId: string;
  supplierAccountId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: string;
  collectedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  phone?: string;
  email?: string;
  accountId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  phone?: string;
  email?: string;
  accountId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Inventory {
  id: string;
  accountId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  category?: string;
  createdAt: string;
  updatedAt: string;
}
