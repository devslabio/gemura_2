'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

import { adminApi, type DashboardStats } from '@/lib/api/admin';
import { useAuthStore } from '@/store/auth';

import Icon, { faUsers, faBuilding, faReceipt, faDollarSign } from '@/app/components/Icon';
import StatCard from '@/app/components/StatCard';
import { DashboardSkeleton } from '@/app/components/SkeletonLoader';

import { useDashboardPeriod } from '../../dashboard-period-context';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const BLUE_ICON = { iconBgColor: '#eff6ff', iconColor: 'var(--primary)' };
const GREEN_ICON = { iconBgColor: '#dcfce7', iconColor: '#059669' };

export default function AdminDashboardOverviewPage() {
  const { currentAccount } = useAuthStore();
  const { dateRange, periodLabel } = useDashboardPeriod();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');

  const selectedDailyTrend = useMemo(() => stats?.trends?.daily ?? [], [stats?.trends?.daily]);

  const hasRevenueData = useMemo(
    () => selectedDailyTrend.some((d) => Number(d.revenue) > 0),
    [selectedDailyTrend],
  );

  const hasSalesVolumeData = useMemo(
    () => selectedDailyTrend.some((d) => Number(d.sales) > 0),
    [selectedDailyTrend],
  );

  const lastN = 14;
  const chartDailyTrend = useMemo(() => {
    if (selectedDailyTrend.length <= lastN) return selectedDailyTrend;
    return selectedDailyTrend.slice(-lastN);
  }, [selectedDailyTrend]);

  const chartTitleSuffix = selectedDailyTrend.length > lastN ? ` · last ${lastN} days` : '';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    adminApi
      .getDashboardStats(currentAccount?.account_id, {
        date_from: dateRange.date_from,
        date_to: dateRange.date_to,
      })
      .then((res) => {
        if (cancelled) return;
        if (res.code === 200 && res.data) setStats(res.data);
        else setError('Failed to load dashboard');
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg =
            err && typeof err === 'object' && 'response' in err
              ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
              : undefined;
          setError(msg || (err instanceof Error ? err.message : null) || 'Failed to load dashboard');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentAccount?.account_id, dateRange.date_from, dateRange.date_to]);

  const formatCurrency = (amount: number) => {
    return `RF ${new Intl.NumberFormat('en-RW', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)}`;
  };

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
        <Link href="/admin/users" className="btn btn-secondary">
          Back to Users
        </Link>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Platform snapshot and milk commerce KPIs. Charts below use <span className="font-medium text-gray-800">{periodLabel}</span>{' '}
        where noted; some totals are lifetime aggregates — see labels on cards.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Users"
          value={stats.users.total}
          subtitle={`${stats.users.active} active, ${stats.users.inactive} inactive · all time`}
          icon={faUsers}
          href="/admin/users"
          {...BLUE_ICON}
        />
        <StatCard
          label="Total Accounts"
          value={stats.accounts.total}
          subtitle="All time"
          icon={faBuilding}
          {...BLUE_ICON}
        />
        <StatCard
          label="Total Sales"
          value={stats.sales.total}
          subtitle={`Accepted milk sales · ${periodLabel}`}
          icon={faReceipt}
          {...GREEN_ICON}
        />
        <StatCard
          label="Total Revenue"
          value={stats.revenue ? formatCurrency(stats.revenue.total) : '0'}
          subtitle={`Accepted milk sales · ${periodLabel}`}
          icon={faDollarSign}
          {...GREEN_ICON}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {(stats.trends?.daily?.length ?? 0) > 0 && (
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">{`Revenue (${periodLabel})${chartTitleSuffix}`}</h3>
            {!hasRevenueData ? (
              <div className="h-[280px] flex items-center justify-center text-gray-500 text-sm">
                No data for selected range.
              </div>
            ) : (
              <Chart
                type="area"
                height={280}
                options={{
                  chart: { type: 'area', toolbar: { show: false }, zoom: { enabled: false } },
                  stroke: { curve: 'smooth', width: 2 },
                  fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.7, opacityTo: 0.3, stops: [0, 90, 100] } },
                  colors: ['#004AAD'],
                  xaxis: { categories: chartDailyTrend.map((d) => d.label) ?? [] },
                  yaxis: { labels: { formatter: (v: number) => formatCurrency(v) } },
                  tooltip: { y: { formatter: (v: number) => formatCurrency(v) } },
                  dataLabels: { enabled: false },
                  grid: { strokeDashArray: 3 },
                }}
                series={[{ name: 'Revenue', data: chartDailyTrend.map((d) => d.revenue) ?? [] }]}
              />
            )}
          </div>
        )}

        {stats.revenue && (stats.trends?.daily?.length ?? 0) > 0 && (
          <div className="bg-white border border-gray-200 rounded-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Revenue snapshot</h3>
            {!hasRevenueData ? (
              <div className="h-[280px] flex items-center justify-center text-gray-500 text-sm">
                No data for selected range.
              </div>
            ) : (
              <Chart
                type="bar"
                height={280}
                options={{
                  chart: { type: 'bar', toolbar: { show: false } },
                  plotOptions: { bar: { borderRadius: 6, columnWidth: '60%', distributed: true } },
                  colors: ['#059669'],
                  xaxis: { categories: [periodLabel] },
                  yaxis: { labels: { formatter: (v: number) => formatCurrency(v) } },
                  tooltip: { y: { formatter: (v: number) => formatCurrency(v) } },
                  dataLabels: { enabled: false },
                  grid: { strokeDashArray: 3 },
                  legend: { show: false },
                }}
                series={[{ name: 'Revenue', data: [stats.revenue.total] }]}
              />
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.salesByStatus && stats.salesByStatus.length > 0 && stats.salesByStatus.some((s) => s.count > 0) && (
          <div className="bg-white border border-gray-200 rounded-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Sales by status</h3>
            <Chart
              type="donut"
              height={260}
              options={{
                chart: { type: 'donut', fontFamily: 'inherit' },
                labels: stats.salesByStatus.map((s) => s.status.charAt(0).toUpperCase() + s.status.slice(1)),
                colors: ['#059669', '#d97706', '#dc2626', '#6b7280'],
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
                          formatter: () => String(stats.salesByStatus!.reduce((a, s) => a + s.count, 0)),
                        },
                      },
                    },
                  },
                },
              }}
              series={stats.salesByStatus.map((s) => s.count)}
            />
          </div>
        )}

        {(stats.users.active > 0 || stats.users.inactive > 0) && (
          <div className="bg-white border border-gray-200 rounded-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Users</h3>
            <Chart
              type="donut"
              height={260}
              options={{
                chart: { type: 'donut', fontFamily: 'inherit' },
                labels: ['Active', 'Inactive'],
                colors: ['#004AAD', '#9ca3af'],
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
                          formatter: () => String(stats.users.total),
                        },
                      },
                    },
                  },
                },
              }}
              series={[stats.users.active, stats.users.inactive]}
            />
          </div>
        )}

        {stats.suppliers?.total !== undefined && stats.customers?.total !== undefined && (stats.suppliers.total > 0 || stats.customers.total > 0) && (
          <div className="bg-white border border-gray-200 rounded-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Relationships</h3>
            <Chart
              type="donut"
              height={260}
              options={{
                chart: { type: 'donut', fontFamily: 'inherit' },
                labels: ['Suppliers', 'Customers'],
                colors: ['#7c3aed', '#0891b2'],
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
                          formatter: () => String(stats.suppliers!.total + stats.customers!.total),
                        },
                      },
                    },
                  },
                },
              }}
              series={[stats.suppliers.total, stats.customers.total]}
            />
          </div>
        )}
      </div>

      {(stats.trends?.daily?.length ?? 0) > 0 && (
        <div className="bg-white border border-gray-200 rounded-sm p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">{`Sales volume — ${periodLabel} (liters)${chartTitleSuffix}`}</h3>
          {!hasSalesVolumeData ? (
            <div className="h-[280px] flex items-center justify-center text-gray-500 text-sm">
              No data for selected range.
            </div>
          ) : (
            <Chart
              type="bar"
              height={280}
              options={{
                chart: { type: 'bar', toolbar: { show: false } },
                plotOptions: { bar: { borderRadius: 4, columnWidth: '85%' } },
                colors: ['#059669'],
                xaxis: {
                  categories: chartDailyTrend.map((d) => d.label) ?? [],
                  labels: { rotate: -45, rotateAlways: true },
                },
                yaxis: { title: { text: 'Liters' }, labels: { formatter: (v: number) => String(Math.round(v)) } },
                dataLabels: { enabled: false },
                grid: { strokeDashArray: 3 },
                tooltip: { y: { formatter: (v: number) => `${v} L` } },
              }}
              series={[{ name: 'Volume (L)', data: chartDailyTrend.map((d) => d.sales) ?? [] }]}
            />
          )}
        </div>
      )}

      {stats.recentSales && stats.recentSales.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-sm p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Recent Sales</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Date</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Supplier</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Customer</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Quantity</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Total</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentSales.map((sale) => (
                  <tr key={sale.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-600">{new Date(sale.date).toLocaleDateString()}</td>
                    <td className="py-2 px-3 text-gray-900">{sale.supplier}</td>
                    <td className="py-2 px-3 text-gray-900">{sale.customer}</td>
                    <td className="py-2 px-3 text-right text-gray-600">{sale.quantity} L</td>
                    <td className="py-2 px-3 text-right font-medium text-gray-900">{formatCurrency(sale.total)}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          sale.status === 'accepted'
                            ? 'bg-green-100 text-green-800'
                            : sale.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {sale.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-sm p-4">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/users" className="btn btn-primary text-sm">
            <Icon icon={faUsers} size="sm" className="mr-2" />
            Manage Users
          </Link>
          <Link href="/admin/users/new" className="btn border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm">
            <Icon icon={faUsers} size="sm" className="mr-2" />
            Add User
          </Link>
        </div>
      </div>
    </div>
  );
}
