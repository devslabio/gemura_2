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
  faCalendarAlt,
} from '@/app/components/Icon';
import Icon from '@/app/components/Icon';
import { type PeriodKey } from '@/lib/utils/dashboardPeriod';
import SupplierDashboardShell from './SupplierDashboardShell';
import { useSupplierOverview, formatSupplierCurrency } from './useSupplierOverview';
import SupplierActivityList from './SupplierActivityList';
import { supplierOperationsApi, type ManagedCollection, type ManagedTransfer, type ManagedFarm } from '@/lib/api/supplierOperations';
import {
  breakdownToSeries,
  chartPeriodLabel,
  supplierRecentOverviewRows,
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
  const chartFromOverview = bd.categories.length > 0;

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

  // Transfer stats
  const submittedTransfers = transfers.filter((t) => t.status === 'submitted');
  const acceptedTransfers = submittedTransfers.filter((t) => t.mcc_status === 'accepted' || t.mcc_status === 'partially_accepted');
  const rejectedTransfers = submittedTransfers.filter((t) => t.mcc_status === 'rejected');
  const pendingTransfers = submittedTransfers.filter((t) => !t.mcc_status || t.mcc_status === 'submitted');
  
  const acceptedLiters = acceptedTransfers.reduce((s, t) => s + (t.mcc_accepted_liters ?? t.total_liters), 0);
  const rejectedLiters = rejectedTransfers.reduce((s, t) => s + t.total_liters, 0);
  const acceptanceRate = submittedTransfers.length > 0
    ? Math.round((acceptedTransfers.length / submittedTransfers.length) * 100)
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
          subtitle={`${acceptedTransfers.length} of ${submittedTransfers.length} transfers`}
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
              <p className="text-2xl font-bold text-yellow-600 mt-1">{pendingTransfers.length}</p>
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
                {(saleLiters > 0 ? saleLiters : acceptedLiters).toFixed(1)} L
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
              <p className="text-2xl font-bold text-red-600 mt-1">{rejectedLiters.toFixed(1)} L</p>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-red-100">
              <Icon icon={faArrowDown} className="text-red-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">{rejectedTransfers.length} rejected transfer{rejectedTransfers.length !== 1 ? 's' : ''}</p>
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
          <a href="/profile" className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-sm transition-colors">
            <Icon icon={faCalendarAlt} className="text-amber-600" />
            <span className="text-sm font-medium text-gray-700">View Profile</span>
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
