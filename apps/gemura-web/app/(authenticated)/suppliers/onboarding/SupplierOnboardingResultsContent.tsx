'use client';

import Link from 'next/link';
import {
  FarmerOnboardingPreview,
  CollectorOnboardingPreview,
} from './OnboardingPreview';
import KycOnboardingPreview from './KycOnboardingPreview';
import type { FarmerFormState, CollectorFormState } from './model';
import { computeOnboardingRecordCompletion } from './onboardingRecordCompletion';
import {
  getKycDraftFromRecord,
  isParticipantKycRecord,
  type ParticipantKycOnboardingRecord,
} from './parseKycOnboardingRecord';
import Icon, { faArrowLeft, faUser } from '@/app/components/Icon';

export type SupplierOnboardingResultsContentProps = {
  supplierName: string;
  supplierId: string;
  supplierPhone?: string;
  supplierEmail?: string | null;
  pricePerLiter?: number;
  hasMilkOnboardingKey: boolean;
  onboardingRecord: Record<string, unknown> | null;
  onboardingUpdatedAt: string | null;
  hasRelationship?: boolean;
};

export default function SupplierOnboardingResultsContent({
  supplierName,
  supplierId,
  supplierPhone,
  supplierEmail,
  pricePerLiter,
  hasMilkOnboardingKey,
  onboardingRecord,
  onboardingUpdatedAt,
  hasRelationship = true,
}: SupplierOnboardingResultsContentProps) {
  const backTo = `/suppliers/${supplierId}`;

  const onboardingKycDraft = onboardingRecord ? getKycDraftFromRecord(onboardingRecord) : null;
  const onboardingIsKyc = onboardingRecord ? isParticipantKycRecord(onboardingRecord) : false;
  const onboardingSt = onboardingRecord?.supplier_type;
  const onboardingDraftFarmer =
    !onboardingIsKyc && onboardingSt === 'farmer' && onboardingRecord?.draft
      ? (onboardingRecord.draft as FarmerFormState)
      : null;
  const onboardingDraftCollector =
    !onboardingIsKyc && onboardingSt === 'collector' && onboardingRecord?.draft
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={backTo}
            className="text-sm text-gray-600 hover:text-[var(--primary)] mb-2 inline-flex items-center"
          >
            <Icon icon={faArrowLeft} size="sm" className="mr-2" />
            Back to supplier
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Onboarding results</h1>
          <p className="text-sm text-gray-600 mt-1">{supplierName}</p>
        </div>
        <Link href={backTo} className="btn btn-secondary whitespace-nowrap">
          <Icon icon={faUser} size="sm" className="mr-2" />
          Supplier profile
        </Link>
      </div>

      {!hasMilkOnboardingKey ? (
        <div className="bg-amber-50 border border-amber-200 rounded-sm p-4 text-sm text-amber-950 space-y-2">
          <p>
            This supplier response has no{' '}
            <code className="text-xs px-1 bg-white/70 rounded">milk_onboarding</code> field. The running API build is
            older than this app.
          </p>
          <p className="text-amber-900/85">Redeploy the backend and refresh this page.</p>
        </div>
      ) : onboardingRecord ? (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
            <div className="flex flex-wrap gap-4 justify-between text-sm text-gray-600">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Completion</label>
                <p className="text-gray-900 font-semibold tabular-nums">{onboardingCompletionPct}%</p>
              </div>
              {onboardingUpdatedAt ? (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Last updated</label>
                  <p className="text-gray-900">{new Date(onboardingUpdatedAt).toLocaleString()}</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Wizard answers</h2>
            <div className="space-y-4">
              {onboardingKycDraft ? (
                <KycOnboardingPreview
                  draft={onboardingKycDraft}
                  record={onboardingRecord as ParticipantKycOnboardingRecord}
                  gpsText={onboardingGpsText}
                  commercialHint={{
                    pricePerLiter,
                    phone: supplierPhone,
                    email: supplierEmail ?? undefined,
                  }}
                />
              ) : null}
              {onboardingDraftFarmer ? (
                <FarmerOnboardingPreview
                  f={onboardingDraftFarmer}
                  gpsText={onboardingGpsText}
                  hasNidPhoto={onboardingHasNid}
                  fullPage
                />
              ) : null}
              {onboardingDraftCollector ? (
                <CollectorOnboardingPreview
                  c={onboardingDraftCollector}
                  gpsText={onboardingGpsText}
                  hasNidPhoto={onboardingHasNid}
                  fullPage
                />
              ) : null}
              {!onboardingKycDraft && !onboardingDraftFarmer && !onboardingDraftCollector ? (
                <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  A record exists but is not farmer or collector format, or the draft section is missing. Raw data may
                  be incomplete.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-sm p-6 space-y-2 text-sm text-gray-600">
          <p>
            No milk onboarding data is stored for this supplier, or none is exposed (no linked app user / no onboarding
            row).
          </p>
          {!hasRelationship ? (
            <p className="text-amber-800 text-xs">
              There is no active supplier–MCC relationship for your default account, so onboarding is not attached.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
