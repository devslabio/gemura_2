'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { usePermission } from '@/hooks/usePermission';
import { useCrudPermissions } from '@/hooks/useCrudPermissions';
import { collectionsApi, Collection } from '@/lib/api/collections';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import Icon, { faBox, faUser, faDollarSign, faCalendar, faFileAlt, faEdit, faArrowLeft, faSpinner, faCheckCircle, faBuilding, faTrash } from '@/app/components/Icon';
import { DetailPageSkeleton } from '@/app/components/SkeletonLoader';

const extractRejectionReason = (notes?: string): string => {
  if (!notes) return '';
  const match = notes.match(/^\[REJECTED_REASON: ([^\]]*)\]/);
  return match ? match[1] : '';
};

const stripRejectionReasonFromNotes = (notes?: string): string => {
  if (!notes) return '';
  return notes.replace(/^\[REJECTED_REASON: [^\]]*\]\n?/, '').trim();
};

export default function CollectionDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const collectionId = params.id as string;
  const { currentAccount } = useAuthStore();
  const { hasPermission, isAdmin } = usePermission();
  const { collections: collectionCrud } = useCrudPermissions();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [collection, setCollection] = useState<Collection | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    if (!collection || !confirm('Are you sure you want to cancel this collection?')) return;
    try {
      setCancelling(true);
      await collectionsApi.cancelCollection(collection.id);
      useToastStore.getState().success('Collection cancelled');
      router.push('/collections');
    } catch (err: any) {
      useToastStore.getState().error(err?.response?.data?.message || 'Failed to cancel collection');
    } finally {
      setCancelling(false);
    }
  };

  useEffect(() => {
    if (!hasPermission('view_collections') && !isAdmin()) {
      router.push('/collections');
      return;
    }
    loadCollection();
    // Only re-run when collection or account context changes; hasPermission/isAdmin are stable in behavior
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId, currentAccount?.account_id]);

  const loadCollection = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await collectionsApi.getCollectionById(collectionId, currentAccount?.account_id);
      if (response.code === 200 && response.data) {
        setCollection(response.data);
      } else {
        setError('Failed to load collection data');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load collection. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-RW', {
      style: 'currency',
      currency: 'RWF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return <DetailPageSkeleton />;
  }

  if (error && !collection) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
        <Link href="/collections" className="btn btn-secondary">
          <Icon icon={faArrowLeft} size="sm" className="mr-2" />
          Back to Collections
        </Link>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    accepted: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-700',
    deleted: 'bg-red-100 text-red-700',
  };

  const rejectionReason = extractRejectionReason(collection?.notes);
  const cleanNotes = stripRejectionReasonFromNotes(collection?.notes);

  return (
    <div className="space-y-4">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/collections" className="text-sm text-gray-600 hover:text-(--primary) mb-2 inline-flex items-center">
            <Icon icon={faArrowLeft} size="sm" className="mr-2" />
            Back to Collections
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Collection Details</h1>
        </div>
        <div className="flex items-center gap-2">
          {collection && collection.status !== 'cancelled' && collection.status !== 'deleted' && collectionCrud.update && (
            <>
              <Link href={`/collections/${collectionId}/edit`} className="btn btn-primary">
                <Icon icon={faEdit} size="sm" className="mr-2" />
                Edit Collection
              </Link>
              <button type="button" onClick={handleCancel} disabled={cancelling} className="btn bg-red-600 hover:bg-red-700 text-white border-0">
                <Icon icon={faTrash} size="sm" className="mr-2" />
                {cancelling ? 'Cancelling...' : 'Cancel Collection'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {collection && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Information */}
          <div className="lg:col-span-2 space-y-4">
            {/* Collection Information */}
            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Collection Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Collection ID</label>
                  <p className="text-sm text-gray-900 font-mono">{collection.id}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Status</label>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusColors[collection.status] || 'bg-gray-100 text-gray-700'}`}>
                    {collection.status.charAt(0).toUpperCase() + collection.status.slice(1)}
                  </span>
                </div>

                {collection.status === 'rejected' && rejectionReason && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Rejection Reason</label>
                    <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-50 text-red-700 border border-red-200">
                      {rejectionReason}
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Collection Date</label>
                  <div className="flex items-center text-gray-900">
                    <Icon icon={faCalendar} size="sm" className="mr-2 text-gray-400" />
                    <span>{new Date(collection.collection_at).toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Created At</label>
                  <div className="flex items-center text-gray-900">
                    <Icon icon={faCalendar} size="sm" className="mr-2 text-gray-400" />
                    <span>{new Date(collection.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {(collection.mcc_collection_context ||
              collection.mcc_gate_delivery_id ||
              collection.mcc_manifest_line_id) && (
              <div className="bg-white border border-emerald-100 rounded-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">MCC traceability</h2>
                <p className="text-sm text-gray-700 mb-2">
                  {collection.mcc_collection_context === 'direct_gate' &&
                    'This collection is linked to a direct farmer gate arrival.'}
                  {collection.mcc_collection_context === 'umucunda_manifest_line' &&
                    'This collection is linked to an accepted Umucunda manifest line (per-farmer).'}
                  {!collection.mcc_collection_context &&
                    'This collection has MCC link fields set; open notes or admin tools for full detail.'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {collection.mcc_gate_delivery_id && (
                    <div>
                      <span className="text-gray-500">Gate delivery</span>
                      <p className="font-mono text-gray-900 break-all">{collection.mcc_gate_delivery_id}</p>
                    </div>
                  )}
                  {collection.mcc_manifest_line_id && (
                    <div>
                      <span className="text-gray-500">Manifest line</span>
                      <p className="font-mono text-gray-900 break-all">{collection.mcc_manifest_line_id}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Supplier & Customer Information */}
            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Parties</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Supplier</label>
                  <div className="flex items-center text-gray-900">
                    <Icon icon={faBuilding} size="sm" className="mr-2 text-gray-400" />
                    <div>
                      <div className="font-medium">
                        {collection.supplier_account?.name?.trim() && collection.supplier_account.name.toLowerCase() !== 'system'
                          ? collection.supplier_account.name
                          : (collection.supplier_account?.code ?? '—')}
                      </div>
                      <div className="text-xs text-gray-500">{collection.supplier_account?.code ?? '—'}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Customer</label>
                  <div className="flex items-center text-gray-900">
                    <Icon icon={faUser} size="sm" className="mr-2 text-gray-400" />
                    <div>
                      <div className="font-medium">{collection.customer_account.name}</div>
                      <div className="text-xs text-gray-500">{collection.customer_account.code}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Details */}
            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Financial Details</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Quantity</span>
                  <span className="text-sm font-medium text-gray-900">{Number(collection.quantity).toFixed(2)}L</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Unit Price</span>
                  <span className="text-sm font-medium text-gray-900">{formatCurrency(Number(collection.unit_price))}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-t-2 border-gray-200">
                  <span className="text-base font-semibold text-gray-900">Total Amount</span>
                  <span className="text-lg font-bold text-(--primary)">{formatCurrency(Number(collection.total_amount))}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {cleanNotes && (
              <div className="bg-white border border-gray-200 rounded-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
                <div className="flex items-start">
                  <Icon icon={faFileAlt} size="sm" className="mr-2 text-gray-400 mt-1" />
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{cleanNotes}</p>
                </div>
              </div>
            )}

            {/* Recorded By */}
            {collection.recorded_by && (
              <div className="bg-white border border-gray-200 rounded-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Recorded By</h2>
                <div className="flex items-center">
                  <Icon icon={faUser} size="sm" className="mr-2 text-gray-400" />
                  <div>
                    <div className="font-medium text-gray-900">{collection.recorded_by.name}</div>
                    <div className="text-xs text-gray-500">{collection.recorded_by.phone}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <Link href="/collections" className="btn btn-secondary w-full justify-center">
                  <Icon icon={faArrowLeft} size="sm" className="mr-2" />
                  Back to List
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
