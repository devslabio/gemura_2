'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { usePermission } from '@/hooks/usePermission';
import { useCrudPermissions } from '@/hooks/useCrudPermissions';
import { suppliersApi, SupplierDetails } from '@/lib/api/suppliers';
import { DetailPageSkeleton } from '@/app/components/SkeletonLoader';
import Modal from '@/app/components/Modal';
import {
  FarmerOnboardingPreview,
  CollectorOnboardingPreview,
} from '../onboarding/OnboardingPreview';
import type { FarmerFormState, CollectorFormState } from '../onboarding/model';
import { computeOnboardingRecordCompletion } from '../onboarding/onboardingRecordCompletion';
import Icon, {
  faBuilding,
  faUser,
  faPhone,
  faEnvelope,
  faIdCard,
  faMapPin,
  faDollarSign,
  faEdit,
  faArrowLeft,
  faCalendar,
  faClipboardList,
} from '@/app/components/Icon';

export default function SupplierDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const supplierId = params.id as string;
  const { hasPermission, isAdmin } = usePermission();
  const { suppliers: supplierCrud } = useCrudPermissions();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [supplier, setSupplier] = useState<SupplierDetails | null>(null);

  const [onboardingModalOpen, setOnboardingModalOpen] = useState(false);
  const [supplierPayloadHasMilkOnboardingKey, setSupplierPayloadHasMilkOnboardingKey] = useState(false);
  const [onboardingRecord, setOnboardingRecord] = useState<Record<string, unknown> | null>(null);
  const [onboardingUpdatedAt, setOnboardingUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPermission('view_suppliers') && !isAdmin()) {
      router.push('/suppliers');
      return;
    }
    loadSupplier();
    // Only re-run when supplier changes; hasPermission/isAdmin are stable in behavior
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  const loadSupplier = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await suppliersApi.getSupplierById(supplierId);
      if (response.code === 200 && response.data) {
        setSupplier(response.data.supplier);
        const mo = response.data.milk_onboarding;
        if (mo?.onboarding != null && typeof mo.onboarding === 'object') {
          setOnboardingRecord(mo.onboarding as Record<string, unknown>);
        } else {
          setOnboardingRecord(null);
        }
        setOnboardingUpdatedAt(mo?.updated_at ?? null);
        setSupplierPayloadHasMilkOnboardingKey(
          response.data != null && Object.prototype.hasOwnProperty.call(response.data, 'milk_onboarding'),
        );
      } else {
        setError('Failed to load supplier data');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load supplier. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openOnboardingModal = () => {
    setOnboardingModalOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-RW', {
      style: 'currency',
      currency: 'RWF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const onboardingSt = onboardingRecord?.supplier_type;
  const onboardingDraftFarmer =
    onboardingSt === 'farmer' && onboardingRecord?.draft
      ? (onboardingRecord.draft as FarmerFormState)
      : null;
  const onboardingDraftCollector =
    onboardingSt === 'collector' && onboardingRecord?.draft
      ? (onboardingRecord.draft as CollectorFormState)
      : null;
  const onboardingGpsText =
    onboardingRecord && typeof onboardingRecord.gps === 'object' && onboardingRecord.gps != null
      ? (() => {
          const g = onboardingRecord.gps as { lat?: number; lng?: number };
          return g.lat != null && g.lng != null ? `${g.lat}, ${g.lng}` : '—';
        })()
      : '—';
  const onboardingHasNid = Boolean(onboardingRecord && onboardingRecord.nid_photo_meta);
  const onboardingCompletionPct = onboardingRecord ? computeOnboardingRecordCompletion(onboardingRecord) : 0;

  if (loading) {
    return <DetailPageSkeleton />;
  }

  if (error && !supplier) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
        <Link href="/suppliers" className="btn btn-secondary">
          <Icon icon={faArrowLeft} size="sm" className="mr-2" />
          Back to Suppliers
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/suppliers" className="text-sm text-gray-600 hover:text-[var(--primary)] mb-2 inline-flex items-center">
            <Icon icon={faArrowLeft} size="sm" className="mr-2" />
            Back to Suppliers
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{supplier?.name || 'Supplier Details'}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(hasPermission('view_suppliers') || isAdmin()) && (
            <button type="button" onClick={openOnboardingModal} className="btn btn-secondary whitespace-nowrap">
              <Icon icon={faClipboardList} size="sm" className="mr-2" />
              Onboarding results
            </button>
          )}
          {supplierCrud.update ? (
            <Link href={`/suppliers/${supplierId}/edit`} className="btn btn-primary whitespace-nowrap">
              <Icon icon={faEdit} size="sm" className="mr-2" />
              Edit Supplier
            </Link>
          ) : null}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {supplier && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Information */}
          <div className="lg:col-span-2 space-y-4">
            {/* Basic Information */}
            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Full Name</label>
                    <div className="flex items-center text-gray-900">
                      <Icon icon={faUser} size="sm" className="mr-2 text-gray-400" />
                      <span>{supplier.user.name}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Phone Number</label>
                    <div className="flex items-center text-gray-900">
                      <Icon icon={faPhone} size="sm" className="mr-2 text-gray-400" />
                      <span>{supplier.user.phone}</span>
                    </div>
                  </div>

                  {supplier.user.email && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Email Address</label>
                      <div className="flex items-center text-gray-900">
                        <Icon icon={faEnvelope} size="sm" className="mr-2 text-gray-400" />
                        <span>{supplier.user.email}</span>
                      </div>
                    </div>
                  )}

                  {supplier.user.nid && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">National ID</label>
                      <div className="flex items-center text-gray-900">
                        <Icon icon={faIdCard} size="sm" className="mr-2 text-gray-400" />
                        <span>{supplier.user.nid}</span>
                      </div>
                    </div>
                  )}

                  {supplier.user.address && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-500 mb-1">Address</label>
                      <div className="flex items-center text-gray-900">
                        <Icon icon={faMapPin} size="sm" className="mr-2 text-gray-400" />
                        <span>{supplier.user.address}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Account Information */}
            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Account Code</label>
                  <div className="flex items-center text-gray-900">
                    <Icon icon={faBuilding} size="sm" className="mr-2 text-gray-400" />
                    <span className="font-mono">{supplier.account_code}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Account Type</label>
                  <span className="capitalize text-gray-900">{supplier.type}</span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Bank Name</label>
                  <span className="text-gray-900">{supplier.bank_name || 'N/A'}</span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Bank Account Number</label>
                  <span className="text-gray-900">{supplier.bank_account_number || 'N/A'}</span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Account Status</label>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    supplier.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {supplier.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Relationship Information */}
            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Relationship Details</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Price per Liter</span>
                  <span className="text-sm font-medium text-gray-900 flex items-center">
                    <Icon icon={faDollarSign} size="sm" className="mr-1 text-gray-400" />
                    {formatCurrency(supplier.relationship.price_per_liter)}
                  </span>
                </div>
                {supplier.relationship.average_supply_quantity && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Average Supply Quantity</span>
                    <span className="text-sm font-medium text-gray-900">
                      {Number(supplier.relationship.average_supply_quantity).toFixed(2)}L
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">Relationship Status</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    supplier.relationship.relationship_status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {supplier.relationship.relationship_status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Account ID</label>
                  <p className="text-sm text-gray-900 font-mono">{supplier.account_id}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Created At</label>
                  <div className="flex items-center text-sm text-gray-900">
                    <Icon icon={faCalendar} size="sm" className="mr-2 text-gray-400" />
                    <span>{new Date(supplier.relationship.created_at).toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Updated At</label>
                  <div className="flex items-center text-sm text-gray-900">
                    <Icon icon={faCalendar} size="sm" className="mr-2 text-gray-400" />
                    <span>{new Date(supplier.relationship.updated_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-2">
                {(hasPermission('view_suppliers') || isAdmin()) && (
                  <button
                    type="button"
                    onClick={openOnboardingModal}
                    className="btn btn-secondary w-full justify-center"
                  >
                    <Icon icon={faClipboardList} size="sm" className="mr-2" />
                    Onboarding results
                  </button>
                )}
                <Link href="/suppliers" className="btn btn-secondary w-full justify-center">
                  <Icon icon={faArrowLeft} size="sm" className="mr-2" />
                  Back to List
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {supplier && onboardingModalOpen ? (
            <Modal
              open={onboardingModalOpen}
              onClose={() => setOnboardingModalOpen(false)}
              title={`Onboarding — ${supplier.name}`}
              maxWidth="max-w-5xl"
            >
              {!supplierPayloadHasMilkOnboardingKey ? (
                <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 space-y-2">
                  <p>
                    This supplier response has no <code className="text-xs px-1 bg-white/70 rounded">milk_onboarding</code>{' '}
                    field. The running API build is older than this app.
                  </p>
                  <p className="text-amber-900/85">Redeploy the backend and refresh this page.</p>
                </div>
              ) : onboardingRecord ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-3 justify-between items-start text-sm text-gray-600">
                    <span>
                      Stored completion (from answers){' '}
                      <strong className="text-gray-900 tabular-nums">{onboardingCompletionPct}%</strong>
                    </span>
                    {onboardingUpdatedAt ? (
                      <span className="text-xs">Last updated: {new Date(onboardingUpdatedAt).toLocaleString()}</span>
                    ) : null}
                  </div>
                  {onboardingDraftFarmer ? (
                    <FarmerOnboardingPreview f={onboardingDraftFarmer} gpsText={onboardingGpsText} hasNidPhoto={onboardingHasNid} />
                  ) : null}
                  {onboardingDraftCollector ? (
                    <CollectorOnboardingPreview c={onboardingDraftCollector} gpsText={onboardingGpsText} hasNidPhoto={onboardingHasNid} />
                  ) : null}
                  {!onboardingDraftFarmer && !onboardingDraftCollector ? (
                    <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                      A record exists but is not farmer or collector format, or the draft section is missing. Raw data may
                      be incomplete.
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2 text-sm text-gray-600">
                  <p>No milk onboarding data is stored for this supplier, or none is exposed (no linked app user / no onboarding row).</p>
                  {!supplier.relationship ? (
                    <p className="text-amber-800 text-xs">There is no active supplier–MCC relationship for your default account, so onboarding is not attached.</p>
                  ) : null}
                </div>
              )}
            </Modal>
      ) : null}
    </div>
  );
}
