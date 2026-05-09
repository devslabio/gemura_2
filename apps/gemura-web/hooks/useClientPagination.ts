'use client';

import { useEffect, useMemo, useState } from 'react';

/** Matches `DataTableWithPagination` default. */
export const CLIENT_TABLE_PAGE_SIZE = 10;

export interface UseClientPaginationOptions {
  pageSize?: number;
  /** When this value changes (e.g. date filters), current page resets to 1. */
  resetKey?: string | number;
}

export function useClientPagination<T>(items: T[], options?: UseClientPaginationOptions) {
  const pageSize = options?.pageSize ?? CLIENT_TABLE_PAGE_SIZE;
  const resetKey = options?.resetKey;
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (resetKey === undefined) return;
    setPage(1);
  }, [resetKey]);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const startIndex = (page - 1) * pageSize;
  const paginatedItems = useMemo(
    () => items.slice(startIndex, startIndex + pageSize),
    [items, startIndex, pageSize],
  );

  return { page, setPage, paginatedItems, totalPages, totalItems, startIndex, pageSize };
}
