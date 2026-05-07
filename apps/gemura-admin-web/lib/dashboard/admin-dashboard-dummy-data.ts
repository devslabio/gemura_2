import type { DashboardStats, FinanceDashboardData, UsageDashboardData } from '@/lib/api/admin';
import type { StatsOverviewData } from '@/lib/api/stats';

function enumerateDates(from: string, to: string, maxDays = 42): string[] {
  const out: string[] = [];
  const cur = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime())) return out;
  while (cur <= end && out.length < maxDays) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function trendLabel(iso: string): string {
  const dt = new Date(`${iso}T12:00:00`);
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function weekdayShort(iso: string): string {
  const dt = new Date(`${iso}T12:00:00`);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getDay()] ?? iso;
}

/** Deterministic “nice” curves for charts (visual only). */
export function buildDummyDashboardStats(dateFrom: string, dateTo: string): DashboardStats {
  const dates = enumerateDates(dateFrom, dateTo);
  const daily = dates.map((date, i) => {
    const revenue = Math.round(680_000 + Math.sin(i * 0.55) * 220_000 + (i % 5) * 12_000);
    const sales = Math.round(2150 + Math.cos(i * 0.48) * 520 + (i % 4) * 80);
    return { date, label: trendLabel(date), revenue, sales };
  });

  const revenueTotal = daily.reduce((s, x) => s + x.revenue, 0);
  const litersSum = daily.reduce((s, x) => s + x.sales, 0);
  const days = Math.max(1, daily.length);
  const txnApprox = Math.round(95 + days * 4.2 + Math.sin(days) * 8);

  const endIso = dates[dates.length - 1] ?? dateTo;

  return {
    users: { total: 248, active: 231, inactive: 17 },
    accounts: { total: 42 },
    sales: {
      total: txnApprox,
      liters: litersSum,
      last30Days: Math.round(txnApprox * 0.85),
      last7Days: Math.round(txnApprox * 0.22),
      today: 14 + (days % 7),
    },
    collections: { total: Math.round(txnApprox * 1.08) },
    suppliers: { total: 56 },
    customers: { total: 89 },
    revenue: {
      total: revenueTotal,
      last30Days: Math.round(revenueTotal * 0.88),
      last7Days: Math.round(revenueTotal * 0.24),
      today: 502_000,
    },
    trends: { daily },
    salesByStatus: [
      { status: 'accepted', count: Math.round(txnApprox * 0.82) },
      { status: 'pending', count: Math.round(txnApprox * 0.14) },
      { status: 'rejected', count: Math.max(2, Math.round(txnApprox * 0.04)) },
    ],
    recentSales: [
      {
        id: 'demo-1',
        quantity: 420,
        unitPrice: 380,
        total: 159600,
        status: 'accepted',
        date: `${endIso}T10:15:00.000Z`,
        supplier: 'Kirehe Dairy Co-op',
        customer: 'Gemura MCC',
      },
      {
        id: 'demo-2',
        quantity: 380,
        unitPrice: 385,
        total: 146300,
        status: 'accepted',
        date: `${endIso}T09:02:00.000Z`,
        supplier: 'Nyagatare Farmers Union',
        customer: 'Gemura MCC',
      },
      {
        id: 'demo-3',
        quantity: 510,
        unitPrice: 375,
        total: 191250,
        status: 'pending',
        date: `${endIso}T08:40:00.000Z`,
        supplier: 'Rwamagana Collectors',
        customer: 'Gemura MCC',
      },
      {
        id: 'demo-4',
        quantity: 295,
        unitPrice: 390,
        total: 115050,
        status: 'accepted',
        date: `${endIso}T07:55:00.000Z`,
        supplier: 'Gatsibo Hub',
        customer: 'Gemura MCC',
      },
      {
        id: 'demo-5',
        quantity: 610,
        unitPrice: 372,
        total: 226920,
        status: 'accepted',
        date: `${endIso}T07:12:00.000Z`,
        supplier: 'Burera Highlands',
        customer: 'Gemura MCC',
      },
    ],
  };
}

export function buildDummyStatsOverview(dateFrom: string, dateTo: string): StatsOverviewData {
  const dates = enumerateDates(dateFrom, dateTo, 45);
  let collL = 0;
  let collV = 0;
  let saleL = 0;
  let saleV = 0;

  const breakdown = dates.map((date, i) => {
    const cLiters = Math.round(2600 + Math.sin(i * 0.52) * 700 + (i % 6) * 40);
    const sLiters = Math.round(2100 + Math.cos(i * 0.44) * 600 + (i % 5) * 35);
    const cVal = Math.round(cLiters * 382);
    const sVal = Math.round(sLiters * 378);
    collL += cLiters;
    collV += cVal;
    saleL += sLiters;
    saleV += sVal;
    return {
      date,
      label: weekdayShort(date),
      collection: { liters: cLiters, value: cVal },
      sales: { liters: sLiters, value: sVal },
    };
  });

  const ct = Math.round(48 + dates.length * 1.1);
  const st = Math.round(41 + dates.length * 0.95);

  return {
    summary: {
      collection: { liters: collL, value: collV, transactions: ct },
      rejections: { liters: 185, value: 70650, transactions: 4 },
      sales: { liters: saleL, value: saleV, transactions: st },
      suppliers: { active: 47, inactive: 9 },
      customers: { active: 72, inactive: 14 },
    },
    breakdown_type: 'daily',
    chart_period: 'demo',
    breakdown,
    date_range: { from: dateFrom, to: dateTo },
  };
}

export function buildDummyFinanceDashboard(dateFrom: string, dateTo: string): FinanceDashboardData {
  const dates = enumerateDates(dateFrom, dateTo, 45);
  let disb = 0;
  let rep = 0;
  let pay = 0;
  let inv = 0;

  const breakdown = dates.map((date, i) => {
    const disbursements = Math.round(180_000 + Math.sin(i * 0.51) * 95_000 + (i % 4) * 12_000);
    const repayments = Math.round(125_000 + Math.cos(i * 0.47) * 72_000 + (i % 5) * 9_000);
    const payroll = Math.round(420_000 + Math.sin(i * 0.39) * 110_000 + (i % 3) * 25_000);
    const inventory_sales = Math.round(35_000 + Math.cos(i * 0.61) * 18_000 + (i % 6) * 4_000);
    disb += disbursements;
    rep += repayments;
    pay += payroll;
    inv += inventory_sales;
    return {
      date,
      label: weekdayShort(date),
      disbursements,
      repayments,
      payroll,
      inventory_sales,
    };
  });

  const lastIso = dates[dates.length - 1] ?? dateTo;

  return {
    summary: {
      disbursements: { amount: disb, count: Math.max(3, Math.round(dates.length * 1.4)) },
      repayments: { amount: rep, count: Math.max(5, Math.round(dates.length * 2.2)) },
      payroll: { amount: pay, runs: Math.max(1, Math.ceil(dates.length / 12)) },
      milk_payments_recorded: { amount: Math.round(pay * 0.42) },
      inventory_sales: { amount: inv, count: Math.max(4, Math.round(dates.length * 1.8)) },
      portfolio_active: { loan_count: 38, principal_outstanding: 12_400_000 },
    },
    loans_by_status: [
      { status: 'active', count: 38 },
      { status: 'closed', count: 6 },
    ],
    breakdown,
    recent_disbursements: [
      {
        id: 'demo-loan-1',
        principal: 2_400_000,
        status: 'active',
        disbursement_date: `${lastIso}T14:20:00.000Z`,
        borrower_label: 'Nyagatare Farmers Union',
        lender_name: 'Gemura MCC',
      },
      {
        id: 'demo-loan-2',
        principal: 980_000,
        status: 'active',
        disbursement_date: `${lastIso}T11:05:00.000Z`,
        borrower_label: 'Kirehe Dairy Co-op',
        lender_name: 'Gemura MCC',
      },
      {
        id: 'demo-loan-3',
        principal: 650_000,
        status: 'active',
        disbursement_date: `${lastIso}T09:40:00.000Z`,
        borrower_label: 'Rwamagana Collectors',
        lender_name: 'Gemura MCC',
      },
    ],
  };
}

export function buildDummyUsageDashboard(dateFrom: string, dateTo: string): UsageDashboardData {
  const dates = enumerateDates(dateFrom, dateTo, 45);
  let auditEv = 0;
  let milkT = 0;
  let gate = 0;

  const breakdown = dates.map((date, i) => {
    const audit_events = Math.round(120 + Math.sin(i * 0.41) * 55 + (i % 4) * 12);
    const audit_users = Math.round(28 + Math.cos(i * 0.38) * 12 + (i % 3) * 3);
    const milk_transactions = Math.round(180 + Math.sin(i * 0.52) * 70 + (i % 5) * 15);
    const milk_operators = Math.round(22 + Math.cos(i * 0.44) * 9 + (i % 4) * 2);
    const gate_deliveries = Math.round(35 + Math.sin(i * 0.35) * 18 + (i % 3) * 5);
    auditEv += audit_events;
    milkT += milk_transactions;
    gate += gate_deliveries;
    return {
      date,
      label: weekdayShort(date),
      audit_events,
      audit_users,
      milk_transactions,
      milk_operators,
      gate_deliveries,
    };
  });

  const days = Math.max(1, dates.length);

  return {
    summary: {
      users: {
        active_platform_total: 248,
        last_login_in_period: Math.min(231, 140 + days * 6),
        registered_in_period: Math.max(2, Math.round(days * 1.2)),
      },
      audit: {
        events: auditEv || Math.round(days * 420),
        distinct_users: Math.min(180, 52 + days * 8),
      },
      milk: {
        transactions: milkT || Math.round(days * 245),
        distinct_operators: Math.min(120, 38 + days * 5),
      },
      mcc_gate_deliveries: gate || Math.round(days * 42),
      payroll_runs_created: Math.max(1, Math.ceil(days / 14)),
      supplier_customer_links_created: Math.max(3, Math.round(days * 2.4)),
      feed_posts_created: Math.round(days * 6.5),
      inventory_sales_created: Math.round(days * 4.2),
    },
    breakdown,
  };
}
