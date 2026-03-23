'use client';

import Icon, { faChevronLeft, faChevronRight } from './Icon';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  showInfo?: boolean;
  itemLabel?: string;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  showInfo = true,
  itemLabel = 'items',
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1 && totalItems <= 10) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const getPageNumbers = (): number[] => {
    const pages: number[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else if (currentPage <= 3) {
      for (let i = 1; i <= 5; i++) pages.push(i);
    } else if (currentPage >= totalPages - 2) {
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      for (let i = currentPage - 2; i <= currentPage + 2; i++) pages.push(i);
    }
    return pages;
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) onPageChange(page);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-sm p-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {showInfo && (
          <div className="text-sm text-gray-600 text-center sm:text-left">
            Showing {startItem} to {endItem} of {totalItems} {itemLabel}
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
          <button
            type="button"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={`px-3 py-2 text-sm bg-white border border-gray-300 rounded-sm text-gray-700 transition-all ${
              currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 hover:border-gray-400 cursor-pointer'
            }`}
            aria-label="Previous page"
          >
            <Icon icon={faChevronLeft} size="sm" className="mr-1" />
            Previous
          </button>

          <div className="flex items-center gap-1">
            {getPageNumbers().map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => handlePageChange(pageNum)}
                className={`min-w-[2.5rem] px-3 py-2 text-sm border rounded-sm text-center transition-all ${
                  currentPage === pageNum
                    ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                }`}
              >
                {pageNum}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`px-3 py-2 text-sm bg-white border border-gray-300 rounded-sm text-gray-700 transition-all ${
              currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 hover:border-gray-400 cursor-pointer'
            }`}
            aria-label="Next page"
          >
            Next
            <Icon icon={faChevronRight} size="sm" className="ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
}

