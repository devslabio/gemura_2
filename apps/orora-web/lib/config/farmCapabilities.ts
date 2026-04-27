import type { Farm, FarmProductionMode } from '@/lib/api/farms';

/** Gates nav items tied to species + modes on the selected farm */
export type FarmGateKey = 'milk' | 'poultry' | 'pigs';

/**
 * When no farm is selected (all farms), or farm has no species focus configured,
 * all gates stay open so legacy farms keep full navigation.
 */
export function farmGateOpen(gate: FarmGateKey, farm: Farm | null | undefined): boolean {
  if (!farm) return true;
  const rows = farm.farm_species_focus;
  if (!rows?.length) return true;

  const byCode = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const code = r.species?.code;
    if (code) byCode.set(code, r);
  }

  switch (gate) {
    case 'milk': {
      const cattle = byCode.get('cattle');
      const goat = byCode.get('goat');
      const hasDairy = (modes: FarmProductionMode[] | undefined) =>
        modes?.some((mode) => mode === 'dairy');
      return !!(hasDairy(cattle?.modes) || hasDairy(goat?.modes));
    }
    case 'poultry':
      return byCode.has('poultry');
    case 'pigs':
      return byCode.has('pig');
    default:
      return true;
  }
}
