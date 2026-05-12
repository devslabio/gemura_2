import type { SupplierDetails } from '@/lib/api/suppliers';
import {
  initialCollectorState,
  initialFarmerState,
  type CollectorFormState,
  type FarmerFormState,
  type MilkCollectorKind,
} from './model';
import type { SupplierOnboardType } from './buildOnboardingPayload';
import { normalizeRwandaPhoneDigits } from './onboardingCommercialValidation';

export interface SupplierCaptureCommercialPrefill {
  regName: string;
  regPhone: string;
  regEmail: string;
  regPricePerLiter: string;
  regNid: string;
  regAddress: string;
  regBankName: string;
  regBankAccount: string;
}

export interface SupplierCapturePrefill {
  supplierType: SupplierOnboardType | null;
  farmer: FarmerFormState | null;
  collector: CollectorFormState | null;
  commercial: SupplierCaptureCommercialPrefill;
}

function splitSupplierName(user: SupplierDetails['user']): { firstName: string; surname: string } {
  const first = user.first_name?.trim() ?? '';
  const last = user.last_name?.trim() ?? '';
  if (first || last) {
    return { firstName: first, surname: last || first };
  }
  const parts = user.name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: '', surname: parts[0] ?? '' };
  }
  return { firstName: parts[0], surname: parts.slice(1).join(' ') };
}

export function buildSupplierCaptureCommercialPrefill(
  supplier: SupplierDetails,
): SupplierCaptureCommercialPrefill {
  const phone = normalizeRwandaPhoneDigits(supplier.user.phone || '');
  const nid = (supplier.user.nid || '').replace(/\D/g, '').slice(0, 16);
  return {
    regName: supplier.user.name,
    regPhone: phone,
    regEmail: supplier.user.email || '',
    regPricePerLiter: String(supplier.relationship?.price_per_liter ?? 390),
    regNid: nid,
    regAddress: supplier.user.address || '',
    regBankName: supplier.bank_name || '',
    regBankAccount: supplier.bank_account_number || '',
  };
}

/** Suggested onboarding path from the linked user profile (picker can override). */
export function inferSupplierCaptureType(supplier: SupplierDetails): SupplierOnboardType | null {
  const accountType = supplier.user.account_type;
  if (accountType === 'farmer') return 'farmer';
  if (accountType === 'supplier') return 'collector';
  return null;
}

export function applyFarmerIdentityFromSupplier(
  supplier: SupplierDetails,
  base: FarmerFormState = initialFarmerState(),
): FarmerFormState {
  const { firstName, surname } = splitSupplierName(supplier.user);
  const phone = normalizeRwandaPhoneDigits(supplier.user.phone || '');
  const nid = (supplier.user.nid || '').replace(/\D/g, '').slice(0, 16);
  return {
    ...base,
    identity: {
      ...base.identity,
      firstName,
      surname,
      primaryPhone: phone,
      nid,
    },
  };
}

export function applyCollectorIdentityFromSupplier(
  supplier: SupplierDetails,
  base: CollectorFormState = initialCollectorState(),
): CollectorFormState {
  const { firstName, surname } = splitSupplierName(supplier.user);
  const phone = normalizeRwandaPhoneDigits(supplier.user.phone || '');
  const nid = (supplier.user.nid || '').replace(/\D/g, '').slice(0, 16);
  const segment = supplier.user.supplier_segment;
  const collectorKind =
    segment === 'farmer_collector' || segment === 'pure_collector'
      ? (segment as MilkCollectorKind)
      : base.collectorKind;
  return {
    ...base,
    collectorKind,
    c1: {
      ...base.c1,
      firstName,
      surname,
      primaryPhone: phone,
      nid,
    },
  };
}

export function buildSupplierCapturePrefill(supplier: SupplierDetails): SupplierCapturePrefill {
  const commercial = buildSupplierCaptureCommercialPrefill(supplier);
  const supplierType = inferSupplierCaptureType(supplier);
  if (supplierType === 'farmer') {
    return {
      supplierType,
      farmer: applyFarmerIdentityFromSupplier(supplier),
      collector: null,
      commercial,
    };
  }
  if (supplierType === 'collector') {
    return {
      supplierType,
      farmer: null,
      collector: applyCollectorIdentityFromSupplier(supplier),
      commercial,
    };
  }
  return { supplierType: null, farmer: null, collector: null, commercial };
}
