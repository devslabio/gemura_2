'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { usePermission } from '@/hooks/usePermission';
import { statsApi, OverviewResponse } from '@/lib/api/stats';
import { accountingApi } from '@/lib/api/accounting';
import { inventoryApi, type InventoryStats, type ValuationOverTimePoint, type TopItemByValue, type StockMovementPoint } from '@/lib/api/inventory';
import { loansApi, type Loan } from '@/lib/api/loans';
import { useToastStore } from '@/store/toast';
import Icon, {
  faBuilding,
  faStore,
  faBox,
  faReceipt,
  faPlus,
  faArrowRight,
  faWarehouse,
  faClipboardList,
  faChartLine,
  faDollarSign,
  faSpinner,
  faHandHoldingDollar,
  faEye,
} from '@/app/components/Icon';
import StatCard from '@/app/components/StatCard';
import Modal from '@/app/components/Modal';
import { DashboardSkeleton, InventoryTabSkeleton, FinanceTabSkeleton, LoansTabSkeleton } from '@/app/components/SkeletonLoader';
import CreateSaleForm from '../sales/CreateSaleForm';
import CreateCollectionForm from '../collections/CreateCollectionForm';
import CreateCustomerForm from '../customers/CreateCustomerForm';
import CreateSupplierForm from '../suppliers/CreateSupplierForm';
import CreateInventoryForm from '../inventory/CreateInventoryForm';
import dynamic from 'next/dynamic';
import MccManagerDashboardSection from '@/app/components/manager/MccManagerDashboardSection';
import VeterinaryQualityStrip from '@/app/components/VeterinaryQualityStrip';
import VeterinaryQualityDesk from '@/app/components/VeterinaryQualityDesk';
import { MCC_OPERATIONS_SUB_PANELS } from '@/lib/config/nav.config';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const BLUE_ICON = { iconBgColor: '#eff6ff', iconColor: 'var(--primary)' };
const GREEN_ICON = { iconBgColor: '#dcfce7', iconColor: '#059669' };
const PURPLE_ICON = { iconBgColor: '#f3e8ff', iconColor: '#7c3aed' };

type PeriodKey = 'day' | 'month' | 'week' | 'quarter' | 'year' | 'custom';

function toYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getPeriodRange(period: PeriodKey, customFrom?: string, customTo?: string): { date_from: string; date_to: string } {
  const now = new Date();
  if (period === 'custom' && customFrom && customTo) {
    return { date_from: customFrom, date_to: customTo };
  }
  let start: Date;
  let end: Date;
  switch (period) {
    case 'day':
      /** Local calendar day: 00:00–23:59:59 (represented as one YYYY-MM-DD for the API). */
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'week': {
      /** Calendar week Monday–Sunday (local). */
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dow = today.getDay();
      const mondayOffset = dow === 0 ? -6 : 1 - dow;
      start = new Date(today);
      start.setDate(today.getDate() + mondayOffset);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      break;
    }
    case 'quarter': {
      const q = Math.ceil((now.getMonth() + 1) / 3);
      start = new Date(now.getFullYear(), (q - 1) * 3, 1);
      end = new Date(now.getFullYear(), q * 3, 0);
      break;
    }
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date();
  }
  return { date_from: toYYYYMMDD(start), date_to: toYYYYMMDD(end) };
}

export default function Dashboard() {
  const { currentAccount } = useAuthStore();
  const { hasPermission, hasAnyPermission } = usePermission();
  const accountType = currentAccount?.account_type ?? '';
  const role = (currentAccount?.role ?? '').toLowerCase();
  const isVeterinaryRole = ['veterinary', 'veterinarian', 'veternary', 'agent', 'veterinary_officer'].includes(role);
  // Login `account_type` is Prisma Account.type (tenant | branch | admin), not User.account_type (mcc).
  const orgType = (accountType ?? '').toLowerCase();
  const showMccOpsDashboard =
    (orgType === 'tenant' || orgType === 'branch' || orgType === 'mcc') &&
    hasAnyPermission(['mcc_view_operations', 'mcc_view_own_operations', 'view_collections']);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewResponse['data'] | null>(null);
  const [error, setError] = useState('');
  const [chartTab, setChartTab] = useState<'value' | 'volume'>('value');
  const [period, setPeriod] = useState<PeriodKey>('day');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  type QuickActionModal = 'sale' | 'collection' | 'customer' | 'supplier' | 'inventory' | 'transaction' | null;
  const [quickActionModal, setQuickActionModal] = useState<QuickActionModal>(null);
  const [recordType, setRecordType] = useState<'revenue' | 'expense'>('revenue');
  const [recordAmount, setRecordAmount] = useState('');
  const [recordDescription, setRecordDescription] = useState('');
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recordSubmitting, setRecordSubmitting] = useState(false);

  type DashboardTab =
    | 'overview'
    | 'quality'
    | 'operations'
    | 'sales'
    | 'collections'
    | 'inventory'
    | 'finance'
    | 'loans';
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('overview');
  const [inventoryStats, setInventoryStats] = useState<InventoryStats | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryValuationSeries, setInventoryValuationSeries] = useState<ValuationOverTimePoint[]>([]);
  const [inventoryTopByValue, setInventoryTopByValue] = useState<TopItemByValue[]>([]);
  const [inventoryStockMovement, setInventoryStockMovement] = useState<StockMovementPoint[]>([]);
  const [financeData, setFinanceData] = useState<{
    income: { revenue: number; expenses: number; net_income: number } | null;
    receivables: number;
    payables: number;
    receivablesAging: { current: number; days_31_60: number; days_61_90: number; days_90_plus: number } | null;
    payablesAging: { current: number; days_31_60: number; days_61_90: number; days_90_plus: number } | null;
  }>({ income: null, receivables: 0, payables: 0, receivablesAging: null, payablesAging: null });
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeRevenueExpensesSeries, setFinanceRevenueExpensesSeries] = useState<{ date: string; revenue: number; expenses: number }[]>([]);
  const [financeExpenseByCategory, setFinanceExpenseByCategory] = useState<{ category_name: string; amount: number }[]>([]);
  const [loansData, setLoansData] = useState<Loan[]>([]);
  const [loansLoading, setLoansLoading] = useState(false);
  const [managerToday, setManagerToday] = useState<OverviewResponse['data'] | null>(null);
  const [managerLast7, setManagerLast7] = useState<OverviewResponse['data'] | null>(null);
  const [managerOpsLoading, setManagerOpsLoading] = useState(false);

  const dateRange = useMemo(
    () => getPeriodRange(period, customFrom || undefined, customTo || undefined),
    [period, customFrom, customTo],
  );

  const canViewSales = hasPermission('view_sales');
  const canViewCollections = hasPermission('view_collections');
  const canViewInventory = hasPermission('view_inventory');
  const canViewAnalytics = hasPermission('view_analytics');
  const canCreateSales = hasPermission('create_sales');
  const canCreateCollections = hasPermission('create_collections');
  const canCreateSuppliers = hasPermission('create_suppliers');
  const canCreateCustomers = hasPermission('create_customers');
  const canManageInventory = hasPermission('manage_inventory');
  const showVetQualityStrip =
    isVeterinaryRole && showMccOpsDashboard && Boolean(currentAccount?.account_id);

  const tabs: { id: DashboardTab; label: string }[] = useMemo(() => {
    if (isVeterinaryRole) {
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'quality', label: 'Quality desk' },
        { id: 'inventory', label: 'Inventory' },
      ];
    }
    const available: { id: DashboardTab; label: string }[] = [{ id: 'overview', label: 'Overview' }];
    if (showMccOpsDashboard) available.push({ id: 'operations', label: 'Operations' });
    if (canViewSales) available.push({ id: 'sales', label: 'Sales' });
    if (canViewCollections) available.push({ id: 'collections', label: 'Collections' });
    if (canViewInventory) available.push({ id: 'inventory', label: 'Inventory' });
    if (canViewAnalytics) {
      available.push({ id: 'finance', label: 'Finance' });
      available.push({ id: 'loans', label: 'Loans' });
    }
    return available;
  }, [
    showMccOpsDashboard,
    canViewSales,
    canViewCollections,
    canViewInventory,
    canViewAnalytics,
    isVeterinaryRole,
  ]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === dashboardTab)) {
      setDashboardTab(tabs[0].id);
    }
  }, [dashboardTab, tabs]);

  // Redraw chart when tab becomes visible (charts in hidden container may render at 0 size)
  useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    return () => clearTimeout(t);
  }, [chartTab, dashboardTab]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    statsApi
      .getOverview(currentAccount?.account_id, {
        date_from: dateRange.date_from,
        date_to: dateRange.date_to,
      })
      .then((res) => {
        if (cancelled) return;
        if (res.code === 200 && res.data) setOverview(res.data);
        else setError('Failed to load dashboard');
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg =
            (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
            (err as { message?: string })?.message ||
            'Failed to load dashboard';
          setError(msg);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountType, currentAccount?.account_id, dateRange.date_from, dateRange.date_to, refreshKey]);

  // MCC manager panel data — loaded only on Operations tab (not shown on Overview)
  useEffect(() => {
    if (!showMccOpsDashboard || !currentAccount?.account_id || dashboardTab !== 'operations') {
      return;
    }
    let cancelled = false;
    const from = dateRange.date_from;
    const to = dateRange.date_to;
    const endLocal = new Date(
      Number(to.slice(0, 4)),
      Number(to.slice(5, 7)) - 1,
      Number(to.slice(8, 10)),
    );
    const start7 = new Date(endLocal);
    start7.setDate(endLocal.getDate() - 6);
    const from7 = toYYYYMMDD(start7);
    const to7 = to;
    setManagerOpsLoading(true);
    Promise.all([
      statsApi.getOverview(currentAccount.account_id, { date_from: from, date_to: to }),
      statsApi.getOverview(currentAccount.account_id, { date_from: from7, date_to: to7 }),
    ])
      .then(([d0, d7]) => {
        if (cancelled) return;
        if (d0.code === 200 && d0.data) setManagerToday(d0.data);
        else setManagerToday(null);
        if (d7.code === 200 && d7.data) setManagerLast7(d7.data);
        else setManagerLast7(null);
      })
      .catch(() => {
        if (!cancelled) {
          setManagerToday(null);
          setManagerLast7(null);
        }
      })
      .finally(() => {
        if (!cancelled) setManagerOpsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    showMccOpsDashboard,
    currentAccount?.account_id,
    dashboardTab,
    dateRange.date_from,
    dateRange.date_to,
    refreshKey,
  ]);

  useEffect(() => {
    setManagerToday(null);
    setManagerLast7(null);
  }, [currentAccount?.account_id]);

  // Load inventory stats and chart data when Inventory tab is selected
  useEffect(() => {
    if (dashboardTab !== 'inventory' || !currentAccount?.account_id) return;
    let cancelled = false;
    setInventoryLoading(true);
    const from = dateRange.date_from;
    const to = dateRange.date_to;
    Promise.all([
      inventoryApi.getInventoryStats(currentAccount.account_id),
      inventoryApi.getValuationOverTime(from, to, currentAccount.account_id),
      inventoryApi.getTopByValue(10, currentAccount.account_id),
      inventoryApi.getStockMovement(from, to, currentAccount.account_id),
    ])
      .then(([statsRes, valRes, topRes, movRes]) => {
        if (cancelled) return;
        if (statsRes.code === 200 && statsRes.data) setInventoryStats(statsRes.data);
        if (valRes.code === 200 && valRes.data?.series) setInventoryValuationSeries(valRes.data.series);
        if (topRes.code === 200 && topRes.data?.items) setInventoryTopByValue(topRes.data.items);
        if (movRes.code === 200 && movRes.data?.series) setInventoryStockMovement(movRes.data.series);
      })
      .catch(() => {
        if (!cancelled) setInventoryStats(null);
        if (!cancelled) setInventoryValuationSeries([]);
        if (!cancelled) setInventoryTopByValue([]);
        if (!cancelled) setInventoryStockMovement([]);
      })
      .finally(() => { if (!cancelled) setInventoryLoading(false); });
    return () => { cancelled = true; };
  }, [dashboardTab, currentAccount?.account_id, dateRange.date_from, dateRange.date_to]);

  // Load finance summary when Finance tab is selected
  useEffect(() => {
    if (dashboardTab !== 'finance' || !currentAccount?.account_id) return;
    let cancelled = false;
    setFinanceLoading(true);
    const from = dateRange.date_from;
    const to = dateRange.date_to;
    Promise.all([
      accountingApi.getIncomeStatement(from, to),
      accountingApi.getReceivables(),
      accountingApi.getPayables(),
      accountingApi.getRevenueExpensesOverTime(from, to),
      accountingApi.getExpenseByCategory(from, to),
    ])
      .then(([income, recv, pay, revExp, expCat]) => {
        if (cancelled) return;
        setFinanceData({
          income: { revenue: income.revenue, expenses: income.expenses, net_income: income.net_income },
          receivables: recv.total_receivables ?? 0,
          payables: pay.total_payables ?? 0,
          receivablesAging: recv.aging_summary ?? null,
          payablesAging: pay.aging_summary ?? null,
        });
        setFinanceRevenueExpensesSeries(revExp?.series ?? []);
        setFinanceExpenseByCategory(expCat?.series ?? []);
      })
      .catch(() => {
        if (!cancelled) setFinanceData({ income: null, receivables: 0, payables: 0, receivablesAging: null, payablesAging: null });
        if (!cancelled) setFinanceRevenueExpensesSeries([]);
        if (!cancelled) setFinanceExpenseByCategory([]);
      })
      .finally(() => { if (!cancelled) setFinanceLoading(false); });
    return () => { cancelled = true; };
  }, [dashboardTab, currentAccount?.account_id, dateRange.date_from, dateRange.date_to]);

  // Load loans when Loans tab is selected
  useEffect(() => {
    if (dashboardTab !== 'loans' || !currentAccount?.account_id) return;
    let cancelled = false;
    setLoansLoading(true);
    loansApi
      .getLoans({ account_id: currentAccount.account_id })
      .then((res) => {
        if (!cancelled && res.code === 200 && res.data) setLoansData(Array.isArray(res.data) ? res.data : []);
        else if (!cancelled) setLoansData([]);
      })
      .catch(() => {
        if (!cancelled) setLoansData([]);
      })
      .finally(() => {
        if (!cancelled) setLoansLoading(false);
      });
    return () => { cancelled = true; };
  }, [dashboardTab, currentAccount?.account_id]);

  const formatCurrency = (amount: number) => {
    const n = Number(amount);
    if (Number.isNaN(n)) return 'RF 0';
    return `RF ${new Intl.NumberFormat('en-RW', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)}`;
  };

  /** Normalize aging summary from API (may use snake_case or mixed types) to numbers for charts. */
  const agingToNumbers = (aging: Record<string, unknown> | null): [number, number, number, number] => {
    if (!aging || typeof aging !== 'object') return [0, 0, 0, 0];
    return [
      Number(aging.current) || 0,
      Number(aging.days_31_60) || 0,
      Number(aging.days_61_90) || 0,
      Number(aging.days_90_plus) || 0,
    ];
  };

  const closeQuickActionAndRefresh = () => {
    setQuickActionModal(null);
    setRefreshKey((k) => k + 1);
  };

  const handleRecordTransactionSubmit = async () => {
    const amount = Number(recordAmount);
    if (!recordDescription.trim() || Number.isNaN(amount) || amount <= 0) {
      useToastStore.getState().error('Enter a valid amount and description');
      return;
    }
    setRecordSubmitting(true);
    try {
      await accountingApi.createTransaction({
        type: recordType,
        amount,
        description: recordDescription.trim(),
        transaction_date: recordDate,
      });
      useToastStore.getState().success(`${recordType === 'revenue' ? 'Revenue' : 'Expense'} recorded`);
      setQuickActionModal(null);
      setRecordAmount('');
      setRecordDescription('');
      setRecordDate(new Date().toISOString().slice(0, 10));
      setRefreshKey((k) => k + 1);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ??
        (e as Error)?.message ??
        'Failed to record';
      useToastStore.getState().error(msg);
    } finally {
      setRecordSubmitting(false);
    }
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-sm p-4">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!overview) return null;

  const { summary, breakdown, recent_transactions } = overview;
  const hasBreakdown = breakdown.length > 0;
  const lastN = 14;
  const breakdownSlice = breakdown.slice(-lastN);

  const periodLabel =
    period === 'custom'
      ? customFrom && customTo
        ? `${customFrom} – ${customTo}`
        : 'Custom range'
      : `${dateRange.date_from} – ${dateRange.date_to}`;

  return (
    <div className="-mt-1 space-y-4">
      {/* Header: tab row — Overview, Operations (MCC), Sales, … — plus period */}
      <div className="mb-3 pb-3 border-b-2 border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-1 min-w-0 gap-1 overflow-x-auto">
            {tabs.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setDashboardTab(id)}
                className={`
                  flex items-center gap-1.5 py-2 px-4 rounded-t border-b-2 border-transparent
                  text-[13px] font-medium whitespace-nowrap transition-all duration-200
                  ${dashboardTab === id
                    ? 'text-[var(--primary)] border-b-2 border-[var(--primary)] bg-[var(--primary)]/5 font-semibold'
                    : 'text-gray-500 border-b-2 border-transparent bg-transparent hover:text-[var(--primary)] hover:bg-[var(--primary)]/5'
                  }
                `}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative flex-shrink-0">
            <select
              value={period}
              onChange={(e) => {
                const v = e.target.value as PeriodKey;
                setPeriod(v);
                if (v === 'custom' && !customFrom && !customTo) {
                  const n = new Date();
                  setCustomFrom(toYYYYMMDD(new Date(n.getFullYear(), n.getMonth(), 1)));
                  setCustomTo(toYYYYMMDD(n));
                }
              }}
              title={periodLabel}
              className="min-w-0 w-[120px] border border-gray-300 rounded py-0.5 pl-1.5 pr-6 text-xs text-gray-900 bg-white focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
            >
              <option value="day">Day</option>
              <option value="month">Month</option>
              <option value="week">Week</option>
              <option value="quarter">Quarter</option>
              <option value="year">Year</option>
              <option value="custom">Custom</option>
            </select>
            {period === 'custom' && (
              <div className="absolute top-full right-0 z-10 mt-0.5 py-1.5 px-1.5 bg-white border border-gray-200 rounded shadow-lg flex items-center gap-1.5">
                <input
                  type="date"
                  value={customFrom}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-28"
                />
                <span className="text-gray-400 text-[10px]">–</span>
                <input
                  type="date"
                  value={customTo}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-28"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overview — business snapshot: totals, trends, quick actions (all accounts including MCC) */}
      {dashboardTab === 'quality' &&
        showVetQualityStrip &&
        currentAccount?.account_id && (
          <VeterinaryQualityDesk
            accountId={currentAccount.account_id}
            dateFrom={dateRange.date_from}
            dateTo={dateRange.date_to}
          />
        )}

      {dashboardTab === 'overview' && (
        <>
      {showVetQualityStrip && currentAccount?.account_id ? (
        <VeterinaryQualityStrip
          accountId={currentAccount.account_id}
          dateFrom={dateRange.date_from}
          dateTo={dateRange.date_to}
        />
      ) : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Sales"
          value={formatCurrency(summary.sales.value)}
          subtitle={`${summary.sales.transactions} transactions · ${summary.sales.liters.toFixed(1)} L`}
          icon={faReceipt}
          href="/sales"
          {...GREEN_ICON}
        />
        <StatCard
          label="Total Collections"
          value={formatCurrency(summary.collection.value)}
          subtitle={`${summary.collection.transactions} transactions · ${summary.collection.liters.toFixed(1)} L`}
          icon={faBox}
          href="/collections"
          {...BLUE_ICON}
        />
        <StatCard
          label="Suppliers"
          value={summary.suppliers.active + summary.suppliers.inactive}
          subtitle={`${summary.suppliers.active} active, ${summary.suppliers.inactive} inactive`}
          icon={faBuilding}
          href="/suppliers"
          {...BLUE_ICON}
        />
        <StatCard
          label="Customers"
          value={summary.customers.active + summary.customers.inactive}
          subtitle={`${summary.customers.active} active, ${summary.customers.inactive} inactive`}
          icon={faStore}
          href="/customers"
          {...PURPLE_ICON}
        />
      </div>

      {/* Charts row: tabbed Value/Volume + donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-sm p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h3 className="text-base font-semibold text-gray-900">Sales vs Collections</h3>
            <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
              <button
                type="button"
                onClick={() => setChartTab('value')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  chartTab === 'value'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Value
              </button>
              <button
                type="button"
                onClick={() => setChartTab('volume')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  chartTab === 'volume'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Volume (L)
              </button>
            </div>
          </div>
          {!hasBreakdown ? (
            <div className="h-[280px] flex items-center justify-center text-gray-500 text-sm">
              No time series data yet.
            </div>
          ) : (
            <>
              <div className={chartTab === 'value' ? 'block' : 'hidden'}>
                <Chart
                  type="area"
                  height={280}
                  options={{
                    chart: { type: 'area', toolbar: { show: false }, zoom: { enabled: false } },
                    stroke: { curve: 'smooth', width: 2 },
                    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0.2, stops: [0, 90, 100] } },
                    colors: ['#059669', '#004AAD'],
                    xaxis: { categories: breakdownSlice.map((d) => d.date) },
                    yaxis: { labels: { formatter: (v: number) => formatCurrency(v) } },
                    tooltip: { y: { formatter: (v: number) => formatCurrency(v) } },
                    dataLabels: { enabled: false },
                    grid: { strokeDashArray: 3 },
                    legend: { position: 'top' },
                  }}
                  series={[
                    { name: 'Sales', data: breakdownSlice.map((d) => d.sales.value) },
                    { name: 'Collections', data: breakdownSlice.map((d) => d.collection.value) },
                  ]}
                />
              </div>
              <div className={chartTab === 'volume' ? 'block' : 'hidden'}>
                <Chart
                  type="bar"
                  height={280}
                  options={{
                    chart: { type: 'bar', toolbar: { show: false } },
                    plotOptions: { bar: { borderRadius: 6, columnWidth: '70%', distributed: false } },
                    colors: ['#059669', '#004AAD'],
                    xaxis: { categories: breakdownSlice.map((d) => d.date), labels: { rotate: -45, rotateAlways: true } },
                    yaxis: { title: { text: 'Liters' }, labels: { formatter: (v: number) => String(Math.round(v)) } },
                    dataLabels: { enabled: false },
                    grid: { strokeDashArray: 3 },
                    tooltip: { y: { formatter: (v: number) => `${v} L` } },
                    legend: { position: 'top' },
                  }}
                  series={[
                    { name: 'Sales (L)', data: breakdownSlice.map((d) => d.sales.liters) },
                    { name: 'Collections (L)', data: breakdownSlice.map((d) => d.collection.liters) },
                  ]}
                />
              </div>
            </>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-sm p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Split by value</h3>
          {summary.sales.value === 0 && summary.collection.value === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-gray-500 text-sm">
              No data yet.
            </div>
          ) : (
            <Chart
              type="donut"
              height={280}
              options={{
                chart: { type: 'donut', fontFamily: 'inherit' },
                labels: ['Sales', 'Collections'],
                colors: ['#059669', '#004AAD'],
                legend: { position: 'bottom', fontSize: '12px' },
                dataLabels: { formatter: (val: number) => `${Math.round(val)}%` },
                plotOptions: {
                  pie: {
                    donut: {
                      size: '65%',
                      labels: {
                        show: true,
                        total: {
                          show: true,
                          label: 'Total',
                          formatter: () => formatCurrency(summary.sales.value + summary.collection.value),
                        },
                      },
                    },
                  },
                },
              }}
              series={[summary.sales.value, summary.collection.value]}
            />
          )}
        </div>
      </div>

      {/* Recent transactions + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-sm">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Icon icon={faReceipt} className="text-[var(--primary)]" size="sm" />
              Recent Transactions
            </h3>
            <Link href="/sales" className="text-xs text-[var(--primary)] hover:text-[#003d8f] flex items-center gap-1">
              View All
              <Icon icon={faArrowRight} size="xs" />
            </Link>
          </div>
          <div className="p-4">
            {recent_transactions.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">No recent transactions.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-medium text-gray-700">Date</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">Type</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">Party</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-700">Qty</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-700">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent_transactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3 text-gray-600">
                          {new Date(tx.transaction_at).toLocaleDateString()}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={
                              tx.type === 'sale'
                                ? 'text-green-700 font-medium'
                                : 'text-[var(--primary)] font-medium'
                            }
                          >
                            {tx.type === 'sale' ? 'Sale' : 'Collection'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-gray-900">
                          {tx.type === 'sale'
                            ? tx.customer_account?.name ?? tx.customer_account?.code ?? '—'
                            : tx.supplier_account?.name ?? tx.supplier_account?.code ?? '—'}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-600">{tx.quantity} L</td>
                        <td className="py-2 px-3 text-right font-medium text-gray-900">
                          {formatCurrency(tx.total_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Icon icon={faPlus} className="text-[var(--primary)]" size="sm" />
              Quick Actions
            </h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {canCreateSales && (
                <button
                  type="button"
                  onClick={() => setQuickActionModal('sale')}
                  className="group flex flex-col items-center justify-center gap-2.5 rounded-sm border border-[var(--primary)] bg-[var(--primary)]/5 p-5 text-center transition-colors hover:bg-[var(--primary)] hover:text-white"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-sm bg-[var(--primary)] text-white group-hover:bg-white group-hover:text-[var(--primary)] transition-colors">
                    <Icon icon={faReceipt} size="lg" />
                  </span>
                  <span className="text-sm font-semibold text-gray-900 group-hover:text-white transition-colors">New Sale</span>
                </button>
              )}
              {canCreateCollections && (
                <button
                  type="button"
                  onClick={() => setQuickActionModal('collection')}
                  className="group flex flex-col items-center justify-center gap-2.5 rounded-sm border border-gray-200 bg-white p-5 text-center transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary)]/5"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-sm bg-gray-100 text-gray-600 group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">
                    <Icon icon={faBox} size="lg" />
                  </span>
                  <span className="text-sm font-semibold text-gray-900">New Collection</span>
                </button>
              )}
              {canCreateSuppliers && (
                <button
                  type="button"
                  onClick={() => setQuickActionModal('supplier')}
                  className="group flex flex-col items-center justify-center gap-2.5 rounded-sm border border-gray-200 bg-white p-5 text-center transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary)]/5"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-sm bg-gray-100 text-gray-600 group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">
                    <Icon icon={faBuilding} size="lg" />
                  </span>
                  <span className="text-sm font-semibold text-gray-900">Add Supplier</span>
                </button>
              )}
              {canCreateCustomers && (
                <button
                  type="button"
                  onClick={() => setQuickActionModal('customer')}
                  className="group flex flex-col items-center justify-center gap-2.5 rounded-sm border border-gray-200 bg-white p-5 text-center transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary)]/5"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-sm bg-gray-100 text-gray-600 group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">
                    <Icon icon={faStore} size="lg" />
                  </span>
                  <span className="text-sm font-semibold text-gray-900">Add Customer</span>
                </button>
              )}
              {canManageInventory && (
                <button
                  type="button"
                  onClick={() => setQuickActionModal('inventory')}
                  className="group flex flex-col items-center justify-center gap-2.5 rounded-sm border border-gray-200 bg-white p-5 text-center transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary)]/5"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-sm bg-gray-100 text-gray-600 group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">
                    <Icon icon={faWarehouse} size="lg" />
                  </span>
                  <span className="text-sm font-semibold text-gray-900">Add Inventory</span>
                </button>
              )}
              {canViewAnalytics && (
                <button
                  type="button"
                  onClick={() => setQuickActionModal('transaction')}
                  className="group flex flex-col items-center justify-center gap-2.5 rounded-sm border border-gray-200 bg-white p-5 text-center transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary)]/5"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-sm bg-gray-100 text-gray-600 group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">
                    <Icon icon={faChartLine} size="lg" />
                  </span>
                  <span className="text-sm font-semibold text-gray-900">Record Transaction</span>
                </button>
              )}
              {canViewAnalytics && (
                <Link
                  href="/payroll"
                  className="group flex flex-col items-center justify-center gap-2.5 rounded-sm border border-gray-200 bg-white p-5 text-center transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 no-underline"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-sm bg-gray-100 text-gray-600 group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">
                    <Icon icon={faClipboardList} size="lg" />
                  </span>
                  <span className="text-sm font-semibold text-gray-900">Payroll</span>
                </Link>
              )}
              {canViewAnalytics && (
                <Link
                  href="/finance"
                  className="group flex flex-col items-center justify-center gap-2.5 rounded-sm border border-gray-200 bg-white p-5 text-center transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 no-underline"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-sm bg-gray-100 text-gray-600 group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">
                    <Icon icon={faChartLine} size="lg" />
                  </span>
                  <span className="text-sm font-semibold text-gray-900">Finance</span>
                </Link>
              )}
              {canViewAnalytics && role !== 'accountant' && (
                <Link
                  href="/accounts"
                  className="group flex flex-col items-center justify-center gap-2.5 rounded-sm border border-gray-200 bg-white p-5 text-center transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 no-underline"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-sm bg-gray-100 text-gray-600 group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">
                    <Icon icon={faDollarSign} size="lg" />
                  </span>
                  <span className="text-sm font-semibold text-gray-900">Accounts</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
        </>
      )}

      {/* Operations — MCC control room + links to full work-area screens */}
      {dashboardTab === 'operations' && showMccOpsDashboard && currentAccount?.account_id && (
        <div className="space-y-6">
          <MccManagerDashboardSection
            accountId={currentAccount.account_id}
            today={managerToday}
            last7={managerLast7}
            loading={managerOpsLoading}
            refreshKey={refreshKey}
            periodKey={period}
            rangeDateFrom={dateRange.date_from}
            rangeDateTo={dateRange.date_to}
          />
          <div>
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Work areas</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {MCC_OPERATIONS_SUB_PANELS.filter(
                (p) => !p.requiresAnyPermission?.length || hasAnyPermission(p.requiresAnyPermission),
              ).map(({ href, label, description }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex flex-col rounded-sm border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 no-underline"
                >
                  <span className="text-base font-semibold text-gray-900 group-hover:text-[var(--primary)]">
                    {label}
                  </span>
                  <span className="text-sm text-gray-600 mt-2 flex-1">{description}</span>
                  <span className="text-xs font-medium text-[var(--primary)] mt-3 inline-flex items-center gap-1">
                    Open
                    <Icon icon={faArrowRight} size="xs" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sales tab */}
      {dashboardTab === 'sales' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Sales value" value={formatCurrency(summary.sales.value)} subtitle={`${periodLabel}`} icon={faReceipt} href="/sales" {...GREEN_ICON} />
            <StatCard label="Volume (L)" value={summary.sales.liters.toFixed(1)} subtitle={`${summary.sales.transactions} transactions`} icon={faBox} href="/sales" {...BLUE_ICON} />
            <StatCard label="Transactions" value={String(summary.sales.transactions)} subtitle="Milk sales" icon={faReceipt} href="/sales" {...GREEN_ICON} />
          </div>
          <div className="bg-white border border-gray-200 rounded-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Sales over time</h3>
            {!hasBreakdown ? (
              <div className="h-[280px] flex items-center justify-center text-gray-500 text-sm">No time series data yet.</div>
            ) : (
              <Chart
                type="area"
                height={280}
                options={{
                  chart: { type: 'area', toolbar: { show: false }, zoom: { enabled: false } },
                  stroke: { curve: 'smooth', width: 2 },
                  fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0.2, stops: [0, 90, 100] } },
                  colors: ['#059669'],
                  xaxis: { categories: breakdownSlice.map((d) => d.date) },
                  yaxis: { labels: { formatter: (v: number) => formatCurrency(v) } },
                  tooltip: { y: { formatter: (v: number) => formatCurrency(v) } },
                  dataLabels: { enabled: false },
                  grid: { strokeDashArray: 3 },
                }}
                series={[{ name: 'Sales', data: breakdownSlice.map((d) => d.sales.value) }]}
              />
            )}
          </div>
          <div className="bg-white border border-gray-200 rounded-sm">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Recent sales</h3>
              <Link href="/sales" className="text-xs text-[var(--primary)] hover:text-[#003d8f] flex items-center gap-1">View All <Icon icon={faArrowRight} size="xs" /></Link>
            </div>
            <div className="p-4">
              {recent_transactions.filter((t) => t.type === 'sale').length === 0 ? (
                <p className="text-sm text-gray-500 py-4">No recent sales.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 font-medium text-gray-700">Date</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-700">Customer</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-700">Qty</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-700">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent_transactions.filter((t) => t.type === 'sale').map((tx) => (
                        <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-3 text-gray-600">{new Date(tx.transaction_at).toLocaleDateString()}</td>
                          <td className="py-2 px-3 text-gray-900">{tx.customer_account?.name ?? tx.customer_account?.code ?? '—'}</td>
                          <td className="py-2 px-3 text-right text-gray-600">{tx.quantity} L</td>
                          <td className="py-2 px-3 text-right font-medium text-gray-900">{formatCurrency(tx.total_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Collections tab */}
      {dashboardTab === 'collections' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Collections value" value={formatCurrency(summary.collection.value)} subtitle={periodLabel} icon={faBox} href="/collections" {...BLUE_ICON} />
            <StatCard label="Volume (L)" value={summary.collection.liters.toFixed(1)} subtitle={`${summary.collection.transactions} transactions`} icon={faBox} href="/collections" {...BLUE_ICON} />
            <StatCard label="Transactions" value={String(summary.collection.transactions)} subtitle="Milk collections" icon={faReceipt} href="/collections" {...BLUE_ICON} />
          </div>
          <div className="bg-white border border-gray-200 rounded-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Collections over time</h3>
            {!hasBreakdown ? (
              <div className="h-[280px] flex items-center justify-center text-gray-500 text-sm">No time series data yet.</div>
            ) : (
              <Chart
                type="area"
                height={280}
                options={{
                  chart: { type: 'area', toolbar: { show: false }, zoom: { enabled: false } },
                  stroke: { curve: 'smooth', width: 2 },
                  fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0.2, stops: [0, 90, 100] } },
                  colors: ['#004AAD'],
                  xaxis: { categories: breakdownSlice.map((d) => d.date) },
                  yaxis: { labels: { formatter: (v: number) => formatCurrency(v) } },
                  tooltip: { y: { formatter: (v: number) => formatCurrency(v) } },
                  dataLabels: { enabled: false },
                  grid: { strokeDashArray: 3 },
                }}
                series={[{ name: 'Collections', data: breakdownSlice.map((d) => d.collection.value) }]}
              />
            )}
          </div>
          <div className="bg-white border border-gray-200 rounded-sm">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Recent collections</h3>
              <Link href="/collections" className="text-xs text-[var(--primary)] hover:text-[#003d8f] flex items-center gap-1">View All <Icon icon={faArrowRight} size="xs" /></Link>
            </div>
            <div className="p-4">
              {recent_transactions.filter((t) => t.type === 'collection').length === 0 ? (
                <p className="text-sm text-gray-500 py-4">No recent collections.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 font-medium text-gray-700">Date</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-700">Supplier</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-700">Qty</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-700">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent_transactions.filter((t) => t.type === 'collection').map((tx) => (
                        <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-3 text-gray-600">{new Date(tx.transaction_at).toLocaleDateString()}</td>
                          <td className="py-2 px-3 text-gray-900">{tx.supplier_account?.name ?? tx.supplier_account?.code ?? '—'}</td>
                          <td className="py-2 px-3 text-right text-gray-600">{tx.quantity} L</td>
                          <td className="py-2 px-3 text-right font-medium text-gray-900">{formatCurrency(tx.total_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inventory tab */}
      {dashboardTab === 'inventory' && (
        <div className="space-y-4">
          {inventoryLoading ? (
            <InventoryTabSkeleton />
          ) : inventoryStats ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total items" value={String(inventoryStats.total_items)} subtitle="All inventory" icon={faWarehouse} href="/inventory" {...BLUE_ICON} />
                <StatCard label="Active" value={String(inventoryStats.active_items)} subtitle="Listed" icon={faBox} href="/inventory" {...GREEN_ICON} />
                <StatCard label="Out of stock" value={String(inventoryStats.out_of_stock_items)} subtitle="Need restock" icon={faWarehouse} href="/inventory" {...(inventoryStats.out_of_stock_items > 0 ? { iconBgColor: '#fef2f2', iconColor: '#b91c1c' } : BLUE_ICON)} />
                <StatCard label="Low stock" value={String(inventoryStats.low_stock_items)} subtitle="Below minimum" icon={faWarehouse} href="/inventory" {...(inventoryStats.low_stock_items > 0 ? { iconBgColor: '#fef3c7', iconColor: '#b45309' } : BLUE_ICON)} />
              </div>
              {(inventoryStats.total_stock_value != null && inventoryStats.total_stock_value > 0) && (
                <div className="bg-white border border-gray-200 rounded-sm p-6">
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Stock value</h3>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(inventoryStats.total_stock_value)}</p>
                  {inventoryStats.total_stock_quantity != null && <p className="text-sm text-gray-500 mt-1">Total quantity: {inventoryStats.total_stock_quantity}</p>}
                </div>
              )}

              {/* Inventory charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-sm p-6">
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Items by status</h3>
                  {inventoryStats.total_items === 0 ? (
                    <div className="h-[260px] flex items-center justify-center text-gray-500 text-sm">No items yet.</div>
                  ) : (
                    <Chart
                      type="donut"
                      height={260}
                      options={{
                        chart: { type: 'donut', fontFamily: 'inherit' },
                        labels: ['Active', 'Out of stock', 'Low stock'],
                        colors: ['#059669', '#b91c1c', '#b45309'],
                        legend: { position: 'bottom', fontSize: '12px' },
                        dataLabels: { formatter: (val: number) => `${Math.round(val)}%` },
                      }}
                      series={[inventoryStats.active_items, inventoryStats.out_of_stock_items, inventoryStats.low_stock_items]}
                    />
                  )}
                </div>
                <div className="bg-white border border-gray-200 rounded-sm p-6">
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Stock value over time</h3>
                  {inventoryValuationSeries.length === 0 ? (
                    <div className="h-[260px] flex items-center justify-center text-gray-500 text-sm">No valuation data for this period.</div>
                  ) : (
                    <Chart
                      type="area"
                      height={260}
                      options={{
                        chart: { type: 'area', toolbar: { show: false }, zoom: { enabled: false } },
                        stroke: { curve: 'smooth', width: 2 },
                        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0.2, stops: [0, 90, 100] } },
                        colors: ['#004AAD'],
                        xaxis: { categories: inventoryValuationSeries.map((d) => d.date) },
                        yaxis: { labels: { formatter: (v: number) => formatCurrency(v) } },
                        tooltip: { y: { formatter: (v: number) => formatCurrency(v) } },
                        dataLabels: { enabled: false },
                        grid: { strokeDashArray: 3 },
                      }}
                      series={[{ name: 'Stock value', data: inventoryValuationSeries.map((d) => d.total_value) }]}
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-sm p-6">
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Stock movement (in / out)</h3>
                  {inventoryStockMovement.length === 0 ? (
                    <div className="h-[260px] flex items-center justify-center text-gray-500 text-sm">No movement data for this period.</div>
                  ) : (
                    <Chart
                      type="bar"
                      height={260}
                      options={{
                        chart: { type: 'bar', toolbar: { show: false } },
                        plotOptions: { bar: { borderRadius: 4, columnWidth: '70%', horizontal: false } },
                        colors: ['#059669', '#b91c1c'],
                        xaxis: { categories: inventoryStockMovement.map((d) => d.date) },
                        yaxis: { labels: { formatter: (v: number) => String(Math.round(v)) } },
                        dataLabels: { enabled: false },
                        grid: { strokeDashArray: 3 },
                        legend: { position: 'top' },
                      }}
                      series={[
                        { name: 'Stock in', data: inventoryStockMovement.map((d) => d.stock_in) },
                        { name: 'Stock out', data: inventoryStockMovement.map((d) => d.stock_out) },
                      ]}
                    />
                  )}
                </div>
                <div className="bg-white border border-gray-200 rounded-sm p-6">
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Top items by value</h3>
                  {inventoryTopByValue.length === 0 ? (
                    <div className="h-[260px] flex items-center justify-center text-gray-500 text-sm">No items.</div>
                  ) : (
                    <Chart
                      type="bar"
                      height={260}
                      options={{
                        chart: { type: 'bar', toolbar: { show: false } },
                        plotOptions: { bar: { borderRadius: 4, columnWidth: '60%', horizontal: true } },
                        colors: ['#004AAD'],
                        xaxis: {
                          categories: inventoryTopByValue.map((i) => (i.name.length > 25 ? i.name.slice(0, 25) + '…' : i.name)),
                          labels: { formatter: (v: number) => formatCurrency(v) },
                        },
                        yaxis: { labels: { maxWidth: 140 } },
                        tooltip: { y: { formatter: (v: number) => formatCurrency(v) } },
                        dataLabels: { enabled: false },
                        grid: { strokeDashArray: 3 },
                      }}
                      series={[{ name: 'Stock value', data: inventoryTopByValue.map((i) => i.stock_value) }]}
                    />
                  )}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-sm p-4 flex items-center justify-between">
                <span className="text-sm text-gray-600">Manage inventory</span>
                <Link href="/inventory" className="text-sm font-medium text-[var(--primary)] hover:text-[#003d8f] flex items-center gap-1">Go to Inventory <Icon icon={faArrowRight} size="xs" /></Link>
              </div>
            </>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-sm p-6 text-center text-gray-600">Unable to load inventory stats.</div>
          )}
        </div>
      )}

      {/* Finance tab */}
      {dashboardTab === 'finance' && (
        <div className="space-y-4">
          {financeLoading ? (
            <FinanceTabSkeleton />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {financeData.income && (
                  <>
                    <StatCard label="Revenue" value={formatCurrency(financeData.income.revenue)} subtitle={periodLabel} icon={faChartLine} href="/finance" {...GREEN_ICON} />
                    <StatCard label="Expenses" value={formatCurrency(financeData.income.expenses)} subtitle={periodLabel} icon={faDollarSign} href="/finance" {...{ iconBgColor: '#fef2f2', iconColor: '#b91c1c' }} />
                    <StatCard label="Net income" value={formatCurrency(financeData.income.net_income)} subtitle={periodLabel} icon={faChartLine} href="/finance" {...(financeData.income.net_income >= 0 ? GREEN_ICON : { iconBgColor: '#fef2f2', iconColor: '#b91c1c' })} />
                  </>
                )}
                <StatCard label="Receivables" value={formatCurrency(financeData.receivables)} subtitle="Outstanding" icon={faDollarSign} href="/finance/receivables" {...BLUE_ICON} />
                <StatCard label="Payables" value={formatCurrency(financeData.payables)} subtitle="Outstanding" icon={faDollarSign} href="/finance/payables" {...{ iconBgColor: '#fef2f2', iconColor: '#b91c1c' }} />
              </div>
              {financeData.income && (financeData.income.revenue > 0 || financeData.income.expenses > 0) && (
                <div className="bg-white border border-gray-200 rounded-sm p-6">
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Revenue vs expenses</h3>
                  <Chart
                    type="donut"
                    height={240}
                    options={{
                      chart: { type: 'donut', fontFamily: 'inherit' },
                      labels: ['Revenue', 'Expenses'],
                      colors: ['#059669', '#b91c1c'],
                      legend: { position: 'bottom' },
                      dataLabels: { formatter: (val: number) => `${Math.round(val)}%` },
                    }}
                    series={[financeData.income.revenue, financeData.income.expenses]}
                  />
                </div>
              )}

              {/* Finance charts: aging + placeholders */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-sm p-6">
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Receivables aging</h3>
                  {financeData.receivablesAging && (() => { const nums = agingToNumbers(financeData.receivablesAging as Record<string, unknown>); return nums[0] > 0 || nums[1] > 0 || nums[2] > 0 || nums[3] > 0; })() ? (
                    <Chart
                      type="bar"
                      height={260}
                      options={{
                        chart: { type: 'bar', toolbar: { show: false } },
                        plotOptions: { bar: { borderRadius: 4, columnWidth: '60%', horizontal: true } },
                        colors: ['#004AAD'],
                        xaxis: {
                          categories: ['Current', '31–60 days', '61–90 days', '90+ days'],
                          labels: { formatter: (v: string | number) => (typeof v === 'number' && !Number.isNaN(v) ? formatCurrency(v) : String(v)) },
                        },
                        yaxis: { labels: { formatter: (v: string | number) => (typeof v === 'number' && !Number.isNaN(v) ? formatCurrency(v) : String(v)) } },
                        tooltip: { y: { formatter: (v: number) => formatCurrency(Number(v)) } },
                        dataLabels: { enabled: false },
                        grid: { strokeDashArray: 3 },
                      }}
                      series={[{ name: 'Amount', data: agingToNumbers(financeData.receivablesAging as Record<string, unknown>) }]}
                    />
                  ) : (
                    <div className="h-[260px] flex items-center justify-center text-gray-500 text-sm">No receivables aging data.</div>
                  )}
                </div>
                <div className="bg-white border border-gray-200 rounded-sm p-6">
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Payables aging</h3>
                  {financeData.payablesAging && (() => { const nums = agingToNumbers(financeData.payablesAging as Record<string, unknown>); return nums[0] > 0 || nums[1] > 0 || nums[2] > 0 || nums[3] > 0; })() ? (
                    <Chart
                      type="bar"
                      height={260}
                      options={{
                        chart: { type: 'bar', toolbar: { show: false } },
                        plotOptions: { bar: { borderRadius: 4, columnWidth: '60%', horizontal: true } },
                        colors: ['#b91c1c'],
                        xaxis: {
                          categories: ['Current', '31–60 days', '61–90 days', '90+ days'],
                          labels: { formatter: (v: string | number) => (typeof v === 'number' && !Number.isNaN(v) ? formatCurrency(v) : String(v)) },
                        },
                        yaxis: { labels: { formatter: (v: string | number) => (typeof v === 'number' && !Number.isNaN(v) ? formatCurrency(v) : String(v)) } },
                        tooltip: { y: { formatter: (v: number) => formatCurrency(Number(v)) } },
                        dataLabels: { enabled: false },
                        grid: { strokeDashArray: 3 },
                      }}
                      series={[{ name: 'Amount', data: agingToNumbers(financeData.payablesAging as Record<string, unknown>) }]}
                    />
                  ) : (
                    <div className="h-[260px] flex items-center justify-center text-gray-500 text-sm">No payables aging data.</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-sm p-6">
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Revenue & expenses over time</h3>
                  {financeRevenueExpensesSeries.length === 0 ? (
                    <div className="h-[260px] flex items-center justify-center text-gray-500 text-sm">No data for this period.</div>
                  ) : (
                    <Chart
                      type="area"
                      height={260}
                      options={{
                        chart: { type: 'area', toolbar: { show: false }, zoom: { enabled: false } },
                        stroke: { curve: 'smooth', width: 2 },
                        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0.2, stops: [0, 90, 100] } },
                        colors: ['#059669', '#b91c1c'],
                        xaxis: { categories: financeRevenueExpensesSeries.map((d) => d.date) },
                        yaxis: { labels: { formatter: (v: number) => formatCurrency(v) } },
                        tooltip: { y: { formatter: (v: number) => formatCurrency(v) } },
                        dataLabels: { enabled: false },
                        grid: { strokeDashArray: 3 },
                        legend: { position: 'top' },
                      }}
                      series={[
                        { name: 'Revenue', data: financeRevenueExpensesSeries.map((d) => d.revenue) },
                        { name: 'Expenses', data: financeRevenueExpensesSeries.map((d) => d.expenses) },
                      ]}
                    />
                  )}
                </div>
                <div className="bg-white border border-gray-200 rounded-sm p-6">
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Expense by category</h3>
                  {financeExpenseByCategory.length === 0 ? (
                    <div className="h-[260px] flex items-center justify-center text-gray-500 text-sm">No expense data for this period.</div>
                  ) : (
                    <Chart
                      type="donut"
                      height={260}
                      options={{
                        chart: { type: 'donut', fontFamily: 'inherit' },
                        labels: financeExpenseByCategory.map((c) => c.category_name),
                        colors: ['#b91c1c', '#dc2626', '#ef4444', '#f87171', '#fca5a5'],
                        legend: { position: 'bottom', fontSize: '12px' },
                        dataLabels: { formatter: (val: number) => `${Math.round(val)}%` },
                      }}
                      series={financeExpenseByCategory.map((c) => c.amount)}
                    />
                  )}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-sm p-4 flex items-center justify-between">
                <span className="text-sm text-gray-600">Full reports & transactions</span>
                <Link href="/finance" className="text-sm font-medium text-[var(--primary)] hover:text-[#003d8f] flex items-center gap-1">Go to Finance <Icon icon={faArrowRight} size="xs" /></Link>
              </div>
            </>
          )}
        </div>
      )}

      {/* Loans tab */}
      {dashboardTab === 'loans' && (
        <div className="space-y-4">
          {loansLoading ? (
            <LoansTabSkeleton />
          ) : (
            (() => {
              const totalOutstanding = loansData.reduce((s, l) => s + (l.outstanding ?? 0), 0);
              const activeLoans = loansData.filter((l) => l.status === 'active');
              const closedLoans = loansData.filter((l) => l.status === 'closed');
              const totalPrincipal = loansData.reduce((s, l) => s + (l.principal ?? 0), 0);
              const totalRepaid = loansData.reduce((s, l) => s + (l.amount_repaid ?? 0), 0);
              const from = dateRange.date_from;
              const to = dateRange.date_to;
              const disbursementsByMonth: { month: string; amount: number }[] = [];
              const monthMap = new Map<string, number>();
              loansData.forEach((l) => {
                const d = typeof l.disbursement_date === 'string' ? l.disbursement_date.slice(0, 7) : '';
                if (d && l.disbursement_date >= from && l.disbursement_date <= to) {
                  monthMap.set(d, (monthMap.get(d) ?? 0) + (l.principal ?? 0));
                }
              });
              Array.from(monthMap.entries())
                .sort((a, b) => a[0].localeCompare(b[0]))
                .forEach(([month, amount]) => disbursementsByMonth.push({ month, amount }));
              const outstandingByType = [
                { type: 'Supplier', value: loansData.filter((l) => l.borrower_type === 'supplier').reduce((s, l) => s + (l.outstanding ?? 0), 0) },
                { type: 'Customer', value: loansData.filter((l) => l.borrower_type === 'customer').reduce((s, l) => s + (l.outstanding ?? 0), 0) },
                { type: 'Other', value: loansData.filter((l) => l.borrower_type === 'other').reduce((s, l) => s + (l.outstanding ?? 0), 0) },
              ].filter((x) => x.value > 0);
              const topByOutstanding = [...activeLoans]
                .sort((a, b) => (b.outstanding ?? 0) - (a.outstanding ?? 0))
                .slice(0, 10)
                .reverse();
              const hasDonut = totalOutstanding > 0 || totalRepaid > 0;
              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                      label="Outstanding"
                      value={formatCurrency(totalOutstanding)}
                      subtitle="Total owed"
                      icon={faHandHoldingDollar}
                      href="/loans"
                      {...{ iconBgColor: '#fef3c7', iconColor: '#b45309' }}
                    />
                    <StatCard
                      label="Active loans"
                      value={String(activeLoans.length)}
                      subtitle="With balance"
                      icon={faHandHoldingDollar}
                      href="/loans?status=active"
                      {...BLUE_ICON}
                    />
                    <StatCard
                      label="Closed loans"
                      value={String(closedLoans.length)}
                      subtitle="Fully repaid"
                      icon={faHandHoldingDollar}
                      href="/loans?status=closed"
                      {...{ iconBgColor: '#f3f4f6', iconColor: '#6b7280' }}
                    />
                    <StatCard
                      label="Total disbursed"
                      value={formatCurrency(totalPrincipal)}
                      subtitle={`${formatCurrency(totalRepaid)} repaid`}
                      icon={faDollarSign}
                      href="/loans"
                      {...GREEN_ICON}
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 bg-white border border-gray-200 rounded-sm p-6">
                      <h3 className="text-base font-semibold text-gray-900 mb-4">Disbursements by month</h3>
                      {disbursementsByMonth.length === 0 ? (
                        <div className="h-[280px] flex items-center justify-center text-gray-500 text-sm">
                          No disbursements in this period.
                        </div>
                      ) : (
                        <Chart
                          type="area"
                          height={280}
                          options={{
                            chart: { type: 'area', toolbar: { show: false }, zoom: { enabled: false } },
                            stroke: { curve: 'smooth', width: 2 },
                            fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0.2, stops: [0, 90, 100] } },
                            colors: ['#b45309'],
                            xaxis: { categories: disbursementsByMonth.map((d) => d.month) },
                            yaxis: { labels: { formatter: (v: number) => formatCurrency(v) } },
                            tooltip: { y: { formatter: (v: number) => formatCurrency(Number(v)) } },
                            dataLabels: { enabled: false },
                            grid: { strokeDashArray: 3 },
                          }}
                          series={[{ name: 'Disbursed', data: disbursementsByMonth.map((d) => d.amount) }]}
                        />
                      )}
                    </div>
                    <div className="bg-white border border-gray-200 rounded-sm p-6">
                      <h3 className="text-base font-semibold text-gray-900 mb-4">Outstanding vs repaid</h3>
                      {!hasDonut ? (
                        <div className="h-[280px] flex items-center justify-center text-gray-500 text-sm">No loan data yet.</div>
                      ) : (
                        <Chart
                          type="donut"
                          height={280}
                          options={{
                            chart: { type: 'donut', fontFamily: 'inherit' },
                            labels: ['Outstanding', 'Repaid'],
                            colors: ['#b45309', '#059669'],
                            legend: { position: 'bottom', fontSize: '12px' },
                            dataLabels: { formatter: (val: number) => `${Math.round(val)}%` },
                            plotOptions: {
                              pie: {
                                donut: {
                                  size: '65%',
                                  labels: {
                                    show: true,
                                    total: { show: true, label: 'Total', formatter: () => formatCurrency(totalPrincipal) },
                                  },
                                },
                              },
                            },
                          }}
                          series={[totalOutstanding, totalRepaid]}
                        />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white border border-gray-200 rounded-sm p-6">
                      <h3 className="text-base font-semibold text-gray-900 mb-4">Outstanding by borrower type</h3>
                      {outstandingByType.length === 0 ? (
                        <div className="h-[260px] flex items-center justify-center text-gray-500 text-sm">No outstanding by type.</div>
                      ) : (
                        <Chart
                          type="bar"
                          height={260}
                          options={{
                            chart: { type: 'bar', toolbar: { show: false } },
                            plotOptions: { bar: { borderRadius: 4, columnWidth: '60%', horizontal: true } },
                            colors: ['#004AAD', '#7c3aed', '#6b7280'],
                            xaxis: {
                              categories: outstandingByType.map((x) => x.type),
                              labels: { formatter: (v: string | number) => (typeof v === 'number' && !Number.isNaN(v) ? formatCurrency(v) : String(v)) },
                            },
                            yaxis: { labels: { formatter: (v: string | number) => (typeof v === 'number' && !Number.isNaN(v) ? formatCurrency(v) : String(v)) } },
                            tooltip: { y: { formatter: (v: number) => formatCurrency(Number(v)) } },
                            dataLabels: { enabled: false },
                            grid: { strokeDashArray: 3 },
                          }}
                          series={[{ name: 'Outstanding', data: outstandingByType.map((x) => x.value) }]}
                        />
                      )}
                    </div>
                    <div className="bg-white border border-gray-200 rounded-sm p-6">
                      <h3 className="text-base font-semibold text-gray-900 mb-4">Top loans by outstanding</h3>
                      {topByOutstanding.length === 0 ? (
                        <div className="h-[260px] flex items-center justify-center text-gray-500 text-sm">No active loans.</div>
                      ) : (
                        <Chart
                          type="bar"
                          height={260}
                          options={{
                            chart: { type: 'bar', toolbar: { show: false } },
                            plotOptions: { bar: { borderRadius: 4, columnWidth: '60%', horizontal: true } },
                            colors: ['#b45309'],
                            xaxis: {
                              categories: topByOutstanding.map((l) => (l.borrower_label?.length > 18 ? l.borrower_label.slice(0, 18) + '…' : l.borrower_label)),
                              labels: { formatter: (v: string | number) => (typeof v === 'number' && !Number.isNaN(v) ? formatCurrency(v) : String(v)) },
                            },
                            yaxis: { labels: { formatter: (v: string | number) => (typeof v === 'number' && !Number.isNaN(v) ? formatCurrency(v) : String(v)) } },
                            tooltip: { y: { formatter: (v: number) => formatCurrency(Number(v)) } },
                            dataLabels: { enabled: false },
                            grid: { strokeDashArray: 3 },
                          }}
                          series={[{ name: 'Outstanding', data: topByOutstanding.map((l) => l.outstanding ?? 0) }]}
                        />
                      )}
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-semibold text-gray-900">Active loans</h3>
                      <Link href="/loans" className="text-sm font-medium text-[var(--primary)] hover:text-[#003d8f] flex items-center gap-1">
                        View all <Icon icon={faArrowRight} size="xs" />
                      </Link>
                    </div>
                    {activeLoans.length === 0 ? (
                      <p className="text-sm text-gray-500">No active loans.</p>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {activeLoans.slice(0, 8).map((loan) => (
                          <li key={loan.id} className="py-3 first:pt-0">
                            <Link href={`/loans/${loan.id}`} className="flex items-center justify-between gap-4 hover:bg-gray-50 -mx-2 px-2 py-1 rounded">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{loan.borrower_label}</p>
                                <p className="text-xs text-gray-500 capitalize">{loan.borrower_type}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-sm font-semibold text-amber-700">{formatCurrency(loan.outstanding)}</span>
                                <Icon icon={faEye} size="sm" className="text-gray-400" />
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              );
            })()
          )}
        </div>
      )}

      {/* Quick action modals */}
      <Modal
        open={quickActionModal === 'sale'}
        onClose={() => setQuickActionModal(null)}
        title="New Sale"
        maxWidth="max-w-xl"
      >
        <CreateSaleForm onSuccess={closeQuickActionAndRefresh} onCancel={() => setQuickActionModal(null)} />
      </Modal>
      <Modal
        open={quickActionModal === 'collection'}
        onClose={() => setQuickActionModal(null)}
        title="New Collection"
        maxWidth="max-w-xl"
      >
        <CreateCollectionForm onSuccess={closeQuickActionAndRefresh} onCancel={() => setQuickActionModal(null)} />
      </Modal>
      <Modal
        open={quickActionModal === 'customer'}
        onClose={() => setQuickActionModal(null)}
        title="Add Customer"
        maxWidth="max-w-lg"
      >
        <CreateCustomerForm onSuccess={closeQuickActionAndRefresh} onCancel={() => setQuickActionModal(null)} />
      </Modal>
      <Modal
        open={quickActionModal === 'supplier'}
        onClose={() => setQuickActionModal(null)}
        title="Add Supplier"
        maxWidth="max-w-lg"
      >
        <CreateSupplierForm onSuccess={closeQuickActionAndRefresh} onCancel={() => setQuickActionModal(null)} />
      </Modal>
      <Modal
        open={quickActionModal === 'inventory'}
        onClose={() => setQuickActionModal(null)}
        title="Add Inventory Item"
        maxWidth="max-w-xl"
      >
        <CreateInventoryForm onSuccess={closeQuickActionAndRefresh} onCancel={() => setQuickActionModal(null)} />
      </Modal>
      <Modal
        open={quickActionModal === 'transaction'}
        onClose={() => !recordSubmitting && setQuickActionModal(null)}
        title="Record Transaction"
        maxWidth="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setQuickActionModal(null)}
              className="btn btn-secondary"
              disabled={recordSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRecordTransactionSubmit}
              className="btn btn-primary"
              disabled={recordSubmitting}
            >
              {recordSubmitting ? <Icon icon={faSpinner} spin size="sm" className="mr-2" /> : null}
              Record
            </button>
          </div>
        }
      >
        {quickActionModal === 'transaction' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setRecordType('revenue')}
                  className={`flex-1 rounded border px-3 py-2 text-sm font-medium ${
                    recordType === 'revenue' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-600'
                  }`}
                >
                  Revenue
                </button>
                <button
                  type="button"
                  onClick={() => setRecordType('expense')}
                  className={`flex-1 rounded border px-3 py-2 text-sm font-medium ${
                    recordType === 'expense' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-600'
                  }`}
                >
                  Expense
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Amount (RWF)</label>
              <input
                type="number"
                min={1}
                value={recordAmount}
                onChange={(e) => setRecordAmount(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <input
                type="text"
                value={recordDescription}
                onChange={(e) => setRecordDescription(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                placeholder="e.g. Milk sales"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date</label>
              <input
                type="date"
                value={recordDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setRecordDate(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
