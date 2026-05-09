import type { DashboardStats, FinanceDashboardData, UsageDashboardData } from '@/lib/api/admin';

export type OverviewKpi = {
  id: string;
  label: string;
  value: string;
  hint?: string;
  trend?: string;
  trendUp?: boolean;
};

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

export type OnboardingRow = {
  id: string;
  applicant: string;
  region: string;
  appliedOn: string;
  status: string;
  statusTone: 'pending' | 'review' | 'kyc';
};

export type AlertItem = {
  id: string;
  severity: 'high' | 'medium' | 'info';
  title: string;
  when: string;
};

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

export type ActivityItem = {
  id: string;
  label: string;
  actor: string;
  when: string;
};

export const EMPTY_KPIS_BASE: OverviewKpi[] = [
  {
    id: 'mccs',
    label: 'Active MCCs',
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
    label: 'Platform active users',
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
    if (row.id === 'users' && stats?.users?.active != null) {
      return {
        ...row,
        value: String(stats.users.active),
        hint: `${stats.users.total} total users`,
      };
    }
    if (row.id === 'mccs' && stats?.accounts?.total != null) {
      const t = stats.accounts.total;
      return {
        ...row,
        value: String(t),
        hint: 'Accounts on platform · API',
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
