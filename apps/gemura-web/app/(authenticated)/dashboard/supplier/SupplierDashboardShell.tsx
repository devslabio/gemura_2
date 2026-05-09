'use client';

import type { ReactNode } from 'react';
import { type PeriodKey } from '@/lib/utils/dashboardPeriod';

const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: 'day', label: 'Today' },
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'year', label: 'This year' },
  { value: 'custom', label: 'Custom' },
];

interface SupplierDashboardShellProps {
  title: string;
  subtitle: string;
  accountName?: string;
  dateFrom: string;
  dateTo: string;
  period: PeriodKey;
  onPeriodChange: (p: PeriodKey) => void;
  customFrom: string;
  customTo: string;
  onCustomFrom: (v: string) => void;
  onCustomTo: (v: string) => void;
  onRefresh: () => void;
  children: ReactNode;
  footerNote?: string;
}

export default function SupplierDashboardShell({
  title,
  subtitle,
  accountName,
  dateFrom,
  dateTo,
  period,
  onPeriodChange,
  customFrom,
  customTo,
  onCustomFrom,
  onCustomTo,
  onRefresh,
  children,
  footerNote,
}: SupplierDashboardShellProps) {
  return (
    <div className="-mt-1 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between border-b-2 border-gray-200 pb-3 mb-1">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 leading-tight">{title}</h1>
          <p className="text-sm text-gray-600 mt-0.5">{subtitle}</p>
          {accountName && (
            <p className="text-xs text-gray-500 mt-1">
              <span className="font-medium text-gray-700">{accountName}</span>
              <span className="mx-1.5">·</span>
              {dateFrom} – {dateTo}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-0.5">Period</label>
            <select
              value={period}
              onChange={(e) => onPeriodChange(e.target.value as PeriodKey)}
              className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
            >
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {period === 'custom' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-0.5">From</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => onCustomFrom(e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-0.5">To</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => onCustomTo(e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            </>
          )}
          <button
            type="button"
            onClick={onRefresh}
            className="rounded border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>
      {children}
      {footerNote && <p className="text-xs text-gray-500 pt-1">{footerNote}</p>}
    </div>
  );
}
