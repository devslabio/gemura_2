/**
 * Validates each onboarding wizard screen before advancing (Next).
 * Mirrors key business rules — phone/NID reuse commercial validation helpers.
 */

import type { FarmerFormState } from './model';
import type { CollectorFormState } from './model';
import { BREEDS } from './model';
import type { FarmerWizardStep } from './FarmerOnboardingPath';
import type { CollectorWizardStep } from './CollectorOnboardingPath';
import { isRwandaMobileLine, isRwandanNationalId } from './onboardingCommercialValidation';

function parseFinite(s: string): number | null {
  const n = Number.parseFloat(String(s).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function nf(s: string): number | null {
  const n = parseFinite(s);
  return n !== null && n >= 0 ? n : null;
}

export function validateOnboardingSetupStep(args: {
  gpsLat?: number;
  gpsLng?: number;
  manualLat: string;
  manualLng: string;
}): string[] {
  const hasGps =
    args.gpsLat != null &&
    args.gpsLng != null &&
    Number.isFinite(args.gpsLat) &&
    Number.isFinite(args.gpsLng);

  if (hasGps) return [];

  const lat = parseFinite(args.manualLat);
  const lng = parseFinite(args.manualLng);
  const msgs: string[] = [];
  if (lat === null || lng === null || args.manualLat.trim() === '' || args.manualLng.trim() === '') {
    msgs.push('Capture GPS or enter manual latitude and longitude (decimal numbers).');
    return msgs;
  }
  if (lat < -90 || lat > 90) msgs.push('Latitude must be between −90° and 90°.');
  if (lng < -180 || lng > 180) msgs.push('Longitude must be between −180° and 180°.');
  return msgs;
}

export function validateFarmerWizardStep(step: FarmerWizardStep, f: FarmerFormState): string[] {
  const e: string[] = [];
  const id = f.identity;

  if (step === 'f1') {
    if (!id.surname.trim()) e.push('Enter surname.');
    if (!id.firstName.trim()) e.push('Enter first name.');
    if (!id.province.trim()) e.push('Enter province.');
    if (!id.district.trim()) e.push('Enter district.');
    if (!id.sector.trim()) e.push('Enter sector.');
    if (!id.cell.trim()) e.push('Enter cell.');
    if (!id.village.trim()) e.push('Enter village.');
    if (!isRwandaMobileLine(id.primaryPhone)) e.push('Primary phone must be valid Rwandan format (250… or local 078…).');
    const wa = id.whatsapp.trim();
    if (wa && !isRwandaMobileLine(wa)) e.push('WhatsApp must use valid Rwandan format when filled.');
    if (!isRwandanNationalId(id.nid)) e.push('National ID must be 16 digits starting with 1.');
    const km = parseFinite(id.distanceMccKm);
    if (id.distanceMccKm.trim() === '' || km === null || km < 0) e.push('Enter distance to MCC in km (0 or positive number).');
    if (!id.whoBringsMilk) e.push('Select who brings the milk.');
    if (id.whoBringsMilk === 'other' && !id.whoBringsOther.trim()) e.push('Describe who brings the milk (Other).');
    if (!id.businessType) e.push('Select business type.');
    if (id.businessType === 'cooperative') {
      if (!nf(id.coopMembers)) e.push('Cooperative: enter total members (number).');
      if (!nf(id.coopWomen)) e.push('Cooperative: enter women members (number).');
      if (!nf(id.coopYouth1835)) e.push('Cooperative: enter members aged 18–35 (number).');
      if (!nf(id.coopYoungWomen)) e.push('Cooperative: enter young women 18–35 (number).');
    }
    if (!id.ownerDisability) e.push('Select disability response for owner.');
  }

  if (step === 'f2') {
    const cows = nf(f.herd.totalCows);
    if (f.herd.totalCows.trim() === '' || cows === null || cows < 1) e.push('Total cows must be a positive whole number.');
    let breedSum = 0;
    const hasAnyBreed = BREEDS.some((b) => f.herd.breedCounts[b].trim() !== '');
    for (const b of BREEDS) {
      const c = nf(f.herd.breedCounts[b]);
      if (f.herd.breedCounts[b].trim() !== '') {
        if (c === null) e.push(`Breed count (${String(b)}) must be a non‑negative number.`);
        else breedSum += c;
      }
    }
    const totalN = cows ?? 0;
    if (
      !e.length &&
      hasAnyBreed &&
      breedSum > 0 &&
      Math.round(breedSum) !== Math.round(totalN)
    ) {
      e.push('Breed counts should add up to total cows — adjust totals.');
    }

    ;(['friesian', 'jersey', 'cross', 'local'] as const).forEach((b) => {
      const s = f.herd.avgDailyPerCowByBreed[b];
      if (!s.trim()) return;
      const v = nf(s);
      if (v === null) e.push(`Avg litres/day for ${b} must be a non‑negative number.`);
      else if (v > 200) e.push(`Avg litres/day for ${b} looks unrealistically high — check decimals.`);
    });

    const peak = nf(f.herd.peakTotal);
    const low = nf(f.herd.lowTotal);
    if (f.herd.peakTotal.trim() === '' || peak === null || peak <= 0)
      e.push('Peak season total litres/day must be a positive number.');
    if (f.herd.lowTotal.trim() === '' || low === null || low <= 0)
      e.push('Low season total litres/day must be a positive number.');
    if (!f.herd.soldPct) e.push('Select % of production sold.');
    if (!f.herd.salesChannels.length) e.push('Pick at least one milk sales channel.');
    if (f.herd.salesChannels.includes('other_mcc') && !f.herd.otherMccName.trim()) e.push('Name the other MCC.');
    for (const b of BREEDS) {
      const lact = nf(f.herd.lactatingByBreed[b]);
      if (lact !== null && (lact !== Math.round(lact) || lact < 0))
        e.push(`Lactating count for breed ${String(b)} must be a non‑negative whole number.`);
    }
  }

  if (step === 'f3') {
    const lactOk = BREEDS.every((b) => !!f.lactation.lactationPerBreed[b]);
    if (!lactOk) e.push('Pick a lactation period for each breed (table).');
    for (const b of BREEDS) {
      const raw = f.lactation.calvingIntervalByBreed[b];
      if (!raw.trim()) {
        e.push(`Calving interval (months) for ${String(b)} is required.`);
        continue;
      }
      const mo = nf(raw);
      if (mo === null || mo < 8 || mo > 48) e.push(`${String(b)} calving interval: use 8–48 months or a plausible number.`);
    }
    if (!f.lactation.breedingMethod.length) e.push('Select at least one breeding method.');
    if (!f.lactation.cowsInsured) e.push('Select cows insured option.');
    if (f.lactation.cowsInsured === 'all' || f.lactation.cowsInsured === 'some') {
      if (!nf(f.lactation.cowsInsuredCount)) e.push('Enter how many cows are insured.');
      if (!f.lactation.insuranceProvider.trim()) e.push('Enter insurance provider.');
    }
  }

  if (step === 'f4') {
    if (!f.farming.grazing) e.push('Select grazing practice.');
    if (!f.farming.feedTypes.length) e.push('Select at least one feed type.');
    if (!f.farming.cleanWater) e.push('Select clean water access.');
    if (!f.farming.waterSource.length) e.push('Select at least one water source.');
    const dh = nf(f.farming.dairyHa);
    const oh = nf(f.farming.otherHa);
    if (f.farming.dairyHa.trim() !== '' && dh === null) e.push('Dairy hectares must be a non‑negative number.');
    if (f.farming.otherHa.trim() !== '' && oh === null) e.push('Other hectares must be a non‑negative number.');
    if (!f.farming.infrastructure.length) e.push('Select at least one infrastructure item.');
  }

  if (step === 'f5') {
    if (!f.management.dedicatedManager) e.push('Select dedicated farm manager option.');
    if (f.management.dedicatedManager === 'yes_ft' && !f.management.managerName.trim())
      e.push('Enter farm manager name.');
    if (!f.management.vetAccess) e.push('Select veterinary officer access.');
    if (!f.management.biosecurity.length) e.push('Select at least one biosecurity measure.');
    if (!f.management.training3y) e.push('Select dairy training question.');
    if (f.management.training3y === 'yes' && !f.management.trainingProvider.trim())
      e.push('Enter training provider.');
    if (!f.management.subsidy) e.push('Select subsidy / grant question.');
    if (f.management.subsidy === 'yes') {
      if (!f.management.grantSource.trim()) e.push('Enter grant source.');
      if (!f.management.grantWhat.trim()) e.push('Describe what was provided.');
    }
  }

  if (step === 'f6') {
    const wt = nf(f.workforce.total);
    if (!f.workforce.total.trim() || wt === null || wt < 1) e.push('Total workers must be at least 1.');
    ;(['women', 'aged1835', 'women1835', 'disabled'] as const).forEach((field) => {
      const raw = f.workforce[field];
      if (!raw.trim()) {
        e.push(`Enter ${field === 'women' ? 'women count' : field === 'aged1835' ? 'workers aged 18–35' : field === 'women1835' ? 'women aged 18–35' : 'workers with disability'} — use 0 if none.`);
        return;
      }
      const n = nf(raw);
      if (n === null) e.push('Workforce numeric fields must be non‑negative numbers.');
    });

    const wtot = wt ?? 0;
    const wom = nf(f.workforce.women);
    const d18 = nf(f.workforce.aged1835);
    const wy = nf(f.workforce.women1835);
    const dis = nf(f.workforce.disabled);
    if (wom != null && Math.round(wom) > Math.round(wtot))
      e.push('Women workers cannot exceed total workers.');
    if (d18 != null && Math.round(d18) > Math.round(wtot))
      e.push('18–35 count cannot exceed total workers.');
    if (wy != null && d18 != null && Math.round(wy) > Math.round(d18))
      e.push('Young women cannot exceed aged 18–35 count.');
    if (dis != null && Math.round(dis) > Math.round(wtot)) e.push('Disability count cannot exceed total workers.');

    if (f.management.dedicatedManager === 'yes_ft') {
      if (!f.workforce.managerSex) e.push('Select manager sex.');
      const ma = nf(f.workforce.managerAge);
      if (!f.workforce.managerAge.trim() || ma === null || ma < 16 || ma > 100)
        e.push('Enter manager age as a plausible number.');
    }
  }

  if (step === 'f7') {
    if (!f.financeFarmer.records) e.push('Select record-keeping method.');
    if (!f.financeFarmer.paymentMethods.length) e.push('Pick at least one payment method.');
    if (!f.financeFarmer.phoneType) e.push('Select mobile phone type.');
    if (!f.financeFarmer.momoWilling) e.push('Select mobile money willingness.');
    if (!f.financeFarmer.borrowed) e.push('Select borrowing question.');
    if (f.financeFarmer.borrowed === 'yes' && !f.financeFarmer.borrowSources.length)
      e.push('Select who you borrowed from, or indicate never borrowed.');
    const rev = parseFinite(f.financeFarmer.annualRevenueRwf);
    if (
      !f.financeFarmer.annualRevenueRwf.trim() ||
      rev === null ||
      rev < 0 ||
      !Number.isFinite(rev)
    )
      e.push('Enter average annual revenue (RWF), use 0 if unknown.');
  }

  if (step === 'f8') {
    if (!f.goalsFarmer.goal12m) e.push('Select main 12‑month goal.');
    if (!f.goalsFarmer.supplyDays) e.push('Select supplying days per week.');
    if (!f.goalsFarmer.missed4w) e.push('Select missed deliveries option.');
    if (!f.goalsFarmer.scaleCapacity) e.push('Select scale capacity answer.');
  }

  if (step === 'agent') {
    if (!f.agentFarmer.pathwayP1) e.push('Select Pathway 1 — digital aggregation (qualifies / does not qualify).');
    if (!f.agentFarmer.pathwayP1Reason.trim() || f.agentFarmer.pathwayP1Reason.trim().length < 10)
      e.push('Enter Pathway 1 reason (at least ~10 characters).');
    if (!f.agentFarmer.breedImprovement) e.push('Select breed improvement candidate.');
    if (!f.agentFarmer.creditTier) e.push('Select initial credit tier.');
  }

  return [...new Set(e)];
}

export function validateCollectorWizardStep(step: CollectorWizardStep, c: CollectorFormState): string[] {
  const e: string[] = [];

  if (step === 'c1') {
    if (!c.c1.surname.trim()) e.push('Enter surname.');
    if (!c.c1.firstName.trim()) e.push('Enter first name.');
    if (!isRwandaMobileLine(c.c1.primaryPhone)) e.push('Primary phone must be valid Rwandan format.');
    const wa = c.c1.whatsapp.trim();
    if (wa && !isRwandaMobileLine(wa))
      e.push('WhatsApp number must use valid Rwandan format if filled.');
    if (!isRwandanNationalId(c.c1.nid)) e.push('National ID must be 16 digits starting with 1.');
    if (!c.c1.province.trim()) e.push('Enter province.');
    if (!c.c1.district.trim()) e.push('Enter district.');
    if (!c.c1.sector.trim()) e.push('Enter sector.');
    if (!c.c1.cell.trim()) e.push('Enter cell.');
    if (!c.c1.village.trim()) e.push('Enter village.');
    if (!c.c1.linkedMcc) e.push('Select linked MCC.');
    if (c.c1.linkedMcc === 'other' && !c.c1.linkedMccOther.trim()) e.push('Specify the linked MCC name.');
    if (!c.c1.ownerDisability) e.push('Select owner disability.');
    if (!c.c1.businessType) e.push('Select business type.');
  }

  if (step === 'c2') {
    if (!c.c2.sector.trim()) e.push('Enter collection sector.');
    if (!c.c2.cells.trim()) e.push('Enter cells covered.');
    const rad = nf(c.c2.radiusKm);
    if (!c.c2.radiusKm.trim() || rad === null || rad <= 0) e.push('Collection radius (km) must be a positive number.');
    const fc = nf(c.c2.farmCount);
    if (!c.c2.farmCount.trim() || fc === null || fc < 1) e.push('Farm count must be at least 1.');
    if (!c.c2.daysWeek) e.push('Select days per week collecting.');
    const pk = nf(c.c2.peakL);
    const lw = nf(c.c2.lowL);
    if (!c.c2.peakL.trim() || pk === null || pk <= 0) e.push('Peak volume (L/day) must be a positive number.');
    if (!c.c2.lowL.trim() || lw === null || lw <= 0) e.push('Low volume (L/day) must be a positive number.');
    if (!c.c2.transport.length) e.push('Select at least one transport method.');
    if (c.c2.transport.includes('other_tr') && !c.c2.transportOther.trim())
      e.push('Describe other transport.');
    if (!c.c2.cooling) e.push('Select cooling / chilling option.');
    if (c.c2.cooling === 'yes' && !c.c2.coolingDetail.trim()) e.push('Describe cooling equipment.');
    const tr = nf(c.c2.transitMin);
    if (!c.c2.transitMin.trim() || tr === null || tr < 0) e.push('Transit time must be zero or positive minutes.');
    if (!c.c2.otherDestinations.length) e.push('Pick at least one delivery destination.');
    if (c.c2.otherDestinations.includes('other_mcc') && !c.c2.otherMccName.trim())
      e.push('Name the other MCC.');
  }

  if (step === 'c3') {
    if (!c.roster.length)
      e.push('Add at least one farm row (use “Add farm”), or tap Back if not ready.');
    else {
      c.roster.forEach((row, i) => {
        if (!row.nameOrId.trim()) e.push(`Row ${String(i + 1)}: enter farmer name or ID.`);
        if (!row.registration) e.push(`Row ${String(i + 1)}: select Gemura registration status.`);
      });
    }
  }

  if (step === 'c4') {
    const wt = nf(c.workforceC.total);
    if (!c.workforceC.total.trim() || wt === null || wt < 1) e.push('Total workers must be at least 1.');
    ;(['women', 'aged1835', 'women1835', 'disabled'] as const).forEach((field) => {
      const raw = c.workforceC[field];
      if (!raw.trim()) {
        e.push('Fill all workforce counts — use 0 if none.');
        return;
      }
      if (nf(raw) === null) e.push('Workforce counts must be non‑negative numbers.');
    });
    const wtot = wt ?? 0;
    const wom = nf(c.workforceC.women);
    const d18 = nf(c.workforceC.aged1835);
    const wy = nf(c.workforceC.women1835);
    const dis = nf(c.workforceC.disabled);
    if (wom != null && Math.round(wom) > Math.round(wtot))
      e.push('Women workers cannot exceed total workers.');
    if (d18 != null && Math.round(d18) > Math.round(wtot))
      e.push('18–35 count cannot exceed total workers.');
    if (wy != null && d18 != null && Math.round(wy) > Math.round(d18))
      e.push('Young women cannot exceed aged 18–35 count.');
    if (dis != null && Math.round(dis) > Math.round(wtot))
      e.push('Disability count cannot exceed total workers.');
  }

  if (step === 'c5') {
    if (!c.financeC.records) e.push('Select record-keeping method.');
    if (!c.financeC.paysFarmers.length) e.push('Select how you pay farmers (at least one).');
    if (!c.financeC.phoneType) e.push('Select phone type.');
    if (!c.financeC.momoWilling) e.push('Select mobile money willingness.');
    if (!c.financeC.borrowed) e.push('Select borrowing question.');
    const rev = parseFinite(c.financeC.annualRevenueRwf);
    if (!c.financeC.annualRevenueRwf.trim() || rev === null || rev < 0)
      e.push('Enter annual revenue from collection (RWF), use 0 if unknown.');
  }

  if (step === 'c6') {
    if (!c.goalsC.goal12m) e.push('Select main 12‑month goal.');
    if (!c.goalsC.missed4w) e.push('Select missed / late deliveries option.');
    if (!c.goalsC.scaleCapacity) e.push('Select scale capacity answer.');
  }

  if (step === 'agent') {
    if (!c.agentCollector.pathwayP4) e.push('Select Pathway 4 — sector logistics node.');
    if (!c.agentCollector.reason.trim() || c.agentCollector.reason.trim().length < 10)
      e.push('Enter pathway reason (at least ~10 characters).');
    if (!c.agentCollector.unregisteredFollowup) e.push('Select unregistered farms follow‑up.');
    if (c.collectorKind === 'farmer_collector' && !c.agentCollector.creditTier)
      e.push('Select initial credit tier for farmer–collector.');
  }

  return [...new Set(e)];
}
