'use client';

import Icon, { faChevronLeft, faChevronRight } from '@/app/components/Icon';

type WidgetPaginationProps = {
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
};

export function WidgetPagination({
  page,
  total,
  pageSize,
  onPageChange,
  itemLabel = 'rows',
}: WidgetPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const go = (p: number) => {
    if (p >= 1 && p <= totalPages && p !== page) onPageChange(p);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2.5 mt-2 text-[11px] text-gray-600">
      <span className="tabular-nums">
        {start}–{end} of {total} {itemLabel}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          className={`inline-flex items-center gap-0.5 rounded-sm border border-gray-200 px-2 py-1 font-medium text-gray-700 ${
            page <= 1 ? 'cursor-not-allowed opacity-45' : 'hover:bg-gray-50'
          }`}
          aria-label="Previous page"
        >
          <Icon icon={faChevronLeft} size="xs" />
          Prev
        </button>
        <span className="tabular-nums px-1 text-gray-500">
          {page}/{totalPages}
        </span>
        <button
          type="button"
          onClick={() => go(page + 1)}
          disabled={page >= totalPages}
          className={`inline-flex items-center gap-0.5 rounded-sm border border-gray-200 px-2 py-1 font-medium text-gray-700 ${
            page >= totalPages ? 'cursor-not-allowed opacity-45' : 'hover:bg-gray-50'
          }`}
          aria-label="Next page"
        >
          Next
          <Icon icon={faChevronRight} size="xs" />
        </button>
      </div>
    </div>
  );
}
