/** Shared completion scoring for MCC operational profile (seeded from onboarding). */

export type OnboardingProfileFieldStatus = {
  key: string;
  label: string;
  filled: boolean;
  value?: string | number | null;
};

export type OnboardingProfileCompletion = {
  filled: number;
  total: number;
  pct: number;
  fields: OnboardingProfileFieldStatus[];
};

type ProfileRow = {
  expected_daily_deliveries?: number | null;
  daily_milk_volume_litres?: { toString(): string } | number | null;
  max_milk_one_day_litres?: { toString(): string } | number | null;
  tank_capacity_sufficiency?: string | null;
  power_supply_sources?: unknown;
  generator_capacity_kva?: { toString(): string } | number | null;
  mobile_connectivity?: string | null;
  total_farmers_supplying?: number | null;
  new_farmers_last_3_months?: number | null;
  milk_transporters_count?: number | null;
  average_distance_km?: { toString(): string } | number | null;
  evening_milk_pattern?: string | null;
  own_milk_transport_type?: string | null;
  record_system?: string | null;
  avg_days_delivery_to_payment?: number | null;
  main_buyer_name?: string | null;
  source_submission_code?: string | null;
};

type TankRow = { capacity_litres?: { toString(): string } | number | null };

function hasText(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

function hasNumber(v: unknown): boolean {
  if (v == null) return false;
  const n = Number(typeof v === 'object' && v !== null && 'toString' in v ? (v as { toString(): string }).toString() : v);
  return Number.isFinite(n);
}

function hasPowerSources(v: unknown): boolean {
  return Array.isArray(v) && v.some((x) => typeof x === 'string' && x.trim().length > 0);
}

function tankWithCapacity(tanks: TankRow[]): boolean {
  return tanks.some((t) => {
    if (t.capacity_litres == null) return false;
    const n = Number(t.capacity_litres.toString?.() ?? t.capacity_litres);
    return Number.isFinite(n) && n > 0;
  });
}

export function computeOnboardingProfileCompletion(
  profile: ProfileRow | null | undefined,
  tanks: TankRow[],
): OnboardingProfileCompletion {
  const p = profile ?? {};
  const powerList = Array.isArray(p.power_supply_sources)
    ? (p.power_supply_sources as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];

  const checks: OnboardingProfileFieldStatus[] = [
    {
      key: 'expected_daily_deliveries',
      label: 'Expected daily deliveries',
      filled: p.expected_daily_deliveries != null && p.expected_daily_deliveries > 0,
      value: p.expected_daily_deliveries ?? null,
    },
    {
      key: 'daily_milk_volume_litres',
      label: 'Daily milk volume',
      filled: hasNumber(p.daily_milk_volume_litres),
      value: hasNumber(p.daily_milk_volume_litres) ? Number(p.daily_milk_volume_litres!.toString()) : null,
    },
    {
      key: 'max_milk_one_day_litres',
      label: 'Max milk in one day',
      filled: hasNumber(p.max_milk_one_day_litres),
      value: hasNumber(p.max_milk_one_day_litres) ? Number(p.max_milk_one_day_litres!.toString()) : null,
    },
    {
      key: 'tank_capacity_sufficiency',
      label: 'Tank capacity assessment',
      filled: hasText(p.tank_capacity_sufficiency),
      value: p.tank_capacity_sufficiency ?? null,
    },
    {
      key: 'power_supply_sources',
      label: 'Power supply',
      filled: hasPowerSources(p.power_supply_sources),
      value: powerList.length ? powerList.join(', ') : null,
    },
    {
      key: 'generator_capacity_kva',
      label: 'Generator capacity (kVA)',
      filled: hasNumber(p.generator_capacity_kva),
      value: hasNumber(p.generator_capacity_kva) ? Number(p.generator_capacity_kva!.toString()) : null,
    },
    {
      key: 'mobile_connectivity',
      label: 'Mobile connectivity',
      filled: hasText(p.mobile_connectivity),
      value: p.mobile_connectivity ?? null,
    },
    {
      key: 'total_farmers_supplying',
      label: 'Farmers supplying',
      filled: p.total_farmers_supplying != null && p.total_farmers_supplying > 0,
      value: p.total_farmers_supplying ?? null,
    },
    {
      key: 'new_farmers_last_3_months',
      label: 'New farmers (3 months)',
      filled: p.new_farmers_last_3_months != null,
      value: p.new_farmers_last_3_months ?? null,
    },
    {
      key: 'milk_transporters_count',
      label: 'Milk transporters',
      filled: p.milk_transporters_count != null,
      value: p.milk_transporters_count ?? null,
    },
    {
      key: 'average_distance_km',
      label: 'Average distance to farms',
      filled: hasNumber(p.average_distance_km),
      value: hasNumber(p.average_distance_km) ? Number(p.average_distance_km!.toString()) : null,
    },
    {
      key: 'evening_milk_pattern',
      label: 'Evening milk pattern',
      filled: hasText(p.evening_milk_pattern),
      value: p.evening_milk_pattern ?? null,
    },
    {
      key: 'own_milk_transport_type',
      label: 'Own transport type',
      filled: hasText(p.own_milk_transport_type),
      value: p.own_milk_transport_type ?? null,
    },
    {
      key: 'record_system',
      label: 'Record system',
      filled: hasText(p.record_system),
      value: p.record_system ?? null,
    },
    {
      key: 'avg_days_delivery_to_payment',
      label: 'Days delivery to payment',
      filled: p.avg_days_delivery_to_payment != null,
      value: p.avg_days_delivery_to_payment ?? null,
    },
    {
      key: 'main_buyer_name',
      label: 'Main buyer',
      filled: hasText(p.main_buyer_name),
      value: p.main_buyer_name ?? null,
    },
    {
      key: 'cooling_tanks',
      label: 'Cooling tanks configured',
      filled: tankWithCapacity(tanks),
      value: tanks.length,
    },
    {
      key: 'source_submission_code',
      label: 'Linked to onboarding',
      filled: hasText(p.source_submission_code),
      value: p.source_submission_code ?? null,
    },
  ];

  const filled = checks.filter((c) => c.filled).length;
  const total = checks.length;
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  return { filled, total, pct, fields: checks };
}

/** Loose name match for admin link guard (e.g. "MCC NYANZA" vs "Mcc nyanza"). */
export function mccNamesLikelyMatch(accountName: string, businessName: string): boolean {
  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const a = norm(accountName);
  const b = norm(businessName);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}
