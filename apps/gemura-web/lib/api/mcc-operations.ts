import { apiClient } from './client';

export interface MccGateDeliveryRow {
  id: string;
  source_type: string;
  gate_volume_litres: string;
  arrived_at: string;
  notes: string | null;
  source_account: { id: string; name: string; code: string | null };
  recorded_by: { id: string; name: string };
  manifest: { id: string; manifest_ref: string; status: string } | null;
  /** Milk collection sale id when this gate row is already linked. */
  linked_collection_id: string | null;
}

export interface MccManifestLineRow {
  id: string;
  declared_litres: string;
  container_id: string | null;
  farmer_supplier: { id: string; name: string; code: string | null };
  linked_collection_id: string | null;
}

export interface MccManifestRow {
  id: string;
  manifest_ref: string;
  status: string;
  submitted_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  gate_delivery: {
    id: string;
    arrived_at: string;
    gate_volume_litres: unknown;
    source_type: string;
  };
  umucunda_supplier: { id: string; name: string; code: string | null };
  lines: MccManifestLineRow[];
}

export interface MccTestResultRow {
  id: string;
  mcc_gate_delivery_id: string;
  manifest_line_id: string | null;
  outcome: string;
  rejection_cause: string | null;
  source_resolution_status: string | null;
  /** Structured quality readings from API (`temperature_c`, `fat_percent`, etc.). */
  detail?: Record<string, unknown> | null;
  tested_at: string;
  gate_delivery: {
    id: string;
    source_account: { id: string; name: string; code: string | null };
  };
  manifest_line: MccManifestLineRow | null;
  tester: { id: string; name: string } | null;
}

export interface MccShiftRow {
  id: string;
  user_id: string;
  user: { id: string; name: string; phone: string | null };
  started_at: string;
  ended_at: string | null;
  role_label_snapshot: string | null;
  notes: string | null;
  open: boolean;
}

export interface MccStaffOption {
  user_account_id: string;
  user_id: string;
  name: string;
  phone: string | null;
  role: string;
  status: string;
}

function params(accountId: string, extra?: Record<string, string | undefined>) {
  const p: Record<string, string> = { account_id: accountId };
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v) p[k] = v;
    }
  }
  return { params: p };
}

export const mccOperationsApi = {
  listGateDeliveries(accountId: string, from?: string, to?: string) {
    return apiClient.get<{ code: number; data: MccGateDeliveryRow[] }>(
      '/mcc/operations/gate-deliveries',
      params(accountId, { from, to }),
    );
  },

  createGateDelivery(body: {
    account_id?: string;
    source_type: 'direct' | 'umucunda_a' | 'umucunda_b';
    source_account_id: string;
    gate_volume_litres: number;
    arrived_at?: string;
    notes?: string;
  }) {
    return apiClient.post<{ code: number; data: unknown }>('/mcc/operations/gate-deliveries', body);
  },

  listManifests(accountId: string, from?: string, to?: string) {
    return apiClient.get<{ code: number; data: MccManifestRow[] }>(
      '/mcc/operations/manifests',
      params(accountId, { from, to }),
    );
  },

  createManifest(body: {
    account_id?: string;
    gate_delivery_id: string;
    umucunda_supplier_account_id: string;
    lines: { farmer_supplier_account_id: string; declared_litres: number; container_id?: string }[];
  }) {
    return apiClient.post<{ code: number; data: unknown }>('/mcc/operations/manifests', body);
  },

  submitManifest(manifestId: string, accountId?: string) {
    return apiClient.patch<{ code: number; data: unknown }>(
      `/mcc/operations/manifests/${manifestId}/submit`,
      {},
      accountId ? { params: { account_id: accountId } } : undefined,
    );
  },

  acceptManifest(manifestId: string, accountId?: string) {
    return apiClient.patch<{ code: number; data: unknown }>(
      `/mcc/operations/manifests/${manifestId}/accept`,
      {},
      accountId ? { params: { account_id: accountId } } : undefined,
    );
  },

  rejectManifest(manifestId: string, rejection_reason: string, account_id?: string) {
    return apiClient.patch<{ code: number; data: unknown }>(
      `/mcc/operations/manifests/${manifestId}/reject`,
      { rejection_reason, account_id },
    );
  },

  updateManifestDraft(
    manifestId: string,
    body: {
      account_id?: string;
      lines: { farmer_supplier_account_id: string; declared_litres: number; container_id?: string }[];
    },
  ) {
    return apiClient.patch<{ code: number; data: unknown }>(
      `/mcc/operations/manifests/${manifestId}/draft`,
      body,
    );
  },

  listTestResults(accountId: string, outcome?: string, from?: string, to?: string) {
    return apiClient.get<{ code: number; data: MccTestResultRow[] }>(
      '/mcc/operations/test-results',
      params(accountId, { outcome, from, to }),
    );
  },

  createTestResult(body: {
    account_id?: string;
    mcc_gate_delivery_id: string;
    manifest_line_id?: string;
    outcome: 'pending' | 'accepted' | 'rejected';
    rejection_cause?: string;
    detail?: Record<string, unknown>;
  }) {
    return apiClient.post<{ code: number; data: { id: string } }>('/mcc/operations/test-results', body);
  },

  updateTestResult(
    testResultId: string,
    body: {
      account_id?: string;
      outcome: 'pending' | 'accepted' | 'rejected';
      rejection_cause?: string;
      detail?: Record<string, unknown>;
    },
  ) {
    return apiClient.patch<{ code: number }>(`/mcc/operations/test-results/${testResultId}`, body);
  },

  listShifts(accountId: string, from?: string, to?: string) {
    return apiClient.get<{ code: number; data: MccShiftRow[] }>(
      '/mcc/operations/shifts',
      params(accountId, { from, to }),
    );
  },

  staffOptions(accountId: string) {
    return apiClient.get<{ code: number; data: MccStaffOption[] }>(
      '/mcc/operations/staff-options',
      params(accountId),
    );
  },

  startShift(body: {
    account_id?: string;
    user_id?: string;
    role_label_snapshot?: string;
    notes?: string;
  }) {
    return apiClient.post<{ code: number; data: MccShiftRow }>('/mcc/operations/shifts/start', body);
  },

  endShift(shiftId: string, accountId?: string) {
    return apiClient.patch<{ code: number }>(
      `/mcc/operations/shifts/${shiftId}/end`,
      {},
      accountId ? { params: { account_id: accountId } } : undefined,
    );
  },
};
