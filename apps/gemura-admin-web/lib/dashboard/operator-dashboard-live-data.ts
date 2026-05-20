import type { DashboardStats, FinanceDashboardData, UsageDashboardData } from '@/lib/api/admin';
import type { PeriodKey } from '@/lib/dashboard/period-url';
import { getEffectiveDateRange } from '@/lib/dashboard/period-url';
import {
  OPERATOR_DASHBOARD_MOCK,
  type OperatorActivityRow,
  type OperatorAlertCounts,
  type OperatorKpi,
  type OperatorMccRow,
} from '@/lib/dashboard/operator-dashboard-mock-data';
import {
  type OperatorDashboardPeriodView,
  periodScopePhrase,
  priorPeriodPhrase,
} from '@/lib/dashboard/operator-dashboard-period-data';

type KpiTrend = Pick<OperatorKpi, 'trend' | 'trendUp'>;

function pctTrend(current: number, prior: number, priorLabel: string, lowerIsBetter = false): KpiTrend {
  if (current === 0 && prior === 0) return {};
  if (prior === 0) {
    return {
      trend: current > 0 ? `Up vs ${priorLabel}` : `Flat vs ${priorLabel}`,
      trendUp: lowerIsBetter ? current === 0 : current > 0,
    };
  }
  const pct = ((current - prior) / prior) * 100;
  if (Math.abs(pct) < 0.5) {
    return { trend: `Flat vs ${priorLabel}`, trendUp: true };
  }
  const sign = pct > 0 ? '+' : '';
  const improved = lowerIsBetter ? pct < 0 : pct > 0;
  return { trend: `${sign}${pct.toFixed(1)}% vs ${priorLabel}`, trendUp: improved };
}

function ppTrend(currentPct: number, priorPct: number, priorLabel: string): KpiTrend {
  const delta = currentPct - priorPct;
  if (Math.abs(delta) < 0.01) {
    return { trend: `Flat vs ${priorLabel}`, trendUp: true };
  }
  const sign = delta > 0 ? '+' : '';
  return { trend: `${sign}${delta.toFixed(2)} pp vs ${priorLabel}`, trendUp: delta <= 0 };
}

function countTrend(current: number, prior: number, priorLabel: string, unit: string): KpiTrend {
  const delta = current - prior;
  if (delta === 0) return { trend: `Flat vs ${priorLabel}`, trendUp: true };
  const sign = delta > 0 ? '+' : '';
  return { trend: `${sign}${delta} ${unit} vs ${priorLabel}`, trendUp: delta >= 0 };
}

function formatLitres(n: number): string {
  return `${new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(Math.round(n))} L`;
}

function formatRwfCompact(n: number): string {
  if (n >= 1_000_000) return `RF ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `RF ${(n / 1_000).toFixed(0)}K`;
  return `RF ${new Intl.NumberFormat('en-RW').format(Math.round(n))}`;
}

function formatRwfFull(n: number): string {
  return `RF ${new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(Math.round(n))}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function daysInclusive(dateFrom: string, dateTo: string): number {
  const [y1, m1, d1] = dateFrom.split('-').map(Number);
  const [y2, m2, d2] = dateTo.split('-').map(Number);
  const start = new Date(y1, (m1 ?? 1) - 1, d1 ?? 1);
  const end = new Date(y2, (m2 ?? 1) - 1, d2 ?? 1);
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1);
}

function rejectionRatePct(stats: DashboardStats | null): number {
  const litres = Number(stats?.sales?.liters ?? 0);
  const rejected = Number(stats?.rejections?.liters ?? 0);
  return litres > 0 ? (rejected / litres) * 100 : 0;
}

function buildKpis(
  period: PeriodKey,
  scope: string,
  stats: DashboardStats | null,
  finance: FinanceDashboardData | null,
  usage: UsageDashboardData | null,
  priorStats: DashboardStats | null,
  priorFinance: FinanceDashboardData | null,
  priorUsage: UsageDashboardData | null,
  days: number,
): OperatorKpi[] {
  const priorLabel = priorPeriodPhrase(period);
  const litres = Number(stats?.sales?.liters ?? 0);
  const priorLitres = Number(priorStats?.sales?.liters ?? 0);
  const rejectedLitres = Number(stats?.rejections?.liters ?? 0);
  const priorRejectedLitres = Number(priorStats?.rejections?.liters ?? 0);
  const rejectionPct = rejectionRatePct(stats);
  const priorRejectionPct = rejectionRatePct(priorStats);
  const rejectionPctDisplay = rejectionPct.toFixed(2);
  const payments = Number(finance?.summary?.milk_payments_recorded?.amount ?? 0);
  const priorPayments = Number(priorFinance?.summary?.milk_payments_recorded?.amount ?? 0);
  const portfolio = finance?.summary?.portfolio_active;
  const priorPortfolio = priorFinance?.summary?.portfolio_active;
  const healthRows = stats?.overview?.healthRows ?? [];
  const activeMccs = healthRows.length;
  const mccTotal = Number(stats?.accounts?.mcc_users ?? 0);
  const suppliersTotal = Number(stats?.suppliers?.total ?? 0);
  const collectors = Number(usage?.summary?.milk?.distinct_operators ?? 0);
  const priorCollectors = Number(priorUsage?.summary?.milk?.distinct_operators ?? 0);
  const gateDeliveries = Number(usage?.summary?.mcc_gate_deliveries ?? 0);
  const priorGateDeliveries = Number(priorUsage?.summary?.mcc_gate_deliveries ?? 0);
  const pendingOnboarding = Number(stats?.overview?.pendingOnboarding ?? 0);
  const priorPending = Number(priorStats?.overview?.pendingOnboarding ?? 0);
  const priorMccTotal = Number(priorStats?.accounts?.mcc_users ?? 0);
  const registeredInPeriod = Number(usage?.summary?.users?.registered_in_period ?? 0);
  const priorRegistered = Number(priorUsage?.summary?.users?.registered_in_period ?? 0);
  const supplierLinks = Number(usage?.summary?.supplier_customer_links_created ?? 0);
  const priorSupplierLinks = Number(priorUsage?.summary?.supplier_customer_links_created ?? 0);
  const disbursements = Number(finance?.summary?.disbursements?.amount ?? 0);
  const priorDisbursements = Number(priorFinance?.summary?.disbursements?.amount ?? 0);
  const outstanding = Number(portfolio?.principal_outstanding ?? 0);
  const priorOutstanding = Number(priorPortfolio?.principal_outstanding ?? 0);

  return [
    {
      id: 'mccs',
      label: 'MCC users on platform',
      value: new Intl.NumberFormat('en-RW').format(mccTotal),
      sub:
        activeMccs > 0
          ? `${activeMccs} MCC sites with ops data · ${pendingOnboarding} onboarding pending`
          : `${pendingOnboarding} onboarding pending`,
      ...(mccTotal !== priorMccTotal
        ? countTrend(mccTotal, priorMccTotal, priorLabel, 'MCC users')
        : countTrend(pendingOnboarding, priorPending, priorLabel, 'onboarding')),
    },
    {
      id: 'farmers',
      label: 'Active users',
      value: String(stats?.users?.active ?? 0),
      sub: `${stats?.users?.total ?? 0} registered · farms in registry`,
      ...pctTrend(registeredInPeriod, priorRegistered, priorLabel),
    },
    {
      id: 'collectors',
      label: `Milk operators ${scope}`,
      value: new Intl.NumberFormat('en-RW').format(collectors),
      sub: `${Number(usage?.summary?.milk?.transactions ?? stats?.collections?.total ?? 0).toLocaleString()} transactions`,
      ...pctTrend(collectors, priorCollectors, priorLabel),
    },
    {
      id: 'suppliers',
      label: 'Registered suppliers',
      value: new Intl.NumberFormat('en-RW').format(suppliersTotal),
      sub: 'Distinct supplier accounts',
      ...pctTrend(supplierLinks, priorSupplierLinks, priorLabel),
    },
    {
      id: 'litres',
      label: `Litres ${scope}`,
      value: formatLitres(litres),
      sub: `Daily avg ${formatLitres(Math.round(litres / days))}`,
      ...pctTrend(litres, priorLitres, priorLabel),
    },
    {
      id: 'rejection',
      label: 'Avg. rejection rate',
      value: `${rejectionPctDisplay}%`,
      sub: `Target ≤ 2.0% · ${scope}`,
      ...ppTrend(rejectionPct, priorRejectionPct, priorLabel),
    },
    {
      id: 'rejected_litres',
      label: `Rejected litres ${scope}`,
      value: formatLitres(rejectedLitres),
      sub: `${stats?.rejections?.transactions ?? 0} rejected transactions`,
      ...pctTrend(rejectedLitres, priorRejectedLitres, priorLabel, true),
    },
    {
      id: 'payments',
      label: `Payments ${scope}`,
      value: formatRwfCompact(payments),
      sub: `Milk amount recorded ${scope}`,
      ...pctTrend(payments, priorPayments, priorLabel),
    },
    {
      id: 'gate_deliveries',
      label: `Gate deliveries ${scope}`,
      value: new Intl.NumberFormat('en-RW').format(gateDeliveries),
      sub: activeMccs > 0 ? `Across ${activeMccs} MCCs tracked` : 'Platform-wide',
      ...pctTrend(gateDeliveries, priorGateDeliveries, priorLabel),
    },
    {
      id: 'loans',
      label: 'Loans outstanding',
      value: formatRwfCompact(outstanding),
      sub: `${portfolio?.loan_count ?? 0} active borrowers`,
      ...(Math.abs(outstanding - priorOutstanding) < 1
        ? { trend: 'Stable portfolio', trendUp: true }
        : pctTrend(disbursements, priorDisbursements, priorLabel)),
    },
  ];
}

function buildCollectionsTrend(stats: DashboardStats | null) {
  const daily = stats?.trends?.daily ?? [];
  if (daily.length === 0) {
    return { categories: ['—'], litres: [0] };
  }
  return {
    categories: daily.map((d) => d.label),
    litres: daily.map((d) => Math.round(Number(d.sales))),
  };
}

function buildMilkByStatus(stats: DashboardStats | null) {
  const rows = (stats?.salesByStatus ?? []).filter((s) => s.count > 0);
  if (rows.length === 0) {
    return { labels: [] as string[], series: [] as number[], litres: [] as number[] };
  }
  const total = rows.reduce((a, s) => a + s.count, 0);
  const litresTotal = Number(stats?.sales?.liters ?? 0);
  return {
    labels: rows.map((s) => s.status.charAt(0).toUpperCase() + s.status.slice(1)),
    series: rows.map((s) => Math.round((s.count / total) * 100)),
    litres: rows.map((s) => Math.round((s.count / total) * litresTotal)),
  };
}

function buildMccPerformance(stats: DashboardStats | null) {
  const rows = stats?.overview?.healthRows ?? [];
  const bands = ['Excellent', 'Good', 'Moderate', 'At risk', 'Critical'] as const;
  const labels = bands.filter((b) => rows.some((r) => r.health === b));
  if (labels.length === 0) {
    return { labels: ['No data'], series: [1] };
  }
  return {
    labels,
    series: labels.map((b) => rows.filter((r) => r.health === b).length),
  };
}

function buildTopMccs(stats: DashboardStats | null): OperatorMccRow[] {
  const rows = [...(stats?.overview?.collectionsByMcc ?? [])]
    .sort((a, b) => b.collections_liters - a.collections_liters)
    .slice(0, 5);
  const healthByName = new Map(
    (stats?.overview?.healthRows ?? []).map((h) => [h.mcc, h]),
  );

  return rows.map((row, i) => {
    const health = healthByName.get(row.mcc);
    const rej = health?.rejectionPct ?? 0;
    return {
      rank: i + 1,
      name: row.mcc,
      litres: formatLitres(row.collections_liters),
      change: health ? `${rej.toFixed(1)}% rej.` : '—',
      changeUp: rej <= 2,
    };
  });
}

function buildTopSuppliersByRecent(stats: DashboardStats | null): Array<{ name: string; litres: string; farms: number }> {
  const byName = new Map<string, number>();
  for (const sale of stats?.recentSales ?? []) {
    const name = sale.supplier?.trim() || 'Unknown';
    byName.set(name, (byName.get(name) ?? 0) + Number(sale.quantity));
  }
  return [...byName.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, qty]) => ({
      name,
      litres: formatLitres(qty),
      farms: 0,
    }));
}

function buildRejectionTrend(stats: DashboardStats | null) {
  const daily = stats?.trends?.daily ?? [];
  const litres = Number(stats?.sales?.liters ?? 0);
  const rejected = Number(stats?.rejections?.liters ?? 0);
  const rate = litres > 0 ? (rejected / litres) * 100 : 0;
  if (daily.length === 0) {
    return { categories: ['—'], rates: [rate] };
  }
  return {
    categories: daily.map((d) => d.label),
    rates: daily.map(() => Math.round(rate * 100) / 100),
  };
}

function buildRejectionCauses(stats: DashboardStats | null) {
  const tx = Number(stats?.rejections?.transactions ?? 0);
  const byStatus = stats?.salesByStatus?.find((s) => s.status === 'rejected');
  if (byStatus && byStatus.count > 0) {
    return {
      labels: ['Rejected sales'],
      values: [byStatus.count],
    };
  }
  if (tx > 0) {
    return { labels: ['Rejected transactions'], values: [tx] };
  }
  return { labels: ['No rejections'], values: [0] };
}

function buildAlerts(stats: DashboardStats | null): OperatorAlertCounts {
  const rows = stats?.overview?.alerts ?? [];
  return {
    high: rows.filter((a) => a.severity === 'high').length,
    medium: rows.filter((a) => a.severity === 'medium').length,
    low: 0,
    info: rows.filter((a) => a.severity === 'info').length,
  };
}

function buildActivity(stats: DashboardStats | null): OperatorActivityRow[] {
  return (stats?.overview?.activity ?? []).slice(0, 5).map((a) => ({
    id: a.id,
    text: a.label,
    time: a.when,
  }));
}

function buildCreditPortfolio(scope: string, finance: FinanceDashboardData | null) {
  const s = finance?.summary;
  if (!s) {
    return [{ label: 'Credit data', value: '—' }];
  }
  return [
    {
      label: 'Total loans outstanding',
      value: formatRwfFull(Number(s.portfolio_active.principal_outstanding)),
    },
    { label: 'Active borrowers', value: String(s.portfolio_active.loan_count) },
    {
      label: `Disbursements ${scope}`,
      value: formatRwfFull(Number(s.disbursements.amount)),
    },
    {
      label: `Repayments ${scope}`,
      value: formatRwfFull(Number(s.repayments.amount)),
    },
    {
      label: `Payroll completed ${scope}`,
      value: formatRwfFull(Number(s.payroll.amount)),
    },
  ];
}

function buildPaymentsOverview(scope: string, finance: FinanceDashboardData | null) {
  const s = finance?.summary;
  if (!s) {
    return [{ label: 'Finance data', value: '—' }];
  }
  const rows = [
    {
      label: `Payments ${scope}`,
      value: formatRwfFull(Number(s.milk_payments_recorded.amount)),
    },
    {
      label: `Disbursements ${scope}`,
      value: formatRwfFull(Number(s.disbursements.amount)),
    },
    {
      label: `Repayments ${scope}`,
      value: formatRwfFull(Number(s.repayments.amount)),
    },
    {
      label: 'Inventory sales',
      value: formatRwfFull(Number(s.inventory_sales.amount)),
    },
  ];
  return rows;
}

export function buildOperatorDashboardFromLive(
  period: PeriodKey,
  customFrom: string,
  customTo: string,
  stats: DashboardStats | null,
  finance: FinanceDashboardData | null,
  usage: UsageDashboardData | null,
  priorStats: DashboardStats | null = null,
  priorFinance: FinanceDashboardData | null = null,
  priorUsage: UsageDashboardData | null = null,
): OperatorDashboardPeriodView {
  const { date_from, date_to } = getEffectiveDateRange(period, customFrom, customTo);
  const scope = periodScopePhrase(period, date_from, date_to);
  const days = daysInclusive(date_from, date_to);
  const collectionsTrend = buildCollectionsTrend(stats);
  const rejectionTrend = buildRejectionTrend(stats);

  return {
    ...OPERATOR_DASHBOARD_MOCK,
    kpis: buildKpis(period, scope, stats, finance, usage, priorStats, priorFinance, priorUsage, days),
    collectionsTrend,
    deliveryType: buildMilkByStatus(stats),
    mccPerformance: buildMccPerformance(stats),
    systemHealth: OPERATOR_DASHBOARD_MOCK.systemHealth,
    topMccs: buildTopMccs(stats),
    topCollectors: buildTopSuppliersByRecent(stats),
    rejectionCauses: buildRejectionCauses(stats),
    rejectionTrend,
    recentActivity: buildActivity(stats),
    creditPortfolio: buildCreditPortfolio(scope, finance),
    paymentsOverview: buildPaymentsOverview(scope, finance),
    alerts: buildAlerts(stats),
    periodMeta: {
      scopeLabel: capitalize(scope),
      chartVolumeSubtitle: 'Milk sales by status',
      topMccSubtitle: capitalize(scope),
      collectionsSubtitle:
        period === 'day'
          ? 'Litres received today'
          : period === 'week'
            ? 'Litres received per day'
            : `Litres ${scope}`,
    },
  };
}
