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

export interface MccManagerOverviewData {
  date: string;
  gate: MccManagerGateSummary;
  manifests: MccManagerManifestRow[];
  rejections: MccManagerRejectionRow[];
  staff: MccManagerStaffRow[];
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
