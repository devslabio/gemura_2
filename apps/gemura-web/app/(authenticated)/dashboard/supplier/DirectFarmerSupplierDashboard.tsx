'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useAuthStore } from '@/store/auth';
import StatCard from '@/app/components/StatCard';
import { DashboardSkeleton } from '@/app/components/SkeletonLoader';
import {
  faTruck,
  faHandHoldingDollar,
  faChartLine,
  faArrowUp,
  faArrowDown,
  faCalendarAlt,
} from '@/app/components/Icon';
import Icon from '@/app/components/Icon';
import { type PeriodKey } from '@/lib/utils/dashboardPeriod';
import SupplierDashboardShell from './SupplierDashboardShell';
import { useSupplierOverview, formatSupplierCurrency } from './useSupplierOverview';
import SupplierActivityList from './SupplierActivityList';
import { supplierOperationsApi, type ManagedProduction, type ManagedTransfer } from '@/lib/api/supplierOperations';
import {
  breakdownToSeries,
  chartPeriodLabel,
  supplierRecentOverviewRows,
} from '@/lib/utils/supplierOverviewFromStats';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const GREEN = { iconBgColor: '#dcfce7', iconColor: '#059669' };
const BLUE = { iconBgColor: '#eff6ff', iconColor: 'var(--primary)' };
const PURPLE = { iconBgColor: '#f3e8ff', iconColor: '#7c3aed' };
const AMBER = { iconBgColor: '#fef3c7', iconColor: '#b45309' };

function groupProductionByDate(production: ManagedProduction[]) {
  const grouped: Record<string, number> = {};
  production.forEach((p) => {
    const date = p.produced_at.split('T')[0];
    grouped[date] = (grouped[date] || 0) + p.liters;
  });
  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14);
}

function calculateTrend(data: number[]): { value: number; direction: 'up' | 'down' | 'flat' } {
  if (data.length < 2) return { value: 0, direction: 'flat' };
  const mid = Math.floor(data.length / 2);
  const firstHalf = data.slice(0, mid).reduce((a, b) => a + b, 0) / mid || 1;
  const secondHalf = data.slice(mid).reduce((a, b) => a + b, 0) / (data.length - mid) || 0;
  const change = ((secondHalf - firstHalf) / firstHalf) * 100;
  return {
    value: Math.abs(change),
    direction: change > 2 ? 'up' : change < -2 ? 'down' : 'flat',
  };
}

export default function DirectFarmerSupplierDashboard() {
  const { currentAccount } = useAuthStore();
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [production, setProduction] = useState<ManagedProduction[]>([]);
  const [transfers, setTransfers] = useState<ManagedTransfer[]>([]);
  const [opsLoading, setOpsLoading] = useState(true);

  const { loading, data, error, dateRange } = useSupplierOverview(
    currentAccount?.account_id,
    period,
    customFrom,
    customTo,
    refreshKey
  );

  const onRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    setOpsLoading(true);
    Promise.all([
      supplierOperationsApi.getProduction(),
      supplierOperationsApi.getTransfers(),
    ])
      .then(([prodRes, trfRes]) => {
        setProduction(prodRes.data ?? []);
        setTransfers(trfRes.data ?? []);
      })
      .catch(() => {
        setProduction([]);
        setTransfers([]);
      })
      .finally(() => setOpsLoading(false));
  }, [refreshKey]);

  const chartData = useMemo(() => groupProductionByDate(production), [production]);
  const bd = useMemo(() => breakdownToSeries(data?.breakdown), [data?.breakdown]);
  const overviewChartPreferred = bd.categories.length > 0;

  const chartCategories = overviewChartPreferred
    ? bd.categories
    : chartData.map(([d]) => {
        const dt = new Date(d);
        return dt.toLocaleDateString('en-RW', { month: 'short', day: 'numeric' });
      });
  const productionSeries = chartData.map(([, v]) => v);
  const totalProduction = productionSeries.reduce((a, b) => a + b, 0);
  const avgDaily = chartData.length > 0 ? totalProduction / chartData.length : 0;
  const trend = calculateTrend(productionSeries);

  // Transfer stats
  const submittedTransfers = transfers.filter((t) => t.status === 'submitted');
  const acceptedLiters = submittedTransfers
    .filter((t) => t.mcc_status === 'accepted' || t.mcc_status === 'partially_accepted')
    .reduce((s, t) => s + (t.mcc_accepted_liters ?? t.total_liters), 0);
  const pendingTransfers = submittedTransfers.filter((t) => !t.mcc_status || t.mcc_status === 'submitted').length;

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  const summary = data?.summary;
  /** Milk credited at MCC in period — aligns with farmer–collector dashboards (overview `sales`). */
  const lit = Number(summary?.sales?.liters ?? 0);
  const val = Number(summary?.sales?.value ?? 0);
  const tx = Number(summary?.sales?.transactions ?? 0);
  const recentRows = supplierRecentOverviewRows(data?.recent_transactions);

  return (
    <SupplierDashboardShell
      title="My Farm Dashboard"
      subtitle="Track your milk production, deliveries, and earnings"
      accountName={currentAccount?.account_name}
      dateFrom={dateRange.date_from}
      dateTo={dateRange.date_to}
      period={period}
      onPeriodChange={setPeriod}
      customFrom={customFrom}
      customTo={customTo}
      onCustomFrom={setCustomFrom}
      onCustomTo={setCustomTo}
      onRefresh={onRefresh}
    >
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-3 text-sm text-red-700 mb-2">{error}</div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Milk Delivered"
          value={`${lit.toLocaleString('en-RW', { maximumFractionDigits: 1 })} L`}
          subtitle="Volume from MCC sales (overview)"
          icon={faTruck}
          {...GREEN}
        />
        <StatCard
          label="Total Earnings"
          value={formatSupplierCurrency(val)}
          subtitle={`${tx} milk sale${tx === 1 ? '' : 's'} (overview)`}
          icon={faHandHoldingDollar}
          {...BLUE}
        />
        <StatCard
          label="Production Logged"
          value={`${totalProduction.toFixed(1)} L`}
          subtitle={`Avg ${avgDaily.toFixed(1)} L/day`}
          icon={faChartLine}
          href="/supplier/production"
          {...PURPLE}
        />
        <StatCard
          label="Pending Transfers"
          value={String(pendingTransfers)}
          subtitle={`${acceptedLiters.toFixed(1)} L accepted`}
          icon={faTruck}
          href="/supplier/transfers"
          {...AMBER}
        />
      </div>

      {/* Trend Indicators */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Production Trend</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-2xl font-bold text-gray-900">
                  {trend.direction === 'flat' ? '—' : `${trend.value.toFixed(0)}%`}
                </p>
                {trend.direction !== 'flat' && (
                  <Icon
                    icon={trend.direction === 'up' ? faArrowUp : faArrowDown}
                    className={trend.direction === 'up' ? 'text-green-500' : 'text-red-500'}
                  />
                )}
              </div>
            </div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              trend.direction === 'up' ? 'bg-green-100' : trend.direction === 'down' ? 'bg-red-100' : 'bg-gray-100'
            }`}>
              <Icon icon={faChartLine} className={
                trend.direction === 'up' ? 'text-green-600' : trend.direction === 'down' ? 'text-red-600' : 'text-gray-600'
              } />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {trend.direction === 'up' ? 'Production increasing' : trend.direction === 'down' ? 'Production decreasing' : 'Stable production'}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Price per Liter</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {lit > 0 ? `RF ${(val / lit).toFixed(0)}` : '—'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-100">
              <Icon icon={faHandHoldingDollar} className="text-blue-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Average this period</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active Days</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{chartData.length}</p>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-purple-100">
              <Icon icon={faCalendarAlt} className="text-purple-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Days with production logged</p>
        </div>
      </div>

      {/* Overview / production volume */}
      <div className="mt-4 bg-white border border-gray-200 rounded-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">
            {overviewChartPreferred
              ? `MCC volume (${chartPeriodLabel(data?.chart_period)})`
              : 'Production logged (last 14 days with entries)'}
          </h3>
          <span className="text-xs text-gray-500">
            Total:{' '}
            {(overviewChartPreferred ? bd.totalCollection + bd.totalSales : totalProduction).toFixed(1)} L
          </span>
        </div>
        {overviewChartPreferred ? (
          <Chart
            type="bar"
            height={260}
            options={{
              chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'inherit' },
              plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
              colors: ['#64748b', '#10b981'],
              xaxis: { categories: chartCategories, labels: { style: { fontSize: '11px' } } },
              yaxis: { labels: { formatter: (v: number) => `${v.toFixed(0)}L`, style: { fontSize: '11px' } } },
              dataLabels: { enabled: false },
              tooltip: { y: { formatter: (v: number) => `${v.toFixed(1)} L` } },
              legend: { position: 'top', horizontalAlign: 'right', fontSize: '11px' },
              grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
            }}
            series={[
              { name: 'Collections', data: bd.collectionLiters },
              { name: 'Sold to MCC', data: bd.salesLiters },
            ]}
          />
        ) : chartData.length > 0 ? (
          <Chart
            type="bar"
            height={260}
            options={{
              chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'inherit' },
              plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
              colors: ['#8b5cf6'],
              xaxis: { categories: chartCategories, labels: { style: { fontSize: '11px' } } },
              yaxis: { labels: { formatter: (v: number) => `${v.toFixed(0)}L`, style: { fontSize: '11px' } } },
              dataLabels: { enabled: false },
              tooltip: { y: { formatter: (v: number) => `${v.toFixed(1)} L` } },
              grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
            }}
            series={[{ name: 'Production', data: productionSeries }]}
          />
        ) : (
          <div className="h-[260px] flex flex-col items-center justify-center text-gray-400">
            <Icon icon={faChartLine} className="text-4xl mb-2" />
            <p className="text-sm">No production or overview chart data yet</p>
            <a href="/supplier/production" className="text-primary text-sm mt-2 hover:underline">
              Start logging production →
            </a>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-4 bg-white border border-gray-200 rounded-sm p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <a href="/supplier/production" className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-sm transition-colors">
            <Icon icon={faChartLine} className="text-purple-600" />
            <span className="text-sm font-medium text-gray-700">Log Production</span>
          </a>
          <a href="/supplier/transfers" className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-sm transition-colors">
            <Icon icon={faTruck} className="text-green-600" />
            <span className="text-sm font-medium text-gray-700">Submit Transfer</span>
          </a>
          <a href="/profile" className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-sm transition-colors">
            <Icon icon={faHandHoldingDollar} className="text-amber-600" />
            <span className="text-sm font-medium text-gray-700">View Profile</span>
          </a>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-2">Recent Deliveries</h2>
        <SupplierActivityList
          rows={recentRows}
          emptyText="No milk sales or collections in this period (overview)."
        />
      </div>
    </SupplierDashboardShell>
  );
}
