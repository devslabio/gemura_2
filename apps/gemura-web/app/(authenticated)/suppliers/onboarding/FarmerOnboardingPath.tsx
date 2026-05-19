'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { FarmerFormState } from './model';
import { BREEDS, BreedKey, REFUGEE_DISTRICTS } from './model';
import {
  AgentPanel,
  CheckboxRow,
  FieldLabel,
  Hint,
  RadioRow,
  RiskBanner,
  TextArea,
  TextInput,
  WizardStepPanel,
} from './formPrimitives';
import { P } from './fieldPlaceholders';
import { RwandaLocationFields } from './RwandaLocationFields';

const WHO_BRINGS = [
  { value: 'self', label: 'I bring it myself' },
  { value: 'cowboy', label: 'Cowboy / hired transporter' },
  { value: 'coop_transport', label: 'Milk transport cooperative' },
  { value: 'other', label: 'Other' },
];

const BUSINESS = [
  { value: 'informal', label: 'Informal' },
  { value: 'rdb', label: 'Individual registered (RDB)' },
  { value: 'cooperative', label: 'Cooperative' },
  { value: 'ltd', label: 'Private company (Ltd)' },
];

const SOLD_PCT = [
  { value: 'lt25', label: '< 25%' },
  { value: '25_50', label: '25–50%' },
  { value: '51_75', label: '51–75%' },
  { value: 'gt75', label: '> 75%' },
];

const SALES_CH = [
  { key: 'mcc', label: 'Direct to this MCC' },
  { key: 'other_mcc', label: 'Another MCC' },
  { key: 'processor', label: 'Direct to processor' },
  { key: 'middleman', label: 'Middleman / broker' },
  { key: 'local', label: 'Local market informal' },
  { key: 'neighbours', label: 'Neighbours / community' },
];

const LACT_COLS = [
  { value: 'lt305', label: '< 305 days' },
  { value: 'eq305', label: '= 305 days' },
  { value: 'gt305', label: '> 305 days' },
];

const GOAL12_F = [
  { value: 'maintain', label: 'Maintain current production' },
  { value: 'increase', label: 'Increase milk from existing cows' },
  { value: 'breed', label: 'Improve breed to produce more' },
  { value: 'contract', label: 'Secure a formal supply contract' },
  { value: 'herd', label: 'Expand herd size' },
  { value: 'credit', label: 'Access credit for farm investment' },
];

const SUPPLY_DAYS = [
  { value: '1_2', label: '1–2 days/week' },
  { value: '3_4', label: '3–4 days/week' },
  { value: '5_6', label: '5–6 days/week' },
  { value: '7', label: 'Every day (7)' },
];

const MISSED = [
  { value: 'never', label: 'Never' },
  { value: '1_2', label: '1–2 times' },
  { value: '3_5', label: '3–5 times' },
  { value: 'gt5', label: 'More than 5 times' },
];

const SCALE = [
  { value: 'immediately', label: 'Yes immediately' },
  { value: 'feed_vet', label: 'Yes with feed / vet investment' },
  { value: 'better_cow', label: 'Yes with a better cow' },
  { value: 'max', label: 'No — at maximum capacity' },
  { value: 'unsure', label: 'Not sure' },
  { value: 'season', label: 'Depends on season' },
];

const CREDIT_INTENT_F = [
  { key: 'feed', label: 'Buy feed / supplements' },
  { key: 'vet', label: 'Pay for vet services' },
  { key: 'cow', label: 'Buy a better cow (breed improvement)' },
  { key: 'ai', label: 'Pay for AI insemination' },
  { key: 'pen', label: 'Build / improve cow pen' },
  { key: 'equip', label: 'Buy equipment' },
  { key: 'labour', label: 'Hire farm labour' },
  { key: 'other', label: 'Other' },
];

const BREED_LABEL: Record<BreedKey, string> = {
  friesian: 'Friesian',
  jersey: 'Jersey',
  cross: 'Cross breed',
  local: 'Local breed',
  other: 'Other',
};

function toggleCreditIntent(
  prev: string[],
  key: string,
  on: boolean,
  max = 2
): string[] {
  if (on) {
    if (prev.includes(key)) return prev;
    if (prev.length >= max) return [...prev.slice(0, max - 1), key];
    return [...prev, key];
  }
  return prev.filter((k) => k !== key);
}

export function computeFarmerProgress(f: FarmerFormState): number {
  if (!f?.identity || !f?.herd || !f?.lactation || !f?.management || !f?.workforce || !f?.financeFarmer || !f?.goalsFarmer || !f?.agentFarmer) {
    return 0;
  }
  const checks: boolean[] = [
    !!f.identity.surname.trim(),
    !!f.identity.firstName.trim(),
    !!f.identity.primaryPhone.trim(),
    !!f.identity.district.trim(),
    !!f.identity.sector.trim(),
    !!f.identity.nid.trim(),
    f.identity.whoBringsMilk !== '',
    f.identity.businessType !== '',
    f.identity.ownerDisability !== '',
    !!f.herd.totalCows.trim(),
    !!f.herd.peakTotal.trim() && !!f.herd.lowTotal.trim(),
    f.herd.soldPct !== '',
    f.management.vetAccess !== '',
    f.workforce.total.trim() !== '' && Number(f.workforce.total) >= 1,
    f.financeFarmer.phoneType !== '',
    f.goalsFarmer.goal12m !== '',
    f.agentFarmer.creditTier !== '',
  ];
  const n = checks.filter(Boolean).length;
  return (n / checks.length) * 100;
}

export function farmerRiskFlags(f: FarmerFormState): string[] {
  const msgs: string[] = [];
  if (!f?.identity || !f?.lactation || !f?.herd) return msgs;
  const km = Number(f.identity.distanceMccKm);
  if (!Number.isNaN(km) && km > 15) {
    msgs.push('Rejection risk rises significantly above 15 km');
  }
  BREEDS.forEach((b) => {
    const m = Number(f.lactation.calvingIntervalByBreed[b]);
    if (!Number.isNaN(m) && m > 14) {
      msgs.push(`Calving interval > 14 months (${BREED_LABEL[b]}) — vet / breeding intervention candidate`);
    }
  });
  const onlyLocal =
    Number(f.herd.breedCounts.local) > 0 &&
    BREEDS.filter((b) => b !== 'local').every((b) => !Number(f.herd.breedCounts[b]));
  const noCrossFriesian =
    !Number(f.herd.breedCounts.cross) && !Number(f.herd.breedCounts.friesian);
  if (onlyLocal && noCrossFriesian && Number(f.herd.breedCounts.local) > 0) {
    msgs.push('Local breed only — highest priority for breed improvement finance');
  }
  BREEDS.forEach((b) => {
    if (f.lactation.lactationPerBreed[b] === 'lt305') {
      msgs.push(`Lactating period < 305 days (${BREED_LABEL[b]}) — flag for review`);
    }
  });
  return [...new Set(msgs)];
}

export type FarmerWizardStep = 'f1' | 'f2' | 'f3' | 'f4' | 'f5' | 'f6' | 'f7' | 'f8' | 'agent';

interface Props {
  f: FarmerFormState;
  setF: Dispatch<SetStateAction<FarmerFormState>>;
  onlyStep: FarmerWizardStep;
  districtForRefugeeHint: string;
}

export function FarmerOnboardingPath({ f, setF, onlyStep, districtForRefugeeHint }: Props) {
  const showCoop = f.identity.businessType === 'cooperative';
  const showManagerFields = f.management.dedicatedManager === 'yes_ft';
  const showTraining = f.management.training3y === 'yes';
  const showSubsidy = f.management.subsidy === 'yes';
  const showBorrow = f.financeFarmer.borrowed === 'yes';
  const showInsuredDetail = f.lactation.cowsInsured === 'all' || f.lactation.cowsInsured === 'some';
  const salesOtherMcc = f.herd.salesChannels.includes('other_mcc');

  const refugeeHit =
    districtForRefugeeHint &&
    REFUGEE_DISTRICTS.some((d) => d.toLowerCase() === districtForRefugeeHint.trim().toLowerCase());

  return (
    <div className="space-y-4">
      {onlyStep === 'f1' && refugeeHit && (
        <RiskBanner>
          Refugee district block (Gicumbi, Kirehe, Nyamasheke, Rusizi, Nyabihu, Bugesera): 13 additional VIBE columns apply — auto-detected from district.
        </RiskBanner>
      )}

      {onlyStep === 'f1' && (
      <WizardStepPanel
        id="f-s1"
        title="1 — Farmer identity & location"
        subtitle="Names, address, phones, NID, distance to MCC, business type"
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <FieldLabel htmlFor="fsur">Surname</FieldLabel>
            <TextInput
              id="fsur"
              value={f.identity.surname}
              placeholder={P.surname}
              onChange={(e) => setF((p) => ({ ...p, identity: { ...p.identity, surname: e.target.value } }))}
            />
          </div>
          <div className="space-y-1">
            <FieldLabel htmlFor="ffirst">First name</FieldLabel>
            <TextInput
              id="ffirst"
              value={f.identity.firstName}
              placeholder={P.firstName}
              onChange={(e) => setF((p) => ({ ...p, identity: { ...p.identity, firstName: e.target.value } }))}
            />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <FieldLabel htmlFor="fother" optional>
              Other names
            </FieldLabel>
            <TextInput
              id="fother"
              value={f.identity.otherNames}
              placeholder={P.otherNames}
              onChange={(e) => setF((p) => ({ ...p, identity: { ...p.identity, otherNames: e.target.value } }))}
            />
          </div>
          <RwandaLocationFields
            idPrefix="f1"
            names={{
              province: f.identity.province,
              district: f.identity.district,
              sector: f.identity.sector,
              cell: f.identity.cell,
              village: f.identity.village,
            }}
            locationVillageId={f.identity.locationVillageId}
            onUpdate={(next) =>
              setF((p) => ({
                ...p,
                identity: {
                  ...p.identity,
                  province: next.province,
                  district: next.district,
                  sector: next.sector,
                  cell: next.cell,
                  village: next.village,
                  locationVillageId: next.locationVillageId,
                },
              }))
            }
          />
          <div className="space-y-1">
            <FieldLabel htmlFor="fphone">Primary phone (wallet login)</FieldLabel>
            <TextInput
              id="fphone"
              inputMode="tel"
              value={f.identity.primaryPhone}
              placeholder={P.phone}
              onChange={(e) => setF((p) => ({ ...p, identity: { ...p.identity, primaryPhone: e.target.value } }))}
            />
          </div>
          <div className="space-y-1">
            <FieldLabel htmlFor="fwa" optional>
              WhatsApp
            </FieldLabel>
            <TextInput
              id="fwa"
              inputMode="tel"
              value={f.identity.whatsapp}
              placeholder={P.phone}
              onChange={(e) => setF((p) => ({ ...p, identity: { ...p.identity, whatsapp: e.target.value } }))}
            />
          </div>
          <div className="sm:col-span-2 space-y-2">
            <FieldLabel htmlFor="fnid">National ID number</FieldLabel>
            <TextInput
              id="fnid"
              inputMode="numeric"
              maxLength={16}
              value={f.identity.nid}
              placeholder={P.nid}
              onChange={(e) =>
                setF((p) => ({
                  ...p,
                  identity: { ...p.identity, nid: e.target.value.replace(/\D/g, '').slice(0, 16) },
                }))
              }
            />
            <Hint>VIBE C16–C21, C79 auto-derived from ID capture on sync — not manual here.</Hint>
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="fdistmcc">Distance to MCC (km)</FieldLabel>
            <TextInput
              id="fdistmcc"
              inputMode="decimal"
              value={f.identity.distanceMccKm}
              placeholder={P.km}
              onChange={(e) => setF((p) => ({ ...p, identity: { ...p.identity, distanceMccKm: e.target.value } }))}
            />
            {Number(f.identity.distanceMccKm) > 15 && (
              <RiskBanner>Rejection risk rises above 15 km</RiskBanner>
            )}
          </div>
        </div>

        <RadioRow
          name="who"
          legend="Who brings the milk"
          value={f.identity.whoBringsMilk}
          onChange={(v) =>
            setF((p) => ({ ...p, identity: { ...p.identity, whoBringsMilk: v as FarmerFormState['identity']['whoBringsMilk'] } }))
          }
          options={WHO_BRINGS}
        />
        {f.identity.whoBringsMilk === 'other' && (
          <div className="space-y-1">
            <FieldLabel htmlFor="fwhoother">Specify</FieldLabel>
            <TextInput
              id="fwhoother"
              value={f.identity.whoBringsOther}
              placeholder={P.whoOther}
              onChange={(e) => setF((p) => ({ ...p, identity: { ...p.identity, whoBringsOther: e.target.value } }))}
            />
          </div>
        )}

        <RadioRow
          name="biz"
          legend="Business type (VIBE C23)"
          value={f.identity.businessType}
          onChange={(v) =>
            setF((p) => ({ ...p, identity: { ...p.identity, businessType: v as FarmerFormState['identity']['businessType'] } }))
          }
          options={BUSINESS}
        />

        {showCoop && (
          <div className="grid sm:grid-cols-2 gap-4 p-3 rounded-sm bg-gray-50 border border-gray-200">
            <p className="sm:col-span-2 text-sm font-medium">Cooperative (A9–A12)</p>
            <div className="space-y-1">
              <FieldLabel htmlFor="cmem">Total members (C28)</FieldLabel>
              <TextInput
                id="cmem"
                inputMode="numeric"
                value={f.identity.coopMembers}
                placeholder={P.coopNum}
                onChange={(e) => setF((p) => ({ ...p, identity: { ...p.identity, coopMembers: e.target.value } }))}
              />
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor="cwom">Women members (C29)</FieldLabel>
              <TextInput
                id="cwom"
                inputMode="numeric"
                value={f.identity.coopWomen}
                placeholder={P.coopNum}
                onChange={(e) => setF((p) => ({ ...p, identity: { ...p.identity, coopWomen: e.target.value } }))}
              />
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor="cyouth">Members aged 18–35 (C31)</FieldLabel>
              <TextInput
                id="cyouth"
                inputMode="numeric"
                value={f.identity.coopYouth1835}
                placeholder={P.coopNum}
                onChange={(e) => setF((p) => ({ ...p, identity: { ...p.identity, coopYouth1835: e.target.value } }))}
              />
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor="cyw">Young women 18–35 (C33)</FieldLabel>
              <TextInput
                id="cyw"
                inputMode="numeric"
                value={f.identity.coopYoungWomen}
                placeholder={P.coopNum}
                onChange={(e) => setF((p) => ({ ...p, identity: { ...p.identity, coopYoungWomen: e.target.value } }))}
              />
            </div>
          </div>
        )}

        <RadioRow
          name="dis"
          legend="Owner disability (VIBE C22)"
          value={f.identity.ownerDisability}
          onChange={(v) =>
            setF((p) => ({ ...p, identity: { ...p.identity, ownerDisability: v as FarmerFormState['identity']['ownerDisability'] } }))
          }
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
            { value: 'prefer_not', label: 'Prefer not to say' },
          ]}
        />
      </WizardStepPanel>
      )}

      {onlyStep === 'f2' && (
      <WizardStepPanel
        id="f-s2"
        title="2 — Herd composition & production"
        subtitle="Herd size, breeds, production volumes, sales channels"
      >
        <div className="space-y-1">
          <FieldLabel htmlFor="tcows">Total cows (all types)</FieldLabel>
          <TextInput
            id="tcows"
            inputMode="numeric"
            value={f.herd.totalCows}
            placeholder={P.totalCows}
            onChange={(e) => setF((p) => ({ ...p, herd: { ...p.herd, totalCows: e.target.value } }))}
          />
        </div>
        <p className="text-sm font-medium text-slate-800">Breed breakdown (counts)</p>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {BREEDS.map((b) => (
            <div key={b} className="space-y-1">
              <FieldLabel htmlFor={`bc-${b}`}>{BREED_LABEL[b]}</FieldLabel>
              <TextInput
                id={`bc-${b}`}
                inputMode="numeric"
                value={f.herd.breedCounts[b]}
                placeholder={P.breedCount}
                onChange={(e) =>
                  setF((p) => ({
                    ...p,
                    herd: {
                      ...p.herd,
                      breedCounts: { ...p.herd.breedCounts, [b]: e.target.value },
                    },
                  }))
                }
              />
            </div>
          ))}
        </div>
        <p className="text-sm font-medium text-slate-800">Lactating cows by breed</p>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {BREEDS.map((b) => (
            <div key={b} className="space-y-1">
              <FieldLabel htmlFor={`lac-${b}`}>{BREED_LABEL[b]}</FieldLabel>
              <TextInput
                id={`lac-${b}`}
                inputMode="numeric"
                value={f.herd.lactatingByBreed[b]}
                placeholder={P.lactating}
                onChange={(e) =>
                  setF((p) => ({
                    ...p,
                    herd: {
                      ...p.herd,
                      lactatingByBreed: { ...p.herd.lactatingByBreed, [b]: e.target.value },
                    },
                  }))
                }
              />
            </div>
          ))}
        </div>
        <p className="text-sm font-medium text-slate-800">Avg daily production per cow (L/cow/day)</p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          {(['friesian', 'jersey', 'cross', 'local'] as BreedKey[]).map((b) => (
            <div key={b} className="space-y-1">
              <FieldLabel htmlFor={`avg-${b}`}>{BREED_LABEL[b]}</FieldLabel>
              <TextInput
                id={`avg-${b}`}
                inputMode="decimal"
                value={f.herd.avgDailyPerCowByBreed[b]}
                placeholder={P.litersPerCow}
                onChange={(e) =>
                  setF((p) => ({
                    ...p,
                    herd: {
                      ...p.herd,
                      avgDailyPerCowByBreed: { ...p.herd.avgDailyPerCowByBreed, [b]: e.target.value },
                    },
                  }))
                }
              />
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <FieldLabel htmlFor="peak">Peak season total (L/day)</FieldLabel>
            <TextInput
              id="peak"
              inputMode="decimal"
              value={f.herd.peakTotal}
              placeholder={P.litersDay}
              onChange={(e) => setF((p) => ({ ...p, herd: { ...p.herd, peakTotal: e.target.value } }))}
            />
          </div>
          <div className="space-y-1">
            <FieldLabel htmlFor="low">Low season total (L/day)</FieldLabel>
            <TextInput
              id="low"
              inputMode="decimal"
              value={f.herd.lowTotal}
              placeholder={P.litersDayLow}
              onChange={(e) => setF((p) => ({ ...p, herd: { ...p.herd, lowTotal: e.target.value } }))}
            />
          </div>
        </div>
        <RadioRow
          name="sold"
          legend="% of production currently sold"
          value={f.herd.soldPct}
          onChange={(v) => setF((p) => ({ ...p, herd: { ...p.herd, soldPct: v as FarmerFormState['herd']['soldPct'] } }))}
          options={SOLD_PCT}
        />
        <CheckboxRow
          legend="Current milk sales channels"
          options={SALES_CH}
          selected={f.herd.salesChannels}
          onToggle={(key, on) =>
            setF((p) => ({
              ...p,
              herd: {
                ...p.herd,
                salesChannels: on ? [...p.herd.salesChannels, key] : p.herd.salesChannels.filter((x) => x !== key),
              },
            }))
          }
        />
        {salesOtherMcc && (
          <div className="space-y-1">
            <FieldLabel htmlFor="omcc">Other MCC name</FieldLabel>
            <TextInput
              id="omcc"
              value={f.herd.otherMccName}
              placeholder={P.mccName}
              onChange={(e) => setF((p) => ({ ...p, herd: { ...p.herd, otherMccName: e.target.value } }))}
            />
          </div>
        )}
      </WizardStepPanel>
      )}

      {onlyStep === 'f3' && (
      <WizardStepPanel
        id="f-s3"
        title="3 — Lactation, calving & breeding"
        subtitle="Lactation periods, calving intervals, breeding & insurance"
      >
        <p className="text-sm font-medium">Lactating period per breed</p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-2 text-left border-b">Breed</th>
                {LACT_COLS.map((c) => (
                  <th key={c.value} className="p-2 border-b text-center">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BREEDS.map((b) => (
                <tr key={b}>
                  <td className="p-2 border-b font-medium">{BREED_LABEL[b]}</td>
                  {LACT_COLS.map((c) => (
                    <td key={c.value} className="p-2 border-b text-center">
                      <input
                        type="radio"
                        name={`lact-${b}`}
                        checked={f.lactation.lactationPerBreed[b] === c.value}
                        onChange={() =>
                          setF((p) => ({
                            ...p,
                            lactation: {
                              ...p.lactation,
                              lactationPerBreed: { ...p.lactation.lactationPerBreed, [b]: c.value as 'lt305' | 'eq305' | 'gt305' },
                            },
                          }))
                        }
                        className="h-4 w-4"
                        aria-label={`${BREED_LABEL[b]} ${c.label}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm font-medium">Calving interval (months) per breed</p>
        <div className="grid sm:grid-cols-5 gap-2">
          {BREEDS.map((b) => (
            <div key={b} className="space-y-1">
              <FieldLabel htmlFor={`ci-${b}`}>{BREED_LABEL[b]}</FieldLabel>
              <TextInput
                id={`ci-${b}`}
                inputMode="decimal"
                value={f.lactation.calvingIntervalByBreed[b]}
                placeholder={P.months}
                onChange={(e) =>
                  setF((p) => ({
                    ...p,
                    lactation: {
                      ...p.lactation,
                      calvingIntervalByBreed: { ...p.lactation.calvingIntervalByBreed, [b]: e.target.value },
                    },
                  }))
                }
              />
            </div>
          ))}
        </div>
        <CheckboxRow
          legend="Breeding method"
          options={[
            { key: 'natural', label: 'Natural mating (bull)' },
            { key: 'ai', label: 'AI insemination' },
            { key: 'both', label: 'Both' },
            { key: 'unsure', label: 'Not sure' },
          ]}
          selected={f.lactation.breedingMethod}
          onToggle={(key, on) =>
            setF((p) => ({
              ...p,
              lactation: {
                ...p.lactation,
                breedingMethod: on
                  ? [...p.lactation.breedingMethod, key]
                  : p.lactation.breedingMethod.filter((x) => x !== key),
              },
            }))
          }
        />
        <RadioRow
          name="ins"
          legend="Cows insured"
          value={f.lactation.cowsInsured}
          onChange={(v) =>
            setF((p) => ({ ...p, lactation: { ...p.lactation, cowsInsured: v as FarmerFormState['lactation']['cowsInsured'] } }))
          }
          options={[
            { value: 'all', label: 'All insured' },
            { value: 'some', label: 'Some insured' },
            { value: 'no', label: 'No' },
            { value: 'unsure', label: 'Not sure' },
          ]}
        />
        {showInsuredDetail && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <FieldLabel htmlFor="insc">Cows covered (count)</FieldLabel>
              <TextInput
                id="insc"
                inputMode="numeric"
                value={f.lactation.cowsInsuredCount}
                placeholder={P.breedCount}
                onChange={(e) => setF((p) => ({ ...p, lactation: { ...p.lactation, cowsInsuredCount: e.target.value } }))}
              />
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor="insp">Insurance provider</FieldLabel>
              <TextInput
                id="insp"
                value={f.lactation.insuranceProvider}
                placeholder={P.insurance}
                onChange={(e) => setF((p) => ({ ...p, lactation: { ...p.lactation, insuranceProvider: e.target.value } }))}
              />
            </div>
          </div>
        )}
      </WizardStepPanel>
      )}

      {onlyStep === 'f4' && (
      <WizardStepPanel
        id="f-s4"
        title="4 — Farming system & infrastructure"
        subtitle="Grazing, feed, water, land, infrastructure"
      >
        <RadioRow
          name="graz"
          legend="Grazing practice"
          value={f.farming.grazing}
          onChange={(v) =>
            setF((p) => ({ ...p, farming: { ...p.farming, grazing: v as FarmerFormState['farming']['grazing'] } }))
          }
          options={[
            { value: 'open', label: 'Open grazing' },
            { value: 'zero', label: 'Zero grazing / intensive' },
            { value: 'semi', label: 'Semi-intensive' },
            { value: 'mixed', label: 'Mixed (seasonal)' },
          ]}
        />
        <CheckboxRow
          legend="Feed types used"
          options={[
            { key: 'grass', label: 'Fresh green grass' },
            { key: 'hay', label: 'Hay' },
            { key: 'silage', label: 'Silage' },
            { key: 'concentrate', label: 'Concentrate / dairy meal' },
            { key: 'residue', label: 'Crop residues' },
            { key: 'commercial', label: 'Commercial feed' },
          ]}
          selected={f.farming.feedTypes}
          onToggle={(key, on) =>
            setF((p) => ({
              ...p,
              farming: {
                ...p.farming,
                feedTypes: on ? [...p.farming.feedTypes, key] : p.farming.feedTypes.filter((x) => x !== key),
              },
            }))
          }
        />
        <RadioRow
          name="water"
          legend="Clean water access daily"
          value={f.farming.cleanWater}
          onChange={(v) =>
            setF((p) => ({ ...p, farming: { ...p.farming, cleanWater: v as FarmerFormState['farming']['cleanWater'] } }))
          }
          options={[
            { value: 'daily', label: 'Yes daily' },
            { value: 'sometimes', label: 'Sometimes' },
            { value: 'no', label: 'No reliable access' },
          ]}
        />
        <CheckboxRow
          legend="Water source"
          options={[
            { key: 'dam', label: 'Valley dam' },
            { key: 'tap', label: 'Tap / piped' },
            { key: 'rain', label: 'Rainwater' },
            { key: 'river', label: 'River / stream' },
            { key: 'bore', label: 'Borehole' },
            { key: 'other', label: 'Other' },
          ]}
          selected={f.farming.waterSource}
          onToggle={(key, on) =>
            setF((p) => ({
              ...p,
              farming: {
                ...p.farming,
                waterSource: on ? [...p.farming.waterSource, key] : p.farming.waterSource.filter((x) => x !== key),
              },
            }))
          }
        />
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <FieldLabel htmlFor="dha">Dairy land (ha)</FieldLabel>
            <TextInput
              id="dha"
              inputMode="decimal"
              value={f.farming.dairyHa}
              placeholder={P.hectares}
              onChange={(e) => setF((p) => ({ ...p, farming: { ...p.farming, dairyHa: e.target.value } }))}
            />
          </div>
          <div className="space-y-1">
            <FieldLabel htmlFor="oha">Other land (ha)</FieldLabel>
            <TextInput
              id="oha"
              inputMode="decimal"
              value={f.farming.otherHa}
              placeholder={P.hectares}
              onChange={(e) => setF((p) => ({ ...p, farming: { ...p.farming, otherHa: e.target.value } }))}
            />
          </div>
        </div>
        <CheckboxRow
          legend="Farm infrastructure"
          options={[
            { key: 'kraal', label: 'Cow pen / kraal' },
            { key: 'milking', label: 'Milking area / shed' },
            { key: 'feed', label: 'Feed storage' },
            { key: 'trough', label: 'Water trough' },
            { key: 'records', label: 'Records register' },
            { key: 'vetmed', label: 'Vet medicine storage' },
          ]}
          selected={f.farming.infrastructure}
          onToggle={(key, on) =>
            setF((p) => ({
              ...p,
              farming: {
                ...p.farming,
                infrastructure: on
                  ? [...p.farming.infrastructure, key]
                  : p.farming.infrastructure.filter((x) => x !== key),
              },
            }))
          }
        />
      </WizardStepPanel>
      )}

      {onlyStep === 'f5' && (
      <WizardStepPanel
        id="f-s5"
        title="5 — Farm management & support"
        subtitle="Manager, vet access, training, subsidies"
      >
        <RadioRow
          name="man"
          legend="Dedicated farm manager"
          value={f.management.dedicatedManager}
          onChange={(v) =>
            setF((p) => ({
              ...p,
              management: { ...p.management, dedicatedManager: v as FarmerFormState['management']['dedicatedManager'] },
            }))
          }
          options={[
            { value: 'yes_ft', label: 'Yes full-time' },
            { value: 'self', label: 'I manage it myself' },
            { value: 'none', label: 'No dedicated manager' },
          ]}
        />
        {showManagerFields && (
          <div className="space-y-1">
            <FieldLabel htmlFor="mname">Farm manager name</FieldLabel>
            <TextInput
              id="mname"
              value={f.management.managerName}
              placeholder={P.managerName}
              onChange={(e) => setF((p) => ({ ...p, management: { ...p.management, managerName: e.target.value } }))}
            />
          </div>
        )}
        <RadioRow
          name="vet"
          legend="Veterinary officer access"
          value={f.management.vetAccess}
          onChange={(v) =>
            setF((p) => ({ ...p, management: { ...p.management, vetAccess: v as FarmerFormState['management']['vetAccess'] } }))
          }
          options={[
            { value: 'regular', label: 'Yes regular visits' },
            { value: 'call', label: 'Yes when needed' },
            { value: 'chw', label: 'Community health workers only' },
            { value: 'none', label: 'No access' },
          ]}
        />
        <CheckboxRow
          legend="Biosecurity measures"
          options={[
            { key: 'visitors', label: 'Visitors restricted' },
            { key: 'sick', label: 'Sick animals separated' },
            { key: 'disinfect', label: 'Equipment disinfected' },
            { key: 'none_bio', label: 'No formal biosecurity' },
          ]}
          selected={f.management.biosecurity}
          onToggle={(key, on) =>
            setF((p) => ({
              ...p,
              management: {
                ...p.management,
                biosecurity: on
                  ? [...p.management.biosecurity, key]
                  : p.management.biosecurity.filter((x) => x !== key),
              },
            }))
          }
        />
        <RadioRow
          name="train"
          legend="Dairy management training (last 3 years)"
          value={f.management.training3y}
          onChange={(v) =>
            setF((p) => ({ ...p, management: { ...p.management, training3y: v as 'yes' | 'no' } }))
          }
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]}
        />
        {showTraining && (
          <div className="space-y-1">
            <FieldLabel htmlFor="tprov">Training provider</FieldLabel>
            <TextInput
              id="tprov"
              value={f.management.trainingProvider}
              placeholder={P.trainingProvider}
              onChange={(e) => setF((p) => ({ ...p, management: { ...p.management, trainingProvider: e.target.value } }))}
            />
          </div>
        )}
        <RadioRow
          name="sub"
          legend="Subsidy or grant received"
          value={f.management.subsidy}
          onChange={(v) => setF((p) => ({ ...p, management: { ...p.management, subsidy: v as 'yes' | 'no' } }))}
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]}
        />
        {showSubsidy && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <FieldLabel htmlFor="gsrc">Grant source</FieldLabel>
              <TextInput
                id="gsrc"
                value={f.management.grantSource}
                placeholder={P.grantSource}
                onChange={(e) => setF((p) => ({ ...p, management: { ...p.management, grantSource: e.target.value } }))}
              />
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor="gwhat">What was provided</FieldLabel>
              <TextInput
                id="gwhat"
                value={f.management.grantWhat}
                placeholder={P.grantProvided}
                onChange={(e) => setF((p) => ({ ...p, management: { ...p.management, grantWhat: e.target.value } }))}
              />
            </div>
          </div>
        )}
      </WizardStepPanel>
      )}

      {onlyStep === 'f6' && (
      <WizardStepPanel
        id="f-s6"
        title="6 — Workforce (VIBE)"
        subtitle="Worker counts for reporting (splits derived on sync)"
      >
        <Hint>
          Platform derives male/female and age splits (C47, C50, C55–C57, C52) from these counts — shown for agent awareness.
        </Hint>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <FieldLabel htmlFor="wtot">Total workers incl. owner (C45)</FieldLabel>
            <TextInput
              id="wtot"
              inputMode="numeric"
              value={f.workforce.total}
              placeholder={P.workers}
              onChange={(e) => setF((p) => ({ ...p, workforce: { ...p.workforce, total: e.target.value } }))}
            />
          </div>
          <div className="space-y-1">
            <FieldLabel htmlFor="wwom">How many are women (C46)</FieldLabel>
            <TextInput
              id="wwom"
              inputMode="numeric"
              value={f.workforce.women}
              placeholder={P.women}
              onChange={(e) => setF((p) => ({ ...p, workforce: { ...p.workforce, women: e.target.value } }))}
            />
          </div>
          <div className="space-y-1">
            <FieldLabel htmlFor="w1835">Aged 18–35 (C48)</FieldLabel>
            <TextInput
              id="w1835"
              inputMode="numeric"
              value={f.workforce.aged1835}
              placeholder={P.youth}
              onChange={(e) => setF((p) => ({ ...p, workforce: { ...p.workforce, aged1835: e.target.value } }))}
            />
          </div>
          <div className="space-y-1">
            <FieldLabel htmlFor="wwy">Of 18–35, how many women (C49)</FieldLabel>
            <TextInput
              id="wwy"
              inputMode="numeric"
              value={f.workforce.women1835}
              placeholder={P.women}
              onChange={(e) => setF((p) => ({ ...p, workforce: { ...p.workforce, women1835: e.target.value } }))}
            />
          </div>
          <div className="space-y-1">
            <FieldLabel htmlFor="wpwd">Workers with disability (C51)</FieldLabel>
            <TextInput
              id="wpwd"
              inputMode="numeric"
              value={f.workforce.disabled}
              placeholder={P.pwdCount}
              onChange={(e) => setF((p) => ({ ...p, workforce: { ...p.workforce, disabled: e.target.value } }))}
            />
          </div>
        </div>
        {showManagerFields && (
          <div className="grid sm:grid-cols-2 gap-4 p-3 rounded-sm border border-gray-200 bg-gray-50">
            <p className="sm:col-span-2 text-sm font-medium">Separate farm manager (C43–C44)</p>
            <RadioRow
              name="msx"
              legend="Manager sex"
              value={f.workforce.managerSex}
              onChange={(v) =>
                setF((p) => ({ ...p, workforce: { ...p.workforce, managerSex: v as 'male' | 'female' } }))
              }
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
              ]}
            />
            <div className="space-y-1">
              <FieldLabel htmlFor="mage">Manager age</FieldLabel>
              <TextInput
                id="mage"
                inputMode="numeric"
                value={f.workforce.managerAge}
                placeholder={P.managerAge}
                onChange={(e) => setF((p) => ({ ...p, workforce: { ...p.workforce, managerAge: e.target.value } }))}
              />
            </div>
          </div>
        )}
      </WizardStepPanel>
      )}

      {onlyStep === 'f7' && (
      <WizardStepPanel
        id="f-s7"
        title="7 — Digital & financial readiness"
        subtitle="Payments, borrowing, revenue, credit intent"
      >
        <RadioRow
          name="rec"
          legend="Record-keeping method"
          value={f.financeFarmer.records}
          onChange={(v) =>
            setF((p) => ({
              ...p,
              financeFarmer: { ...p.financeFarmer, records: v as FarmerFormState['financeFarmer']['records'] },
            }))
          }
          options={[
            { value: 'none', label: 'No records' },
            { value: 'paper', label: 'Paper notebook' },
            { value: 'phone', label: 'Phone notes / spreadsheet' },
            { value: 'app', label: 'Farm app or software' },
            { value: 'mcc', label: 'MCC keeps records' },
            { value: 'other', label: 'Other' },
          ]}
        />
        <CheckboxRow
          legend="Current milk payment method"
          options={[
            { key: 'cod', label: 'Cash on delivery' },
            { key: 'cow', label: 'Cash end week/month' },
            { key: 'momo', label: 'MTN MoMo' },
            { key: 'airtel', label: 'Airtel Money' },
            { key: 'bank', label: 'Bank transfer' },
            { key: 'through_mcc', label: 'Through MCC' },
          ]}
          selected={f.financeFarmer.paymentMethods}
          onToggle={(key, on) =>
            setF((p) => ({
              ...p,
              financeFarmer: {
                ...p.financeFarmer,
                paymentMethods: on
                  ? [...p.financeFarmer.paymentMethods, key]
                  : p.financeFarmer.paymentMethods.filter((x) => x !== key),
              },
            }))
          }
        />
        <RadioRow
          name="ph"
          legend="Mobile phone type"
          value={f.financeFarmer.phoneType}
          onChange={(v) =>
            setF((p) => ({
              ...p,
              financeFarmer: { ...p.financeFarmer, phoneType: v as FarmerFormState['financeFarmer']['phoneType'] },
            }))
          }
          options={[
            { value: 'basic', label: 'Basic phone' },
            { value: 'smart', label: 'Smartphone' },
            { value: 'none', label: 'No mobile phone' },
          ]}
        />
        <RadioRow
          name="momo"
          legend="Willing to receive payments via mobile money"
          value={f.financeFarmer.momoWilling}
          onChange={(v) =>
            setF((p) => ({
              ...p,
              financeFarmer: { ...p.financeFarmer, momoWilling: v as FarmerFormState['financeFarmer']['momoWilling'] },
            }))
          }
          options={[
            { value: 'happy', label: 'Yes — happy to use' },
            { value: 'try', label: 'Yes — willing to try' },
            { value: 'unsure', label: 'Unsure' },
            { value: 'cash', label: 'No — prefer cash' },
          ]}
        />
        <RadioRow
          name="bor"
          legend="Borrowed for the farm before"
          value={f.financeFarmer.borrowed}
          onChange={(v) =>
            setF((p) => ({ ...p, financeFarmer: { ...p.financeFarmer, borrowed: v as 'yes' | 'no' } }))
          }
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]}
        />
        {showBorrow && (
          <CheckboxRow
            legend="Borrowed from"
            options={[
              { key: 'bank', label: 'Commercial bank' },
              { key: 'sacco', label: 'SACCO / microfinance' },
              { key: 'family', label: 'Family / friends' },
              { key: 'momo_loan', label: 'Mobile money loan' },
              { key: 'gov', label: 'Government programme' },
              { key: 'never', label: 'Never borrowed' },
            ]}
            selected={f.financeFarmer.borrowSources}
            onToggle={(key, on) =>
              setF((p) => ({
                ...p,
                financeFarmer: {
                  ...p.financeFarmer,
                  borrowSources: on
                    ? [...p.financeFarmer.borrowSources, key]
                    : p.financeFarmer.borrowSources.filter((x) => x !== key),
                },
              }))
            }
          />
        )}
        <div className="space-y-1">
          <FieldLabel htmlFor="rev">Average annual revenue before Gemura (RWF) — C75</FieldLabel>
          <TextInput
            id="rev"
            inputMode="numeric"
            value={f.financeFarmer.annualRevenueRwf}
            placeholder={P.revenue}
            onChange={(e) =>
              setF((p) => ({ ...p, financeFarmer: { ...p.financeFarmer, annualRevenueRwf: e.target.value } }))
            }
          />
          <Hint>Post-VIBE revenue (C76) is captured at 6-month wallet review — not here.</Hint>
        </div>
        <CheckboxRow
          legend="Credit use intent (max 2)"
          maxSelections={2}
          options={CREDIT_INTENT_F}
          selected={f.financeFarmer.creditIntent}
          onToggle={(key, on) =>
            setF((p) => ({
              ...p,
              financeFarmer: {
                ...p.financeFarmer,
                creditIntent: toggleCreditIntent(p.financeFarmer.creditIntent, key, on, 2),
              },
            }))
          }
        />
      </WizardStepPanel>
      )}

      {onlyStep === 'f8' && (
      <WizardStepPanel
        id="f-s8"
        title="8 — Goals & pathway"
        subtitle="Supply behaviour and growth intent"
      >
        <RadioRow
          name="g12"
          legend="Main goal (12 months)"
          value={f.goalsFarmer.goal12m}
          onChange={(v) => setF((p) => ({ ...p, goalsFarmer: { ...p.goalsFarmer, goal12m: v } }))}
          options={GOAL12_F}
        />
        <RadioRow
          name="sd"
          legend="Days per week supplying milk"
          value={f.goalsFarmer.supplyDays}
          onChange={(v) => setF((p) => ({ ...p, goalsFarmer: { ...p.goalsFarmer, supplyDays: v } }))}
          options={SUPPLY_DAYS}
        />
        <RadioRow
          name="miss"
          legend="Missed deliveries (last 4 weeks)"
          value={f.goalsFarmer.missed4w}
          onChange={(v) => setF((p) => ({ ...p, goalsFarmer: { ...p.goalsFarmer, missed4w: v } }))}
          options={MISSED}
        />
        <div className="space-y-1">
          <FieldLabel htmlFor="missr" optional>
            Main reason for missed deliveries
          </FieldLabel>
          <TextArea
            id="missr"
            value={f.goalsFarmer.missedReason}
            placeholder={P.reason}
            onChange={(e) => setF((p) => ({ ...p, goalsFarmer: { ...p.goalsFarmer, missedReason: e.target.value } }))}
          />
        </div>
        <RadioRow
          name="scale"
          legend="If guaranteed buyer — increase production within 3 months?"
          value={f.goalsFarmer.scaleCapacity}
          onChange={(v) => setF((p) => ({ ...p, goalsFarmer: { ...p.goalsFarmer, scaleCapacity: v } }))}
          options={SCALE}
        />
      </WizardStepPanel>
      )}

      {onlyStep === 'agent' && (
      <AgentPanel title="Agent panel — Farmer pathway assignment">
        {farmerRiskFlags(f).length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-amber-950">Auto flags</p>
            <ul className="list-disc pl-5 text-sm text-amber-950 space-y-0.5">
              {farmerRiskFlags(f).map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}
        <RadioRow
          name="p1"
          legend="Pathway 1 — Digital aggregation (C77)"
          value={f.agentFarmer.pathwayP1}
          onChange={(v) =>
            setF((p) => ({
              ...p,
              agentFarmer: { ...p.agentFarmer, pathwayP1: v as '' | 'qualifies' | 'not' },
            }))
          }
          options={[
            { value: 'qualifies', label: 'Qualifies' },
            { value: 'not', label: 'Does not qualify' },
          ]}
        />
        <div className="space-y-1">
          <FieldLabel htmlFor="p1r">Pathway 1 reason</FieldLabel>
          <TextArea
            id="p1r"
            value={f.agentFarmer.pathwayP1Reason}
            placeholder={P.reason}
            onChange={(e) =>
              setF((p) => ({ ...p, agentFarmer: { ...p.agentFarmer, pathwayP1Reason: e.target.value } }))
            }
          />
        </div>
        <RadioRow
          name="bi"
          legend="Breed improvement candidate (C78)"
          value={f.agentFarmer.breedImprovement}
          onChange={(v) =>
            setF((p) => ({
              ...p,
              agentFarmer: { ...p.agentFarmer, breedImprovement: v as '' | 'yes' | 'no' },
            }))
          }
          options={[
            { value: 'yes', label: 'Yes — flag for credit' },
            { value: 'no', label: 'No' },
          ]}
        />
        <RadioRow
          name="tier"
          legend="Initial credit tier"
          value={f.agentFarmer.creditTier}
          onChange={(v) =>
            setF((p) => ({
              ...p,
              agentFarmer: { ...p.agentFarmer, creditTier: v as '' | 'starter' | 'reliable' },
            }))
          }
          options={[
            { value: 'starter', label: 'Starter (< 10 L/day)' },
            { value: 'reliable', label: 'Reliable (20+ L/day)' },
          ]}
        />
        <div className="space-y-1">
          <FieldLabel htmlFor="agn">Agent notes</FieldLabel>
          <TextArea
            id="agn"
            value={f.agentFarmer.notes}
            placeholder={P.notes}
            onChange={(e) => setF((p) => ({ ...p, agentFarmer: { ...p.agentFarmer, notes: e.target.value } }))}
          />
        </div>
      </AgentPanel>
      )}
    </div>
  );
}
