'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { PermissionService } from '@/lib/services/permission.service';

import { DashboardPeriodProvider, useDashboardPeriod } from './dashboard-period-context';

const TABS: Array<{ href: string; label: string; segment: string }> = [
  { href: '/admin/dashboard/overview', label: 'Overview', segment: 'overview' },
  { href: '/admin/dashboard/milk', label: 'Milk & collections', segment: 'milk' },
  { href: '/admin/dashboard/finance', label: 'Finance', segment: 'finance' },
  { href: '/admin/dashboard/usage', label: 'Usage', segment: 'usage' },
];

function PeriodToolbar() {
  const { period, customFrom, customTo, periodLabel, setPeriodPreset, setCustomDates } = useDashboardPeriod();

  return (
    <div className="relative flex-shrink-0">
      <select
        value={period}
        onChange={(e) => setPeriodPreset(e.target.value as typeof period)}
        title={periodLabel}
        aria-label="Period"
        className="min-w-0 w-[128px] rounded border border-gray-300 bg-white py-0.5 pl-1.5 pr-6 text-xs text-gray-900 focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] focus:outline-none"
      >
        <option value="day">Day</option>
        <option value="week">Week</option>
        <option value="month">Month</option>
        <option value="quarter">Quarter</option>
        <option value="year">Year</option>
        <option value="custom">Custom</option>
      </select>

      {period === 'custom' && (
        <div className="absolute top-full right-0 z-10 mt-0.5 flex items-center gap-1.5 rounded border border-gray-200 bg-white px-1.5 py-1.5 shadow-lg">
          <input
            type="date"
            value={customFrom}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setCustomDates(e.target.value, customTo || e.target.value)}
            className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-28"
          />
          <span className="text-gray-400 text-[10px]">–</span>
          <input
            type="date"
            value={customTo}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setCustomDates(customFrom || e.target.value, e.target.value)}
            className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-28"
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
    <div className="-mt-1 space-y-3">
      <div className="mb-2 border-b-2 border-gray-200 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {TABS.map((tab) => {
              const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
              return (
                <Link
                  key={tab.segment}
                  href={`${tab.href}${suffix}`}
                  className={`
                  flex items-center gap-1.5 rounded-t border-b-2 border-transparent px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-all duration-200
                  ${
                    active
                      ? 'border-[var(--primary)] bg-[var(--primary)]/5 font-semibold text-[var(--primary)]'
                      : 'border-transparent bg-transparent text-gray-500 hover:bg-[var(--primary)]/5 hover:text-[var(--primary)]'
                  }
                `}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
          <PeriodToolbar />
        </div>
      </div>

      {children}
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
