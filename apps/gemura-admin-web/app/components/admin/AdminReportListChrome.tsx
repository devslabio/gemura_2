'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import FilterBar, { FilterBarActions, FilterBarExport, FilterBarGroup } from '@/app/components/FilterBar';
import type { ExportColumn } from '@/app/components/FilterBar';
import { ADMIN_REPORT_PAGE_SIZES } from '@/hooks/useAdminReportNavigation';

type AdminReportListChromeProps<T extends object> = {
  title: string;
  backHref: string;
  /** Shown under the title (e.g. resolved UTC window from API). */
  periodHint?: string;
  headerRight?: ReactNode;
  /** When false, date inputs are hidden (e.g. portfolio-wide lists). */
  showDateFilters?: boolean;
  dateFrom?: string;
  dateTo?: string;
  pageSize: number;
  onDateFromChange?: (value: string) => void;
  onDateToChange?: (value: string) => void;
  onPageSizeChange: (value: number) => void;
  onClearFilters: () => void;
  exportFilename: string;
  exportColumns: ExportColumn<T>[];
  exportRows: T[];
  children: ReactNode;
};

export default function AdminReportListChrome<T extends object>({
  title,
  backHref,
  periodHint,
  headerRight,
  showDateFilters = true,
  dateFrom = '',
  dateTo = '',
  pageSize,
  onDateFromChange,
  onDateToChange,
  onPageSizeChange,
  onClearFilters,
  exportFilename,
  exportColumns,
  exportRows,
  children,
}: AdminReportListChromeProps<T>) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link href={backHref} className="text-sm font-medium text-[var(--primary)] hover:underline">
            ← Dashboard overview
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{title}</h1>
          {periodHint ? <p className="mt-1 text-sm text-gray-600">{periodHint}</p> : null}
        </div>
        {headerRight ? <div className="flex shrink-0 flex-wrap items-center gap-2">{headerRight}</div> : null}
      </div>

      <FilterBar>
        {showDateFilters && onDateFromChange && onDateToChange ? (
          <>
            <FilterBarGroup label="Date from">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                className="input h-9 w-full !px-3 !py-1.5 text-sm text-gray-900"
              />
            </FilterBarGroup>
            <FilterBarGroup label="Date to">
              <input
                type="date"
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
                className="input h-9 w-full !px-3 !py-1.5 text-sm text-gray-900"
              />
            </FilterBarGroup>
          </>
        ) : null}
        <FilterBarGroup label="Page size">
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="input h-9 w-full !px-3 !py-1.5 text-sm text-gray-900"
          >
            {ADMIN_REPORT_PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </FilterBarGroup>
        <FilterBarExport data={exportRows} exportFilename={exportFilename} exportColumns={exportColumns} />
        <FilterBarActions onClear={onClearFilters} />
      </FilterBar>

      {children}
    </div>
  );
}
