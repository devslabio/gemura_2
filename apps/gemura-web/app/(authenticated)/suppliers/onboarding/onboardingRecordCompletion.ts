import { computeFarmerProgress } from './FarmerOnboardingPath';
import { computeCollectorProgress } from './CollectorOnboardingPath';
import type { CollectorFormState, FarmerFormState } from './model';
import { computeKycRecordCompletion } from './parseKycOnboardingRecord';

/**
 * Rounds 0–100 from stored supplier onboarding record (`buildOnboardingPayload` output or API mirror).
 */
export function computeOnboardingRecordCompletion(record: unknown): number {
  if (!record || typeof record !== 'object') return 0;
  const kycPct = computeKycRecordCompletion(record);
  if (kycPct > 0) return kycPct;
  const r = record as { supplier_type?: string; draft?: unknown };
  if (r.supplier_type === 'farmer' && r.draft && typeof r.draft === 'object') {
    return Math.round(computeFarmerProgress(r.draft as FarmerFormState));
  }
  if (r.supplier_type === 'collector' && r.draft && typeof r.draft === 'object') {
    return Math.round(computeCollectorProgress(r.draft as CollectorFormState));
  }
  return 0;
}
