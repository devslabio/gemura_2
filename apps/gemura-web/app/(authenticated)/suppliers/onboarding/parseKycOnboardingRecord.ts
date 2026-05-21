import type { NidPhotoMeta, SupplierKycDraft } from './kycModel';
import { computeKycReadinessPct } from './kycOnboardingProgress';

export type ParticipantKycOnboardingRecord = {
  schema_version?: string;
  supplier_type?: string;
  collector_kind?: string;
  kyc?: SupplierKycDraft;
  participant_relationship?: Record<string, unknown>;
  gps?: { lat?: number; lng?: number } | null;
  nid_photo_meta?: NidPhotoMeta | null;
};

export function isParticipantKycRecord(record: unknown): record is ParticipantKycOnboardingRecord {
  if (!record || typeof record !== 'object') return false;
  const r = record as ParticipantKycOnboardingRecord;
  return r.schema_version === 'participant_kyc_v1' || (r.kyc != null && typeof r.kyc === 'object');
}

export function getKycDraftFromRecord(record: unknown): SupplierKycDraft | null {
  if (!isParticipantKycRecord(record) || !record.kyc || typeof record.kyc !== 'object') {
    return null;
  }
  return record.kyc;
}

export function computeKycRecordCompletion(record: unknown): number {
  const draft = getKycDraftFromRecord(record);
  if (!draft) return 0;
  return computeKycReadinessPct(draft, 5);
}
