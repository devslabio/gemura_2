/**
 * GEMURA × VIBE — MCC & Farmer onboarding (agent panel).
 * C77 = Intervention 2, C78 = Intervention 3, C79 = Ownership (per guide v3).
 */

import type { FarmerFormState } from './model';
import { BREEDS } from './model';

/** When Pathway 1 = Qualifies — VIBE C77 (Intervention 2) */
export const VIBE_C77_PATHWAY1_QUALIFIES = '1.1 Market-access and ecosystem support' as const;

/** When breed improvement = Yes — VIBE C78 (Intervention 3) */
export const VIBE_C78_BREED_IMPROVEMENT = 'Breed improvement finance' as const;

/** C79 — Ownership band from initial credit tier (agent estimate) */
export const VIBE_C79 = {
  starter: 'Ownership — starter band (under 10 L/day, agent estimate)',
  reliable: 'Ownership — reliable band (20+ L/day, agent estimate)',
} as const;

export type VibeFarmerCodes = {
  /** C77 — set when agent selects Pathway 1 qualifies */
  c77: string | null;
  /** C78 — set when agent flags breed improvement */
  c78: string | null;
  /** C79 — from agent initial credit tier */
  c79: string | null;
};

function n(s: string): number {
  const v = Number(String(s).replace(',', '.').trim());
  return Number.isFinite(v) ? v : Number.NaN;
}

/** Heuristic: answers suggest the breed-improvement flag (C78) even before agent. */
export function herdSuggestsBreedImprovement(f: FarmerFormState): boolean {
  const onlyLocal =
    n(f.herd.breedCounts.local) > 0 &&
    BREEDS.filter((b) => b !== 'local').every((b) => !n(f.herd.breedCounts[b]));
  const noCrossFriesian = !n(f.herd.breedCounts.cross) && !n(f.herd.breedCounts.friesian);
  if (onlyLocal && noCrossFriesian && n(f.herd.breedCounts.local) > 0) return true;
  if (BREEDS.some((b) => f.lactation.lactationPerBreed[b] === 'lt305')) return true;
  return BREEDS.some((b) => {
    const m = n(f.lactation.calvingIntervalByBreed[b]);
    return !Number.isNaN(m) && m > 14;
  });
}

/**
 * Map agent selections + production band to the VIBE values used on sync.
 * When an agent field is not set, the code is null (not sent / pending).
 */
export function deriveFarmerVibeCodes(f: FarmerFormState): VibeFarmerCodes {
  const c77 = f.agentFarmer.pathwayP1 === 'qualifies' ? VIBE_C77_PATHWAY1_QUALIFIES : null;
  const c78 = f.agentFarmer.breedImprovement === 'yes' ? VIBE_C78_BREED_IMPROVEMENT : null;
  const c79 =
    f.agentFarmer.creditTier === 'starter'
      ? VIBE_C79.starter
      : f.agentFarmer.creditTier === 'reliable'
        ? VIBE_C79.reliable
        : null;
  return { c77, c78, c79 };
}
