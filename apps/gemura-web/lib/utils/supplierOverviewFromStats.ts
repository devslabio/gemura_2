import type {
  OverviewBreakdownItem,
  OverviewRecentTransaction,
  OverviewSummary,
} from '@/lib/api/stats';

/** Sort newest first — same ordering the overview API typically returns */
export function sortOverviewTransactionsRecentFirst(
  rows: OverviewRecentTransaction[]
): OverviewRecentTransaction[] {
  return [...rows].sort(
    (a, b) => new Date(b.transaction_at).getTime() - new Date(a.transaction_at).getTime()
  );
}

/** Rows for “recent deliveries” / activity: milk sales and collection records */
export function supplierRecentOverviewRows(transactions: OverviewRecentTransaction[] | undefined) {
  const list = transactions ?? [];
  return sortOverviewTransactionsRecentFirst(
    list.filter((r) => r.type === 'sale' || r.type === 'collection')
  );
}

export function breakdownToSeries(breakdown: OverviewBreakdownItem[] | undefined) {
  const b = breakdown ?? [];
  return {
    categories: b.map((x) => x.label),
    collectionLiters: b.map((x) => Number(x.collection?.liters ?? 0)),
    salesLiters: b.map((x) => Number(x.sales?.liters ?? 0)),
    salesValues: b.map((x) => Number(x.sales?.value ?? 0)),
    collectionValues: b.map((x) => Number(x.collection?.value ?? 0)),
    totalCollection: b.reduce((s, x) => s + Number(x.collection?.liters ?? 0), 0),
    totalSales: b.reduce((s, x) => s + Number(x.sales?.liters ?? 0), 0),
    totalSalesValue: b.reduce((s, x) => s + Number(x.sales?.value ?? 0), 0),
    totalCollectionValue: b.reduce((s, x) => s + Number(x.collection?.value ?? 0), 0),
  };
}

export function groupCollectionsByQualityGrade(
  collections: Array<{ quality_grade?: string; liters: number }>
) {
  const gradeMap: Record<string, { liters: number; count: number }> = {};
  for (const c of collections) {
    const grade = c.quality_grade?.trim().toUpperCase() || 'Ungraded';
    if (!gradeMap[grade]) gradeMap[grade] = { liters: 0, count: 0 };
    gradeMap[grade].liters += Number(c.liters) || 0;
    gradeMap[grade].count += 1;
  }
  return Object.entries(gradeMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([grade, { liters, count }]) => ({ grade, liters, count }));
}

export function chartPeriodLabel(chartPeriod?: string): string {
  if (!chartPeriod) return 'Selected period';
  const map: Record<string, string> = {
    last_7_days: 'Last 7 days',
    last_14_days: 'Last 14 days',
    last_30_days: 'Last 30 days',
  };
  return map[chartPeriod] ?? chartPeriod.replace(/_/g, ' ');
}
