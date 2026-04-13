'use client';

import { useState, useMemo } from 'react';
import Modal from '@/app/components/Modal';
import DataTableWithPagination from '@/app/components/DataTableWithPagination';
import FilterBar, { FilterBarSearch, FilterBarActions, FilterBarExport } from '@/app/components/FilterBar';
import type { TableColumn } from '@/app/components/DataTable';
import type { ExportColumn } from '@/app/components/FilterBar';

const SECTION_PREVIEW_LIMIT = 10;

function defaultSearchFilter<T extends object>(row: T, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase().trim();
  return Object.values(row).some((v) => {
    if (v == null) return false;
    if (typeof v === 'object' && !(v instanceof Date)) return false;
    return String(v).toLowerCase().includes(q);
  });
}

export interface SectionRecordsModalProps<T extends object> {
  open: boolean;
  onClose: () => void;
  title: string;
  data: T[];
  columns: TableColumn<T>[];
  exportColumns: ExportColumn<T>[];
  exportFilename: string;
  emptyMessage?: string;
  itemLabel?: string;
  searchPlaceholder?: string;
  /** Optional custom search filter. Default searches across all primitive values. */
  searchFilter?: (row: T, query: string) => boolean;
}

/**
 * Modal that shows a full list of records with search, pagination, and CSV export.
 * Used when a profile section (e.g. weight history, health records) has more than 10 items.
 */
export default function SectionRecordsModal<T extends object>({
  open,
  onClose,
  title,
  data,
  columns,
  exportColumns,
  exportFilename,
  emptyMessage = 'No records',
  itemLabel = 'records',
  searchPlaceholder = 'Search...',
  searchFilter = defaultSearchFilter,
}: SectionRecordsModalProps<T>) {
  const [search, setSearch] = useState('');

  const filteredData = useMemo(() => {
    return data.filter((row) => searchFilter(row, search));
  }, [data, search, searchFilter]);

  const handleClear = () => setSearch('');

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-5xl">
      <div className="space-y-4">
        <FilterBar>
          <FilterBarSearch
            value={search}
            onChange={setSearch}
            placeholder={searchPlaceholder}
          />
          <FilterBarActions onClear={handleClear} />
          <FilterBarExport
            data={filteredData}
            exportFilename={exportFilename}
            exportColumns={exportColumns}
          />
        </FilterBar>

        <DataTableWithPagination<T>
          data={filteredData}
          columns={columns}
          emptyMessage={emptyMessage}
          itemLabel={itemLabel}
          showRowNumbers
        />
      </div>
    </Modal>
  );
}

export { SECTION_PREVIEW_LIMIT };
