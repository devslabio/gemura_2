import { apiClient } from './client';

export interface EmployeeItem {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  role: string;
  permissions: string[] | Record<string, boolean> | null;
  status: string;
  created_at: string;
}

export interface EmployeesResponse {
  code: number;
  status: string;
  message?: string;
  data: EmployeeItem[];
}

export interface InviteEmployeeData {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  password?: string;
  role: string;
  permissions?: string[];
  account_id?: string;
}

export interface UpdateEmployeeData {
  role?: string;
  permissions?: string[];
  status?: 'active' | 'inactive';
}

export interface RoleOption {
  code: string;
  name: string;
  description: string;
  permissions: string[];
  permissionCount: number;
}

export interface RolesResponse {
  code: number;
  status: string;
  message?: string;
  data: { roles: RoleOption[] };
}

export interface PermissionOption {
  code: string;
  name: string;
  description: string;
  category?: string;
}

export interface PermissionsResponse {
  code: number;
  status: string;
  message?: string;
  data: { permissions: PermissionOption[] };
}

const accountParam = (accountId?: string | null) =>
  accountId ? { account_id: accountId } : {};

export const employeesApi = {
  getEmployees: (accountId?: string | null, status?: 'active' | 'inactive') =>
    apiClient.get<EmployeesResponse>('/employees', {
      params: { ...accountParam(accountId), ...(status && { status }) },
    }),

  inviteEmployee: (data: InviteEmployeeData) =>
    apiClient.post<{ code: number; status: string; message?: string; data: EmployeeItem }>(
      '/employees/invite',
      data
    ),

  updateEmployee: (id: string, data: UpdateEmployeeData, accountId?: string | null) =>
    apiClient.put<{ code: number; status: string; message?: string; data: EmployeeItem }>(
      `/employees/${id}/access`,
      data,
      { params: accountParam(accountId) }
    ),

  deleteEmployee: (id: string, accountId?: string | null) =>
    apiClient.delete<{ code: number; status: string; message?: string }>(
      `/employees/${id}`,
      { params: accountParam(accountId) }
    ),

  getRoles: (accountId?: string | null) =>
    apiClient.get<RolesResponse>('/employees/roles', {
      params: accountParam(accountId),
    }),

  getPermissions: (accountId?: string | null) =>
    apiClient.get<PermissionsResponse>('/employees/permissions', {
      params: accountParam(accountId),
    }),
};
