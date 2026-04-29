'use client';

import { useState } from 'react';
import Icon, { faChevronUp, faChevronDown, faArrowsUpDown } from './Icon';
import { TableSkeleton } from './SkeletonLoader';

export interface TableColumn<T = any> {
  key: string;
  label: string;
  /**
   * `true`  → client-side sort (sorts current page in memory).
   * `'server'` → calls `onSort` prop; visual state driven by `activeSortKey`/`activeSortDir`.
   */
  sortable?: boolean | 'server';
  render?: (value: any, row: T, index: number) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T = any> {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  onRowClick?: (row: T) => void;
  showRowNumbers?: boolean;
  emptyMessage?: string;
  /** Server-sort callback — called when a `sortable: 'server'` column header is clicked. */
  onSort?: (key: string, dir: 'asc' | 'desc') => void;
  /** Currently active server-sort field (controlled from parent). */
  activeSortKey?: string | null;
  /** Currently active server-sort direction (controlled from parent). */
  activeSortDir?: 'asc' | 'desc';
}

export default function DataTable<T = any>({
  data,
  columns,
  loading = false,
  onRowClick,
  showRowNumbers = true,
  emptyMessage = 'No data available',
  onSort,
  activeSortKey = null,
  activeSortDir = 'desc',
}: DataTableProps<T>) {
  const [clientSortKey, setClientSortKey] = useState<string | null>(null);
  const [clientSortDir, setClientSortDir] = useState<'asc' | 'desc'>('asc');

  const handleClientSort = (key: string) => {
    if (clientSortKey === key) {
      setClientSortDir(clientSortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setClientSortKey(key);
      setClientSortDir('asc');
    }
  };

  const handleServerSort = (key: string) => {
    if (!onSort) return;
    const newDir = activeSortKey === key && activeSortDir === 'asc' ? 'desc' : 'asc';
    onSort(key, newDir);
  };

  const sortedData = clientSortKey
    ? [...data].sort((a, b) => {
        const aVal = (a as any)[clientSortKey];
        const bVal = (b as any)[clientSortKey];
        if (aVal === bVal) return 0;
        const cmp = aVal > bVal ? 1 : -1;
        return clientSortDir === 'asc' ? cmp : -cmp;
      })
    : data;

  if (loading) {
    return <TableSkeleton rows={10} cols={columns.length} showRowNumbers={showRowNumbers} />;
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-sm text-gray-500">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  const SortIcon = ({ isActive, dir }: { isActive: boolean; dir: 'asc' | 'desc' }) => (
    <span className={isActive ? 'text-[var(--primary)]' : 'text-gray-400'} aria-hidden>
      {isActive ? (
        dir === 'asc' ? <Icon icon={faChevronUp} size="xs" /> : <Icon icon={faChevronDown} size="xs" />
      ) : (
        <Icon icon={faArrowsUpDown} size="xs" />
      )}
    </span>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {showRowNumbers && (
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-12">
                  #
                </th>
              )}
              {columns.map((column) => {
                const isServerSort = column.sortable === 'server';
                const isClientSort = column.sortable === true;
                const isServerActive = isServerSort && activeSortKey === column.key;
                const isClientActive = isClientSort && clientSortKey === column.key;

                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={`px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider ${column.className || ''}`}
                  >
                    {isServerSort ? (
                      <button
                        type="button"
                        className={`flex w-full min-w-0 items-center gap-1.5 rounded -mx-1 px-1 py-0.5 text-left text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-gray-100/80 ${
                          isServerActive ? 'text-[var(--primary)]' : 'text-gray-600'
                        }`}
                        onClick={() => handleServerSort(column.key)}
                        aria-label={`Sort by ${column.label}`}
                      >
                        <span>{column.label}</span>
                        <SortIcon isActive={isServerActive} dir={isServerActive ? activeSortDir : 'asc'} />
                      </button>
                    ) : isClientSort ? (
                      <button
                        type="button"
                        className={`flex w-full min-w-0 items-center gap-1.5 rounded -mx-1 px-1 py-0.5 text-left text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-gray-100/80 ${
                          isClientActive ? 'text-gray-800' : 'text-gray-500'
                        }`}
                        onClick={() => handleClientSort(column.key)}
                        aria-label={`Sort by ${column.label} (within page)`}
                        title="Sorts within current page"
                      >
                        <span>{column.label}</span>
                        <SortIcon isActive={isClientActive} dir={isClientActive ? clientSortDir : 'asc'} />
                      </button>
                    ) : (
                      <span>{column.label}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedData.map((row, index) => (
              <tr
                key={index}
                className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {showRowNumbers && (
                  <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                )}
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-4 py-3 text-sm text-gray-900 whitespace-nowrap ${column.className || ''}`}
                  >
                    {column.render
                      ? column.render((row as any)[column.key], row, index)
                      : (row as any)[column.key] || '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
