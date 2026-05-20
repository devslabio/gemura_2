/**
 * Realistic platform-operator dashboard fixtures (Rwanda MCC scale).
 * Replace with live aggregates when a dedicated operator overview API exists.
 */

export type OperatorKpi = {
  id: string;
  label: string;
  value: string;
  sub: string;
  trend?: string;
  trendUp?: boolean;
};

export type OperatorMccRow = {
  rank: number;
  name: string;
  litres: string;
  change: string;
  changeUp: boolean;
};

export type OperatorCollectorRow = {
  name: string;
  litres: string;
  farms: number;
};

export type OperatorActivityRow = {
  id: string;
  text: string;
  time: string;
};

export type OperatorAlertCounts = {
  high: number;
  medium: number;
  low: number;
  info: number;
};

/** Snapshot inspired by production-scale tenant counts (May 2026). */
export const OPERATOR_DASHBOARD_MOCK = {
  kpis: [
    {
      id: 'mccs',
      label: 'Total MCCs',
      value: '48',
      sub: '45 active (94%)',
      trend: '+2 vs last month',
      trendUp: true,
    },
    {
      id: 'farmers',
      label: 'Total farmers',
      value: '18,732',
      sub: '15,922 active (85%)',
      trend: '+4.1% vs last week',
      trendUp: true,
    },
    {
      id: 'collectors',
      label: 'Collectors / agents',
      value: '1,248',
      sub: '1,098 active (88%)',
      trend: '+18 onboarded',
      trendUp: true,
    },
    {
      id: 'suppliers',
      label: 'Active suppliers',
      value: '2,840',
      sub: 'Delivering of 3,186 registered',
      trend: '+6.2% vs last week',
      trendUp: true,
    },
    {
      id: 'litres',
      label: 'Litres this week',
      value: '342,650 L',
      sub: 'Daily avg 48,950 L',
      trend: '+11.2% vs prior week',
      trendUp: true,
    },
    {
      id: 'rejection',
      label: 'Avg. rejection rate',
      value: '1.38%',
      sub: 'Target ≤ 2.0%',
      trend: '−0.25 pp',
      trendUp: true,
    },
    {
      id: 'rejected_litres',
      label: 'Rejected litres',
      value: '4,728 L',
      sub: '1.38% of volume',
      trend: '−8% vs prior week',
      trendUp: true,
    },
    {
      id: 'payments',
      label: 'Payments this week',
      value: 'RF 85.2M',
      sub: 'Settled RF 81.4M',
      trend: '+9.1%',
      trendUp: true,
    },
    {
      id: 'gate_deliveries',
      label: 'Gate deliveries',
      value: '1,892',
      sub: 'Across 45 active MCCs',
      trend: '+14.3% vs prior week',
      trendUp: true,
    },
    {
      id: 'loans',
      label: 'Loans outstanding',
      value: 'RF 312.6M',
      sub: '412 active borrowers',
      trend: '+6.5% portfolio',
      trendUp: false,
    },
  ] as OperatorKpi[],

  collectionsTrend: {
    categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    litres: [41200, 46800, 52100, 48900, 51200, 47800, 54650],
  },

  deliveryType: {
    labels: ['Direct farmer', 'Via collectors'],
    series: [61, 39],
    litres: [208900, 133750],
  },

  mccPerformance: {
    labels: ['Excellent', 'Good', 'Needs improvement'],
    series: [18, 22, 8],
  },

  systemHealth: [
    { name: 'Application', status: 'Operational' },
    { name: 'Database', status: 'Operational' },
    { name: 'Mobile services', status: 'Operational' },
    { name: 'Payment gateway', status: 'Operational' },
    { name: 'SMS / notifications', status: 'Operational' },
    { name: 'Backup jobs', status: 'Operational' },
  ],

  topMccs: [
    { rank: 1, name: 'Nyabihu Cooperative MCC', litres: '42,180 L', change: '+8.2%', changeUp: true },
    { rank: 2, name: 'Gishali MCC', litres: '38,420 L', change: '+5.1%', changeUp: true },
    { rank: 3, name: 'Kigabiro MCC', litres: '31,905 L', change: '−1.4%', changeUp: false },
    { rank: 4, name: 'Musanze Central MCC', litres: '28,640 L', change: '+3.8%', changeUp: true },
    { rank: 5, name: 'Rubavu Gate MCC', litres: '24,110 L', change: '+2.0%', changeUp: true },
  ] satisfies OperatorMccRow[],

  rejectionCauses: {
    labels: ['Antibiotics (+)', 'High TBC', 'Dilution', 'Acidity', 'Other'],
    values: [42, 28, 18, 8, 4],
  },

  rejectionTrend: {
    categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    rates: [1.52, 1.41, 1.28, 1.35, 1.22, 1.44, 1.38],
  },

  recentActivity: [
    { id: '1', text: 'System backup completed successfully', time: '10:15 AM' },
    { id: '2', text: 'New MCC onboarded: Huye Hills Cooperative', time: '09:42 AM' },
    { id: '3', text: 'Weekly milk reconciliation report generated', time: '08:30 AM' },
    { id: '4', text: 'Payment batch RF 12.4M processed for Eastern MCCs', time: 'Yesterday 6:12 PM' },
    { id: '5', text: 'Manifest compliance alert cleared — Kigabiro MCC', time: 'Yesterday 4:05 PM' },
  ] satisfies OperatorActivityRow[],

  topCollectors: [
    { name: 'Jean Baptiste N.', litres: '12,840 L', farms: 86 },
    { name: 'Marie Claire U.', litres: '11,205 L', farms: 72 },
    { name: 'Emmanuel K.', litres: '9,880 L', farms: 64 },
    { name: 'Grace M.', litres: '8,420 L', farms: 58 },
    { name: 'Patrick H.', litres: '7,965 L', farms: 51 },
  ] satisfies OperatorCollectorRow[],

  creditPortfolio: [
    { label: 'Total loans outstanding', value: 'RF 312,560,000' },
    { label: 'Active borrowers', value: '412' },
    { label: 'Portfolio at risk (>30d)', value: '4.2%' },
    { label: 'Disbursements this week', value: 'RF 18,750,000' },
    { label: 'Repayments this week', value: 'RF 14,200,000' },
  ],

  paymentsOverview: [
    { label: 'Payments this week', value: 'RF 85,230,000' },
    { label: 'Payments yesterday', value: 'RF 12,480,000' },
    { label: 'Pending settlements', value: 'RF 3,820,000' },
    { label: 'Payment holds (quality)', value: 'RF 1,240,000' },
    { label: 'Platform wallet balance', value: 'RF 42,180,000' },
  ],

  alerts: { high: 8, medium: 15, low: 12, info: 23 } satisfies OperatorAlertCounts,
};
