import { apiClient } from './client';

export interface MilkProductionRecord {
  id: string;
  account_id: string;
  farm_id: string | null;
  animal_id: string | null;
  production_date: string;
  quantity_litres: number | string;
  session: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  animal?: { id: string; tag_number: string; name: string | null } | null;
  farm?: { id: string; name: string; code: string | null } | null;
}

export interface CreateMilkProductionData {
  farm_id?: string;
  animal_id?: string;
  production_date: string;
  quantity_litres: number;
  session?: string;
  notes?: string;
}

export const MILK_PRODUCTION_SESSIONS = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'other', label: 'Other' },
] as const;

export interface MilkProductionFilters {
  animal_id?: string;
  farm_id?: string;
  session?: string;
  from?: string;
  to?: string;
}

export interface ProductionReport {
  total_production_litres: number;
  total_sold_litres: number;
}

export interface MilkCostPerLitreReport {
  from: string | null;
  to: string | null;
  farm_id: string | null;
  total_expense: number;
  total_production_litres: number;
  total_cows: number;
  producing_cows: number;
  non_producing_cows: number;
  producing_cost_estimate: number;
  non_producing_cost_estimate: number;
  cost_per_litre_producing_cows: number;
  expense_by_category: Array<{ category_name: string; amount: number }>;
  notes: string[];
}

export interface ApiResponse<T> {
  code: number;
  status: string;
  message: string;
  data: T;
}

const accountParam = (accountId?: string) => (accountId ? { account_id: accountId } : {});

export const milkProductionApi = {
  create: (data: CreateMilkProductionData, accountId?: string) =>
    apiClient.post<ApiResponse<MilkProductionRecord>>('/milk-production', data, {
      params: accountParam(accountId),
    }),

  list: (accountId?: string, filters?: MilkProductionFilters) =>
    apiClient.get<ApiResponse<MilkProductionRecord[]>>('/milk-production', {
      params: { ...accountParam(accountId), ...filters },
    }),

  getById: (id: string, accountId?: string) =>
    apiClient.get<ApiResponse<MilkProductionRecord>>(`/milk-production/${id}`, {
      params: accountParam(accountId),
    }),

  report: (accountId?: string, from?: string, to?: string) =>
    apiClient.get<ApiResponse<ProductionReport>>('/milk-production/report', {
      params: { ...accountParam(accountId), from, to },
    }),

  costPerLitre: (accountId?: string, from?: string, to?: string, farmId?: string) =>
    apiClient.get<ApiResponse<MilkCostPerLitreReport>>('/milk-production/cost-per-litre', {
      params: { ...accountParam(accountId), from, to, farm_id: farmId },
    }),

  update: (id: string, data: Partial<CreateMilkProductionData>, accountId?: string) =>
    apiClient.patch<ApiResponse<MilkProductionRecord>>(`/milk-production/${id}`, data, {
      params: accountParam(accountId),
    }),

  delete: (id: string, accountId?: string) =>
    apiClient.delete<ApiResponse<{ id: string; message: string }>>(`/milk-production/${id}`, {
      params: accountParam(accountId),
    }),
};
