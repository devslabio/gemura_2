import type { DashboardStats, FinanceDashboardData, UsageDashboardData } from '@/lib/api/admin';

export type OverviewKpi = {
  id: string;
  label: string;
  value: string;
  hint?: string;
  trend?: string;
  trendUp?: boolean;
};

/** Widget rows — mock until dedicated admin aggregates exist */
export const MOCK_MCC_NAMES = [
  'Gahengeri',
  'Mysuru',
  'Mandya',
  'Kodagu',
  'Hunsur',
  'Ramanagara',
  'Chikkamagaluru',
] as const;

export const MOCK_COLLECTIONS_LITERS = [124_800, 98000, 87200, 76100, 68900, 54800, 49200];
export const MOCK_SALES_RF = [18_200_000, 14_500_000, 12_800_000, 11_200_000, 9_800_000, 7_900_000, 7_100_000];

export type MccHealthRow = {
  accountId?: string;
  userId?: string;
  mcc: string;
  litersToday: string;
  manifestPct: number;
  rejectionPct: number;
  tankPct: number;
  alerts: number;
  health: 'Excellent' | 'Good' | 'Moderate' | 'At risk' | 'Critical';
};

export const MOCK_HEALTH_ROWS: MccHealthRow[] = [
  {
    mcc: 'Gahengeri',
    litersToday: '98,400 L',
    manifestPct: 99.2,
    rejectionPct: 0.8,
    tankPct: 72,
    alerts: 0,
    health: 'Excellent',
  },
  {
    mcc: 'Mysuru',
    litersToday: '112,200 L',
    manifestPct: 97.5,
    rejectionPct: 1.1,
    tankPct: 81,
    alerts: 1,
    health: 'Good',
  },
  {
    mcc: 'Mandya',
    litersToday: '76,800 L',
    manifestPct: 94.0,
    rejectionPct: 2.4,
    tankPct: 68,
    alerts: 3,
    health: 'Moderate',
  },
  {
    mcc: 'Kodagu',
    litersToday: '54,100 L',
    manifestPct: 88.2,
    rejectionPct: 4.2,
    tankPct: 91,
    alerts: 6,
    health: 'At risk',
  },
  {
    mcc: 'Hunsur',
    litersToday: '41,200 L',
    manifestPct: 76.5,
    rejectionPct: 6.8,
    tankPct: 55,
    alerts: 11,
    health: 'Critical',
  },
];

export type OnboardingRow = {
  id: string;
  applicant: string;
  region: string;
  appliedOn: string;
  status: string;
  statusTone: 'pending' | 'review' | 'kyc';
};

export const MOCK_ONBOARDING: OnboardingRow[] = [
  {
    id: 'mock-onboarding-1',
    applicant: 'Kaveri Dairy Co-op',
    region: 'Karnataka',
    appliedOn: '12 May 2026',
    status: 'Documents pending',
    statusTone: 'pending',
  },
  {
    id: 'mock-onboarding-2',
    applicant: 'Nandi Hills MCC',
    region: 'Karnataka',
    appliedOn: '11 May 2026',
    status: 'Under review',
    statusTone: 'review',
  },
  {
    id: 'mock-onboarding-3',
    applicant: 'Sharavathi Farmers Union',
    region: 'Karnataka',
    appliedOn: '09 May 2026',
    status: 'KYC pending',
    statusTone: 'kyc',
  },
];

export type AlertItem = {
  id: string;
  severity: 'high' | 'medium' | 'info';
  title: string;
  when: string;
};

export const MOCK_ALERTS: AlertItem[] = [
  {
    id: '1',
    severity: 'high',
    title: 'High rejection rate at Kodagu MCC vs 7-day average',
    when: '32 min ago',
  },
  {
    id: '2',
    severity: 'medium',
    title: 'Tank capacity above 90% at Mysuru evening intake',
    when: '1 hr ago',
  },
  {
    id: '3',
    severity: 'info',
    title: 'Payroll run completed for 42 MCCs — reconciliation pending',
    when: '2 hr ago',
  },
];

export type AdoptionRow = {
  accountId?: string;
  userId?: string;
  mcc: string;
  milk: number;
  finance: number;
  usage: number;
  inventory: number;
  loans: number;
};

export const MOCK_ADOPTION: AdoptionRow[] = [
  { mcc: 'Gahengeri', milk: 96, finance: 88, usage: 72, inventory: 65, loans: 54 },
  { mcc: 'Mysuru', milk: 94, finance: 91, usage: 79, inventory: 70, loans: 61 },
  { mcc: 'Mandya', milk: 89, finance: 76, usage: 58, inventory: 49, loans: 42 },
];

export type ActivityItem = {
  id: string;
  label: string;
  actor: string;
  when: string;
};

export const MOCK_ACTIVITY: ActivityItem[] = [
  { id: '1', label: 'Payroll completed', actor: 'Ops · Mysuru', when: '18 min ago' },
  { id: '2', label: 'Disbursement sanctioned', actor: 'Finance · Platform', when: '42 min ago' },
  { id: '3', label: 'New supplier submitted', actor: 'Kariuki J.', when: '1 hr ago' },
];

export const EMPTY_KPIS_BASE: OverviewKpi[] = [
  {
    id: 'mccs',
    label: 'Active users',
    value: '—',
    hint: 'No data in selected range',
  },
  {
    id: 'onboarding',
    label: 'Pending onboarding',
    value: '—',
    hint: 'View queue',
  },
  {
    id: 'collections',
    label: 'Collections (period)',
    value: '—',
    hint: 'No data in selected range',
  },
  {
    id: 'rejections',
    label: 'Rejections (period)',
    value: '—',
    hint: 'No data in selected range',
  },
  {
    id: 'suppliers',
    label: 'Total suppliers',
    value: '—',
    hint: 'Distinct supplier accounts · platform',
  },
  {
    id: 'loans',
    label: 'Active loan book',
    value: '—',
    hint: 'No data in selected range',
  },
  {
    id: 'inventory',
    label: 'Inventory sales',
    value: '—',
    hint: 'No data in selected range',
  },
  {
    id: 'payroll',
    label: 'Payroll completed',
    value: '—',
    hint: 'No data in selected range',
  },
  {
    id: 'users',
    label: 'Total users',
    value: '—',
    hint: 'No data in selected range',
  },
  {
    id: 'audit',
    label: 'Audit events',
    value: '—',
    hint: 'No data in selected range',
  },
];

/** Collections row hint uses dashboard period label */
export function emptyOverviewKpisForPeriod(periodLabel: string): OverviewKpi[] {
  return EMPTY_KPIS_BASE.map((k) => (k.id === 'collections' ? { ...k, hint: periodLabel } : k));
}

function fmtRf(n: number): string {
  return `RF ${new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(n)}`;
}

function fmtLiters(n: number): string {
  return `${new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(Math.round(n))} L`;
}

export type FinanceSummaryTile = {
  label: string;
  value: string;
  hint?: string;
  trend?: string;
  trendUp?: boolean;
};

export const MOCK_FINANCE_TILES: FinanceSummaryTile[] = [
  {
    label: 'Disbursements',
    value: 'RF 68.4M',
    hint: 'Cash out · period',
    trend: '+4.2%',
    trendUp: true,
  },
  {
    label: 'Repayments',
    value: 'RF 53.2M',
    hint: 'Loan receipts',
    trend: '+3.1%',
    trendUp: true,
  },
  {
    label: 'Milk payments recorded',
    value: 'RF 107.8M',
    hint: 'amount_paid on collections',
    trend: '+5.4%',
    trendUp: true,
  },
  {
    label: 'Active loan book',
    value: 'RF 246.8M',
    hint: 'Principal outstanding',
    trend: '+6.2%',
    trendUp: true,
  },
];

export function financeTilesFromLive(finance: FinanceDashboardData | null, periodLabel: string): FinanceSummaryTile[] {
  if (!finance?.summary) {
    return [
      { label: 'Disbursements', value: '—', hint: periodLabel },
      { label: 'Repayments', value: '—', hint: periodLabel },
      { label: 'Milk payments recorded', value: '—', hint: periodLabel },
      { label: 'Active loan book', value: '—', hint: 'No data in selected range' },
    ];
  }
  const s = finance.summary;
  return [
    {
      label: 'Disbursements',
      value: fmtRf(Number(s.disbursements.amount)),
      hint: `${s.disbursements.count} loans · ${periodLabel}`,
    },
    {
      label: 'Repayments',
      value: fmtRf(Number(s.repayments.amount)),
      hint: `${s.repayments.count} payments · ${periodLabel}`,
    },
    {
      label: 'Milk payments recorded',
      value: fmtRf(Number(s.milk_payments_recorded.amount)),
      hint: periodLabel,
    },
    {
      label: 'Active loan book',
      value: fmtRf(Number(s.portfolio_active.principal_outstanding)),
      hint: `${s.portfolio_active.loan_count} active loans`,
    },
  ];
}

export function mergeOverviewKpis(
  base: OverviewKpi[],
  opts: {
    stats: DashboardStats | null;
    finance: FinanceDashboardData | null;
    usage: UsageDashboardData | null;
    periodLabel: string;
  },
): OverviewKpi[] {
  const { stats, finance, usage, periodLabel } = opts;
  return base.map((row) => {
    if (!stats && !finance && !usage) return row;

    if (row.id === 'collections' && stats?.sales?.liters != null) {
      return {
        ...row,
        value: fmtLiters(Number(stats.sales.liters)),
        hint: periodLabel,
      };
    }
    if (row.id === 'rejections' && stats?.rejections) {
      const r = stats.rejections;
      const liters = Number(r.liters ?? 0);
      const tx = Number(r.transactions ?? 0);
      return {
        ...row,
        value: fmtLiters(liters),
        hint: `${tx} rejected transaction${tx === 1 ? '' : 's'} · ${periodLabel}`,
      };
    }
    if (row.id === 'suppliers' && stats?.suppliers?.total != null) {
      return {
        ...row,
        value: String(stats.suppliers.total),
        hint: 'Distinct supplier accounts · platform',
      };
    }
    if (row.id === 'users' && stats?.users) {
      const u = stats.users;
      const total = Number(u.total ?? 0);
      const active = Number(u.active ?? 0);
      return {
        ...row,
        value: String(total),
        hint: `${active} active · platform`,
      };
    }
    if (row.id === 'mccs' && stats?.users) {
      const u = stats.users;
      const active = Number(u.active ?? 0);
      const total = Number(u.total ?? 0);
      return {
        ...row,
        value: String(active),
        hint: `${total} total users · platform`,
      };
    }
    if (row.id === 'onboarding') {
      const pending = Number(stats?.overview?.pendingOnboarding ?? 0);
      return {
        ...row,
        value: String(pending),
        hint: pending > 0 ? `${pending} pending submission${pending === 1 ? '' : 's'}` : 'View queue',
      };
    }
    if (row.id === 'loans' && finance?.summary?.portfolio_active?.principal_outstanding != null) {
      const p = finance.summary.portfolio_active.principal_outstanding;
      return {
        ...row,
        value: fmtRf(Number(p)),
        hint: `${finance.summary.portfolio_active.loan_count} active loans`,
      };
    }
    if (row.id === 'inventory' && finance?.summary?.inventory_sales?.amount != null) {
      const a = finance.summary.inventory_sales.amount;
      return {
        ...row,
        value: fmtRf(Number(a)),
        hint: `${finance.summary.inventory_sales.count} sales · ${periodLabel}`,
      };
    }
    if (row.id === 'payroll' && finance?.summary?.payroll) {
      const p = finance.summary.payroll;
      const runs = Number(p.runs ?? 0);
      return {
        ...row,
        value: fmtRf(Number(p.amount)),
        hint: `${runs} completed run${runs === 1 ? '' : 's'} · ${periodLabel}`,
      };
    }
    if (row.id === 'audit' && usage?.summary?.audit?.events != null) {
      return {
        ...row,
        value: String(usage.summary.audit.events),
        hint: `${usage.summary.audit.distinct_users} distinct users · ${periodLabel}`,
      };
    }
    return row;
  });
}
