import type { KycStepKey, SupplierKycDraft } from './kycModel';
import { normalizeRwandaPhoneDigits } from './onboardingCommercialValidation';

export function validateKycStep(step: KycStepKey, draft: SupplierKycDraft): string[] {
  const errs: string[] = [];
  const i = draft.identity;
  const c = draft.classification;
  const f = draft.farm;
  const p = draft.payment;

  switch (step) {
    case 'identity': {
      if (!i.surname.trim()) errs.push('Surname is required.');
      if (!i.firstName.trim()) errs.push('First name is required.');
      if (!i.district.trim()) errs.push('District is required (select location).');
      if (!i.primaryPhone.trim()) errs.push('Primary phone is required.');
      else {
        try {
          normalizeRwandaPhoneDigits(i.primaryPhone);
        } catch {
          errs.push('Phone must be Rwandan format (250XXXXXXXXX).');
        }
      }
      const nid = i.nid.replace(/\D/g, '');
      if (nid.length !== 16 || !/^1[0-9]{15}$/.test(nid)) {
        errs.push('National ID must be 16 digits starting with 1.');
      }
      break;
    }
    case 'supplier_type': {
      if (!c.ownershipStatus) errs.push('Select ownership status.');
      if (!c.supplierType) errs.push('Select supplier type.');
      if (!c.deliveryMode) errs.push('Select delivery mode.');
      if (!c.creditEligible) errs.push('Set credit eligibility.');
      break;
    }
    case 'farm_supply': {
      if (c.supplierType === 'pure_aggregator') {
        if (!f.mainRoute.trim() && !f.distanceKm.trim()) {
          errs.push('Enter main route or distance to MCC for aggregators.');
        }
      } else {
        if (!f.farmName.trim()) errs.push('Farm name is required.');
        if (!f.avgDailyLiters.trim()) errs.push('Average daily milk production is required.');
      }
      break;
    }
    case 'payment': {
      if (!p.paymentMethods.length) errs.push('Select at least one payment method.');
      if (p.paymentMethods.includes('momo') && !p.momoNumber.trim()) {
        errs.push('Mobile money number is required.');
      }
      if (p.paymentMethods.includes('bank') && (!p.bankName.trim() || !p.bankAccount.trim())) {
        errs.push('Bank name and account are required when bank transfer is selected.');
      }
      if (!p.milkPaymentScenario) errs.push('Select a milk payment scenario.');
      break;
    }
    case 'documents': {
      const mustUpload = draft.documents.filter((doc) => {
        if (!doc.required) return false;
        if (doc.id === 'route_auth' && !['farmer_aggregator', 'pure_aggregator'].includes(c.supplierType)) {
          return false;
        }
        if (doc.id === 'business_reg' && !['institutional', 'trader'].includes(c.supplierType)) {
          return false;
        }
        return true;
      });
      const missing = mustUpload.filter((d) => d.status === 'missing');
      if (missing.length > 0) {
        errs.push(`Upload required documents: ${missing.map((m) => m.label).join(', ')}.`);
      }
      break;
    }
    case 'review': {
      if (!draft.review.declarationAccurate) errs.push('Confirm information is accurate.');
      if (!draft.review.declarationConsent) errs.push('Confirm data processing consent.');
      if (!draft.review.declarationTerms) errs.push('Accept terms and conditions.');
      break;
    }
  }
  return errs;
}
