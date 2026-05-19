export type SupervisorHealthStatus = 'good' | 'fair' | 'at_risk';

export type SupervisorDashboardPortfolioRow = {
  id: string;
  code: string | null;
  name: string;
  type: string;
  status: string;
  operational_location_id: string | null;
  operational_district_id: string | null;
  operational_location_label: string | null;
  operational_district_label: string | null;
  regional_supervisor_user_id: string | null;
  regional_supervisor: { id: string; name: string; email: string | null; phone: string } | null;
  stats: {
    members: number;
    suppliers: number;
    customers: number;
    sales: number;
    collections: number;
    farms: number;
  };
  health_status: SupervisorHealthStatus;
  gate_litres_14d: number;
  sparkline_14d: number[];
  manifest_acceptance_pct: number | null;
  quality_test_rejection_pct: number | null;
  tank_used_pct: number | null;
};

export type SupervisorDashboardData = {
  scope: {
    provinces: Array<{ id: string; code: string; name: string }>;
    districts: Array<{ id: string; code: string; name: string; province_id: string }>;
  };
  summary: {
    mcc_count: number;
    members: number;
    suppliers: number;
    customers: number;
    farms: number;
    sales: number;
    collections: number;
    manifest_acceptance_pct: number | null;
    quality_test_rejection_pct: number | null;
    avg_tank_utilization_pct: number | null;
    open_staff_shifts: number;
  };
  trend: {
    date_labels: string[];
    series: Array<{ account_id: string; name: string; data: number[] }>;
  };
  map_pins: Array<{
    account_id: string;
    label: string;
    district_id: string | null;
    district_name: string | null;
    status: SupervisorHealthStatus;
    top_pct: number;
    left_pct: number;
  }>;
  interventions: Array<{
    id: string;
    account_id: string;
    mcc_name: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
    owner: string | null;
    due_label: string | null;
    href: string;
  }>;
  scoreboard: Array<{
    account_id: string;
    mcc_name: string;
    tank_pct: number | null;
    power: string | null;
    generator: string | null;
    test_pct: number | null;
    staff_pct: number | null;
    buyer_status: 'ok' | 'watch' | 'hold';
    escalation_count: number;
  }>;
  activities: Array<{
    id: string;
    kind: 'shift' | 'delivery' | 'manifest' | 'test';
    mcc_name: string;
    title: string;
    when_label: string;
    owner: string | null;
    detail: string | null;
    tone: 'info' | 'warn' | 'ok';
    href: string | null;
  }>;
  escalations: Array<{
    id: string;
    account_id: string;
    mcc_name: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
    raised_label: string;
    status: 'open' | 'in_progress' | 'resolved';
    href: string;
  }>;
  portfolio: SupervisorDashboardPortfolioRow[];
};
