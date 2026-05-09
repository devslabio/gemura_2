import { apiClient } from './client';

export interface MccManagerGateSummary {
  direct_litres: number;
  umucunda_litres: number;
  total_litres: number;
  delivery_count: number;
}

export interface MccManagerManifestRow {
  id: string;
  manifest_ref: string;
  gate_delivery_id: string;
  route_label: string;
  expected_litres: number;
  status: string;
  submitted: boolean;
  submitted_at: string | null;
  payment_hold: boolean;
  umucunda_name: string | null;
}

export interface MccManagerRejectionRow {
  test_result_id: string;
  gate_delivery_id: string;
  source_label: string;
  source_type: string;
  volume_litres: number;
  rejection_cause: string;
  farms_summary: string;
  resolution_status: string;
  tested_at: string;
}

export interface MccManagerStaffRow {
  user_account_id: string;
  user_id: string;
  name: string;
  role: string;
  on_duty: boolean;
  shift_started_at: string | null;
  tasks_done: number;
}

export interface MccManagerWalletSummary {
  id: string;
  code: string | null;
  balance: number;
  currency: string;
  is_default: boolean;
}

export interface MccManagerOperationalProfile {
  expected_daily_deliveries: number | null;
  cooling_tank_total_capacity_litres: number | null;
  power_supply_sources: string[];
}

export interface MccManagerFacilitySnapshot {
  tank_used_litres: number | null;
  tank_used_pct: number | null;
  cooling_temperature_c: number | null;
  power_status: string | null;
  generator_status: string | null;
  generator_fuel_pct: number | null;
  observed_at: string | null;
}

export interface MccManagerAlert {
  id: string;
  priority: number;
  title: string;
  detail: string;
  tone: 'critical' | 'warn' | 'info';
}

export interface MccManagerOverviewData {
  date: string;
  gate: MccManagerGateSummary;
  manifests: MccManagerManifestRow[];
  rejections: MccManagerRejectionRow[];
  staff: MccManagerStaffRow[];
  wallet: MccManagerWalletSummary | null;
  profile: MccManagerOperationalProfile | null;
  facility_snapshot: MccManagerFacilitySnapshot | null;
  alerts: MccManagerAlert[];
}

export interface MccManagerOverviewResponse {
  code: number;
  status: string;
  message: string;
  data: MccManagerOverviewData;
}

export const mccManagerApi = {
  getOverview(accountId: string, date?: string) {
    const params: Record<string, string> = { account_id: accountId };
    if (date) params.date = date;
    return apiClient.get<MccManagerOverviewResponse>('/mcc/manager/overview', { params });
  },

  updateTestResolution(
    testResultId: string,
    body: { source_resolution_status: 'resolved' | 'secondary_test' | 'frozen'; account_id?: string },
  ) {
    return apiClient.patch<{ code: number; status: string; message: string }>(
      `/mcc/manager/test-results/${testResultId}/resolution`,
      body,
    );
  },
};
