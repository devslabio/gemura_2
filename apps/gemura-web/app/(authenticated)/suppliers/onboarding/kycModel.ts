/** Supplier KYC onboarding — aligned with Participant Relationship Model (boss mockups). */

export const KYC_STEP_KEYS = [
  'identity',
  'supplier_type',
  'farm_supply',
  'payment',
  'documents',
  'review',
] as const;

export type KycStepKey = (typeof KYC_STEP_KEYS)[number];

export const KYC_STEP_LABELS: Record<KycStepKey, { title: string; subtitle: string }> = {
  identity: { title: 'Identity', subtitle: 'Basic information' },
  supplier_type: { title: 'Supplier type', subtitle: 'Classification & role' },
  farm_supply: { title: 'Farm & supply profile', subtitle: 'Farm and milk profile' },
  payment: { title: 'Payment setup', subtitle: 'Payment & deductions' },
  documents: { title: 'Documents & verification', subtitle: 'Upload & verify' },
  review: { title: 'Review & submit', subtitle: 'Final review' },
};

export type OwnershipStatus = 'member' | 'non_member' | 'shareholder' | 'none';
export type KycSupplierType =
  | 'individual_farmer'
  | 'farmer_aggregator'
  | 'pure_aggregator'
  | 'institutional'
  | 'trader';
export type DeliveryMode = 'direct_mcc' | 'via_route' | 'collection_center' | 'transported';
export type PaymentRecipientKind = 'supplier' | 'designated' | 'organization';
export type MilkPaymentScenario =
  | 'direct_own'
  | 'non_member_farmer'
  | 'farmer_agg_own'
  | 'farmer_agg_collected'
  | 'pure_agg_passthrough';

export type KycDocumentStatus = 'missing' | 'uploaded' | 'pending' | 'verified' | 'rejected';

export type KycDocumentRow = {
  id: string;
  label: string;
  required: boolean;
  conditional?: boolean;
  conditionalHint?: string;
  status: KycDocumentStatus;
  fileName?: string;
  /** Base64 data URL persisted in onboarding JSON for manager review */
  dataUrl?: string;
  mimeType?: string;
  rejectionNote?: string;
};

export type NidPhotoMeta =
  | string
  | {
      file_name?: string;
      mime_type?: string;
      data_url?: string;
      thumb_data_url?: string;
    };

export interface SupplierKycDraft {
  identity: {
    surname: string;
    firstName: string;
    otherNames: string;
    gender: '' | 'male' | 'female' | 'other';
    dateOfBirth: string;
    province: string;
    district: string;
    sector: string;
    cell: string;
    village: string;
    locationVillageId: string;
    primaryPhone: string;
    whatsapp: string;
    nid: string;
  };
  classification: {
    ownershipStatus: '' | OwnershipStatus;
    supplierType: '' | KycSupplierType;
    deliveryMode: '' | DeliveryMode;
    relationshipToMcc: string;
    relationshipSince: string;
    activeStatus: boolean;
    serviceEligibility: string[];
    creditEligible: '' | 'eligible' | 'not_eligible' | 'pending';
    collectionFeeEligible: '' | 'eligible' | 'not_eligible';
    paymentRecipient: '' | PaymentRecipientKind;
    routeParticipation: '' | 'assigned' | 'wants_join' | 'does_not_want';
  };
  farm: {
    farmName: string;
    farmCode: string;
    gpsLat: string;
    gpsLng: string;
    lactatingCows: string;
    totalHerd: string;
    breedType: string;
    housingType: string;
    avgDailyLiters: string;
    peakLiters: string;
    seasonalVariation: string;
    morningLiters: string;
    eveningLiters: string;
    collectionFrequency: string;
    mainRoute: string;
    distanceKm: string;
    primaryDeliveryMode: string;
    qualityScore: string;
    rejectionPct: string;
    avgGrade: string;
    milkCans: string;
    coolingAccess: string;
    waterSource: string;
    electricity: string;
    servicesNeeded: string[];
  };
  payment: {
    paymentMethods: string[];
    momoProvider: string;
    momoNumber: string;
    bankName: string;
    bankAccount: string;
    paymentFrequency: string;
    cutoffTime: string;
    milkPaymentScenario: '' | MilkPaymentScenario;
    collectionFeePct: string;
    collectionFeeApplies: string;
    serviceDeductions: string[];
    withholdingEnabled: boolean;
    withholdingPct: string;
    withholdingTin: string;
    prePaymentEnabled: boolean;
    prePaymentMaxRwf: string;
    walletActivation: boolean;
    notifyPayment: boolean;
    notifyFailures: boolean;
    notifyDeductions: boolean;
    primaryLanguage: string;
    secondaryLanguage: string;
  };
  documents: KycDocumentRow[];
  review: {
    declarationAccurate: boolean;
    declarationConsent: boolean;
    declarationTerms: boolean;
    reviewerNotes: string;
  };
}

export const DEFAULT_KYC_DOCUMENTS: Omit<KycDocumentRow, 'status' | 'fileName'>[] = [
  { id: 'nid', label: 'National ID', required: true },
  { id: 'photo', label: 'Passport photo', required: true },
  { id: 'membership', label: 'Membership proof / share certificate', required: true },
  {
    id: 'business_reg',
    label: 'Business registration (for companies)',
    required: false,
    conditional: true,
    conditionalHint: 'Required for institutional / trader suppliers',
  },
  {
    id: 'route_auth',
    label: 'Route authorization (for aggregators)',
    required: false,
    conditional: true,
    conditionalHint: 'Required for farmer-aggregators and pure aggregators',
  },
  { id: 'vet_card', label: 'Veterinary card / farm verification', required: true },
  { id: 'bank_proof', label: 'Bank proof', required: true },
  { id: 'tax_cert', label: 'Tax certificate', required: true },
];

export function initialKycDocuments(): KycDocumentRow[] {
  return DEFAULT_KYC_DOCUMENTS.map((d) => ({
    ...d,
    status: 'missing' as KycDocumentStatus,
  }));
}

export function initialSupplierKycDraft(): SupplierKycDraft {
  return {
    identity: {
      surname: '',
      firstName: '',
      otherNames: '',
      gender: '',
      dateOfBirth: '',
      province: '',
      district: '',
      sector: '',
      cell: '',
      village: '',
      locationVillageId: '',
      primaryPhone: '',
      whatsapp: '',
      nid: '',
    },
    classification: {
      ownershipStatus: '',
      supplierType: '',
      deliveryMode: '',
      relationshipToMcc: 'active_supplier',
      relationshipSince: '',
      activeStatus: true,
      serviceEligibility: [],
      creditEligible: '',
      collectionFeeEligible: '',
      paymentRecipient: 'supplier',
      routeParticipation: '',
    },
    farm: {
      farmName: '',
      farmCode: '',
      gpsLat: '',
      gpsLng: '',
      lactatingCows: '',
      totalHerd: '',
      breedType: '',
      housingType: '',
      avgDailyLiters: '',
      peakLiters: '',
      seasonalVariation: '',
      morningLiters: '',
      eveningLiters: '',
      collectionFrequency: 'daily',
      mainRoute: '',
      distanceKm: '',
      primaryDeliveryMode: 'milk_can',
      qualityScore: '',
      rejectionPct: '',
      avgGrade: '',
      milkCans: '',
      coolingAccess: '',
      waterSource: '',
      electricity: '',
      servicesNeeded: [],
    },
    payment: {
      paymentMethods: ['momo'],
      momoProvider: 'MTN',
      momoNumber: '',
      bankName: '',
      bankAccount: '',
      paymentFrequency: 'daily',
      cutoffTime: '17:00',
      milkPaymentScenario: '',
      collectionFeePct: '2',
      collectionFeeApplies: 'all_transactions',
      serviceDeductions: ['loan'],
      withholdingEnabled: false,
      withholdingPct: '5',
      withholdingTin: '',
      prePaymentEnabled: false,
      prePaymentMaxRwf: '',
      walletActivation: true,
      notifyPayment: true,
      notifyFailures: true,
      notifyDeductions: true,
      primaryLanguage: 'en',
      secondaryLanguage: 'rw',
    },
    documents: initialKycDocuments(),
    review: {
      declarationAccurate: false,
      declarationConsent: false,
      declarationTerms: false,
      reviewerNotes: '',
    },
  };
}

export function kycFullName(d: SupplierKycDraft): string {
  return `${d.identity.firstName} ${d.identity.surname}`.trim() || d.identity.surname.trim();
}

export function isKycDirty(d: SupplierKycDraft): boolean {
  const base = initialSupplierKycDraft();
  return JSON.stringify(d) !== JSON.stringify(base);
}
