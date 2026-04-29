'use client';

import { ReactNode } from 'react';
import Icon, { faSearch, faTimes, faDownload, faCheck } from './Icon';
import { exportToCsv } from '@/lib/utils/export-csv';

export interface ExportColumn<T = unknown> {
  key: string;
  label: string;
  getValue?: (row: T) => string;
}

export function FilterBarGroup({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 min-w-0 flex-1 basis-full sm:basis-[calc(50%-0.375rem)] md:basis-auto md:min-w-[140px] lg:min-w-[180px] ${className}`}>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

export function FilterBarSearch({
  value,
  onChange,
  placeholder = 'Search...',
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0 flex-1 basis-full sm:basis-[calc(50%-0.375rem)] md:basis-auto md:min-w-[200px] lg:min-w-[240px]">
      <label className="text-sm font-medium text-gray-700">Search</label>
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center pointer-events-none text-gray-400">
          <Icon icon={faSearch} size="sm" />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="input w-full !pl-11 h-9 text-sm placeholder:text-gray-500"
        />
      </div>
    </div>
  );
}

export function FilterBarActions({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col gap-1.5 flex-shrink-0 min-w-0 basis-full sm:basis-auto">
      <label className="text-sm font-medium text-gray-700 invisible select-none">Actions</label>
      <button
        type="button"
        onClick={onClear}
        className="inline-flex items-center justify-center gap-1.5 h-9 px-4 text-sm font-medium text-gray-700 bg-gray-100 border-0 rounded hover:bg-gray-200 transition-colors"
      >
        <Icon icon={faTimes} size="sm" />
        Clear
      </button>
    </div>
  );
}

export function FilterBarApply({ onApply }: { onApply: () => void }) {
  return (
    <div className="flex flex-col gap-1.5 flex-shrink-0 min-w-0 basis-full sm:basis-auto">
      <label className="text-sm font-medium text-gray-700 invisible select-none">Apply</label>
      <button
        type="button"
        onClick={onApply}
        className="inline-flex items-center justify-center gap-1.5 h-9 px-4 text-sm font-medium bg-[var(--primary)] text-white border-0 rounded hover:opacity-90 transition-colors"
      >
        <Icon icon={faCheck} size="sm" />
        Apply
      </button>
    </div>
  );
}

export function FilterBarExport<T extends object>({
  data,
  exportFilename,
  exportColumns,
  disabled = false,
}: {
  data: T[];
  exportFilename: string;
  exportColumns: ExportColumn<T>[];
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 flex-shrink-0 min-w-0 basis-full sm:basis-auto">
      <label className="text-sm font-medium text-gray-700 invisible select-none">Export</label>
      <button
        type="button"
        onClick={() => exportToCsv(data, exportColumns, exportFilename)}
        disabled={disabled || data.length === 0}
        className="inline-flex items-center justify-center gap-1.5 h-9 px-4 text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Icon icon={faDownload} size="sm" />
        Export CSV
      </button>
    </div>
  );
}

export default function FilterBar({
  children,
  alignItems = 'end',
}: {
  children: ReactNode;
  alignItems?: 'center' | 'end';
}) {
  return (
    <div
      className={`relative z-20 flex flex-wrap gap-3 md:gap-4 p-3 md:p-4 bg-white border border-gray-200 rounded mb-4 ${alignItems === 'center' ? 'items-center' : 'items-end'}`}
    >
      {children}
    </div>
  );
}

