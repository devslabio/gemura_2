'use client';

import { useState, useMemo, useEffect } from 'react';
import DataTable, { TableColumn } from './DataTable';
import Pagination from './Pagination';

const FIXED_PAGE_SIZE = 10;

interface DataTableWithPaginationProps<T = unknown> {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  emptyMessage?: string;
  itemLabel?: string;
  showRowNumbers?: boolean;
  onRowClick?: (row: T) => void;
}

export default function DataTableWithPagination<T extends object>({
  data,
  columns,
  loading = false,
  emptyMessage = 'No data available',
  itemLabel = 'items',
  showRowNumbers = true,
  onRowClick,
}: DataTableWithPaginationProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalItems = data.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / FIXED_PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [totalPages, currentPage]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * FIXED_PAGE_SIZE;
    return data.slice(start, start + FIXED_PAGE_SIZE);
  }, [data, currentPage]);

  return (
    <div className="space-y-4">
      <DataTable
        data={paginatedData}
        columns={columns}
        loading={loading}
        emptyMessage={emptyMessage}
        showRowNumbers={showRowNumbers}
        onRowClick={onRowClick}
      />
      {!loading && data.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={FIXED_PAGE_SIZE}
          itemLabel={itemLabel}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}

