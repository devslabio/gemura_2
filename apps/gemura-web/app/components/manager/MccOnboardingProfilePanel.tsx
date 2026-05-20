'use client';

import type {
  MccManagerCoolingTank,
  MccManagerOperationalProfile,
} from '@/lib/api/mcc-manager';

export type OnboardingCompletion = {
  filled: number;
  total: number;
  pct: number;
  fields?: { key: string; label: string; filled: boolean; value?: string | number | null }[];
};

type Props = {
  profile: MccManagerOperationalProfile | null;
  coolingTanks: MccManagerCoolingTank[];
  completion: OnboardingCompletion | null;
  submissionCode?: string | null;
  /** compact = dashboard card; full = MCC profile page */
  variant?: 'compact' | 'full';
  accountName?: string;
};

function hasOnboardingData(
  profile: MccManagerOperationalProfile | null,
  tanks: MccManagerCoolingTank[],
): boolean {
  return (
    Boolean(profile?.source_submission_code) ||
    tanks.length > 0 ||
    (profile?.total_farmers_supplying != null && profile.total_farmers_supplying > 0)
  );
}

function completionTone(pct: number): string {
  return pct >= 85 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#94a3b8';
}

function CompletionRing({
  pct,
  size = 'md',
}: {
  pct: number;
  size?: 'md' | 'lg' | 'xl';
}) {
  const tone = completionTone(pct);
  const dim =
    size === 'xl'
      ? 'h-[220px] w-[220px] text-4xl'
      : size === 'lg'
        ? 'h-44 w-44 text-3xl'
        : 'h-32 w-32 text-2xl';
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center rounded-full border-[6px] border-gray-100 ${dim}`}
      style={{
        background: `conic-gradient(${tone} ${pct}%, #f3f4f6 0)`,
      }}
      role="img"
      aria-label={`Profile ${pct}% complete`}
    >
      <span className="rounded-full bg-white px-4 py-2 font-bold text-gray-900 tabular-nums shadow-sm">
        {pct}%
      </span>
    </div>
  );
}

type ProfileField = {
  key: keyof MccManagerOperationalProfile | 'power_supply';
  label: string;
  format?: 'litres' | 'km' | 'list';
};

const ALL_PROFILE_FIELDS: ProfileField[] = [
  { key: 'expected_daily_deliveries', label: 'Expected deliveries / day' },
  { key: 'daily_milk_volume_litres', label: 'Daily milk volume', format: 'litres' },
  { key: 'max_milk_one_day_litres', label: 'Max milk in one day', format: 'litres' },
  { key: 'cooling_tank_total_capacity_litres', label: 'Total tank capacity', format: 'litres' },
  { key: 'tank_capacity_sufficiency', label: 'Tank capacity assessment' },
  { key: 'power_supply', label: 'Power supply', format: 'list' },
  { key: 'generator_capacity_kva', label: 'Generator (kVA)' },
  { key: 'mobile_connectivity', label: 'Mobile connectivity' },
  { key: 'total_farmers_supplying', label: 'Farmers supplying' },
  { key: 'new_farmers_last_3_months', label: 'New farmers (last 3 months)' },
  { key: 'milk_transporters_count', label: 'Milk transporters' },
  { key: 'average_distance_km', label: 'Average distance to farms', format: 'km' },
  { key: 'evening_milk_pattern', label: 'Evening milk pattern' },
  { key: 'own_milk_transport_type', label: 'Own transport type' },
  { key: 'record_system', label: 'Record system' },
  { key: 'avg_days_delivery_to_payment', label: 'Days delivery → payment' },
  { key: 'main_buyer_name', label: 'Main buyer' },
  { key: 'source_submission_code', label: 'Onboarding reference' },
];

function formatValue(profile: MccManagerOperationalProfile, field: ProfileField): string {
  if (field.key === 'power_supply') {
    return (profile.power_supply_sources ?? []).filter(Boolean).join(', ') || '—';
  }
  const v = profile[field.key as keyof MccManagerOperationalProfile];
  if (v == null || v === '') return '—';
  if (field.format === 'list' && Array.isArray(v)) {
    return v.filter(Boolean).join(', ') || '—';
  }
  if (field.format === 'litres' && typeof v === 'number') {
    return `${Math.round(v).toLocaleString()} L`;
  }
  if (field.format === 'km' && typeof v === 'number') {
    return `${v} km`;
  }
  return String(v);
}

function FieldGrid({
  profile,
  fields,
  cols = 2,
}: {
  profile: MccManagerOperationalProfile;
  fields: ProfileField[];
  cols?: 2 | 3;
}) {
  const gridClass = cols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2';
  return (
    <dl className={`grid grid-cols-1 ${gridClass} gap-x-8 gap-y-4 text-sm`}>
      {fields.map((row) => (
        <div key={row.key} className="min-w-0">
          <dt className="text-[10px] uppercase tracking-wide text-gray-500">{row.label}</dt>
          <dd className="font-semibold text-gray-900 mt-1 break-words">{formatValue(profile, row)}</dd>
        </div>
      ))}
    </dl>
  );
}

function TanksTable({ coolingTanks }: { coolingTanks: MccManagerCoolingTank[] }) {
  if (coolingTanks.length === 0) return null;
  const totalCap = coolingTanks.reduce((s, t) => s + (t.capacity_litres ?? 0), 0);
  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Cooling tanks</h3>
      <div className="overflow-x-auto rounded-sm border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
                Tank
              </th>
              <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
                Capacity (L)
              </th>
              <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
                Year / age
              </th>
              <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
                Condition
              </th>
            </tr>
          </thead>
          <tbody>
            {coolingTanks.map((t, idx) => (
              <tr key={`${t.tank_number ?? idx}`} className="border-t border-gray-100">
                <td className="py-3 px-4 font-medium">{t.tank_number?.trim() || `Tank ${idx + 1}`}</td>
                <td className="py-3 px-4 tabular-nums">
                  {t.capacity_litres != null ? Math.round(t.capacity_litres).toLocaleString() : '—'}
                </td>
                <td className="py-3 px-4 text-gray-600">{t.year_or_age?.trim() || '—'}</td>
                <td className="py-3 px-4 text-gray-600">{t.condition?.trim() || '—'}</td>
              </tr>
            ))}
            <tr className="border-t border-gray-200 bg-gray-50/80">
              <td className="py-3 px-4 font-semibold">Total</td>
              <td className="py-3 px-4 font-semibold tabular-nums" colSpan={3}>
                {totalCap > 0 ? `${Math.round(totalCap).toLocaleString()} L` : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MccOnboardingProfilePanel({
  profile,
  coolingTanks,
  completion,
  submissionCode,
  variant = 'full',
  accountName,
}: Props) {
  const synced = hasOnboardingData(profile, coolingTanks);
  const pct = completion?.pct ?? 0;
  const filled = completion?.filled ?? 0;
  const total = completion?.total ?? 0;
  const code = submissionCode ?? profile?.source_submission_code;

  if (!synced) {
    return (
      <p className="text-sm text-gray-500 py-10 text-center max-w-lg mx-auto">
        Onboarding data is not synced to this account yet. In admin, link submission
        {code ? ` ${code}` : ''} to the manager&apos;s tenant ({accountName || 'same MCC name as the wizard'}).
      </p>
    );
  }

  if (variant === 'compact') {
    const dashFields = ALL_PROFILE_FIELDS.filter((f) =>
      [
        'expected_daily_deliveries',
        'daily_milk_volume_litres',
        'total_farmers_supplying',
        'cooling_tank_total_capacity_litres',
        'power_supply',
        'record_system',
      ].includes(f.key),
    );
    return (
      <div className="flex flex-col flex-1 min-h-[220px] gap-6">
        <div className="flex flex-1 items-center justify-center min-h-[220px] w-full">
          <CompletionRing pct={pct} size="xl" />
        </div>
        <div className="text-center -mt-2">
          <p className="text-sm font-medium text-gray-900">
            {filled} of {total} onboarding fields complete
          </p>
          {code ? <p className="text-xs text-gray-500 font-mono mt-1">{code}</p> : null}
        </div>
        {profile && (
          <div className="w-full border-t border-gray-100 pt-5">
            <FieldGrid profile={profile} fields={dashFields} cols={3} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col xl:flex-row gap-8 xl:gap-12 w-full">
      <div className="flex flex-col items-center shrink-0 xl:w-[280px] xl:border-r xl:border-gray-100 xl:pr-10">
        <div className="flex items-center justify-center py-4">
          <CompletionRing pct={pct} size="xl" />
        </div>
        <p className="text-base font-semibold text-gray-900 tabular-nums text-center mt-4">
          {filled} / {total} fields complete
        </p>
        {code && <p className="text-xs text-gray-500 font-mono mt-2 text-center">{code}</p>}
        {completion?.fields && completion.fields.length > 0 && (
          <ul className="w-full mt-6 space-y-2 text-xs max-h-[320px] overflow-y-auto pr-1">
            {completion.fields.map((f) => (
              <li key={f.key} className="flex items-start gap-2">
                <span
                  className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${f.filled ? 'bg-emerald-500' : 'bg-gray-300'}`}
                />
                <span className={f.filled ? 'text-gray-800' : 'text-gray-400'}>{f.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-8 w-full">
        {profile && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Operational summary</h3>
            <FieldGrid profile={profile} fields={ALL_PROFILE_FIELDS} cols={3} />
          </div>
        )}
        <TanksTable coolingTanks={coolingTanks} />
      </div>
    </div>
  );
}
