'use client';

import type { OverviewRecentTransaction } from '@/lib/api/stats';
import { formatSupplierCurrency } from './useSupplierOverview';

const TYPE_LABEL: Record<string, string> = {
  collection: 'Collection',
  sale: 'MCC sale',
};

export default function SupplierActivityList({
  rows,
  emptyText,
}: {
  rows: OverviewRecentTransaction[];
  emptyText: string;
}) {
  if (!rows.length) {
    return <p className="text-sm text-gray-500 py-4">{emptyText}</p>;
  }
  return (
    <div className="overflow-x-auto rounded border border-gray-200 bg-white">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Qty (L)</th>
            <th className="px-3 py-2">Amount</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 10).map((r) => (
            <tr key={r.id} className="border-b border-gray-100 last:border-0">
              <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                {r.transaction_at ? new Date(r.transaction_at).toLocaleString() : '—'}
              </td>
              <td className="px-3 py-2 text-gray-800">{TYPE_LABEL[r.type] ?? r.type}</td>
              <td className="px-3 py-2 text-gray-800">{r.quantity != null ? Number(r.quantity).toFixed(1) : '—'}</td>
              <td className="px-3 py-2 text-gray-900 font-medium">
                {formatSupplierCurrency(r.total_amount ?? 0)}
              </td>
              <td className="px-3 py-2 text-gray-600 capitalize">{r.status || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
