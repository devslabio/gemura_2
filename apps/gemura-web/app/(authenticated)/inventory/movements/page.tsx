'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { inventoryApi, InventoryMovementWithProduct } from '@/lib/api/inventory';
import { useAuthStore } from '@/store/auth';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';
import Icon, { faList, faSpinner, faArrowDown, faArrowUp, faBox } from '@/app/components/Icon';

export default function InventoryMovementsPage() {
  const { currentAccount } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [movements, setMovements] = useState<InventoryMovementWithProduct[]>([]);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{ total: number; total_pages: number; limit: number } | null>(null);

  const loadMovements = useCallback(async (p = 1) => {
    try {
      setLoading(true);
      setError('');
      const res = await inventoryApi.getAllMovements({
        page: p,
        limit: 20,
        account_id: currentAccount?.account_id,
      });
      if (res.code === 200 && res.data) {
        setMovements(res.data.items);
        setPagination(res.data.pagination);
        setPage(p);
      } else {
        setError(res.message || 'Failed to load movements');
      }
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as { message?: string })?.message || 'Failed to load movements');
    } finally {
      setLoading(false);
    }
  }, [currentAccount?.account_id]);

  useEffect(() => {
    loadMovements(1);
  }, [loadMovements]);

  if (loading && movements.length === 0) {
    return <ListPageSkeleton title="Inventory · Movements" filterFields={0} tableRows={15} tableCols={6} />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Movements</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
          <Icon icon={faList} size="sm" className="text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Movement history</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Icon icon={faSpinner} className="animate-spin mr-2" />
            Loading…
          </div>
        ) : movements.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 px-6">No movements recorded yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600 bg-gray-50">
                    <th className="py-3 px-4 font-medium">Product</th>
                    <th className="py-3 px-4 font-medium">Date</th>
                    <th className="py-3 px-4 font-medium">Type</th>
                    <th className="py-3 px-4 font-medium">Direction</th>
                    <th className="py-3 px-4 font-medium text-right">Quantity</th>
                    <th className="py-3 px-4 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => {
                    const isIn = ['adjustment_in', 'purchase_in', 'transfer_in'].includes(m.movement_type);
                    return (
                      <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                        <td className="py-3 px-4">
                          <Link
                            href={`/inventory/${m.product_id}`}
                            className="inline-flex items-center gap-1.5 text-[var(--primary)] hover:underline font-medium"
                          >
                            <Icon icon={faBox} size="sm" className="text-gray-400" />
                            {m.product_name || '—'}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-gray-700 whitespace-nowrap">
                          {new Date(m.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 capitalize text-gray-900">
                          {m.movement_type.replace(/_/g, ' ')}
                        </td>
                        <td className="py-3 px-4">
                          {isIn ? (
                            <span className="inline-flex items-center text-green-700">
                              <Icon icon={faArrowDown} size="sm" className="mr-1" /> In
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-amber-700">
                              <Icon icon={faArrowUp} size="sm" className="mr-1" /> Out
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-gray-900">{m.quantity}</td>
                        <td className="py-3 px-4 text-gray-700">{m.description || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pagination && pagination.total_pages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50/50">
                <span className="text-sm text-gray-500">
                  Page {page} of {pagination.total_pages} ({pagination.total} total)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => loadMovements(page - 1)}
                    disabled={page <= 1}
                    className="btn btn-secondary text-sm py-1.5 px-3 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => loadMovements(page + 1)}
                    disabled={page >= pagination.total_pages}
                    className="btn btn-secondary text-sm py-1.5 px-3 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
