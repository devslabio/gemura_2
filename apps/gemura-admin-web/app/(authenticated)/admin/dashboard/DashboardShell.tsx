'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import Icon, { faChartLine, faHandHoldingDollar, faWallet } from '@/app/components/Icon';
import { PermissionService } from '@/lib/services/permission.service';

import { DashboardPeriodProvider, useDashboardPeriod } from './dashboard-period-context';

const TABS: Array<{ href: string; label: string; segment: string; icon: typeof faChartLine }> = [
  { href: '/admin/dashboard/overview', label: 'Overview', segment: 'overview', icon: faChartLine },
  { href: '/admin/dashboard/milk', label: 'Milk & collections', segment: 'milk', icon: faHandHoldingDollar },
  { href: '/admin/dashboard/finance', label: 'Finance', segment: 'finance', icon: faWallet },
];

function PeriodToolbar() {
  const { period, customFrom, customTo, periodLabel, setPeriodPreset, setCustomDates } = useDashboardPeriod();

  return (
    <div className="relative flex flex-wrap items-center gap-3 justify-end">
      <span className="text-xs text-gray-500 hidden sm:inline">{periodLabel}</span>
      <select
        value={period}
        onChange={(e) => setPeriodPreset(e.target.value as typeof period)}
        title={periodLabel}
        className="min-w-0 w-[128px] border border-gray-300 rounded py-1 pl-2 pr-7 text-xs text-gray-900 bg-white focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
      >
        <option value="day">Day</option>
        <option value="week">Week</option>
        <option value="month">Month</option>
        <option value="quarter">Quarter</option>
        <option value="custom">Custom</option>
      </select>

      {period === 'custom' && (
        <div className="flex flex-wrap items-center gap-1.5 py-1 px-2 bg-gray-50 border border-gray-200 rounded">
          <input
            type="date"
            value={customFrom}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setCustomDates(e.target.value, customTo || e.target.value)}
            className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-[118px]"
          />
          <span className="text-gray-400 text-[10px]">–</span>
          <input
            type="date"
            value={customTo}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setCustomDates(customFrom || e.target.value, e.target.value)}
            className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-[118px]"
          />
        </div>
      )}
    </div>
  );
}

function DashboardChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const suffix = qs ? `?${qs}` : '';

  return (
    <div className="-mt-1 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between pb-3 border-b-2 border-gray-200">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 leading-tight truncate">Dashboard</h1>
        </div>
        <PeriodToolbar />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-px">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.segment}
              href={`${tab.href}${suffix}`}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-t-md border border-b-0 transition-colors ${
                active
                  ? 'bg-white text-[var(--primary)] border-gray-200 border-b-white -mb-px z-[1] relative'
                  : 'bg-gray-50 text-gray-600 border-transparent hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon icon={tab.icon} size="sm" className="opacity-80" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="pt-1">{children}</div>
    </div>
  );
}

export default function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!PermissionService.canViewDashboard() && !PermissionService.isAdmin()) {
      router.replace('/dashboard');
    }
  }, [router]);

  if (!PermissionService.canViewDashboard() && !PermissionService.isAdmin()) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-gray-500 text-sm">Redirecting…</p>
      </div>
    );
  }

  return (
    <DashboardPeriodProvider>
      <DashboardChrome>{children}</DashboardChrome>
    </DashboardPeriodProvider>
  );
}
