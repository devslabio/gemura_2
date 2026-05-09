/**
 * Auto-generated assessment from questionnaire answers (UI only).
 * Rules mirror hints in the wizard (credit tiers, digital readiness, risk flags).
 */

import type { CollectorFormState, FarmerFormState } from './model';
import { BREEDS, MILK_COLLECTOR_KIND, REFUGEE_DISTRICTS } from './model';
import { deriveFarmerVibeCodes, herdSuggestsBreedImprovement, type VibeFarmerCodes } from './vibeReporting';

export type AutoInsightTone = 'positive' | 'info' | 'caution';

export type AutoInsight = {
  title: string;
  detail: string;
  tone: AutoInsightTone;
};

export type AgentFieldCompare = {
  field: string;
  /** What the form answers suggest */
  fromAnswers: string;
  /** What the agent selected */
  fromAgent: string;
  /** null when we could not infer from answers */
  aligned: boolean | null;
};

export type OnboardingAutoSummary = {
  headline: string;
  subline: string;
  /** 0–100 composite readiness; null if not enough data */
  score: number | null;
  metrics: { label: string; value: string }[];
  insights: AutoInsight[];
  agentCompare: AgentFieldCompare[];
  /** VIBE C77 / C78 / C79 values for sync (farmer only) */
  vibeFarmer?: VibeFarmerCodes;
};

function n(s: string): number {
  const v = Number(String(s).replace(',', '.').trim());
  return Number.isFinite(v) ? v : Number.NaN;
}

function isRefugeeDistrict(d: string): boolean {
  const t = d.trim().toLowerCase();
  return REFUGEE_DISTRICTS.some((x) => x.toLowerCase() === t);
}

/* --- Farmer --- */

function suggestedFarmerCreditTier(f: FarmerFormState): '' | 'starter' | 'reliable' {
  const peak = n(f.herd.peakTotal);
  if (Number.isNaN(peak) || peak <= 0) return '';
  if (peak >= 20) return 'reliable';
  if (peak < 10) return 'starter';
  return '';
}

/** Aligns with Pathway 1 / C77 “market-access & ecosystem” — digital + formal sales signals */
function suggestedPathway1(f: FarmerFormState): '' | 'qualifies' | 'not' {
  let d = 0;
  if (f.financeFarmer.records === 'app' || f.financeFarmer.records === 'mcc') d += 3;
  else if (f.financeFarmer.records === 'phone') d += 2;
  else if (f.financeFarmer.records === 'paper') d += 1;
  if (f.financeFarmer.phoneType === 'smart') d += 3;
  else if (f.financeFarmer.phoneType === 'basic') d += 1;
  if (f.financeFarmer.momoWilling === 'happy' || f.financeFarmer.momoWilling === 'try') d += 2;
  else if (f.financeFarmer.momoWilling === 'unsure') d += 1;
  if (
    f.herd.salesChannels.includes('mcc') ||
    f.herd.salesChannels.includes('other_mcc') ||
    f.herd.salesChannels.includes('processor')
  ) {
    d += 1;
  }
  if (d >= 5) return 'qualifies';
  if (f.financeFarmer.phoneType === 'none' && (f.financeFarmer.records === 'none' || f.financeFarmer.records === 'paper')) {
    return 'not';
  }
  if (d <= 2) return 'not';
  return '';
}

function farmerReadinessScore(f: FarmerFormState): number | null {
  const peak = n(f.herd.peakTotal);
  const low = n(f.herd.lowTotal);
  const hasProd = !Number.isNaN(peak) && peak > 0 && !Number.isNaN(low) && low > 0;
  if (!hasProd && !f.herd.totalCows.trim()) return null;

  let s = 22;
  if (f.financeFarmer.phoneType === 'smart') s += 16;
  if (f.financeFarmer.phoneType === 'basic') s += 6;
  if (f.financeFarmer.records === 'app' || f.financeFarmer.records === 'mcc') s += 14;
  if (f.financeFarmer.records === 'phone') s += 8;
  if (f.financeFarmer.momoWilling === 'happy' || f.financeFarmer.momoWilling === 'try') s += 8;
  if (f.financeFarmer.momoWilling === 'unsure') s += 3;
  if (f.management.vetAccess === 'regular') s += 8;
  if (f.farming.cleanWater === 'daily') s += 6;
  if (f.management.training3y === 'yes') s += 5;
  if (f.lactation.cowsInsured === 'all' || f.lactation.cowsInsured === 'some') s += 5;
  if (hasProd && low / peak >= 0.45) s += 6;

  if (!hasProd) s = Math.min(s, 62);

  return Math.min(100, Math.round(s));
}

const tierLabel: Record<'starter' | 'reliable', string> = {
  starter: 'Starter (under ~10 L/day peak)',
  reliable: 'Reliable (~20+ L/day peak)',
};

const pathwayLabel: Record<'qualifies' | 'not', string> = {
  qualifies: 'Qualifies — strong digital signals',
  not: 'Does not qualify — weak digital signals',
};

const collectorTierLabel: Record<'starter' | 'reliable', string> = {
  starter: 'Starter (under ~50 L/day peak)',
  reliable: 'Reliable (~100+ L/day peak)',
};

function suggestedCollectorCreditTier(c: CollectorFormState): '' | 'starter' | 'reliable' {
  const peak = n(c.c2.peakL);
  if (Number.isNaN(peak) || peak <= 0) return '';
  if (peak >= 100) return 'reliable';
  if (peak < 50) return 'starter';
  return '';
}

function suggestedPathway4(c: CollectorFormState): '' | 'qualifies' | 'not' {
  const peak = n(c.c2.peakL);
  const t = n(c.c2.transitMin);
  if (Number.isNaN(peak) || peak <= 0) return '';
  if (!Number.isNaN(t) && t > 90) return 'not';
  if (peak >= 50 && (Number.isNaN(t) || t <= 90)) return 'qualifies';
  if (peak < 30) return 'not';
  return '';
}

function collectorReadinessScore(c: CollectorFormState): number | null {
  const peak = n(c.c2.peakL);
  if (Number.isNaN(peak) || peak <= 0) return null;

  let s = 20;
  if (c.c2.cooling === 'yes') s += 18;
  const transit = n(c.c2.transitMin);
  if (!Number.isNaN(transit)) {
    if (transit <= 45) s += 22;
    else if (transit <= 60) s += 16;
    else if (transit <= 90) s += 8;
  }
  const { total, reg } = (() => {
    const t = c.roster.length;
    const r = c.roster.filter((x) => x.registration === 'registered').length;
    return { total: t, reg: r };
  })();
  if (total > 0 && reg / total >= 0.5) s += 14;
  else if (reg > 0) s += 8;
  if (c.financeC.phoneType === 'smart') s += 10;
  if (c.financeC.momoWilling === 'happy' || c.financeC.momoWilling === 'try') s += 8;
  if (c.c2.cooling === 'no' && !Number.isNaN(transit) && transit > 75) s -= 8;

  return Math.min(100, Math.max(0, Math.round(s)));
}

export function computeFarmerAutoSummary(
  f: FarmerFormState,
  opts?: { districtForRefugee?: string }
): OnboardingAutoSummary {
  const metrics: { label: string; value: string }[] = [];
  const insights: AutoInsight[] = [];

  const peak = n(f.herd.peakTotal);
  const low = n(f.herd.lowTotal);
  if (!Number.isNaN(peak) && peak > 0) {
    metrics.push({ label: 'Est. peak (L/day)', value: String(Math.round(peak * 10) / 10) });
  }
  if (!Number.isNaN(peak) && !Number.isNaN(low) && peak > 0) {
    const sev = Math.round((low / peak) * 100);
    metrics.push({ label: 'Low vs peak (seasonal)', value: `${sev}%` });
  }

  const totalW = n(f.workforce.total);
  const women = n(f.workforce.women);
  if (!Number.isNaN(totalW) && totalW > 0 && !Number.isNaN(women)) {
    metrics.push({ label: 'Women in workforce', value: `${Math.round((women / totalW) * 100)}%` });
  }

  const dist = n(f.identity.distanceMccKm);
  if (!Number.isNaN(dist)) {
    metrics.push({ label: 'Distance to MCC (km)', value: String(Math.round(dist * 10) / 10) });
  }

  if (opts?.districtForRefugee && isRefugeeDistrict(opts.districtForRefugee)) {
    insights.push({
      title: 'Refugee district VIBE',
      detail: 'District matches extended VIBE columns — same handling as in Section 1.',
      tone: 'info',
    });
  }

  if (!Number.isNaN(dist) && dist > 15) {
    insights.push({
      title: 'Distance to MCC',
      detail: 'Above ~15 km often increases collection risk; confirm routing and collection windows.',
      tone: 'caution',
    });
  } else if (!Number.isNaN(dist) && dist > 0 && dist <= 8) {
    insights.push({
      title: 'Distance to MCC',
      detail: 'Within a short radius — favourable for reliable delivery and cold chain.',
      tone: 'positive',
    });
  }

  if (!Number.isNaN(peak) && !Number.isNaN(low) && peak > 0 && low / peak < 0.35) {
    insights.push({
      title: 'Seasonal swing',
      detail: 'Low season is a small fraction of peak — consider support for off-peak months.',
      tone: 'info',
    });
  }

  if (f.financeFarmer.phoneType === 'smart' && (f.financeFarmer.records === 'app' || f.financeFarmer.momoWilling === 'happy')) {
    insights.push({
      title: 'Digital fit',
      detail: 'Smartphone plus app or strong MoMo willingness supports digital pay and data capture.',
      tone: 'positive',
    });
  }

  if (f.financeFarmer.phoneType === 'none' && f.financeFarmer.records === 'none') {
    insights.push({
      title: 'Digital gap',
      detail: 'No smartphone and no structured records — Pathway 1 and digital pay need a catch-up plan.',
      tone: 'caution',
    });
  }

  if (BREEDS.some((b) => f.lactation.lactationPerBreed[b] === 'lt305')) {
    insights.push({
      title: 'Lactation length',
      detail: 'At least one breed is under 305 days lactation — review feeding and health.',
      tone: 'caution',
    });
  }

  const onlyLocal =
    n(f.herd.breedCounts.local) > 0 && BREEDS.filter((b) => b !== 'local').every((b) => !n(f.herd.breedCounts[b]));
  const noCrossFriesian = !n(f.herd.breedCounts.cross) && !n(f.herd.breedCounts.friesian);
  if (onlyLocal && noCrossFriesian) {
    insights.push({
      title: 'Breed mix',
      detail: 'Local-only herd with no cross/Friesian — high value for breed improvement and AI programmes.',
      tone: 'info',
    });
  }

  const suggestedTier = suggestedFarmerCreditTier(f);
  const suggestedP1 = suggestedPathway1(f);
  const score = farmerReadinessScore(f);
  const vibeFarmer: VibeFarmerCodes = deriveFarmerVibeCodes(f);

  if (herdSuggestsBreedImprovement(f) && f.agentFarmer.breedImprovement === 'no') {
    insights.push({
      title: 'C78 (breed improvement)',
      detail: 'Herd and lactation answers suggest a breed-finance candidate — agent selected No. Confirm on visit.',
      tone: 'caution',
    });
  } else if (herdSuggestsBreedImprovement(f) && f.agentFarmer.breedImprovement === '') {
    insights.push({
      title: 'C78 (breed improvement)',
      detail: 'Herd profile is consistent with breed improvement finance — complete the agent step.',
      tone: 'info',
    });
  }

  if (f.agentFarmer.pathwayP1 === 'qualifies' && suggestedP1 === 'not') {
    insights.push({
      title: 'C77 (Pathway 1)',
      detail: 'Agent marked Qualifies while questionnaire leans not — document reason; ecosystem access may be informal.',
      tone: 'caution',
    });
  } else if (f.agentFarmer.pathwayP1 === 'not' && suggestedP1 === 'qualifies') {
    insights.push({
      title: 'C77 (Pathway 1)',
      detail: 'Questionnaire suggests Qualifies; agent said No — worth reconciling (C77 only applies if agent confirms Qualifies).',
      tone: 'info',
    });
  }

  const agentCompare: AgentFieldCompare[] = [];

  if (f.agentFarmer.creditTier && (suggestedTier === 'starter' || suggestedTier === 'reliable')) {
    const aligned = f.agentFarmer.creditTier === suggestedTier;
    agentCompare.push({
      field: 'Initial credit tier',
      fromAnswers: tierLabel[suggestedTier],
      fromAgent: f.agentFarmer.creditTier === 'starter' ? tierLabel.starter : tierLabel.reliable,
      aligned,
    });
  } else if (f.agentFarmer.creditTier && suggestedTier === '') {
    agentCompare.push({
      field: 'Initial credit tier',
      fromAnswers: 'Unclear (peak in mid band ~10–20 L or missing)',
      fromAgent: f.agentFarmer.creditTier === 'starter' ? tierLabel.starter : tierLabel.reliable,
      aligned: null,
    });
  }

  if (f.agentFarmer.pathwayP1 && (suggestedP1 === 'qualifies' || suggestedP1 === 'not')) {
    const aligned = f.agentFarmer.pathwayP1 === suggestedP1;
    agentCompare.push({
      field: 'Pathway 1 — digital aggregation',
      fromAnswers: pathwayLabel[suggestedP1],
      fromAgent: f.agentFarmer.pathwayP1 === 'qualifies' ? 'Qualifies' : 'Does not qualify',
      aligned,
    });
  } else if (f.agentFarmer.pathwayP1 && suggestedP1 === '') {
    agentCompare.push({
      field: 'Pathway 1 — digital aggregation',
      fromAnswers: 'Mixed / borderline — review records and phone on site',
      fromAgent: f.agentFarmer.pathwayP1 === 'qualifies' ? 'Qualifies' : 'Does not qualify',
      aligned: null,
    });
  }

  let headline = 'Onboarding profile summary';
  if (score != null && score >= 72) headline = 'Strong operational & digital fit';
  else if (score != null && score >= 48) headline = 'Moderate readiness — a few levers to pull';
  else if (score != null) headline = 'Early-stage profile — prioritise support areas';

  const hasVibeCode = Boolean(vibeFarmer.c77 || vibeFarmer.c78 || vibeFarmer.c79);
  const subline = hasVibeCode
    ? 'VIBE C77–C79 are filled below where the agent step is complete; they follow the MCC & farmer onboarding guide (v3).'
    : suggestedP1 === 'qualifies'
      ? 'Answers suggest a good match for digital aggregation (Pathway 1 / C77 when the agent agrees).'
      : suggestedP1 === 'not'
        ? 'Digital adoption may need a staged plan before Pathway 1 and C77.'
        : 'Complete the agent step to set C77–C79 for sync, or use metrics to prioritise follow-up.';

  return { headline, subline, score, metrics, insights, agentCompare, vibeFarmer };
}

export function computeCollectorAutoSummary(
  c: CollectorFormState,
  opts?: { districtForRefugee?: string }
): OnboardingAutoSummary {
  const metrics: { label: string; value: string }[] = [];
  const insights: AutoInsight[] = [];

  if (c.collectorKind) {
    metrics.push({ label: 'Collector profile', value: MILK_COLLECTOR_KIND[c.collectorKind].label });
  }

  if (c.collectorKind === 'pure_collector') {
    insights.push({
      title: 'Pure collector',
      detail: 'Expect manifest-led workflows and (optionally) pre-payment settlement. Credit tier on the form is for routing, not a loan product in this role.',
      tone: 'info',
    });
  } else if (c.collectorKind === 'farmer_collector') {
    insights.push({
      title: 'Farmer–collector',
      detail: 'Own milk and collected milk are reported separately: credit follows own production; collection fees and manifests follow route rules.',
      tone: 'info',
    });
  }

  const peak = n(c.c2.peakL);
  const transit = n(c.c2.transitMin);
  if (!Number.isNaN(peak) && peak > 0) {
    metrics.push({ label: 'Peak season (L/day)', value: String(Math.round(peak * 10) / 10) });
  }
  if (!Number.isNaN(transit)) {
    metrics.push({ label: 'Transit to MCC (min)', value: String(Math.round(transit)) });
  }

  const total = c.roster.length;
  const reg = c.roster.filter((r) => r.registration === 'registered').length;
  const notReg = c.roster.filter((r) => r.registration === 'not_registered').length;
  if (total > 0) {
    metrics.push({ label: 'Roster registered', value: `${reg}/${total} (${Math.round((reg / total) * 100)}%)` });
  } else {
    metrics.push({ label: 'Farms in roster', value: '0' });
  }

  if (opts?.districtForRefugee && isRefugeeDistrict(opts.districtForRefugee)) {
    insights.push({
      title: 'Refugee district',
      detail: 'Same extended VIBE handling as the farmer path — flag in reporting.',
      tone: 'info',
    });
  }

  if (!Number.isNaN(transit) && transit > 90) {
    insights.push({
      title: 'Umurara (fermentation) risk',
      detail: 'Transit over 90 minutes — priority for cooling, routing, or earlier MCC handoff.',
      tone: 'caution',
    });
  } else if (!Number.isNaN(transit) && transit > 0 && transit <= 45) {
    insights.push({
      title: 'Logistics',
      detail: 'Short first-farm to MCC time — good for quality if volume can scale.',
      tone: 'positive',
    });
  }

  if (c.c2.cooling === 'no' && !Number.isNaN(transit) && transit > 60) {
    insights.push({
      title: 'Cooling',
      detail: 'No active cooling and longer runs — high spoilage risk in warm weather.',
      tone: 'caution',
    });
  } else if (c.c2.cooling === 'yes') {
    insights.push({
      title: 'Cooling',
      detail: 'Cooling or chill equipment reported — better buffer for variable transit.',
      tone: 'positive',
    });
  }

  if (notReg > 0) {
    insights.push({
      title: 'Roster — registration',
      detail: `${notReg} farm(s) not on Gemura — outreach targets for the agent.`,
      tone: 'info',
    });
  } else if (total > 0 && notReg === 0 && reg > 0) {
    insights.push({
      title: 'Roster — registration',
      detail: 'All listed farms with a registration status — good visibility (verify on visit).',
      tone: 'positive',
    });
  }

  if (!Number.isNaN(peak) && peak >= 100) {
    insights.push({
      title: 'Volume',
      detail: 'Peak at or above the “reliable” band used in the agent panel — stress-test quality on peak days.',
      tone: 'info',
    });
  }

  const suggestedTier = suggestedCollectorCreditTier(c);
  const suggestedP4 = suggestedPathway4(c);
  const score = collectorReadinessScore(c);

  const agentCompare: AgentFieldCompare[] = [];

  if (c.collectorKind !== 'pure_collector') {
    if (c.agentCollector.creditTier && (suggestedTier === 'starter' || suggestedTier === 'reliable')) {
      const aligned = c.agentCollector.creditTier === suggestedTier;
      agentCompare.push({
        field: 'Credit tier',
        fromAnswers: collectorTierLabel[suggestedTier],
        fromAgent: c.agentCollector.creditTier === 'starter' ? collectorTierLabel.starter : collectorTierLabel.reliable,
        aligned,
      });
    } else if (c.agentCollector.creditTier && suggestedTier === '') {
      agentCompare.push({
        field: 'Credit tier',
        fromAnswers: 'Unclear (peak between ~50 and ~100 L or missing)',
        fromAgent: c.agentCollector.creditTier === 'starter' ? collectorTierLabel.starter : collectorTierLabel.reliable,
        aligned: null,
      });
    }
  } else if (c.agentCollector.creditTier) {
    agentCompare.push({
      field: 'Volume band (agent)',
      fromAnswers: 'Optional for pure collectors — not a credit product in the collector role.',
      fromAgent: c.agentCollector.creditTier === 'starter' ? collectorTierLabel.starter : collectorTierLabel.reliable,
      aligned: null,
    });
  }

  if (c.agentCollector.pathwayP4 && (suggestedP4 === 'qualifies' || suggestedP4 === 'not')) {
    const aligned = c.agentCollector.pathwayP4 === suggestedP4;
    agentCompare.push({
      field: 'Pathway 4 — sector logistics node',
      fromAnswers: suggestedP4 === 'qualifies' ? 'Qualifies (volume + transit)' : 'Does not qualify (volume or transit)',
      fromAgent: c.agentCollector.pathwayP4 === 'qualifies' ? 'Qualifies' : 'Does not qualify',
      aligned,
    });
  } else if (c.agentCollector.pathwayP4 && suggestedP4 === '') {
    agentCompare.push({
      field: 'Pathway 4 — sector logistics node',
      fromAnswers: 'Borderline — confirm cold chain and peak-day capacity in person',
      fromAgent: c.agentCollector.pathwayP4 === 'qualifies' ? 'Qualifies' : 'Does not qualify',
      aligned: null,
    });
  }

  let headline = 'Collector profile summary';
  if (score != null && score >= 70) headline = 'Solid logistics and digital levers';
  else if (score != null && score >= 45) headline = 'Actionable — fix cold chain and roster next';
  else if (score != null) headline = 'Higher-risk logistics — investigate before scaling credit';

  const subline =
    notReg > 0
      ? 'Prioritise Gemura sign-up for unregistered farms on the roster.'
      : 'Use metrics to align MCC handoffs and follow-up.';

  return { headline, subline, score, metrics, insights, agentCompare };
}
