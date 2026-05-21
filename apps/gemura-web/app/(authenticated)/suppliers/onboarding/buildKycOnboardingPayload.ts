import type { SupplierOnboardType } from './buildOnboardingPayload';
import type { SupplierSegment } from '@/types';
import type { NidPhotoMeta, SupplierKycDraft } from './kycModel';

export type KycAccountDerivation = {
  account_type: 'farmer' | 'supplier';
  supplier_segment?: SupplierSegment;
  supplierType: SupplierOnboardType;
};

/** Map KYC classification → API account_type / supplier_segment (dashboard routing). */
export function deriveAccountFromKyc(draft: SupplierKycDraft): KycAccountDerivation {
  const st = draft.classification.supplierType;
  if (st === 'farmer_aggregator') {
    return {
      account_type: 'supplier',
      supplier_segment: 'farmer_collector',
      supplierType: 'collector',
    };
  }
  if (st === 'pure_aggregator') {
    return {
      account_type: 'supplier',
      supplier_segment: 'pure_collector',
      supplierType: 'collector',
    };
  }
  return {
    account_type: 'farmer',
    supplier_segment: 'direct_farmer',
    supplierType: 'farmer',
  };
}

function buildNidPhotoMeta(draft: SupplierKycDraft): NidPhotoMeta | null {
  const nidDoc =
    draft.documents.find((d) => d.id === 'nid' && d.dataUrl) ||
    draft.documents.find((d) => d.id === 'photo' && d.dataUrl);
  if (nidDoc?.dataUrl) {
    return {
      file_name: nidDoc.fileName || nidDoc.label,
      mime_type: nidDoc.mimeType,
      data_url: nidDoc.dataUrl,
    };
  }
  const named = draft.documents.find((d) => (d.id === 'nid' || d.id === 'photo') && d.fileName);
  return named?.fileName?.trim() || null;
}

export function buildKycOnboardingPayload(
  draft: SupplierKycDraft,
  gps: { lat?: number; lng?: number },
) {
  const derived = deriveAccountFromKyc(draft);
  const gpsOut =
    gps.lat != null && gps.lng != null
      ? { lat: gps.lat, lng: gps.lng }
      : draft.farm.gpsLat && draft.farm.gpsLng
        ? { lat: Number(draft.farm.gpsLat), lng: Number(draft.farm.gpsLng) }
        : null;

  return {
    schema_version: 'participant_kyc_v1' as const,
    supplier_type: derived.supplierType,
    ...(derived.supplier_segment ? { collector_kind: derived.supplier_segment } : {}),
    gps: gpsOut,
    nid_photo_meta: buildNidPhotoMeta(draft),
    kyc: draft,
    participant_relationship: {
      ownership_status: draft.classification.ownershipStatus,
      supplier_type: draft.classification.supplierType,
      delivery_mode: draft.classification.deliveryMode,
      service_eligibility: draft.classification.serviceEligibility,
      credit_eligible: draft.classification.creditEligible,
      payment_recipient: draft.classification.paymentRecipient,
      milk_payment_scenario: draft.payment.milkPaymentScenario,
    },
  };
}
