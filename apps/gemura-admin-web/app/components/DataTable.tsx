'use client';

import { useState } from 'react';
import Icon, { faChevronUp, faChevronDown, faArrowsUpDown } from './Icon';
import { TableSkeleton } from './SkeletonLoader';

export interface TableColumn<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
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
}

export default function DataTable<T = any>({
  data,
  columns,
  loading = false,
  onRowClick,
  showRowNumbers = true,
  emptyMessage = 'No data available',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const aVal = (a as any)[sortKey];
    const bVal = (b as any)[sortKey];
    if (aVal === bVal) return 0;
    const comparison = aVal > bVal ? 1 : -1;
    return sortDirection === 'asc' ? comparison : -comparison;
  });

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

  return (
    <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {showRowNumbers && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-12">#</th>}
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider ${column.className || ''}`}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded -mx-1 px-1 py-0.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 hover:bg-gray-100/80"
                      onClick={() => handleSort(column.key)}
                      aria-label={`Sort by ${column.label}`}
                    >
                      <span>{column.label}</span>
                      <span className="text-gray-400" aria-hidden>
                        {sortKey === column.key ? (
                          sortDirection === 'asc' ? <Icon icon={faChevronUp} size="xs" /> : <Icon icon={faChevronDown} size="xs" />
                        ) : (
                          <Icon icon={faArrowsUpDown} size="xs" />
                        )}
                      </span>
                    </button>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span>{column.label}</span>
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedData.map((row, index) => (
              <tr
                key={index}
                className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {showRowNumbers && <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>}
                {columns.map((column) => (
                  <td key={column.key} className={`px-4 py-3 text-sm text-gray-900 whitespace-nowrap ${column.className || ''}`}>
                    {column.render ? column.render((row as any)[column.key], row, index) : (row as any)[column.key] || '-'}
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

