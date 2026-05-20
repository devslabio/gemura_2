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
  hours_elapsed?: number;
  follow_up_status?: string;
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

export interface MccManagerCoolingTank {
  tank_number: string | null;
  capacity_litres: number | null;
  year_or_age: string | null;
  condition: string | null;
}

export interface MccManagerOperationalProfile {
  expected_daily_deliveries: number | null;
  cooling_tank_total_capacity_litres: number | null;
  daily_milk_volume_litres: number | null;
  max_milk_one_day_litres: number | null;
  tank_capacity_sufficiency: string | null;
  power_supply_sources: string[];
  generator_capacity_kva: number | null;
  mobile_connectivity: string | null;
  total_farmers_supplying: number | null;
  new_farmers_last_3_months: number | null;
  milk_transporters_count: number | null;
  average_distance_km: number | null;
  evening_milk_pattern: string | null;
  own_milk_transport_type: string | null;
  record_system: string | null;
  avg_days_delivery_to_payment: number | null;
  main_buyer_name: string | null;
  source_submission_code: string | null;
  captured_at: string | null;
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

export interface MccManagerAccountContext {
  name: string;
  code: string | null;
  district_label: string | null;
}

export interface MccManagerTrendDay {
  date: string;
  label: string;
  litres: number;
}

export interface MccManagerQualitySummary {
  accepted_count: number;
  rejected_count: number;
  accepted_pct: number | null;
  rejected_pct: number | null;
}

export interface MccManagerRejectionCause {
  cause: string;
  count: number;
}

export interface MccManagerRecentDelivery {
  id: string;
  source_name: string;
  source_type: string;
  source_type_label: string;
  litres: number;
  arrived_at: string;
}

export interface MccManagerRouteRow {
  route_label: string;
  collector_name: string;
  farms_count: number;
  litres: number;
  compliance_pct: number;
}

export interface MccManagerTopFarmer {
  supplier_account_id: string;
  name: string;
  code: string | null;
  litres: number;
  deliveries: number;
  quality_grade: string;
  quality_score_pct: number | null;
}

export interface MccManagerTopCollector {
  name: string;
  code: string | null;
  litres: number;
  farms_served: number;
  compliance_pct: number;
}

export interface MccManagerPaymentsOverview {
  payments_week_amount: number;
  payments_week_count: number;
  payments_yesterday_amount: number;
  payments_yesterday_count: number;
  pending_payments_amount: number;
  pending_payments_count: number;
  holds_quality_count: number;
  holds_other_count: number;
}

export interface OnboardingProfileCompletion {
  filled: number;
  total: number;
  pct: number;
  fields?: { key: string; label: string; filled: boolean; value?: string | number | null }[];
}

export interface MccOperationalProfileResponse {
  account: MccManagerAccountContext & { id: string };
  profile: MccManagerOperationalProfile | null;
  cooling_tanks: MccManagerCoolingTank[];
  completion: OnboardingProfileCompletion;
}

export interface MccManagerOverviewData {
  date: string;
  updated_at: string;
  account_context: MccManagerAccountContext;
  litres_yesterday: number;
  litres_change_pct: number | null;
  trend_7d: MccManagerTrendDay[];
  quality_summary: MccManagerQualitySummary;
  rejection_causes_top: MccManagerRejectionCause[];
  recent_deliveries: MccManagerRecentDelivery[];
  collection_by_route: MccManagerRouteRow[];
  top_farmers_month: MccManagerTopFarmer[];
  top_collectors_month: MccManagerTopCollector[];
  payments_overview: MccManagerPaymentsOverview;
  gate: MccManagerGateSummary;
  manifests: MccManagerManifestRow[];
  rejections: MccManagerRejectionRow[];
  staff: MccManagerStaffRow[];
  wallet: MccManagerWalletSummary | null;
  profile: MccManagerOperationalProfile | null;
  cooling_tanks: MccManagerCoolingTank[];
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

  getOperationalProfile(accountId: string) {
    return apiClient.get<{ code: number; status: string; message: string; data: MccOperationalProfileResponse }>(
      '/mcc/manager/operational-profile',
      { params: { account_id: accountId } },
    );
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
