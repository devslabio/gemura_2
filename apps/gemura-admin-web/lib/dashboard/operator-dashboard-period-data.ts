import { type PeriodKey, getEffectiveDateRange } from '@/lib/dashboard/period-url';
import {
  OPERATOR_DASHBOARD_MOCK,
  type OperatorKpi,
  type OperatorMccRow,
} from '@/lib/dashboard/operator-dashboard-mock-data';

/** Week-scale baseline used to derive other periods until a live operator API exists. */
const BASE = {
  litresTotal: 342_650,
  paymentsRwf: 85_230_000,
  disbursementsRwf: 18_750_000,
  repaymentsRwf: 14_200_000,
  rejectionRate: 1.38,
  collectionsDaily: [41_200, 46_800, 52_100, 48_900, 51_200, 47_800, 54_650],
  rejectionDaily: [1.52, 1.41, 1.28, 1.35, 1.22, 1.44, 1.38],
  deliveryLitres: [208_900, 133_750],
  topMccLitres: [42_180, 38_420, 31_905, 28_640, 24_110],
  collectorLitres: [12_840, 11_205, 9_880, 8_420, 7_965],
  suppliersDelivering: 2_840,
  suppliersRegistered: 3_186,
  gateDeliveries: 1_892,
  rejectedLitres: 4_728,
} as const;

export type OperatorDashboardView = typeof OPERATOR_DASHBOARD_MOCK;

function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function daysInclusive(dateFrom: string, dateTo: string): number {
  const start = parseYmd(dateFrom);
  const end = parseYmd(dateTo);
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.floor(ms / 86_400_000) + 1);
}

function scaleToWeek(days: number): number {
  return days / 7;
}

function formatLitres(n: number): string {
  return `${new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(Math.round(n))} L`;
}

function formatRwfCompact(n: number): string {
  if (n >= 1_000_000) {
    return `RF ${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `RF ${(n / 1_000).toFixed(0)}K`;
  }
  return `RF ${new Intl.NumberFormat('en-RW').format(Math.round(n))}`;
}

function formatRwfFull(n: number): string {
  return `RF ${new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(Math.round(n))}`;
}

export function periodScopePhrase(period: PeriodKey, dateFrom: string, dateTo: string): string {
  if (period === 'custom' && dateFrom && dateTo) {
    const d = daysInclusive(dateFrom, dateTo);
    return `in ${d} day${d === 1 ? '' : 's'}`;
  }
  switch (period) {
    case 'day':
      return 'today';
    case 'week':
      return 'this week';
    case 'month':
      return 'this month';
    case 'quarter':
      return 'this quarter';
    case 'year':
      return 'this year';
    default:
      return 'in range';
  }
}

export function priorPeriodPhrase(period: PeriodKey): string {
  switch (period) {
    case 'day':
      return 'prior day';
    case 'week':
      return 'prior week';
    case 'month':
      return 'prior month';
    case 'quarter':
      return 'prior quarter';
    case 'year':
      return 'prior year';
    default:
      return 'prior period';
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function distributeTotal(total: number, buckets: number): number[] {
  if (buckets <= 0) return [];
  if (buckets === 1) return [Math.round(total)];
  const weights = Array.from({ length: buckets }, (_, i) => 0.85 + (i % 5) * 0.06);
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (total * w) / sum);
  const rounded = raw.map((v) => Math.round(v));
  const drift = Math.round(total) - rounded.reduce((a, b) => a + b, 0);
  rounded[rounded.length - 1] += drift;
  return rounded;
}

function buildCollectionsTrend(period: PeriodKey, days: number, litresTotal: number) {
  if (period === 'day') {
    return {
      categories: ['Morning', 'Midday', 'Afternoon', 'Evening'],
      litres: distributeTotal(litresTotal, 4),
    };
  }
  if (period === 'week' || days <= 7) {
    return {
      categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      litres: distributeTotal(litresTotal, 7),
    };
  }
  if (period === 'month' || days <= 31) {
    return {
      categories: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      litres: distributeTotal(litresTotal, 4),
    };
  }
  if (period === 'quarter' || days <= 120) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const q = Math.ceil((now.getMonth() + 1) / 3);
    const cats = monthNames.slice((q - 1) * 3, q * 3);
    return { categories: cats, litres: distributeTotal(litresTotal, 3) };
  }
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const cats = monthNames.slice(0, now.getMonth() + 1);
  return { categories: cats, litres: distributeTotal(litresTotal, cats.length) };
}

function buildRejectionTrend(categories: string[]) {
  const base = BASE.rejectionRate;
  const rates = categories.map((_, i) => {
    const wobble = ((i % 3) - 1) * 0.06;
    return Math.round((base + wobble) * 100) / 100;
  });
  return { categories, rates };
}

function scaleLitresString(litresStr: string, factor: number): string {
  const n = Number(litresStr.replace(/[^\d]/g, ''));
  if (!Number.isFinite(n)) return litresStr;
  return formatLitres(n * factor);
}

export type OperatorPeriodMeta = {
  scopeLabel: string;
  chartVolumeSubtitle: string;
  topMccSubtitle: string;
  collectionsSubtitle: string;
};

export type OperatorDashboardPeriodView = OperatorDashboardView & {
  periodMeta: OperatorPeriodMeta;
};

export function buildOperatorDashboardForPeriod(
  period: PeriodKey,
  customFrom: string,
  customTo: string,
): OperatorDashboardPeriodView {
  const { date_from, date_to } = getEffectiveDateRange(period, customFrom, customTo);
  const days = daysInclusive(date_from, date_to);
  const factor = scaleToWeek(days);
  const scope = periodScopePhrase(period, date_from, date_to);
  const prior = priorPeriodPhrase(period);

  const litresTotal = Math.round(BASE.litresTotal * factor);
  const paymentsTotal = Math.round(BASE.paymentsRwf * factor);
  const dailyAvg = Math.round(litresTotal / days);

  const kpis: OperatorKpi[] = OPERATOR_DASHBOARD_MOCK.kpis.map((k) => {
    switch (k.id) {
      case 'litres':
        return {
          ...k,
          label: `Litres ${scope}`,
          value: formatLitres(litresTotal),
          sub: `Daily avg ${formatLitres(dailyAvg)}`,
          trend: `+11.2% vs ${prior}`,
        };
      case 'payments':
        return {
          ...k,
          label: `Payments ${scope}`,
          value: formatRwfCompact(paymentsTotal),
          sub: `Settled ${formatRwfCompact(Math.round(paymentsTotal * 0.955))}`,
          trend: `+9.1% vs ${prior}`,
        };
      case 'farmers':
        return {
          ...k,
          trend: `+4.1% vs ${prior}`,
        };
      case 'mccs':
        return {
          ...k,
          trend: period === 'year' || period === 'quarter' ? '+6 vs start of year' : '+2 vs last month',
        };
      case 'collectors':
        return {
          ...k,
          trend:
            period === 'day'
              ? '+2 onboarded today'
              : period === 'week'
                ? '+18 onboarded'
                : `+${Math.max(1, Math.round(18 * factor))} onboarded`,
        };
      case 'rejection':
        return {
          ...k,
          sub: `Avg. over ${scope}`,
          trend: `−0.25 pp vs ${prior}`,
        };
      case 'loans':
        return {
          ...k,
          trend: period === 'day' ? 'Stable portfolio' : `+6.5% vs ${prior}`,
        };
      case 'suppliers': {
        const delivering = Math.round(BASE.suppliersDelivering * Math.min(factor, 1.15));
        return {
          ...k,
          label: `Suppliers ${scope}`,
          value: new Intl.NumberFormat('en-RW').format(delivering),
          sub: `Delivering of ${new Intl.NumberFormat('en-RW').format(BASE.suppliersRegistered)} registered`,
          trend: `+6.2% vs ${prior}`,
        };
      }
      case 'gate_deliveries': {
        const deliveries = Math.round(BASE.gateDeliveries * factor);
        const activeMccs = 45;
        return {
          ...k,
          label: `Gate deliveries ${scope}`,
          value: new Intl.NumberFormat('en-RW').format(deliveries),
          sub: `Across ${activeMccs} active MCCs`,
          trend: `+14.3% vs ${prior}`,
        };
      }
      case 'rejected_litres': {
        const rejected = Math.round(BASE.rejectedLitres * factor);
        const pct = litresTotal > 0 ? ((rejected / litresTotal) * 100).toFixed(2) : '0.00';
        return {
          ...k,
          label: `Rejected litres ${scope}`,
          value: formatLitres(rejected),
          sub: `${pct}% of volume`,
          trend: `−8% vs ${prior}`,
        };
      }
      default:
        return k;
    }
  });

  const deliveryTotal = Math.round((BASE.deliveryLitres[0] + BASE.deliveryLitres[1]) * factor);
  const deliveryLitres = distributeTotal(deliveryTotal, 2);
  const deliveryPct = deliveryLitres.map((l) => Math.round((l / deliveryTotal) * 100));

  const topMccs: OperatorMccRow[] = OPERATOR_DASHBOARD_MOCK.topMccs.map((row) => ({
    ...row,
    litres: scaleLitresString(row.litres, factor),
  }));

  const topCollectors = OPERATOR_DASHBOARD_MOCK.topCollectors.map((c) => ({
    ...c,
    litres: scaleLitresString(c.litres, factor),
  }));

  const collectionsTrend = buildCollectionsTrend(period, days, litresTotal);
  const rejectionTrend = buildRejectionTrend(collectionsTrend.categories);

  const creditPortfolio = OPERATOR_DASHBOARD_MOCK.creditPortfolio.map((row) => {
    if (row.label === 'Disbursements this week') {
      return {
        label: `Disbursements ${scope}`,
        value: formatRwfFull(Math.round(BASE.disbursementsRwf * factor)),
      };
    }
    if (row.label === 'Repayments this week') {
      return {
        label: `Repayments ${scope}`,
        value: formatRwfFull(Math.round(BASE.repaymentsRwf * factor)),
      };
    }
    return row;
  });

  const paymentsOverview = OPERATOR_DASHBOARD_MOCK.paymentsOverview.map((row) => {
    if (row.label === 'Payments this week') {
      return { label: `Payments ${scope}`, value: formatRwfFull(paymentsTotal) };
    }
    if (row.label === 'Payments yesterday') {
      const dayPay = period === 'day' ? paymentsTotal : Math.round(paymentsTotal / Math.min(days, 7));
      return {
        label: period === 'day' ? 'Payments today' : 'Latest day',
        value: formatRwfFull(dayPay),
      };
    }
    return row;
  });

  return {
    ...OPERATOR_DASHBOARD_MOCK,
    kpis,
    collectionsTrend,
    deliveryType: {
      ...OPERATOR_DASHBOARD_MOCK.deliveryType,
      series: deliveryPct,
      litres: deliveryLitres,
    },
    topMccs,
    topCollectors,
    rejectionTrend,
    creditPortfolio,
    paymentsOverview,
    periodMeta: {
      scopeLabel: capitalize(scope),
      chartVolumeSubtitle: `Share of ${scope} volume`,
      topMccSubtitle: capitalize(scope),
      collectionsSubtitle:
        period === 'day' ? 'Litres received today' : period === 'week' ? 'Litres received per day' : `Litres ${scope}`,
    },
  };
}
