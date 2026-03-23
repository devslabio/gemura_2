'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';

import { PermissionService } from '@/lib/services/permission.service';
import { adminApi, type DashboardStats } from '@/lib/api/admin';
import { useAuthStore } from '@/store/auth';

import Icon, { faUsers, faBuilding, faReceipt, faDollarSign } from '@/app/components/Icon';
import StatCard from '@/app/components/StatCard';
import { DashboardSkeleton } from '@/app/components/SkeletonLoader';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const BLUE_ICON = { iconBgColor: '#eff6ff', iconColor: 'var(--primary)' };
const GREEN_ICON = { iconBgColor: '#dcfce7', iconColor: '#059669' };

type PeriodKey = 'day' | 'week' | 'month' | 'quarter' | 'custom';

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
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'quarter': {
      const q = Math.ceil((now.getMonth() + 1) / 3);
      start = new Date(now.getFullYear(), (q - 1) * 3, 1);
      end = new Date(now.getFullYear(), q * 3, 0);
      break;
    }
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now);
  }

  return { date_from: toYYYYMMDD(start), date_to: toYYYYMMDD(end) };
}

export default function AdminDashboard() {
  const router = useRouter();
  const { currentAccount } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');

  const [period, setPeriod] = useState<PeriodKey>('quarter');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const dateRange = useMemo(
    () => getPeriodRange(period, customFrom || undefined, customTo || undefined),
    [period, customFrom, customTo],
  );

  const periodLabel = useMemo(() => {
    if (period === 'custom') {
      if (customFrom && customTo) return `${customFrom} – ${customTo}`;
      return 'Custom range';
    }
    if (period === 'day') return 'Today';
    if (period === 'week') return 'Last 7 days';
    if (period === 'month') return 'This month';
    if (period === 'quarter') return 'This quarter';
    return 'Selected range';
  }, [period, customFrom, customTo]);

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

  // Like gemura-web, we keep charts readable by plotting only a small trailing window.
  const chartTitleSuffix = selectedDailyTrend.length > lastN ? ` · last ${lastN} days` : '';

  useEffect(() => {
    if (!PermissionService.canViewDashboard() && !PermissionService.isAdmin()) {
      router.push('/dashboard');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    adminApi
      .getDashboardStats(currentAccount?.account_id, { date_from: dateRange.date_from, date_to: dateRange.date_to })
      .then((res) => {
        if (cancelled) return;
        if (res.code === 200 && res.data) setStats(res.data);
        else setError('Failed to load dashboard');
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.response?.data?.message || err?.message || 'Failed to load dashboard');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentAccount?.account_id, router, dateRange.date_from, dateRange.date_to]);

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
    <div className="-mt-1 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3 pb-3 border-b-2 border-gray-200">
        <div className="flex-shrink-0">
          <h1 className="text-2xl font-semibold text-gray-900 leading-tight">Admin Dashboard</h1>
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
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="quarter">Quarter</option>
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

      {/* Stats Grid - ResolveIT-style cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Users"
          value={stats.users.total}
          subtitle={`${stats.users.active} active, ${stats.users.inactive} inactive`}
          icon={faUsers}
          href="/admin/users"
          {...BLUE_ICON}
        />
        <StatCard label="Total Accounts" value={stats.accounts.total} icon={faBuilding} {...BLUE_ICON} />
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
          subtitle={stats.revenue ? `Value of accepted milk sales · ${periodLabel}` : 'Value of accepted milk sales'}
          icon={faDollarSign}
          {...GREEN_ICON}
        />
      </div>

      {/* Charts row: Revenue trend (full width) + Revenue snapshot */}
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

      {/* Donut charts */}
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

      {/* Sales volume full-width bar (last 30 days) */}
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

      {/* Recent Sales */}
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

      {/* Quick Actions */}
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

