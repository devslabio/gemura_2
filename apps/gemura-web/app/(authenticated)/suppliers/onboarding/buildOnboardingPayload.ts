import { computeCollectorAutoSummary, computeFarmerAutoSummary } from './onboardingAutoResults';
import { deriveFarmerVibeCodes } from './vibeReporting';
import type { CollectorFormState, FarmerFormState } from './model';

export type SupplierOnboardType = 'farmer' | 'collector';

/**
 * Server-ready onboarding payload (same shape as the previous inline buildPayload in the modal).
 */
export function buildOnboardingPayload(
  type: SupplierOnboardType,
  farmer: FarmerFormState,
  collector: CollectorFormState,
  gps: { lat?: number; lng?: number; manualLat: string; manualLng: string },
  nidPhotoName: string | null
) {
  const gpsOut =
    gps.lat != null && gps.lng != null
      ? { lat: gps.lat, lng: gps.lng }
      : gps.manualLat && gps.manualLng
        ? { lat: Number(gps.manualLat), lng: Number(gps.manualLng) }
        : null;

  if (type === 'farmer') {
    return {
      supplier_type: 'farmer' as const,
      gps: gpsOut,
      nid_photo_meta: nidPhotoName,
      draft: farmer,
      agent: farmer.agentFarmer,
      vibe_reporting: deriveFarmerVibeCodes(farmer),
      assessment: computeFarmerAutoSummary(farmer, { districtForRefugee: farmer.identity.district }),
    };
  }
  return {
    supplier_type: 'collector' as const,
    ...(collector.collectorKind
      ? { collector_kind: collector.collectorKind as 'farmer_collector' | 'pure_collector' }
      : {}),
    gps: gpsOut,
    nid_photo_meta: nidPhotoName,
    draft: collector,
    agent: collector.agentCollector,
    assessment: computeCollectorAutoSummary(collector, { districtForRefugee: collector.c1.district }),
  };
}
