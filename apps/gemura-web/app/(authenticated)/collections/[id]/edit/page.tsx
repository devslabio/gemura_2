'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { usePermission } from '@/hooks/usePermission';
import { collectionsApi, UpdateCollectionData, Collection, RejectionReason } from '@/lib/api/collections';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import Icon, { faBox, faDollarSign, faCalendar, faFileAlt, faCheckCircle, faTimes, faSpinner } from '@/app/components/Icon';
import { DetailPageSkeleton } from '@/app/components/SkeletonLoader';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

const extractRejectionReason = (notes?: string): string => {
  if (!notes) return '';
  const match = notes.match(/^\[REJECTED_REASON: ([^\]]*)\]/);
  return match ? match[1] : '';
};

const stripRejectionReasonFromNotes = (notes?: string): string => {
  if (!notes) return '';
  return notes.replace(/^\[REJECTED_REASON: [^\]]*\]\n?/, '').trim();
};

export default function EditCollectionPage() {
  const router = useRouter();
  const params = useParams();
  const collectionId = params.id as string;
  const { currentAccount } = useAuthStore();
  const { hasPermission, isAdmin } = usePermission();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingReasons, setLoadingReasons] = useState(true);
  const [error, setError] = useState('');
  const [collection, setCollection] = useState<Collection | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<RejectionReason[]>([]);
  const [formData, setFormData] = useState<UpdateCollectionData & { unit_price: number }>({
    collection_id: collectionId,
    quantity: 0,
    unit_price: 0,
    status: 'accepted',
    collection_at: '',
    notes: '',
    rejection_reason: '',
  });

  useEffect(() => {
    if (!hasPermission('create_collections') && !isAdmin()) {
      router.push('/collections');
      return;
    }
    loadCollection();
    loadRejectionReasons();
    // Only re-run when collection or account context changes; hasPermission/isAdmin are stable in behavior
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId, currentAccount?.account_id]);

  const loadCollection = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await collectionsApi.getCollectionById(collectionId, currentAccount?.account_id);
      if (response.code === 200 && response.data) {
        const collectionData = response.data;
        setCollection(collectionData);
        const rejectionReason = extractRejectionReason(collectionData.notes);
        setFormData({
          collection_id: collectionId,
          quantity: Number(collectionData.quantity),
          unit_price: Number(collectionData.unit_price),
          status: collectionData.status,
          collection_at: collectionData.collection_at ? new Date(collectionData.collection_at).toISOString().slice(0, 16) : '',
          notes: stripRejectionReasonFromNotes(collectionData.notes),
          rejection_reason: rejectionReason,
        });
      } else {
        setError('Failed to load collection data');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load collection. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadRejectionReasons = async () => {
    try {
      const response = await collectionsApi.getRejectionReasons();
      if (response.code === 200) {
        setRejectionReasons(response.data || []);
      }
    } catch (err: any) {
      console.error('Failed to load rejection reasons:', err);
    } finally {
      setLoadingReasons(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'status' && value !== 'rejected' ? { rejection_reason: '' } : {}),
    }));
    setError('');
  };

  const validateForm = (): boolean => {
    if (!formData.quantity || formData.quantity <= 0) {
      setError('Quantity must be greater than 0');
      return false;
    }

    if (formData.status === 'rejected' && !formData.rejection_reason) {
      setError('Rejection reason is required when status is rejected');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setSaving(true);

    try {
      const finalData: UpdateCollectionData = {
        collection_id: collectionId,
        quantity: formData.quantity,
        status: formData.status,
        collection_at: formData.collection_at ? new Date(formData.collection_at).toISOString() : undefined,
        notes: formData.notes,
        rejection_reason: formData.status === 'rejected' ? (formData.rejection_reason || undefined) : undefined,
      };

      const response = await collectionsApi.updateCollection(finalData);

      if (response.code === 200) {
        useToastStore.getState().success('Collection updated successfully!');
        router.push(`/collections/${collectionId}`);
      } else {
        setError(response.message || 'Failed to update collection');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to update collection. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <DetailPageSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Collection</h1>
        </div>
        <Link href={`/collections/${collectionId}`} className="btn btn-secondary">
          <Icon icon={faTimes} size="sm" className="mr-2" />
          Cancel
        </Link>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-sm p-6 space-y-6">
        {/* Collection Details */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Collection Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-2">
                Quantity (Liters) <span className="text-red-500">*</span>
              </label>
              <input
                id="quantity"
                name="quantity"
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.quantity}
                onChange={handleChange}
                className="input w-full"
                placeholder="0.00"
                disabled={saving}
              />
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="input w-full"
                disabled={saving}
              >
                {STATUS_OPTIONS.map(status => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            {formData.status === 'rejected' && (
              <div>
                <label htmlFor="rejection_reason" className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                {loadingReasons ? (
                  <div className="input w-full flex items-center text-gray-500 text-sm"><Icon icon={faSpinner} size="sm" spin className="mr-2" />Loading reasons...</div>
                ) : (
                  <select
                    id="rejection_reason"
                    name="rejection_reason"
                    value={formData.rejection_reason}
                    onChange={handleChange}
                    className="input w-full"
                    disabled={saving}
                    required
                  >
                    <option value="">-- Select a reason --</option>
                    {rejectionReasons.map(r => (
                      <option key={r.id} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div>
              <label htmlFor="collection_at" className="block text-sm font-medium text-gray-700 mb-2">
                <Icon icon={faCalendar} size="sm" className="inline mr-2" />
                Collection Date & Time
              </label>
              <input
                id="collection_at"
                name="collection_at"
                type="datetime-local"
                value={formData.collection_at}
                max={new Date().toISOString().slice(0, 16)}
                onChange={handleChange}
                className="input w-full"
                disabled={saving}
              />
            </div>
          </div>

          {/* Total Calculation */}
          {formData.quantity && formData.unit_price && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Total Amount:</span>
                <span className="text-lg font-bold text-(--primary)">
                  {new Intl.NumberFormat('en-RW', {
                    style: 'currency',
                    currency: 'RWF',
                    minimumFractionDigits: 0,
                  }).format(Number(formData.quantity) * Number(formData.unit_price))}
                </span>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="mt-4">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              <Icon icon={faFileAlt} size="sm" className="inline mr-2" />
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              value={formData.notes}
              onChange={handleChange}
              className="input w-full"
              placeholder="Additional notes about this collection..."
              disabled={saving}
            />
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <Link href={`/collections/${collectionId}`} className="btn btn-secondary" tabIndex={-1}>
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? (
              <>
                <Icon icon={faSpinner} size="sm" spin className="mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Icon icon={faCheckCircle} size="sm" className="mr-2" />
                Update Collection
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
