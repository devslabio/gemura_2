'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { adminApi, type TenantAccountAdminDetail } from '@/lib/api/admin';
import { useToastStore } from '@/store/toast';
import Icon, { faSpinner, faPlus, faTrash, faEdit } from '@/app/components/Icon';

const POWER_STATUSES = ['grid', 'generator', 'solar', 'outage', 'unknown'] as const;
const GENERATOR_STATUSES = ['available', 'running', 'fault', 'offline', 'unknown'] as const;

/** Matches account detail cards: flat border, no shadow. */
const panel = 'bg-white border border-gray-200 rounded-sm p-6 flex flex-col h-full min-h-0';
/** Preview: primary column (left) — shares width with right stack. */
const previewPanelPrimary =
  'flex flex-1 min-w-0 flex-col bg-white border border-gray-200 rounded-sm p-6 min-h-0';
/** Preview: cards stacked in the right column (facility + tanks). */
const previewPanelStack =
  'flex flex-col bg-white border border-gray-200 rounded-sm p-6 min-h-0';
const panelTitle = 'text-base font-semibold text-gray-900 pb-3 mb-4 border-b border-gray-100 shrink-0';

function numInput(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '';
  return String(v);
}

function strInput(v: string | null | undefined): string {
  return v ?? '';
}

function toIsoLocalDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseOptionalInt(raw: string): number | null {
  const n = parseOptionalNumber(raw);
  return n == null ? null : Math.round(n);
}

function DisplayValue({ children }: { children: ReactNode }) {
  const empty = children === null || children === undefined || children === '';
  return <span className={empty ? 'text-gray-400' : 'text-gray-900'}>{empty ? '—' : children}</span>;
}

function PreviewItem({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-1.5 text-sm leading-snug break-words min-h-[1.25rem]">
        <DisplayValue>{children}</DisplayValue>
      </dd>
    </div>
  );
}

function PreviewGrid({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 flex-1 min-h-0 auto-rows-min content-start">
      {children}
    </dl>
  );
}

type TankDraft = { tank_number: string; capacity_litres: string; year_or_age: string; condition: string };

export default function AccountOperationalMetricsSection({
  adminAccountId,
  detail,
  onReload,
}: {
  adminAccountId: string | undefined;
  detail: TenantAccountAdminDetail;
  onReload: () => Promise<void>;
}) {
  const successToast = useToastStore((s) => s.success);
  const errorToast = useToastStore((s) => s.error);

  const [editing, setEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingFacility, setSavingFacility] = useState(false);
  const [savingTanks, setSavingTanks] = useState(false);

  const [profileFields, setProfileFields] = useState({
    expected_daily_deliveries: '',
    daily_milk_volume_litres: '',
    max_milk_one_day_litres: '',
    tank_capacity_sufficiency: '',
    insufficient_capacity_plan: '',
    power_supply_json: '',
    generator_capacity_kva: '',
    mobile_connectivity: '',
    total_farmers_supplying: '',
    new_farmers_last_3_months: '',
    milk_transporters_count: '',
    average_distance_km: '',
    furthest_farm_km: '',
    evening_milk_pattern: '',
    own_milk_transport_type: '',
    record_system: '',
    avg_days_delivery_to_payment: '',
    average_annual_revenue_rwf: '',
    main_buyer_name: '',
    formal_supply_agreement_details: '',
  });

  const [facilityFields, setFacilityFields] = useState({
    tank_used_litres: '',
    tank_used_pct: '',
    cooling_temperature_c: '',
    power_status: '',
    generator_status: '',
    generator_fuel_pct: '',
    observed_at_local: '',
  });

  const [tankRows, setTankRows] = useState<TankDraft[]>([]);

  const syncFromDetail = useCallback(() => {
    const p = detail.operational_profile;
    setProfileFields({
      expected_daily_deliveries: numInput(p?.expected_daily_deliveries ?? null),
      daily_milk_volume_litres: numInput(p?.daily_milk_volume_litres ?? null),
      max_milk_one_day_litres: numInput(p?.max_milk_one_day_litres ?? null),
      tank_capacity_sufficiency: strInput(p?.tank_capacity_sufficiency),
      insufficient_capacity_plan: strInput(p?.insufficient_capacity_plan),
      power_supply_json:
        p?.power_supply_sources != null ? JSON.stringify(p.power_supply_sources, null, 2) : '',
      generator_capacity_kva: numInput(p?.generator_capacity_kva ?? null),
      mobile_connectivity: strInput(p?.mobile_connectivity),
      total_farmers_supplying: numInput(p?.total_farmers_supplying ?? null),
      new_farmers_last_3_months: numInput(p?.new_farmers_last_3_months ?? null),
      milk_transporters_count: numInput(p?.milk_transporters_count ?? null),
      average_distance_km: numInput(p?.average_distance_km ?? null),
      furthest_farm_km: numInput(p?.furthest_farm_km ?? null),
      evening_milk_pattern: strInput(p?.evening_milk_pattern),
      own_milk_transport_type: strInput(p?.own_milk_transport_type),
      record_system: strInput(p?.record_system),
      avg_days_delivery_to_payment: numInput(p?.avg_days_delivery_to_payment ?? null),
      average_annual_revenue_rwf: numInput(p?.average_annual_revenue_rwf ?? null),
      main_buyer_name: strInput(p?.main_buyer_name),
      formal_supply_agreement_details: strInput(p?.formal_supply_agreement_details),
    });

    const f = detail.facility_snapshot;
    setFacilityFields({
      tank_used_litres: numInput(f?.tank_used_litres ?? null),
      tank_used_pct: numInput(f?.tank_used_pct ?? null),
      cooling_temperature_c: numInput(f?.cooling_temperature_c ?? null),
      power_status: strInput(f?.power_status),
      generator_status: strInput(f?.generator_status),
      generator_fuel_pct: numInput(f?.generator_fuel_pct ?? null),
      observed_at_local: toIsoLocalDateTime(f?.observed_at ?? null),
    });

    setTankRows(
      detail.cooling_tank_profiles.length
        ? detail.cooling_tank_profiles.map((t) => ({
            tank_number: strInput(t.tank_number),
            capacity_litres: numInput(t.capacity_litres ?? null),
            year_or_age: strInput(t.year_or_age),
            condition: strInput(t.condition),
          }))
        : [{ tank_number: '', capacity_litres: '', year_or_age: '', condition: '' }],
    );
  }, [detail]);

  useEffect(() => {
    syncFromDetail();
  }, [syncFromDetail]);

  const startEditing = () => {
    syncFromDetail();
    setEditing(true);
  };

  const cancelEditing = () => {
    syncFromDetail();
    setEditing(false);
  };

  const buildProfilePayload = () => {
    const rawJson = profileFields.power_supply_json.trim();
    let power_supply_sources: Record<string, unknown> | undefined;
    if (rawJson !== '') {
      try {
        const parsed = JSON.parse(rawJson) as unknown;
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('Must be a JSON object');
        }
        power_supply_sources = parsed as Record<string, unknown>;
      } catch {
        errorToast('Power supply sources must be valid JSON object, or leave blank to keep unchanged.');
        return null;
      }
    }

    const profile: Record<string, unknown> = {
      expected_daily_deliveries: parseOptionalInt(profileFields.expected_daily_deliveries),
      daily_milk_volume_litres: parseOptionalNumber(profileFields.daily_milk_volume_litres),
      max_milk_one_day_litres: parseOptionalNumber(profileFields.max_milk_one_day_litres),
      tank_capacity_sufficiency: profileFields.tank_capacity_sufficiency.trim() || null,
      insufficient_capacity_plan: profileFields.insufficient_capacity_plan.trim() || null,
      generator_capacity_kva: parseOptionalNumber(profileFields.generator_capacity_kva),
      mobile_connectivity: profileFields.mobile_connectivity.trim() || null,
      total_farmers_supplying: parseOptionalInt(profileFields.total_farmers_supplying),
      new_farmers_last_3_months: parseOptionalInt(profileFields.new_farmers_last_3_months),
      milk_transporters_count: parseOptionalInt(profileFields.milk_transporters_count),
      average_distance_km: parseOptionalNumber(profileFields.average_distance_km),
      furthest_farm_km: parseOptionalNumber(profileFields.furthest_farm_km),
      evening_milk_pattern: profileFields.evening_milk_pattern.trim() || null,
      own_milk_transport_type: profileFields.own_milk_transport_type.trim() || null,
      record_system: profileFields.record_system.trim() || null,
      avg_days_delivery_to_payment: parseOptionalInt(profileFields.avg_days_delivery_to_payment),
      average_annual_revenue_rwf: parseOptionalNumber(profileFields.average_annual_revenue_rwf),
      main_buyer_name: profileFields.main_buyer_name.trim() || null,
      formal_supply_agreement_details: profileFields.formal_supply_agreement_details.trim() || null,
    };
    if (power_supply_sources !== undefined) {
      profile.power_supply_sources = power_supply_sources;
    }
    return { profile };
  };

  const saveProfile = async () => {
    const body = buildProfilePayload();
    if (!body) return;
    setSavingProfile(true);
    try {
      const res = await adminApi.updateTenantAccountOperationalMetrics(adminAccountId, detail.id, body);
      if (res.code === 200) {
        successToast('Operational profile saved.');
        await onReload();
      } else {
        errorToast(res.message || 'Save failed.');
      }
    } catch (e: unknown) {
      errorToast((e as { message?: string })?.message || 'Save failed.');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveFacility = async () => {
    let observed_at: string | null = null;
    if (facilityFields.observed_at_local.trim()) {
      const d = new Date(facilityFields.observed_at_local);
      if (Number.isNaN(d.getTime())) {
        errorToast('Observed at is not a valid date.');
        return;
      }
      observed_at = d.toISOString();
    } else {
      observed_at = null;
    }

    const body = {
      facility_snapshot: {
        tank_used_litres: parseOptionalNumber(facilityFields.tank_used_litres),
        tank_used_pct: parseOptionalNumber(facilityFields.tank_used_pct),
        cooling_temperature_c: parseOptionalNumber(facilityFields.cooling_temperature_c),
        power_status: facilityFields.power_status.trim() || null,
        generator_status: facilityFields.generator_status.trim() || null,
        generator_fuel_pct: parseOptionalNumber(facilityFields.generator_fuel_pct),
        observed_at,
      },
    };

    setSavingFacility(true);
    try {
      const res = await adminApi.updateTenantAccountOperationalMetrics(adminAccountId, detail.id, body);
      if (res.code === 200) {
        successToast('Facility snapshot saved.');
        await onReload();
      } else {
        errorToast(res.message || 'Save failed.');
      }
    } catch (e: unknown) {
      errorToast((e as { message?: string })?.message || 'Save failed.');
    } finally {
      setSavingFacility(false);
    }
  };

  const saveTanks = async () => {
    const cooling_tanks = tankRows.map((row) => ({
      tank_number: row.tank_number.trim() || null,
      capacity_litres: parseOptionalNumber(row.capacity_litres),
      year_or_age: row.year_or_age.trim() || null,
      condition: row.condition.trim() || null,
    }));

    setSavingTanks(true);
    try {
      const res = await adminApi.updateTenantAccountOperationalMetrics(adminAccountId, detail.id, { cooling_tanks });
      if (res.code === 200) {
        successToast('Cooling tanks saved.');
        await onReload();
      } else {
        errorToast(res.message || 'Save failed.');
      }
    } catch (e: unknown) {
      errorToast((e as { message?: string })?.message || 'Save failed.');
    } finally {
      setSavingTanks(false);
    }
  };

  const gridInput =
    'mt-1 block w-full rounded-sm border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]';

  const p = detail.operational_profile;
  const f = detail.facility_snapshot;
  const tanks = detail.cooling_tank_profiles;

  return (
    <section className="space-y-4">
      <div className={`${panel} !h-auto`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">Operational metrics</h2>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl">
              Milk operations baseline, facility signals, and cooling tanks. Preview is read-only; use Edit to change values.
            </p>
          </div>
          {!editing ? (
            <button type="button" className="btn btn-primary text-sm shrink-0" onClick={startEditing}>
              <Icon icon={faEdit} size="sm" className="mr-2" />
              Edit metrics
            </button>
          ) : (
            <button type="button" className="btn btn-secondary text-sm shrink-0" onClick={cancelEditing}>
              Cancel editing
            </button>
          )}
        </div>
      </div>

      {!editing ? (
        <div className="flex flex-col xl:flex-row gap-4 xl:items-stretch">
          <article className={previewPanelPrimary}>
            <h3 className={panelTitle}>Operational profile</h3>
            <PreviewGrid>
              <PreviewItem label="Expected daily deliveries">{p?.expected_daily_deliveries ?? ''}</PreviewItem>
              <PreviewItem label="Daily milk volume (L)">{p?.daily_milk_volume_litres ?? ''}</PreviewItem>
              <PreviewItem label="Max milk in one day (L)">{p?.max_milk_one_day_litres ?? ''}</PreviewItem>
              <PreviewItem label="Tank capacity sufficiency">{p?.tank_capacity_sufficiency}</PreviewItem>
              <PreviewItem label="Generator capacity (kVA)">{p?.generator_capacity_kva ?? ''}</PreviewItem>
              <PreviewItem label="Mobile connectivity">{p?.mobile_connectivity}</PreviewItem>
              <PreviewItem label="Total farmers supplying">{p?.total_farmers_supplying ?? ''}</PreviewItem>
              <PreviewItem label="New farmers (3 mo)">{p?.new_farmers_last_3_months ?? ''}</PreviewItem>
              <PreviewItem label="Milk transporters">{p?.milk_transporters_count ?? ''}</PreviewItem>
              <PreviewItem label="Average distance (km)">{p?.average_distance_km ?? ''}</PreviewItem>
              <PreviewItem label="Furthest farm (km)">{p?.furthest_farm_km ?? ''}</PreviewItem>
              <PreviewItem label="Evening milk pattern">{p?.evening_milk_pattern}</PreviewItem>
              <PreviewItem label="Own transport type">{p?.own_milk_transport_type}</PreviewItem>
              <PreviewItem label="Record system">{p?.record_system}</PreviewItem>
              <PreviewItem label="Avg days delivery → payment">{p?.avg_days_delivery_to_payment ?? ''}</PreviewItem>
              <PreviewItem label="Avg annual revenue (RWF)">{p?.average_annual_revenue_rwf ?? ''}</PreviewItem>
              <PreviewItem label="Main buyer">{p?.main_buyer_name}</PreviewItem>
              <PreviewItem label="Insufficient capacity plan" className="sm:col-span-2">
                {p?.insufficient_capacity_plan ? (
                  <span className="whitespace-pre-wrap text-gray-900">{p.insufficient_capacity_plan}</span>
                ) : (
                  ''
                )}
              </PreviewItem>
              <PreviewItem label="Formal supply agreement" className="sm:col-span-2">
                {p?.formal_supply_agreement_details ? (
                  <span className="whitespace-pre-wrap text-gray-900">{p.formal_supply_agreement_details}</span>
                ) : (
                  ''
                )}
              </PreviewItem>
              <PreviewItem label="Power supply sources" className="sm:col-span-2">
                {p?.power_supply_sources != null ? (
                  <pre className="mt-1 text-xs font-mono bg-gray-50 border border-gray-100 rounded-sm p-3 overflow-x-auto max-h-36">
                    {JSON.stringify(p.power_supply_sources, null, 2)}
                  </pre>
                ) : (
                  ''
                )}
              </PreviewItem>
            </PreviewGrid>
            {p?.source_submission_code ? (
              <p className="text-xs text-gray-500 mt-auto pt-4 border-t border-gray-100 shrink-0">
                Source onboarding <span className="font-mono text-gray-700">{p.source_submission_code}</span>
              </p>
            ) : null}
          </article>

          <div className="flex flex-1 min-w-0 flex-col gap-4 min-h-0">
            <article className={`${previewPanelStack} shrink-0`}>
              <h3 className={panelTitle}>Facility snapshot</h3>
              <PreviewGrid>
                <PreviewItem label="Tank used (L)">{f?.tank_used_litres ?? ''}</PreviewItem>
                <PreviewItem label="Tank used (%)">{f?.tank_used_pct ?? ''}</PreviewItem>
                <PreviewItem label="Cooling temp (°C)">{f?.cooling_temperature_c ?? ''}</PreviewItem>
                <PreviewItem label="Power status">{f?.power_status}</PreviewItem>
                <PreviewItem label="Generator status">{f?.generator_status}</PreviewItem>
                <PreviewItem label="Generator fuel (%)">{f?.generator_fuel_pct ?? ''}</PreviewItem>
                <PreviewItem label="Observed at" className="sm:col-span-2">
                  {f?.observed_at ? new Date(f.observed_at).toLocaleString() : ''}
                </PreviewItem>
                <PreviewItem label="Source">{f?.source}</PreviewItem>
              </PreviewGrid>
              {f?.updated_at ? (
                <p className="text-xs text-gray-500 mt-auto pt-4 border-t border-gray-100 shrink-0">
                  Record updated {new Date(f.updated_at).toLocaleString()}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-auto pt-4 border-t border-gray-100 shrink-0">
                  No snapshot stored yet.
                </p>
              )}
            </article>

            <article className={`${previewPanelStack} flex-1 flex flex-col min-h-[140px]`}>
              <h3 className={panelTitle}>Cooling tanks</h3>
              {tanks.length === 0 ? (
                <div className="flex flex-1 min-h-[120px] flex-col items-center justify-center rounded-sm border border-dashed border-gray-200 bg-gray-50/50 px-4">
                  <p className="text-sm text-gray-500 text-center">No cooling tanks recorded.</p>
                </div>
              ) : (
                <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-sm border border-gray-100">
                  <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          <th className="px-3 py-2">Tank #</th>
                          <th className="px-3 py-2 text-right">Capacity (L)</th>
                          <th className="px-3 py-2">Year / age</th>
                          <th className="px-3 py-2">Condition</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tanks.map((t) => (
                          <tr key={t.id} className="border-b border-gray-100 last:border-0">
                            <td className="px-3 py-2.5 text-gray-900">{t.tank_number?.trim() || '—'}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">
                              {t.capacity_litres != null ? t.capacity_litres : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-gray-900">{t.year_or_age?.trim() || '—'}</td>
                            <td className="px-3 py-2.5 text-gray-900">{t.condition?.trim() || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </article>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <div className={`${panel} !h-auto`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Operational profile</h3>
                <p className="text-xs text-gray-500 mt-1">Baseline volumes, farmers, and buyer context.</p>
              </div>
              <button type="button" className="btn btn-primary text-sm" disabled={savingProfile} onClick={saveProfile}>
                {savingProfile ? (
                  <>
                    <Icon icon={faSpinner} spin size="sm" className="mr-2" />
                    Saving…
                  </>
                ) : (
                  'Save profile'
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600">Expected daily deliveries</label>
                <input
                  className={gridInput}
                  inputMode="numeric"
                  value={profileFields.expected_daily_deliveries}
                  onChange={(e) => setProfileFields((s) => ({ ...s, expected_daily_deliveries: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Daily milk volume (L)</label>
                <input
                  className={gridInput}
                  inputMode="decimal"
                  value={profileFields.daily_milk_volume_litres}
                  onChange={(e) => setProfileFields((s) => ({ ...s, daily_milk_volume_litres: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Max milk in one day (L)</label>
                <input
                  className={gridInput}
                  inputMode="decimal"
                  value={profileFields.max_milk_one_day_litres}
                  onChange={(e) => setProfileFields((s) => ({ ...s, max_milk_one_day_litres: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Tank capacity sufficiency</label>
                <input
                  className={gridInput}
                  value={profileFields.tank_capacity_sufficiency}
                  onChange={(e) => setProfileFields((s) => ({ ...s, tank_capacity_sufficiency: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-gray-600">Insufficient capacity plan</label>
                <textarea
                  className={`${gridInput} min-h-[72px]`}
                  value={profileFields.insufficient_capacity_plan}
                  onChange={(e) => setProfileFields((s) => ({ ...s, insufficient_capacity_plan: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Generator capacity (kVA)</label>
                <input
                  className={gridInput}
                  inputMode="decimal"
                  value={profileFields.generator_capacity_kva}
                  onChange={(e) => setProfileFields((s) => ({ ...s, generator_capacity_kva: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Mobile connectivity</label>
                <input
                  className={gridInput}
                  value={profileFields.mobile_connectivity}
                  onChange={(e) => setProfileFields((s) => ({ ...s, mobile_connectivity: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Total farmers supplying</label>
                <input
                  className={gridInput}
                  inputMode="numeric"
                  value={profileFields.total_farmers_supplying}
                  onChange={(e) => setProfileFields((s) => ({ ...s, total_farmers_supplying: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">New farmers (last 3 months)</label>
                <input
                  className={gridInput}
                  inputMode="numeric"
                  value={profileFields.new_farmers_last_3_months}
                  onChange={(e) => setProfileFields((s) => ({ ...s, new_farmers_last_3_months: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Milk transporters count</label>
                <input
                  className={gridInput}
                  inputMode="numeric"
                  value={profileFields.milk_transporters_count}
                  onChange={(e) => setProfileFields((s) => ({ ...s, milk_transporters_count: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Average distance (km)</label>
                <input
                  className={gridInput}
                  inputMode="decimal"
                  value={profileFields.average_distance_km}
                  onChange={(e) => setProfileFields((s) => ({ ...s, average_distance_km: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Furthest farm (km)</label>
                <input
                  className={gridInput}
                  inputMode="decimal"
                  value={profileFields.furthest_farm_km}
                  onChange={(e) => setProfileFields((s) => ({ ...s, furthest_farm_km: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Evening milk pattern</label>
                <input
                  className={gridInput}
                  value={profileFields.evening_milk_pattern}
                  onChange={(e) => setProfileFields((s) => ({ ...s, evening_milk_pattern: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Own milk transport type</label>
                <input
                  className={gridInput}
                  value={profileFields.own_milk_transport_type}
                  onChange={(e) => setProfileFields((s) => ({ ...s, own_milk_transport_type: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Record system</label>
                <input
                  className={gridInput}
                  value={profileFields.record_system}
                  onChange={(e) => setProfileFields((s) => ({ ...s, record_system: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Avg days delivery → payment</label>
                <input
                  className={gridInput}
                  inputMode="numeric"
                  value={profileFields.avg_days_delivery_to_payment}
                  onChange={(e) => setProfileFields((s) => ({ ...s, avg_days_delivery_to_payment: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Average annual revenue (RWF)</label>
                <input
                  className={gridInput}
                  inputMode="decimal"
                  value={profileFields.average_annual_revenue_rwf}
                  onChange={(e) => setProfileFields((s) => ({ ...s, average_annual_revenue_rwf: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-gray-600">Main buyer name</label>
                <input
                  className={gridInput}
                  value={profileFields.main_buyer_name}
                  onChange={(e) => setProfileFields((s) => ({ ...s, main_buyer_name: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-gray-600">Formal supply agreement details</label>
                <textarea
                  className={`${gridInput} min-h-[72px]`}
                  value={profileFields.formal_supply_agreement_details}
                  onChange={(e) => setProfileFields((s) => ({ ...s, formal_supply_agreement_details: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-gray-600">Power supply sources (JSON object)</label>
                <textarea
                  className={`${gridInput} font-mono text-xs min-h-[88px]`}
                  placeholder="Leave blank to keep stored value unchanged."
                  value={profileFields.power_supply_json}
                  onChange={(e) => setProfileFields((s) => ({ ...s, power_supply_json: e.target.value }))}
                />
              </div>
            </div>

            {detail.operational_profile?.source_submission_code ? (
              <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-100">
                Source onboarding <span className="font-mono">{detail.operational_profile.source_submission_code}</span>
              </p>
            ) : null}
          </div>

          <div className={`${panel} !h-auto`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Facility snapshot</h3>
                <p className="text-xs text-gray-500 mt-1">Tank usage, cooling, and power signals.</p>
              </div>
              <button type="button" className="btn btn-primary text-sm" disabled={savingFacility} onClick={saveFacility}>
                {savingFacility ? (
                  <>
                    <Icon icon={faSpinner} spin size="sm" className="mr-2" />
                    Saving…
                  </>
                ) : (
                  'Save snapshot'
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600">Tank used (L)</label>
                <input
                  className={gridInput}
                  inputMode="decimal"
                  value={facilityFields.tank_used_litres}
                  onChange={(e) => setFacilityFields((s) => ({ ...s, tank_used_litres: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Tank used (%)</label>
                <input
                  className={gridInput}
                  inputMode="decimal"
                  value={facilityFields.tank_used_pct}
                  onChange={(e) => setFacilityFields((s) => ({ ...s, tank_used_pct: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Cooling temperature (°C)</label>
                <input
                  className={gridInput}
                  inputMode="decimal"
                  value={facilityFields.cooling_temperature_c}
                  onChange={(e) => setFacilityFields((s) => ({ ...s, cooling_temperature_c: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Power status</label>
                <select
                  className={gridInput}
                  value={facilityFields.power_status}
                  onChange={(e) => setFacilityFields((s) => ({ ...s, power_status: e.target.value }))}
                >
                  <option value="">—</option>
                  {POWER_STATUSES.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Generator status</label>
                <select
                  className={gridInput}
                  value={facilityFields.generator_status}
                  onChange={(e) => setFacilityFields((s) => ({ ...s, generator_status: e.target.value }))}
                >
                  <option value="">—</option>
                  {GENERATOR_STATUSES.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Generator fuel (%)</label>
                <input
                  className={gridInput}
                  inputMode="decimal"
                  value={facilityFields.generator_fuel_pct}
                  onChange={(e) => setFacilityFields((s) => ({ ...s, generator_fuel_pct: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Observed at (local)</label>
                <input
                  type="datetime-local"
                  className={gridInput}
                  value={facilityFields.observed_at_local}
                  onChange={(e) => setFacilityFields((s) => ({ ...s, observed_at_local: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className={`${panel} !h-auto`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Cooling tanks</h3>
                <p className="text-xs text-gray-500 mt-1">Saving replaces all tanks for this account.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-secondary text-sm"
                  onClick={() =>
                    setTankRows((rows) => [...rows, { tank_number: '', capacity_litres: '', year_or_age: '', condition: '' }])
                  }
                >
                  <Icon icon={faPlus} size="sm" className="mr-2" />
                  Add tank
                </button>
                <button type="button" className="btn btn-primary text-sm" disabled={savingTanks} onClick={saveTanks}>
                  {savingTanks ? (
                    <>
                      <Icon icon={faSpinner} spin size="sm" className="mr-2" />
                      Saving…
                    </>
                  ) : (
                    'Save tanks'
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {tankRows.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end rounded-sm border border-gray-100 bg-gray-50/80 p-4"
                >
                  <div className="md:col-span-3">
                    <label className="text-xs font-medium text-gray-600">Tank #</label>
                    <input
                      className={gridInput}
                      value={row.tank_number}
                      onChange={(e) =>
                        setTankRows((rows) => rows.map((r, i) => (i === idx ? { ...r, tank_number: e.target.value } : r)))
                      }
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs font-medium text-gray-600">Capacity (L)</label>
                    <input
                      className={gridInput}
                      inputMode="decimal"
                      value={row.capacity_litres}
                      onChange={(e) =>
                        setTankRows((rows) => rows.map((r, i) => (i === idx ? { ...r, capacity_litres: e.target.value } : r)))
                      }
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs font-medium text-gray-600">Year / age</label>
                    <input
                      className={gridInput}
                      value={row.year_or_age}
                      onChange={(e) =>
                        setTankRows((rows) => rows.map((r, i) => (i === idx ? { ...r, year_or_age: e.target.value } : r)))
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-gray-600">Condition</label>
                    <input
                      className={gridInput}
                      value={row.condition}
                      onChange={(e) =>
                        setTankRows((rows) => rows.map((r, i) => (i === idx ? { ...r, condition: e.target.value } : r)))
                      }
                    />
                  </div>
                  <div className="md:col-span-1 flex justify-end pb-2">
                    <button
                      type="button"
                      className="text-gray-500 hover:text-red-600 p-2 rounded-sm hover:bg-white"
                      aria-label="Remove tank row"
                      onClick={() =>
                        setTankRows((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== idx)))
                      }
                    >
                      <Icon icon={faTrash} size="sm" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
