/** Supplier onboarding draft — UI-only; aligns with gemura_supplier_onboarding_dev_prompt.md output shape. */

export type BreedKey = 'friesian' | 'jersey' | 'cross' | 'local' | 'other';

export const BREEDS: BreedKey[] = ['friesian', 'jersey', 'cross', 'local', 'other'];

export const REFUGEE_DISTRICTS = ['Gicumbi', 'Kirehe', 'Nyamasheke', 'Rusizi', 'Nyabihu', 'Bugesera'] as const;

export type GpsUiStatus = 'idle' | 'acquiring' | 'captured' | 'unavailable';

/**
 * Milk collector profile (MCC spec): farmer–collector (own + others) vs pure collection only.
 * Direct-to-MCC suppliers use the separate `farmer` supplier flow, not these values.
 */
export type MilkCollectorKind = 'farmer_collector' | 'pure_collector';

export const MILK_COLLECTOR_KIND: Record<
  MilkCollectorKind,
  { label: string; description: string }
> = {
  farmer_collector: {
    label: 'Farmer–collector',
    description:
      'You produce milk and also collect from other farms. Own milk and collection fee are separate; farm-by-farm manifest applies to collected milk.',
  },
  pure_collector: {
    label: 'Pure collector',
    description:
      'You do not sell your own production here — you only collect for others. Performance is mainly manifest and route compliance (no credit product in the collector role).',
  },
};

export interface FarmerFormState {
  identity: {
    surname: string;
    firstName: string;
    otherNames: string;
    province: string;
    district: string;
    sector: string;
    cell: string;
    village: string;
    /** Deepest selected village UUID for `/locations/:id/path` reload (Orora-style). */
    locationVillageId: string;
    primaryPhone: string;
    whatsapp: string;
    nid: string;
    distanceMccKm: string;
    whoBringsMilk: '' | 'self' | 'cowboy' | 'coop_transport' | 'other';
    whoBringsOther: string;
    businessType: '' | 'informal' | 'rdb' | 'cooperative' | 'ltd';
    ownerDisability: '' | 'yes' | 'no' | 'prefer_not';
    coopMembers: string;
    coopWomen: string;
    coopYouth1835: string;
    coopYoungWomen: string;
  };
  herd: {
    totalCows: string;
    breedCounts: Record<BreedKey, string>;
    lactatingByBreed: Record<BreedKey, string>;
    avgDailyPerCowByBreed: Record<BreedKey, string>;
    peakTotal: string;
    lowTotal: string;
    soldPct: '' | 'lt25' | '25_50' | '51_75' | 'gt75';
    salesChannels: string[];
    otherMccName: string;
  };
  lactation: {
    lactationPerBreed: Record<BreedKey, '' | 'lt305' | 'eq305' | 'gt305'>;
    calvingIntervalByBreed: Record<BreedKey, string>;
    breedingMethod: string[];
    cowsInsured: '' | 'all' | 'some' | 'no' | 'unsure';
    cowsInsuredCount: string;
    insuranceProvider: string;
  };
  farming: {
    grazing: '' | 'open' | 'zero' | 'semi' | 'mixed';
    feedTypes: string[];
    cleanWater: '' | 'daily' | 'sometimes' | 'no';
    waterSource: string[];
    dairyHa: string;
    otherHa: string;
    infrastructure: string[];
  };
  management: {
    dedicatedManager: '' | 'yes_ft' | 'self' | 'none';
    managerName: string;
    vetAccess: '' | 'regular' | 'call' | 'chw' | 'none';
    biosecurity: string[];
    training3y: '' | 'yes' | 'no';
    trainingProvider: string;
    subsidy: '' | 'yes' | 'no';
    grantSource: string;
    grantWhat: string;
  };
  workforce: {
    total: string;
    women: string;
    aged1835: string;
    women1835: string;
    disabled: string;
    managerSex: '' | 'male' | 'female';
    managerAge: string;
  };
  financeFarmer: {
    records: '' | 'none' | 'paper' | 'phone' | 'app' | 'mcc' | 'other';
    paymentMethods: string[];
    phoneType: '' | 'basic' | 'smart' | 'none';
    momoWilling: '' | 'happy' | 'try' | 'unsure' | 'cash';
    borrowed: '' | 'yes' | 'no';
    borrowSources: string[];
    annualRevenueRwf: string;
    creditIntent: string[];
  };
  goalsFarmer: {
    goal12m: string;
    supplyDays: string;
    missed4w: string;
    missedReason: string;
    scaleCapacity: string;
  };
  agentFarmer: {
    pathwayP1: '' | 'qualifies' | 'not';
    pathwayP1Reason: string;
    breedImprovement: '' | 'yes' | 'no';
    creditTier: '' | 'starter' | 'reliable';
    notes: string;
  };
}

export interface CollectorFormState {
  /** Set on type picker before the wizard. */
  collectorKind: '' | MilkCollectorKind;
  c1: {
    surname: string;
    firstName: string;
    otherNames: string;
    primaryPhone: string;
    whatsapp: string;
    nid: string;
    province: string;
    district: string;
    sector: string;
    cell: string;
    village: string;
    /** Deepest selected village UUID for `/locations/:id/path` reload (Orora-style). */
    locationVillageId: string;
    linkedMcc: string;
    linkedMccOther: string;
    ownerDisability: '' | 'yes' | 'no' | 'prefer_not';
    businessType: '' | 'informal' | 'rdb' | 'coop_member' | 'ltd';
  };
  c2: {
    sector: string;
    cells: string;
    radiusKm: string;
    farmCount: string;
    daysWeek: string;
    peakL: string;
    lowL: string;
    transport: string[];
    transportOther: string;
    cooling: '' | 'yes' | 'no';
    coolingDetail: string;
    transitMin: string;
    otherDestinations: string[];
    otherMccName: string;
  };
  roster: { id: string; nameOrId: string; registration: '' | 'registered' | 'not_registered' }[];
  workforceC: {
    total: string;
    women: string;
    aged1835: string;
    women1835: string;
    disabled: string;
  };
  financeC: {
    records: '' | 'none' | 'paper' | 'phone' | 'app';
    paysFarmers: string[];
    phoneType: '' | 'basic' | 'smart' | 'none';
    momoWilling: '' | 'happy' | 'try' | 'unsure' | 'cash';
    borrowed: '' | 'yes' | 'no';
    annualRevenueRwf: string;
    creditIntent: string[];
  };
  goalsC: {
    goal12m: string;
    missed4w: string;
    missedReason: string;
    scaleCapacity: string;
  };
  agentCollector: {
    pathwayP4: '' | 'qualifies' | 'not';
    reason: string;
    unregisteredFollowup: '' | 'yes' | 'no';
    creditTier: '' | 'starter' | 'reliable';
    notes: string;
  };
}

export function emptyBreedRecord(): Record<BreedKey, string> {
  return { friesian: '', jersey: '', cross: '', local: '', other: '' };
}

export function emptyLactationBand(): Record<BreedKey, '' | 'lt305' | 'eq305' | 'gt305'> {
  return { friesian: '', jersey: '', cross: '', local: '', other: '' };
}

export function initialFarmerState(): FarmerFormState {
  return {
    identity: {
      surname: '',
      firstName: '',
      otherNames: '',
      province: '',
      district: '',
      sector: '',
      cell: '',
      village: '',
      locationVillageId: '',
      primaryPhone: '',
      whatsapp: '',
      nid: '',
      distanceMccKm: '',
      whoBringsMilk: '',
      whoBringsOther: '',
      businessType: '',
      ownerDisability: '',
      coopMembers: '',
      coopWomen: '',
      coopYouth1835: '',
      coopYoungWomen: '',
    },
    herd: {
      totalCows: '',
      breedCounts: emptyBreedRecord(),
      lactatingByBreed: emptyBreedRecord(),
      avgDailyPerCowByBreed: emptyBreedRecord(),
      peakTotal: '',
      lowTotal: '',
      soldPct: '',
      salesChannels: [],
      otherMccName: '',
    },
    lactation: {
      lactationPerBreed: emptyLactationBand(),
      calvingIntervalByBreed: emptyBreedRecord(),
      breedingMethod: [],
      cowsInsured: '',
      cowsInsuredCount: '',
      insuranceProvider: '',
    },
    farming: {
      grazing: '',
      feedTypes: [],
      cleanWater: '',
      waterSource: [],
      dairyHa: '',
      otherHa: '',
      infrastructure: [],
    },
    management: {
      dedicatedManager: '',
      managerName: '',
      vetAccess: '',
      biosecurity: [],
      training3y: '',
      trainingProvider: '',
      subsidy: '',
      grantSource: '',
      grantWhat: '',
    },
    workforce: {
      total: '',
      women: '',
      aged1835: '',
      women1835: '',
      disabled: '',
      managerSex: '',
      managerAge: '',
    },
    financeFarmer: {
      records: '',
      paymentMethods: [],
      phoneType: '',
      momoWilling: '',
      borrowed: '',
      borrowSources: [],
      annualRevenueRwf: '',
      creditIntent: [],
    },
    goalsFarmer: {
      goal12m: '',
      supplyDays: '',
      missed4w: '',
      missedReason: '',
      scaleCapacity: '',
    },
    agentFarmer: {
      pathwayP1: '',
      pathwayP1Reason: '',
      breedImprovement: '',
      creditTier: '',
      notes: '',
    },
  };
}

export function initialCollectorState(): CollectorFormState {
  return {
    collectorKind: '',
    c1: {
      surname: '',
      firstName: '',
      otherNames: '',
      primaryPhone: '',
      whatsapp: '',
      nid: '',
      province: '',
      district: '',
      sector: '',
      cell: '',
      village: '',
      locationVillageId: '',
      linkedMcc: '',
      linkedMccOther: '',
      ownerDisability: '',
      businessType: '',
    },
    c2: {
      sector: '',
      cells: '',
      radiusKm: '',
      farmCount: '',
      daysWeek: '',
      peakL: '',
      lowL: '',
      transport: [],
      transportOther: '',
      cooling: '',
      coolingDetail: '',
      transitMin: '',
      otherDestinations: [],
      otherMccName: '',
    },
    roster: [],
    workforceC: {
      total: '',
      women: '',
      aged1835: '',
      women1835: '',
      disabled: '',
    },
    financeC: {
      records: '',
      paysFarmers: [],
      phoneType: '',
      momoWilling: '',
      borrowed: '',
      annualRevenueRwf: '',
      creditIntent: [],
    },
    goalsC: {
      goal12m: '',
      missed4w: '',
      missedReason: '',
      scaleCapacity: '',
    },
    agentCollector: {
      pathwayP4: '',
      reason: '',
      unregisteredFollowup: '',
      creditTier: '',
      notes: '',
    },
  };
}

export function isFarmerDirty(f: FarmerFormState): boolean {
  const i = f.identity;
  if (i.surname || i.firstName || i.primaryPhone || i.nid || i.district) return true;
  if (f.herd.totalCows || f.herd.peakTotal) return true;
  return JSON.stringify(f) !== JSON.stringify(initialFarmerState());
}

export function isCollectorDirty(c: CollectorFormState): boolean {
  if (c.collectorKind) return true;
  const x = c.c1;
  if (x.surname || x.firstName || x.primaryPhone || x.nid) return true;
  if (c.roster.length > 0) return true;
  return JSON.stringify(c) !== JSON.stringify(initialCollectorState());
}
