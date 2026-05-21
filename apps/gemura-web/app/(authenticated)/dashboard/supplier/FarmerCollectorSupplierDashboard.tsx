'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useAuthStore } from '@/store/auth';
import StatCard from '@/app/components/StatCard';
import { DashboardSkeleton } from '@/app/components/SkeletonLoader';
import {
  faTruck,
  faUserFriends,
  faHandHoldingDollar,
  faChartLine,
  faArrowUp,
  faArrowDown,
  faCheckCircle,
  faTriangleExclamation,
  faTimesCircle,
} from '@/app/components/Icon';
import Icon from '@/app/components/Icon';
import { type PeriodKey } from '@/lib/utils/dashboardPeriod';
import SupplierDashboardShell from './SupplierDashboardShell';
import { useSupplierOverview, formatSupplierCurrency } from './useSupplierOverview';
import SupplierActivityList from './SupplierActivityList';
import { supplierOperationsApi, type ManagedCollection, type ManagedTransfer } from '@/lib/api/supplierOperations';
import { getTransferIntakeStats } from './transferRejectionStats';
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

interface OpsSummary {
  farms_total: number;
  own_collected_liters: number;
  external_collected_liters: number;
  total_collected_liters: number;
  own_production_liters: number;
  pending_transfers: number;
}

function groupCollectionsByDate(collections: ManagedCollection[]) {
  const grouped: Record<string, { own: number; external: number }> = {};
  collections.forEach((c) => {
    const date = c.collected_at.split('T')[0];
    if (!grouped[date]) grouped[date] = { own: 0, external: 0 };
    if (c.source_type === 'own_farm') grouped[date].own += c.liters;
    else grouped[date].external += c.liters;
  });
  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14); // Last 14 days
}

export default function FarmerCollectorSupplierDashboard() {
  const { currentAccount } = useAuthStore();
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [opsSummary, setOpsSummary] = useState<OpsSummary | null>(null);
  const [collections, setCollections] = useState<ManagedCollection[]>([]);
  const [transfers, setTransfers] = useState<ManagedTransfer[]>([]);

  const { loading, data, error, dateRange } = useSupplierOverview(
    currentAccount?.account_id,
    period,
    customFrom,
    customTo,
    refreshKey
  );

  const onRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    Promise.all([
      supplierOperationsApi.getSummary(),
      supplierOperationsApi.getCollections(),
      supplierOperationsApi.getTransfers(),
    ])
      .then(([sumRes, colRes, trfRes]) => {
        setOpsSummary(sumRes.data ?? null);
        setCollections(colRes.data ?? []);
        setTransfers(trfRes.data ?? []);
      })
      .catch(() => {
        setOpsSummary(null);
        setCollections([]);
        setTransfers([]);
      });
  }, [refreshKey]);

  const chartData = useMemo(() => groupCollectionsByDate(collections), [collections]);
  const bdSeries = useMemo(() => breakdownToSeries(data?.breakdown), [data?.breakdown]);
  const transferStats = useMemo(() => getTransferIntakeStats(transfers), [transfers]);
  const qualityGrades = useMemo(() => groupCollectionsByQualityGrade(collections), [collections]);

  /** Prefer `/stats/overview` breakdown (matches dashboards date filter); fallback to logged collections split */
  const chartFromOverview = bdSeries.categories.length > 0;

  const chartCategories = chartFromOverview
    ? bdSeries.categories
    : chartData.map(([d]) => {
        const dt = new Date(d);
        return dt.toLocaleDateString('en-RW', { month: 'short', day: 'numeric' });
      });

  const ownSeries = chartData.map(([, v]) => v.own);
  const externalSeries = chartData.map(([, v]) => v.external);

  const ownTotal = ownSeries.reduce((a, b) => a + b, 0);
  const extTotal = externalSeries.reduce((a, b) => a + b, 0);
  const totalCollected = ownTotal + extTotal;

  const overviewCollTotal = bdSeries.totalCollection;
  const overviewSalesTotal = bdSeries.totalSales;
  const donutFromOps = totalCollected > 0;
  const donutFromOverviewTotals =
    !donutFromOps && (overviewCollTotal > 0 || overviewSalesTotal > 0);
  const saleLitersSummary = Number(data?.summary?.sales?.liters ?? 0);
  const collLitersSummary = Number(data?.summary?.collection?.liters ?? 0);
  const donutFromSummary =
    !donutFromOps &&
    !donutFromOverviewTotals &&
    saleLitersSummary + collLitersSummary > 0;

  // Acceptance rate
  const acceptanceRate = transferStats.submitted > 0
    ? Math.round((transferStats.accepted / transferStats.submitted) * 100)
    : 100;

  // Earnings chart
  const hasEarningsData = bdSeries.salesValues.some((v) => v > 0);
  const totalQualityLiters = qualityGrades.reduce((s, g) => s + g.liters, 0);

  const GRADE_COLORS: Record<string, string> = { A: '#10b981', B: '#3b82f6', C: '#f59e0b', D: '#ef4444', UNGRADED: '#94a3b8' };
  const gradeColor = (grade: string) => GRADE_COLORS[grade.toUpperCase()] ?? GRADE_COLORS.UNGRADED;

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  const summary = data?.summary;
  const lit = Number(summary?.collection?.liters ?? 0);
  const saleLiters = Number(summary?.sales?.liters ?? 0);
  const saleVal = Number(summary?.sales?.value ?? 0);
  const rejLit = Math.max(
    Number(summary?.rejections?.liters ?? 0),
    transferStats.rejectedLiters,
  );
  const rejVal =
    Number(summary?.rejections?.value ?? 0) ||
    (transferStats.rejectedLiters > 0 && saleLiters > 0
      ? transferStats.rejectedLiters * (saleVal / saleLiters)
      : 0);
  const saleTx = Number(summary?.sales?.transactions ?? 0);
  const recentRows = supplierRecentOverviewRows(data?.recent_transactions);

  return (
    <SupplierDashboardShell
      title="Farmer & Collector Dashboard"
      subtitle="Your milk production and collections from other farmers"
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
          label="Total Delivered to MCC"
          value={`${saleLiters.toLocaleString('en-RW', { maximumFractionDigits: 1 })} L`}
          subtitle={
            saleTx > 0
              ? `${saleTx} milk sale${saleTx === 1 ? '' : 's'} recorded at MCC (overview)`
              : lit > 0
                ? `Includes ${lit.toFixed(1)} L as collection totals — no sales rows yet`
                : 'Overview: volume from milk sales to your MCC this period'
          }
          icon={faTruck}
          {...GREEN}
        />
        <StatCard
          label="From Your Farm"
          value={opsSummary ? `${Number(opsSummary.own_collected_liters || 0).toFixed(1)} L` : '—'}
          subtitle={opsSummary ? `Production: ${Number(opsSummary.own_production_liters || 0).toFixed(1)} L` : 'Loading...'}
          icon={faTruck}
          href="/supplier/production"
          {...BLUE}
        />
        <StatCard
          label="Collected from Others"
          value={opsSummary ? `${Number(opsSummary.external_collected_liters || 0).toFixed(1)} L` : '—'}
          subtitle={opsSummary ? `${opsSummary.farms_total} farms managed` : 'Loading...'}
          icon={faUserFriends}
          href="/supplier/farms"
          {...PURPLE}
        />
        <StatCard
          label="Gross Earnings"
          value={formatSupplierCurrency(saleVal)}
          subtitle={
            saleTx > 0
              ? `${saleTx} milk sale${saleTx === 1 ? '' : 's'} · ${saleLiters.toFixed(1)} L`
              : 'Milk payment from MCC sales (overview)'
          }
          icon={faHandHoldingDollar}
          {...AMBER}
        />
      </div>

      {/* KPI Cards Row 2 - Transfer Stats */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Transfer Acceptance</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{acceptanceRate}%</p>
            </div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${acceptanceRate >= 80 ? 'bg-green-100' : 'bg-amber-100'}`}>
              <Icon icon={acceptanceRate >= 80 ? faCheckCircle : faTriangleExclamation} className={acceptanceRate >= 80 ? 'text-green-600' : 'text-amber-600'} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">{transferStats.accepted} of {transferStats.submitted} transfers accepted</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pending Transfers</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{transferStats.pending}</p>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-yellow-100">
              <Icon icon={faTruck} className="text-yellow-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Awaiting MCC processing</p>
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
            {saleTx > 0
              ? `${saleTx} sale record${saleTx === 1 ? '' : 's'} · overview`
              : 'Total milk accepted by MCC (transfers when no overview sales)'}
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
        {/* Collection Trend Chart */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">
              {chartFromOverview
                ? `Volume trend — ${chartPeriodLabel(data?.chart_period)}`
                : 'Collection trend (own vs external, last 14 logged days)'}
            </h3>
            <div className="flex items-center gap-3 text-xs">
              {chartFromOverview ? (
                <>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-slate-500" />
                    Collections
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-emerald-500" />
                    Sold to MCC
                  </span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-blue-500" />
                    Own farm
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-purple-500" />
                    External
                  </span>
                </>
              )}
            </div>
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
                legend: { show: false },
                grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
              }}
              series={[
                { name: 'Collections', data: bdSeries.collectionLiters },
                { name: 'Sold to MCC', data: bdSeries.salesLiters },
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
                colors: ['#3b82f6', '#8b5cf6'],
                xaxis: { categories: chartCategories, labels: { style: { fontSize: '11px' } } },
                yaxis: { labels: { formatter: (v: number) => `${v.toFixed(0)}L`, style: { fontSize: '11px' } } },
                dataLabels: { enabled: false },
                tooltip: { y: { formatter: (v: number) => `${v.toFixed(1)} L` } },
                legend: { show: false },
                grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
              }}
              series={[
                { name: 'Own Farm', data: ownSeries },
                { name: 'External', data: externalSeries },
              ]}
            />
          ) : (
            <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">
              No chart data yet. Record collections or wait for overview breakdown.
            </div>
          )}
        </div>

        {/* Milk Source Breakdown Donut */}
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            {donutFromOps ? 'Milk source (logged collections)' : 'Volume mix (overview)'}
          </h3>
          {donutFromOps ? (
            <>
              <Chart
                type="donut"
                height={200}
                options={{
                  chart: { type: 'donut', fontFamily: 'inherit' },
                  labels: ['Own Farm', 'External Farms'],
                  colors: ['#3b82f6', '#8b5cf6'],
                  legend: { position: 'bottom', fontSize: '12px' },
                  dataLabels: { enabled: true, formatter: (val: number) => `${val.toFixed(0)}%` },
                  plotOptions: {
                    pie: {
                      donut: {
                        size: '65%',
                        labels: {
                          show: true,
                          total: {
                            show: true,
                            label: 'Total',
                            formatter: () => `${totalCollected.toFixed(0)}L`,
                          },
                        },
                      },
                    },
                  },
                }}
                series={[ownTotal, extTotal]}
              />
              <div className="mt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Own Farm</span>
                  <span className="font-medium">
                    {ownTotal.toFixed(1)} L ({totalCollected > 0 ? ((ownTotal / totalCollected) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">External</span>
                  <span className="font-medium">
                    {extTotal.toFixed(1)} L ({totalCollected > 0 ? ((extTotal / totalCollected) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
              </div>
            </>
          ) : donutFromOverviewTotals || donutFromSummary ? (
            (() => {
              const c = donutFromOverviewTotals ? overviewCollTotal : collLitersSummary;
              const s = donutFromOverviewTotals ? overviewSalesTotal : saleLitersSummary;
              const t = c + s;
              return (
                <>
                  <Chart
                    type="donut"
                    height={200}
                    options={{
                      chart: { type: 'donut', fontFamily: 'inherit' },
                      labels: ['Collection volume', 'MCC sales volume'],
                      colors: ['#64748b', '#10b981'],
                      legend: { position: 'bottom', fontSize: '12px' },
                      dataLabels: { enabled: true, formatter: (val: number) => `${val.toFixed(0)}%` },
                      plotOptions: {
                        pie: {
                          donut: {
                            size: '65%',
                            labels: {
                              show: true,
                              total: {
                                show: true,
                                label: 'Total',
                                formatter: () => `${t.toFixed(0)}L`,
                              },
                            },
                          },
                        },
                      },
                    }}
                    series={[c, s]}
                  />
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Collection</span>
                      <span className="font-medium">
                        {c.toFixed(1)} L ({t > 0 ? ((c / t) * 100).toFixed(0) : 0}%)
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Sold to MCC</span>
                      <span className="font-medium">
                        {s.toFixed(1)} L ({t > 0 ? ((s / t) * 100).toFixed(0) : 0}%)
                      </span>
                    </div>
                  </div>
                </>
              );
            })()
          ) : (
            <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">
              No data yet
            </div>
          )}
        </div>
      </div>

      {/* Quality + Earnings Row */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Quality Grade Distribution */}
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Milk Quality Distribution</h3>
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
            </div>
          )}
        </div>

        {/* Earnings Trend */}
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Earnings Trend</h3>
            <span className="text-xs text-gray-500">Total: {formatSupplierCurrency(saleVal)}</span>
          </div>
          {hasEarningsData ? (
            <Chart
              type="bar"
              height={200}
              options={{
                chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'inherit' },
                plotOptions: { bar: { borderRadius: 3, columnWidth: '55%' } },
                colors: ['#10b981'],
                xaxis: { categories: bdSeries.categories, labels: { style: { fontSize: '11px' } } },
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
              series={[{ name: 'Earnings (RF)', data: bdSeries.salesValues }]}
            />
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
              No earnings data for selected period
            </div>
          )}
        </div>
      </div>

      {/* Payment Summary + Rejection Panel */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-sm p-4">
          <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Gross Earnings</p>
          <p className="text-2xl font-bold text-green-800 mt-1">{formatSupplierCurrency(saleVal)}</p>
          <p className="text-xs text-green-600 mt-1">{saleLiters.toFixed(1)} L · {saleTx} sale{saleTx !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-xs font-medium text-red-700 uppercase tracking-wide">Rejection Losses</p>
          <p className="text-2xl font-bold text-red-800 mt-1">{rejLit.toFixed(1)} L</p>
          <p className="text-xs text-red-600 mt-1">{rejVal > 0 ? formatSupplierCurrency(rejVal) : 'No value lost'}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-sm p-4">
          <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Net Estimate</p>
          <p className="text-2xl font-bold text-blue-800 mt-1">{formatSupplierCurrency(Math.max(0, saleVal - rejVal))}</p>
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
            <Icon icon={faTruck} className="text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Record Collection</span>
          </a>
          <a href="/supplier/production" className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-sm transition-colors">
            <Icon icon={faChartLine} className="text-green-600" />
            <span className="text-sm font-medium text-gray-700">Log Production</span>
          </a>
          <a href="/supplier/transfers" className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-sm transition-colors">
            <Icon icon={faHandHoldingDollar} className="text-amber-600" />
            <span className="text-sm font-medium text-gray-700">Submit Transfer</span>
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
