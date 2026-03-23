'use client';

export function SkeletonBar({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton-shimmer rounded-sm bg-gray-200 min-h-[1rem] ${className}`} style={style} />;
}

interface SkeletonLoaderProps {
  lines?: number;
  className?: string;
}

export default function SkeletonLoader({ lines = 3, className = '' }: SkeletonLoaderProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonBar key={index} className={index === lines - 1 ? 'w-3/4' : 'w-full'} style={{ height: '1rem' }} />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 10, cols = 5, showRowNumbers = true }: { rows?: number; cols?: number; showRowNumbers?: boolean }) {
  return (
    <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {showRowNumbers && (
                <th className="px-4 py-3 text-left w-12">
                  <SkeletonBar className="h-3 w-4" />
                </th>
              )}
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="px-4 py-3 text-left">
                  <SkeletonBar className="h-3 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {showRowNumbers && (
                  <td className="px-4 py-3">
                    <SkeletonBar className="h-4 w-4" />
                  </td>
                )}
                {Array.from({ length: cols }).map((_, colIndex) => (
                  <td key={colIndex} className="px-4 py-3">
                    <SkeletonBar className="h-4" style={{ width: colIndex === 0 ? '80%' : colIndex === cols - 1 ? '60%' : '90%' }} />
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

export function ListPageSkeleton({
  title = 'Page',
  filterFields = 4,
  tableRows = 10,
  tableCols = 5,
}: {
  title?: string;
  filterFields?: number;
  tableRows?: number;
  tableCols?: number;
} = {}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <SkeletonBar className="h-10 w-28 rounded-sm" />
      </div>
      <div className="bg-white border border-gray-200 rounded-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          {Array.from({ length: filterFields }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5 min-w-[120px]">
              <SkeletonBar className="h-3 w-16" />
              <SkeletonBar className="h-9 w-full rounded-sm" />
            </div>
          ))}
        </div>
      </div>
      <TableSkeleton rows={tableRows} cols={tableCols} />
    </div>
  );
}

export function DetailPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <SkeletonBar className="h-4 w-4 rounded-sm" />
        <SkeletonBar className="h-6 w-24" />
      </div>
      <SkeletonBar className="h-8 w-48" />
      <div className="bg-white border border-gray-200 rounded-sm p-6 space-y-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <SkeletonBar className="h-3 w-20" />
            <SkeletonBar className="h-10 w-full rounded-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Stat card skeleton – matches StatCard layout (label, value, subtitle, icon box). */
export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-sm border border-gray-200 p-6 min-h-[120px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBar className="h-3 w-24" />
          <SkeletonBar className="h-8 w-28" />
          <SkeletonBar className="h-3 w-full max-w-[140px]" />
        </div>
        <div className="flex-shrink-0 w-12 h-12 rounded-lg skeleton-shimmer bg-gray-200" />
      </div>
    </div>
  );
}

/** Dashboard skeleton – header with tabs, stat cards, charts row, table + quick actions. */
export function DashboardSkeleton() {
  return (
    <div className="-mt-1 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3 pb-3 border-b-2 border-gray-200">
        <SkeletonBar className="h-8 w-40" />
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonBar key={i} className="h-10 w-24 rounded-md" />
          ))}
        </div>
        <SkeletonBar className="h-8 w-28 rounded-sm" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-sm p-6">
          <SkeletonBar className="h-5 w-48 mb-4" />
          <div className="h-[280px] skeleton-shimmer rounded-sm bg-gray-100" />
        </div>
        <div className="bg-white border border-gray-200 rounded-sm p-6">
          <SkeletonBar className="h-5 w-32 mb-4" />
          <div className="h-[280px] rounded-full skeleton-shimmer bg-gray-100 mx-auto max-w-[200px]" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between">
            <SkeletonBar className="h-5 w-36" />
            <SkeletonBar className="h-4 w-16" />
          </div>
          <div className="p-4">
            <TableSkeleton rows={5} cols={5} />
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <SkeletonBar className="h-5 w-28 mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} className="rounded-sm border border-gray-200 p-5">
                <div className="w-11 h-11 rounded-sm skeleton-shimmer bg-gray-200 mx-auto mb-2" />
                <SkeletonBar className="h-4 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

