import type { KycStepKey, SupplierKycDraft } from './kycModel';
import { KYC_STEP_KEYS } from './kycModel';

function filled(s: string | undefined | null): boolean {
  return Boolean(s?.trim());
}

function stepIdentityDone(d: SupplierKycDraft): boolean {
  const i = d.identity;
  return (
    filled(i.surname) &&
    filled(i.firstName) &&
    filled(i.district) &&
    filled(i.primaryPhone) &&
    i.nid.replace(/\D/g, '').length === 16
  );
}

function stepClassificationDone(d: SupplierKycDraft): boolean {
  const c = d.classification;
  return filled(c.ownershipStatus) && filled(c.supplierType) && filled(c.deliveryMode);
}

function stepFarmDone(d: SupplierKycDraft): boolean {
  const f = d.farm;
  if (d.classification.supplierType === 'pure_aggregator') {
    return filled(f.mainRoute) || filled(f.distanceKm);
  }
  return filled(f.farmName) && filled(f.avgDailyLiters);
}

function stepPaymentDone(d: SupplierKycDraft): boolean {
  const p = d.payment;
  if (!p.paymentMethods.length) return false;
  if (p.paymentMethods.includes('momo') && !filled(p.momoNumber)) return false;
  if (p.paymentMethods.includes('bank') && (!filled(p.bankName) || !filled(p.bankAccount))) return false;
  return filled(p.milkPaymentScenario);
}

function stepDocumentsDone(d: SupplierKycDraft): boolean {
  const required = d.documents.filter((doc) => {
    if (!doc.required) return false;
    if (doc.conditional && d.classification.supplierType !== 'institutional' && doc.id === 'business_reg') {
      return false;
    }
    if (doc.conditional && !['farmer_aggregator', 'pure_aggregator'].includes(d.classification.supplierType) && doc.id === 'route_auth') {
      return false;
    }
    return true;
  });
  if (required.length === 0) return true;
  const uploaded = required.filter((doc) => doc.status !== 'missing');
  return uploaded.length >= Math.min(3, required.length);
}

const STEP_CHECKS: Record<KycStepKey, (d: SupplierKycDraft) => boolean> = {
  identity: stepIdentityDone,
  supplier_type: stepClassificationDone,
  farm_supply: stepFarmDone,
  payment: stepPaymentDone,
  documents: stepDocumentsDone,
  review: (d) =>
    d.review.declarationAccurate && d.review.declarationConsent && d.review.declarationTerms,
};

export function kycStepComplete(step: KycStepKey, draft: SupplierKycDraft): boolean {
  return STEP_CHECKS[step](draft);
}

export function computeKycReadinessPct(draft: SupplierKycDraft, currentStepIndex: number): number {
  const weights = [18, 18, 16, 18, 15, 15];
  let score = 0;
  KYC_STEP_KEYS.forEach((key, i) => {
    if (kycStepComplete(key, draft)) score += weights[i] ?? 0;
    else if (i < currentStepIndex) score += (weights[i] ?? 0) * 0.5;
  });
  return Math.min(100, Math.round(score));
}

export function kycPendingItems(draft: SupplierKycDraft): string[] {
  const items: string[] = [];
  if (!stepIdentityDone(draft)) items.push('Complete identity & NID');
  if (!stepClassificationDone(draft)) items.push('Set supplier classification');
  if (!stepFarmDone(draft)) items.push('Farm & supply profile');
  if (!stepPaymentDone(draft)) items.push('Payment configuration');
  const missingDocs = draft.documents.filter((d) => d.status === 'missing' && d.required).length;
  if (missingDocs > 0) items.push(`${missingDocs} required document(s) missing`);
  if (!draft.review.declarationTerms) items.push('Accept terms on review step');
  return items;
}

export function roleBadgesFromDraft(d: SupplierKycDraft): string[] {
  const badges: string[] = [];
  const c = d.classification;
  if (c.ownershipStatus === 'member') badges.push('Member');
  if (c.ownershipStatus === 'shareholder') badges.push('Shareholder');
  if (c.supplierType === 'individual_farmer') badges.push('Individual farmer');
  if (c.supplierType === 'farmer_aggregator') badges.push('Farmer-aggregator');
  if (c.supplierType === 'pure_aggregator') badges.push('Pure aggregator');
  if (c.deliveryMode === 'direct_mcc') badges.push('Direct to MCC');
  if (c.deliveryMode === 'via_route') badges.push('Via route');
  if (c.activeStatus) badges.push('Active supplier');
  for (const s of c.serviceEligibility) {
    badges.push(`${s.charAt(0).toUpperCase()}${s.slice(1)} eligible`);
  }
  return badges;
}
