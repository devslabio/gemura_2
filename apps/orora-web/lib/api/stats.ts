import { apiClient } from './client';

export interface OverviewSummary {
  collection: { liters: number; value: number; transactions: number };
  sales: { liters: number; value: number; transactions: number };
  suppliers: { active: number; inactive: number };
  customers: { active: number; inactive: number };
}

export interface OverviewBreakdownItem {
  label: string;
  date: string;
  collection: { liters: number; value: number };
  sales: { liters: number; value: number };
}

export interface OverviewRecentTransaction {
  id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  status: string;
  transaction_at: string;
  type: 'sale' | 'collection';
  supplier_account: { code: string; name: string; type: string; status: string } | null;
  customer_account: { code: string; name: string; type: string; status: string } | null;
  notes: string | null;
  created_at: string;
}

export interface OverviewResponse {
  code: number;
  status: string;
  message: string;
  data: {
    summary: OverviewSummary;
    breakdown_type: string;
    chart_period: string;
    breakdown: OverviewBreakdownItem[];
    recent_transactions: OverviewRecentTransaction[];
    date_range: { from: string; to: string };
  };
}

export interface GetOverviewParams {
  account_id?: string;
  date_from?: string; // YYYY-MM-DD
  date_to?: string; // YYYY-MM-DD
  /** Same as `-Date.getTimezoneOffset()` — local calendar day from midnight in the browser */
  tz_offset_minutes?: number;
}

export const statsApi = {
  getOverview(accountId?: string, params?: { date_from?: string; date_to?: string }): Promise<OverviewResponse> {
    const body: GetOverviewParams = {};
    if (accountId) body.account_id = accountId;
    if (params?.date_from) body.date_from = params.date_from;
    if (params?.date_to) body.date_to = params.date_to;
    if (params?.date_from && params?.date_to) {
      body.tz_offset_minutes = -new Date().getTimezoneOffset();
    }
    return apiClient.post<OverviewResponse>('/stats/overview', Object.keys(body).length ? body : {});
  },
};
