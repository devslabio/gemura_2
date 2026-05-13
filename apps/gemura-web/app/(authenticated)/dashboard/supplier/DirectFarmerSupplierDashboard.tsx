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
  faCheckCircle,
  faTimesCircle,
  faClock,
  faStar,
} from '@/app/components/Icon';
import Icon from '@/app/components/Icon';
import { type PeriodKey } from '@/lib/utils/dashboardPeriod';
import SupplierDashboardShell from './SupplierDashboardShell';
import { useSupplierOverview, formatSupplierCurrency } from './useSupplierOverview';
import SupplierActivityList from './SupplierActivityList';
import { supplierOperationsApi, type ManagedProduction, type ManagedTransfer, type ManagedCollection } from '@/lib/api/supplierOperations';
import {
  breakdownToSeries,
  chartPeriodLabel,
  supplierRecentOverviewRows,
  groupCollectionsByQualityGrade,
} from '@/lib/utils/supplierOverviewFromStats';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const GREEN = { iconBgColor: '#dcfce7', iconColor: '#059669' };
const BLUE = { iconBgColor: '#eff6ff', iconColor: 'var(--primary)' };
const PURPLE = { iconBgColor: '#f3e8ff', iconColor: '#7c3aed' };
const RED = { iconBgColor: '#fee2e2', iconColor: '#dc2626' };

const GRADE_COLORS: Record<string, string> = {
  A: '#10b981',
  B: '#3b82f6',
  C: '#f59e0b',
  D: '#ef4444',
  UNGRADED: '#94a3b8',
};

function gradeColor(grade: string): string {
  const upper = grade.toUpperCase();
  return GRADE_COLORS[upper] ?? GRADE_COLORS.UNGRADED;
}

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
  const [collections, setCollections] = useState<ManagedCollection[]>([]);
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
      supplierOperationsApi.getCollections(),
    ])
      .then(([prodRes, trfRes, colRes]) => {
        setProduction(prodRes.data ?? []);
        setTransfers(trfRes.data ?? []);
        setCollections(colRes.data ?? []);
      })
      .catch(() => {
        setProduction([]);
        setTransfers([]);
        setCollections([]);
      })
      .finally(() => setOpsLoading(false));
  }, [refreshKey]);

  const chartData = useMemo(() => groupProductionByDate(production), [production]);
  const bd = useMemo(() => breakdownToSeries(data?.breakdown), [data?.breakdown]);
  const overviewChartPreferred = bd.categories.length > 0;
  const qualityGrades = useMemo(() => groupCollectionsByQualityGrade(collections), [collections]);

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
  const acceptedTransfers = submittedTransfers.filter(
    (t) => t.mcc_status === 'accepted' || t.mcc_status === 'partially_accepted'
  );
  const rejectedTransfers = submittedTransfers.filter((t) => t.mcc_status === 'rejected');
  const pendingTransfers = submittedTransfers.filter(
    (t) => !t.mcc_status || t.mcc_status === 'submitted'
  );
  const acceptedLiters = acceptedTransfers.reduce(
    (s, t) => s + (t.mcc_accepted_liters ?? t.total_liters),
    0
  );
  const rejectedLiters = rejectedTransfers.reduce((s, t) => s + t.total_liters, 0);
  const acceptanceRate =
    submittedTransfers.length > 0
      ? Math.round((acceptedTransfers.length / submittedTransfers.length) * 100)
      : 100;

  // Earnings chart using breakdown data
  const earningsCategories = bd.categories;
  const earningsSeries = bd.salesValues;
  const hasEarningsData = earningsSeries.some((v) => v > 0);

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  const summary = data?.summary;
  const lit = Number(summary?.sales?.liters ?? 0);
  const val = Number(summary?.sales?.value ?? 0);
  const tx = Number(summary?.sales?.transactions ?? 0);
  const rejLit = Number(summary?.rejections?.liters ?? 0);
  const rejVal = Number(summary?.rejections?.value ?? 0);
  const pricePerLiter = lit > 0 ? val / lit : 0;
  const recentRows = supplierRecentOverviewRows(data?.recent_transactions);

  const totalQualityLiters = qualityGrades.reduce((s, g) => s + g.liters, 0);

  return (
    <SupplierDashboardShell
      title="My Farm Dashboard"
      subtitle="Track your milk production, deliveries, earnings and quality"
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
          label="Milk Delivered to MCC"
          value={`${lit.toLocaleString('en-RW', { maximumFractionDigits: 1 })} L`}
          subtitle={`${tx} sale${tx === 1 ? '' : 's'} recorded`}
          icon={faTruck}
          {...GREEN}
        />
        <StatCard
          label="Total Earnings"
          value={formatSupplierCurrency(val)}
          subtitle={lit > 0 ? `Avg RF ${pricePerLiter.toFixed(0)}/L` : 'This period'}
          icon={faHandHoldingDollar}
          {...BLUE}
        />
        <StatCard
          label="Production Logged"
          value={`${totalProduction.toFixed(1)} L`}
          subtitle={`Avg ${avgDaily.toFixed(1)} L/day · ${chartData.length} active days`}
          icon={faChartLine}
          href="/supplier/production"
          {...PURPLE}
        />
        <StatCard
          label="Rejected / Losses"
          value={`${rejLit.toFixed(1)} L`}
          subtitle={rejVal > 0 ? `${formatSupplierCurrency(rejVal)} in losses` : 'No rejections'}
          icon={faTimesCircle}
          {...RED}
        />
      </div>

      {/* Production Trend + Transfer Status mini-cards */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
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
            {trend.direction === 'up' ? 'Increasing' : trend.direction === 'down' ? 'Decreasing' : 'Stable'}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Price / Liter</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {pricePerLiter > 0 ? `RF ${pricePerLiter.toFixed(0)}` : '—'}
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
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Transfer Rate</p>
              <p className={`text-2xl font-bold mt-1 ${acceptanceRate >= 80 ? 'text-green-600' : 'text-amber-600'}`}>
                {acceptanceRate}%
              </p>
            </div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${acceptanceRate >= 80 ? 'bg-green-100' : 'bg-amber-100'}`}>
              <Icon icon={faCheckCircle} className={acceptanceRate >= 80 ? 'text-green-600' : 'text-amber-600'} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {acceptedTransfers.length}/{submittedTransfers.length} transfers accepted
          </p>
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

      {/* Main Charts Row */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Volume + Earnings Area Chart */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">
              {overviewChartPreferred
                ? `Volume trend — ${chartPeriodLabel(data?.chart_period)}`
                : 'Production logged (last 14 active days)'}
            </h3>
            <span className="text-xs text-gray-500">
              Total: {(overviewChartPreferred ? bd.totalCollection + bd.totalSales : totalProduction).toFixed(1)} L
            </span>
          </div>
          {overviewChartPreferred ? (
            <Chart
              type="area"
              height={260}
              options={{
                chart: { type: 'area', toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'inherit' },
                stroke: { curve: 'smooth', width: 2 },
                fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05 } },
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
              type="area"
              height={260}
              options={{
                chart: { type: 'area', toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'inherit' },
                stroke: { curve: 'smooth', width: 2 },
                fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05 } },
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
              <p className="text-sm">No production data yet</p>
              <a href="/supplier/production" className="text-primary text-sm mt-2 hover:underline">
                Start logging production →
              </a>
            </div>
          )}
        </div>

        {/* Quality Grade Breakdown */}
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Milk Quality Distribution</h3>
          {qualityGrades.length > 0 && totalQualityLiters > 0 ? (
            <>
              <Chart
                type="donut"
                height={200}
                options={{
                  chart: { type: 'donut', fontFamily: 'inherit' },
                  labels: qualityGrades.map((g) => `Grade ${g.grade}`),
                  colors: qualityGrades.map((g) => gradeColor(g.grade)),
                  legend: { position: 'bottom', fontSize: '11px' },
                  dataLabels: {
                    enabled: true,
                    formatter: (val: number) => `${val.toFixed(0)}%`,
                  },
                  plotOptions: {
                    pie: {
                      donut: {
                        size: '65%',
                        labels: {
                          show: true,
                          total: {
                            show: true,
                            label: 'Total',
                            formatter: () => `${totalQualityLiters.toFixed(0)}L`,
                          },
                        },
                      },
                    },
                  },
                  tooltip: { y: { formatter: (v: number) => `${v.toFixed(1)} L` } },
                }}
                series={qualityGrades.map((g) => g.liters)}
              />
              <div className="mt-3 space-y-1.5">
                {qualityGrades.map((g) => (
                  <div key={g.grade} className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: gradeColor(g.grade) }}
                      />
                      <span className="text-gray-700">Grade {g.grade}</span>
                    </span>
                    <span className="text-gray-900 font-medium">
                      {g.liters.toFixed(1)} L ({totalQualityLiters > 0 ? ((g.liters / totalQualityLiters) * 100).toFixed(0) : 0}%)
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[200px] flex flex-col items-center justify-center text-gray-400">
              <Icon icon={faStar} className="text-4xl mb-2" />
              <p className="text-sm text-center">Quality grades logged from collection records appear here</p>
              <a href="/supplier/collections" className="text-primary text-sm mt-2 hover:underline">
                Log a collection →
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Earnings Trend + Payment Summary Row */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Earnings Bar Chart */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Earnings Trend</h3>
            <span className="text-xs text-gray-500">Total: {formatSupplierCurrency(val)}</span>
          </div>
          {hasEarningsData && earningsCategories.length > 0 ? (
            <Chart
              type="bar"
              height={200}
              options={{
                chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'inherit' },
                plotOptions: { bar: { borderRadius: 3, columnWidth: '55%' } },
                colors: ['#10b981'],
                xaxis: { categories: earningsCategories, labels: { style: { fontSize: '11px' } } },
                yaxis: {
                  labels: {
                    formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v.toFixed(0)}`,
                    style: { fontSize: '11px' },
                  },
                },
                dataLabels: { enabled: false },
                tooltip: { y: { formatter: (v: number) => formatSupplierCurrency(v) } },
                grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
              }}
              series={[{ name: 'Earnings (RF)', data: earningsSeries }]}
            />
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
              No earnings data for selected period
            </div>
          )}
        </div>

        {/* Payment Summary */}
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Payment Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-500">This Period</p>
                <p className="text-base font-bold text-gray-900 mt-0.5">{formatSupplierCurrency(val)}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <Icon icon={faHandHoldingDollar} className="text-green-600 text-xs" />
              </div>
            </div>

            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-500">Volume Sold</p>
                <p className="text-base font-bold text-gray-900 mt-0.5">{lit.toFixed(1)} L</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Icon icon={faTruck} className="text-blue-600 text-xs" />
              </div>
            </div>

            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-500">Avg Price</p>
                <p className="text-base font-bold text-gray-900 mt-0.5">
                  {pricePerLiter > 0 ? `RF ${pricePerLiter.toFixed(0)}/L` : '—'}
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                <Icon icon={faChartLine} className="text-purple-600 text-xs" />
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-500">Rejection Losses</p>
                <p className={`text-base font-bold mt-0.5 ${rejVal > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {rejVal > 0 ? `–${formatSupplierCurrency(rejVal)}` : 'RF 0'}
                </p>
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${rejVal > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                <Icon icon={faTimesCircle} className={rejVal > 0 ? 'text-red-500 text-xs' : 'text-gray-400 text-xs'} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transfer Status Row */}
      {submittedTransfers.length > 0 && (
        <div className="mt-4 bg-white border border-gray-200 rounded-sm p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Transfer Status Overview</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            <div className="text-center p-3 bg-green-50 rounded-sm">
              <p className="text-2xl font-bold text-green-600">{acceptedTransfers.length}</p>
              <p className="text-xs text-green-700 mt-1">Accepted</p>
              <p className="text-xs text-gray-500">{acceptedLiters.toFixed(1)} L</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-sm">
              <p className="text-2xl font-bold text-yellow-600">{pendingTransfers.length}</p>
              <p className="text-xs text-yellow-700 mt-1">Pending</p>
              <p className="text-xs text-gray-500">Awaiting review</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-sm">
              <p className="text-2xl font-bold text-red-600">{rejectedTransfers.length}</p>
              <p className="text-xs text-red-700 mt-1">Rejected</p>
              <p className="text-xs text-gray-500">{rejectedLiters.toFixed(1)} L</p>
            </div>
            <div className="hidden sm:block text-center p-3 bg-blue-50 rounded-sm">
              <p className="text-2xl font-bold text-blue-600">{acceptanceRate}%</p>
              <p className="text-xs text-blue-700 mt-1">Accept Rate</p>
              <p className="text-xs text-gray-500">{submittedTransfers.length} total</p>
            </div>
          </div>
        </div>
      )}

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
          <a href="/supplier/collections" className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-sm transition-colors">
            <Icon icon={faClock} className="text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Record Collection</span>
          </a>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-800">Recent Deliveries</h2>
          <a href="/supplier/transfers" className="text-xs text-primary hover:underline">View all transfers →</a>
        </div>
        <SupplierActivityList
          rows={recentRows}
          emptyText="No milk sales or collections in this period."
        />
      </div>
    </SupplierDashboardShell>
  );
}
