import { apiClient } from './client';

export interface StatsOverviewBreakdownDay {
  date: string;
  label: string;
  sales: { liters: number; value: number };
  collection: { liters: number; value: number };
}

export interface StatsOverviewData {
  summary: {
    collection: { liters: number; value: number; transactions: number };
    sales: { liters: number; value: number; transactions: number };
    suppliers: { active: number; inactive: number };
    customers: { active: number; inactive: number };
  };
  breakdown_type?: string;
  chart_period?: string;
  breakdown: StatsOverviewBreakdownDay[];
  recent_transactions?: unknown[];
  date_range: { from: string; to: string };
}

export interface StatsOverviewResponse {
  code: number;
  status: string;
  message: string;
  data: StatsOverviewData;
}

export const statsApi = {
  postOverview: async (body?: {
    account_id?: string;
    date_from?: string;
    date_to?: string;
    tz_offset_minutes?: number;
  }): Promise<StatsOverviewResponse> => {
    return apiClient.post('/stats/overview', body ?? {});
  },
};
