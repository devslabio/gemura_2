'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useAuthStore } from '@/store/auth';
import StatCard from '@/app/components/StatCard';
import { DashboardSkeleton } from '@/app/components/SkeletonLoader';
import {
  faTruck,
  faReceipt,
  faHandHoldingDollar,
  faCheckCircle,
  faUserFriends,
  faArrowUp,
  faArrowDown,
  faCog,
} from '@/app/components/Icon';
import Icon from '@/app/components/Icon';
import { type PeriodKey } from '@/lib/utils/dashboardPeriod';
import SupplierDashboardShell from './SupplierDashboardShell';
import { useSupplierOverview, formatSupplierCurrency } from './useSupplierOverview';
import { getTransferIntakeStats } from './transferRejectionStats';
import SupplierActivityList from './SupplierActivityList';
import { supplierOperationsApi, type ManagedCollection, type ManagedTransfer, type ManagedFarm } from '@/lib/api/supplierOperations';
import {
  breakdownToSeries,
  chartPeriodLabel,
  supplierRecentOverviewRows,
  groupCollectionsByQualityGrade,
} from '@/lib/utils/supplierOverviewFromStats';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const GREEN = { iconBgColor: '#dcfce7', iconColor: '#059669' };
const BLUE = { iconBgColor: '#eff6ff', iconColor: 'var(--primary)' };
const AMBER = { iconBgColor: '#fef3c7', iconColor: '#b45309' };
const PURPLE = { iconBgColor: '#f3e8ff', iconColor: '#7c3aed' };

function groupCollectionsByDate(collections: ManagedCollection[]) {
  const grouped: Record<string, number> = {};
  collections.forEach((c) => {
    const date = c.collected_at.split('T')[0];
    grouped[date] = (grouped[date] || 0) + c.liters;
  });
  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14);
}

function groupCollectionsByFarm(collections: ManagedCollection[], farms: ManagedFarm[]) {
  const farmMap = new Map(farms.map((f) => [f.id, f.name]));
  const grouped: Record<string, number> = {};
  collections.forEach((c) => {
    const farmName = c.farm_name || farmMap.get(c.farm_id) || 'Unknown';
    grouped[farmName] = (grouped[farmName] || 0) + c.liters;
  });
  return Object.entries(grouped)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
}

export default function PureCollectorSupplierDashboard() {
  const { currentAccount } = useAuthStore();
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [collections, setCollections] = useState<ManagedCollection[]>([]);
  const [transfers, setTransfers] = useState<ManagedTransfer[]>([]);
  const [farms, setFarms] = useState<ManagedFarm[]>([]);
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
      supplierOperationsApi.getCollections(),
      supplierOperationsApi.getTransfers(),
      supplierOperationsApi.getFarms(),
    ])
      .then(([colRes, trfRes, farmRes]) => {
        setCollections(colRes.data ?? []);
        setTransfers(trfRes.data ?? []);
        setFarms(farmRes.data ?? []);
      })
      .catch(() => {
        setCollections([]);
        setTransfers([]);
        setFarms([]);
      })
      .finally(() => setOpsLoading(false));
  }, [refreshKey]);

  const chartData = useMemo(() => groupCollectionsByDate(collections), [collections]);
  const farmBreakdown = useMemo(() => groupCollectionsByFarm(collections, farms), [collections, farms]);
  const bd = useMemo(() => breakdownToSeries(data?.breakdown), [data?.breakdown]);
  const qualityGrades = useMemo(() => groupCollectionsByQualityGrade(collections), [collections]);
  const chartFromOverview = bd.categories.length > 0;

  const hasEarningsData = bd.salesValues.some((v) => v > 0);
  const totalQualityLiters = qualityGrades.reduce((s, g) => s + g.liters, 0);
  const GRADE_COLORS: Record<string, string> = { A: '#10b981', B: '#3b82f6', C: '#f59e0b', D: '#ef4444', UNGRADED: '#94a3b8' };
  const gradeColor = (grade: string) => GRADE_COLORS[grade.toUpperCase()] ?? GRADE_COLORS.UNGRADED;

  const chartCategories = chartFromOverview
    ? bd.categories
    : chartData.map(([d]) => {
        const dt = new Date(d);
        return dt.toLocaleDateString('en-RW', { month: 'short', day: 'numeric' });
      });
  const collectionSeries = chartData.map(([, v]) => v);
  const totalCollected = collectionSeries.reduce((a, b) => a + b, 0);
  const overviewVolumeTotal = bd.totalCollection + bd.totalSales;
  const chartTotalForAvg = chartFromOverview ? overviewVolumeTotal : totalCollected;
  const chartDays = chartFromOverview ? bd.categories.length : chartData.length;
  const avgDaily = chartDays > 0 ? chartTotalForAvg / chartDays : 0;

  const transferStats = useMemo(() => getTransferIntakeStats(transfers), [transfers]);
  const acceptanceRate =
    transferStats.submitted > 0
      ? Math.round((transferStats.accepted / transferStats.submitted) * 100)
      : 100;

  // Active farms
  const activeFarms = farms.filter((f) => f.status === 'active').length;

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  const summary = data?.summary;
  const lit = Number(summary?.collection?.liters ?? 0);
  const val = Number(summary?.sales?.value ?? 0);
  const saleLiters = Number(summary?.sales?.liters ?? 0);
  const saleTx = Number(summary?.sales?.transactions ?? 0);
  const rejLit = Math.max(Number(summary?.rejections?.liters ?? 0), transferStats.rejectedLiters);
  const rejVal =
    Number(summary?.rejections?.value ?? 0) ||
    (transferStats.rejectedLiters > 0 && saleLiters > 0
      ? transferStats.rejectedLiters * (val / saleLiters)
      : 0);
  const recentRows = supplierRecentOverviewRows(data?.recent_transactions);

  return (
    <SupplierDashboardShell
      title="Collector Dashboard"
      subtitle="Track your collection runs and farmer network"
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

      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Collected"
          value={`${lit.toLocaleString('en-RW', { maximumFractionDigits: 1 })} L`}
          subtitle="Collection volume (overview)"
          icon={faTruck}
          {...GREEN}
        />
        <StatCard
          label="Settlement from MCC"
          value={formatSupplierCurrency(val)}
          subtitle={
            saleTx > 0
              ? `${saleTx} sale${saleTx === 1 ? '' : 's'} · ${saleLiters.toFixed(1)} L`
              : 'Milk sales payment (overview)'
          }
          icon={faHandHoldingDollar}
          {...BLUE}
        />
        <StatCard
          label="Farms Managed"
          value={String(activeFarms)}
          subtitle={`${farms.length} total farms`}
          icon={faUserFriends}
          href="/supplier/farms"
          {...PURPLE}
        />
        <StatCard
          label="Acceptance Rate"
          value={`${acceptanceRate}%`}
          subtitle={`${transferStats.accepted} of ${transferStats.submitted} transfers`}
          icon={faCheckCircle}
          {...AMBER}
        />
      </div>

      {/* KPI Cards Row 2 */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Daily Average</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{avgDaily.toFixed(1)} L</p>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-100">
              <Icon icon={faReceipt} className="text-green-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Over {chartDays} day{chartDays === 1 ? '' : 's'} in chart</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pending Transfers</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{transferStats.pending}</p>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-yellow-100">
              <Icon icon={faTruck} className="text-yellow-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Awaiting MCC review</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Accepted Volume</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {(saleLiters > 0 ? saleLiters : transferStats.acceptedLiters).toFixed(1)} L
              </p>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-100">
              <Icon icon={faArrowUp} className="text-green-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {saleTx > 0 ? `${saleTx} sale record${saleTx === 1 ? '' : 's'} · overview` : 'Processed by MCC'}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Rejected Volume</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{transferStats.rejectedLiters.toFixed(1)} L</p>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-red-100">
              <Icon icon={faArrowDown} className="text-red-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {transferStats.rejected} rejection{transferStats.rejected !== 1 ? 's' : ''} (incl. partial)
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Collection Trend */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">
              {chartFromOverview
                ? `Volume trend — ${chartPeriodLabel(data?.chart_period)}`
                : 'Collection trend (last 14 logged days)'}
            </h3>
            <span className="text-xs text-gray-500">Total: {chartTotalForAvg.toFixed(1)} L</span>
          </div>
          {chartFromOverview ? (
            <Chart
              type="area"
              height={260}
              options={{
                chart: { type: 'area', toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'inherit' },
                stroke: { curve: 'smooth', width: 2 },
                fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1 } },
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
                fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1 } },
                colors: ['#059669'],
                xaxis: { categories: chartCategories, labels: { style: { fontSize: '11px' } } },
                yaxis: { labels: { formatter: (v: number) => `${v.toFixed(0)}L`, style: { fontSize: '11px' } } },
                dataLabels: { enabled: false },
                tooltip: { y: { formatter: (v: number) => `${v.toFixed(1)} L` } },
                grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
              }}
              series={[{ name: 'Collected', data: collectionSeries }]}
            />
          ) : (
            <div className="h-[260px] flex flex-col items-center justify-center text-gray-400">
              <Icon icon={faTruck} className="text-4xl mb-2" />
              <p className="text-sm">No collection data yet</p>
              <a href="/supplier/collections" className="text-primary text-sm mt-2 hover:underline">
                Start recording collections →
              </a>
            </div>
          )}
        </div>

        {/* Top Farms */}
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Top Farms by Volume</h3>
          {farmBreakdown.length > 0 ? (
            <>
              <Chart
                type="bar"
                height={200}
                options={{
                  chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'inherit' },
                  plotOptions: { bar: { borderRadius: 4, horizontal: true, distributed: true } },
                  colors: ['#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe'],
                  xaxis: { categories: farmBreakdown.map(([name]) => name), labels: { style: { fontSize: '11px' } } },
                  yaxis: { labels: { style: { fontSize: '11px' } } },
                  dataLabels: { enabled: true, formatter: (v: number) => `${v.toFixed(0)}L`, style: { fontSize: '10px' } },
                  legend: { show: false },
                  grid: { borderColor: '#f1f5f9' },
                }}
                series={[{ name: 'Volume', data: farmBreakdown.map(([, v]) => v) }]}
              />
              <div className="mt-3 space-y-1">
                {farmBreakdown.slice(0, 3).map(([name, liters], i) => (
                  <div key={name} className="flex justify-between text-xs">
                    <span className="text-gray-600">{i + 1}. {name}</span>
                    <span className="font-medium">{liters.toFixed(1)} L</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[260px] flex flex-col items-center justify-center text-gray-400">
              <Icon icon={faUserFriends} className="text-4xl mb-2" />
              <p className="text-sm">No farms added yet</p>
              <a href="/supplier/farms" className="text-primary text-sm mt-2 hover:underline">
                Add farms to collect from →
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Quality Grade + Earnings Row */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Quality Grade Distribution */}
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Collection Quality Distribution</h3>
          {qualityGrades.length > 0 && totalQualityLiters > 0 ? (
            <>
              <Chart
                type="donut"
                height={180}
                options={{
                  chart: { type: 'donut', fontFamily: 'inherit' },
                  labels: qualityGrades.map((g) => `Grade ${g.grade}`),
                  colors: qualityGrades.map((g) => gradeColor(g.grade)),
                  legend: { position: 'right', fontSize: '11px' },
                  dataLabels: { enabled: true, formatter: (val: number) => `${val.toFixed(0)}%` },
                  plotOptions: {
                    pie: {
                      donut: {
                        size: '60%',
                        labels: {
                          show: true,
                          total: { show: true, label: 'Total', formatter: () => `${totalQualityLiters.toFixed(0)}L` },
                        },
                      },
                    },
                  },
                  tooltip: { y: { formatter: (v: number) => `${v.toFixed(1)} L` } },
                }}
                series={qualityGrades.map((g) => g.liters)}
              />
              <div className="mt-2 space-y-1">
                {qualityGrades.map((g) => (
                  <div key={g.grade} className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: gradeColor(g.grade) }} />
                      <span className="text-gray-600">Grade {g.grade} ({g.count} records)</span>
                    </span>
                    <span className="font-medium text-gray-900">{g.liters.toFixed(1)} L</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[180px] flex flex-col items-center justify-center text-gray-400">
              <p className="text-sm">No quality grade data yet</p>
              <p className="text-xs mt-1">Add quality grades when logging collections</p>
              <a href="/supplier/collections" className="text-primary text-sm mt-2 hover:underline">
                Record collections →
              </a>
            </div>
          )}
        </div>

        {/* Earnings Trend */}
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Earnings Trend</h3>
            <span className="text-xs text-gray-500">Total: {formatSupplierCurrency(val)}</span>
          </div>
          {hasEarningsData ? (
            <Chart
              type="bar"
              height={200}
              options={{
                chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'inherit' },
                plotOptions: { bar: { borderRadius: 3, columnWidth: '55%' } },
                colors: ['#059669'],
                xaxis: { categories: bd.categories, labels: { style: { fontSize: '11px' } } },
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
              series={[{ name: 'Earnings (RF)', data: bd.salesValues }]}
            />
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
              No earnings data for selected period
            </div>
          )}
        </div>
      </div>

      {/* Payment + Rejection Summary */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-sm p-4">
          <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Settlement</p>
          <p className="text-2xl font-bold text-green-800 mt-1">{formatSupplierCurrency(val)}</p>
          <p className="text-xs text-green-600 mt-1">{saleLiters.toFixed(1)} L · {saleTx} sale{saleTx !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-xs font-medium text-red-700 uppercase tracking-wide">Rejection Losses</p>
          <p className="text-2xl font-bold text-red-800 mt-1">{rejLit.toFixed(1)} L</p>
          <p className="text-xs text-red-600 mt-1">{rejVal > 0 ? `–${formatSupplierCurrency(rejVal)}` : 'No rejections'}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-sm p-4">
          <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Net Estimate</p>
          <p className="text-2xl font-bold text-blue-800 mt-1">{formatSupplierCurrency(Math.max(0, val - rejVal))}</p>
          <p className="text-xs text-blue-600 mt-1">After rejection deductions</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-4 bg-white border border-gray-200 rounded-sm p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <a href="/supplier/farms" className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-sm transition-colors">
            <Icon icon={faUserFriends} className="text-purple-600" />
            <span className="text-sm font-medium text-gray-700">Manage Farms</span>
          </a>
          <a href="/supplier/collections" className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-sm transition-colors">
            <Icon icon={faTruck} className="text-green-600" />
            <span className="text-sm font-medium text-gray-700">Record Collection</span>
          </a>
          <a href="/supplier/transfers" className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-sm transition-colors">
            <Icon icon={faReceipt} className="text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Submit Transfer</span>
          </a>
          <a href="/settings" className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-sm transition-colors">
            <Icon icon={faCog} className="text-amber-600" />
            <span className="text-sm font-medium text-gray-700">Settings</span>
          </a>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-2">Recent Collection Runs</h2>
        <SupplierActivityList
          rows={recentRows}
          emptyText="No milk sales or collections in this period (overview)."
        />
      </div>
    </SupplierDashboardShell>
  );
}
