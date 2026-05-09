'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { CollectorFormState, MilkCollectorKind } from './model';
import { MILK_COLLECTOR_KIND } from './model';
import { REFUGEE_DISTRICTS } from './model';
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
  wizardNativeSelectClass,
} from './formPrimitives';
import { P } from './fieldPlaceholders';

function toggleCreditIntent(prev: string[], key: string, on: boolean, max = 2): string[] {
  if (on) {
    if (prev.includes(key)) return prev;
    if (prev.length >= max) return prev;
    return [...prev, key];
  }
  return prev.filter((k) => k !== key);
}

const MCC_OPTIONS = [
  { value: 'mcc_a', label: 'MCC — linked account A' },
  { value: 'mcc_b', label: 'MCC — linked account B' },
  { value: 'other', label: 'Other — specify' },
];

function creditTierSatisfied(c: CollectorFormState): boolean {
  if (c.collectorKind === 'pure_collector') return true;
  return c.agentCollector.creditTier !== '';
}

export function computeCollectorProgress(c: CollectorFormState): number {
  const checks = [
    c.collectorKind !== '',
    !!c.c1.surname.trim(),
    !!c.c1.firstName.trim(),
    !!c.c1.primaryPhone.trim(),
    !!c.c1.district.trim(),
    !!c.c1.nid.trim(),
    c.c1.linkedMcc !== '',
    !!c.c2.peakL.trim() && !!c.c2.lowL.trim(),
    c.workforceC.total.trim() !== '' && Number(c.workforceC.total) >= 1,
    c.financeC.phoneType !== '',
    c.goalsC.goal12m !== '',
    creditTierSatisfied(c),
  ];
  return (checks.filter(Boolean).length / checks.length) * 100;
}

export function collectorRiskFlags(c: CollectorFormState): string[] {
  const t = Number(c.c2.transitMin);
  const msgs: string[] = [];
  if (!Number.isNaN(t) && t > 90) {
    msgs.push('High Umurara (fermentation) risk — transit over 90 minutes');
  }
  return msgs;
}

export function rosterSummary(c: CollectorFormState) {
  const total = c.roster.length;
  const reg = c.roster.filter((r) => r.registration === 'registered').length;
  const notReg = c.roster.filter((r) => r.registration === 'not_registered').length;
  return { total, reg, notReg };
}

export type CollectorWizardStep = 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6' | 'agent';

interface Props {
  c: CollectorFormState;
  setC: Dispatch<SetStateAction<CollectorFormState>>;
  onlyStep: CollectorWizardStep;
  districtForRefugeeHint: string;
}

export function CollectorOnboardingPath({ c, setC, onlyStep, districtForRefugeeHint }: Props) {
  const showMccOther = c.c1.linkedMcc === 'other';
  const showCooling = c.c2.cooling === 'yes';
  const destOtherMcc = c.c2.otherDestinations.includes('other_mcc');

  const { total, reg, notReg } = rosterSummary(c);

  const kindLabel = (k: MilkCollectorKind) => MILK_COLLECTOR_KIND[k].label;
  const profileBanner =
    c.collectorKind === 'farmer_collector' ? (
      <Hint>
        <span className="font-semibold text-slate-800">{kindLabel('farmer_collector')}.</span>{' '}
        Own-farm production and collection for others are separate in reporting: manifests apply to milk from other
        farms; your credit (if any) is based on your own production only.
      </Hint>
    ) : c.collectorKind === 'pure_collector' ? (
      <Hint>
        <span className="font-semibold text-slate-800">{kindLabel('pure_collector')}.</span>{' '}
        No own milk on this profile — only collected volumes, fees, and manifest compliance. Gemura credit products do
        not apply to the collector role (use a separate farmer account if you also produce).
      </Hint>
    ) : null;

  const refugeeHit =
    districtForRefugeeHint &&
    REFUGEE_DISTRICTS.some((d) => d.toLowerCase() === districtForRefugeeHint.trim().toLowerCase());

  return (
    <div className="space-y-4">
      {onlyStep && profileBanner}
      {onlyStep === 'c1' && refugeeHit && (
        <RiskBanner>
          Refugee district block applies — auto-detected from district (same as farmer path).
        </RiskBanner>
      )}

      {onlyStep === 'c1' && (
      <WizardStepPanel
        id="c-s1"
        title="C1 — Collector identity & registration"
        subtitle={
          c.collectorKind
            ? `${MILK_COLLECTOR_KIND[c.collectorKind].label} — identity, location, linked MCC, business type`
            : 'Identity, location, linked MCC, business type'
        }
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="csur">Surname</FieldLabel>
            <TextInput
              id="csur"
              value={c.c1.surname}
              placeholder={P.surname}
              onChange={(e) => setC((p) => ({ ...p, c1: { ...p.c1, surname: e.target.value } }))}
            />
          </div>
          <div>
            <FieldLabel htmlFor="cfirst">First name</FieldLabel>
            <TextInput
              id="cfirst"
              value={c.c1.firstName}
              placeholder={P.firstName}
              onChange={(e) => setC((p) => ({ ...p, c1: { ...p.c1, firstName: e.target.value } }))}
            />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="cother" optional>
              Other names
            </FieldLabel>
            <TextInput
              id="cother"
              value={c.c1.otherNames}
              placeholder={P.otherNames}
              onChange={(e) => setC((p) => ({ ...p, c1: { ...p.c1, otherNames: e.target.value } }))}
            />
          </div>
          <div>
            <FieldLabel htmlFor="cphone">Primary phone (wallet login)</FieldLabel>
            <TextInput
              id="cphone"
              inputMode="tel"
              value={c.c1.primaryPhone}
              placeholder={P.phone}
              onChange={(e) => setC((p) => ({ ...p, c1: { ...p.c1, primaryPhone: e.target.value } }))}
            />
          </div>
          <div>
            <FieldLabel htmlFor="cwa" optional>
              WhatsApp
            </FieldLabel>
            <TextInput
              id="cwa"
              inputMode="tel"
              value={c.c1.whatsapp}
              placeholder={P.phone}
              onChange={(e) => setC((p) => ({ ...p, c1: { ...p.c1, whatsapp: e.target.value } }))}
            />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="cnid">National ID number</FieldLabel>
            <TextInput
              id="cnid"
              inputMode="numeric"
              maxLength={16}
              value={c.c1.nid}
              placeholder={P.nid}
              onChange={(e) =>
                setC((p) => ({
                  ...p,
                  c1: { ...p.c1, nid: e.target.value.replace(/\D/g, '').slice(0, 16) },
                }))
              }
            />
            <Hint>Photo capture below; NID parsing on sync.</Hint>
          </div>
          <div>
            <FieldLabel htmlFor="cprov">Province</FieldLabel>
            <TextInput
              id="cprov"
              value={c.c1.province}
              placeholder={P.province}
              onChange={(e) => setC((p) => ({ ...p, c1: { ...p.c1, province: e.target.value } }))}
            />
          </div>
          <div>
            <FieldLabel htmlFor="cdist">District</FieldLabel>
            <TextInput
              id="cdist"
              value={c.c1.district}
              placeholder={P.district}
              onChange={(e) => setC((p) => ({ ...p, c1: { ...p.c1, district: e.target.value } }))}
            />
          </div>
          <div>
            <FieldLabel htmlFor="csec">Sector</FieldLabel>
            <TextInput
              id="csec"
              value={c.c1.sector}
              placeholder={P.sector}
              onChange={(e) => setC((p) => ({ ...p, c1: { ...p.c1, sector: e.target.value } }))}
            />
          </div>
          <div>
            <FieldLabel htmlFor="ccell">Cell</FieldLabel>
            <TextInput
              id="ccell"
              value={c.c1.cell}
              placeholder={P.cell}
              onChange={(e) => setC((p) => ({ ...p, c1: { ...p.c1, cell: e.target.value } }))}
            />
          </div>
          <div>
            <FieldLabel htmlFor="cvill">Village</FieldLabel>
            <TextInput
              id="cvill"
              value={c.c1.village}
              placeholder={P.village}
              onChange={(e) => setC((p) => ({ ...p, c1: { ...p.c1, village: e.target.value } }))}
            />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="cmcc">Linked MCC</FieldLabel>
            <select
              id="cmcc"
              className={wizardNativeSelectClass()}
              value={c.c1.linkedMcc}
              onChange={(e) => setC((p) => ({ ...p, c1: { ...p.c1, linkedMcc: e.target.value } }))}
            >
              <option value="">Select…</option>
              {MCC_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {showMccOther && (
              <div className="mt-2">
                <FieldLabel htmlFor="cmcco">Specify MCC</FieldLabel>
                <TextInput
                  id="cmcco"
                  value={c.c1.linkedMccOther}
                  placeholder={P.mccName}
                  onChange={(e) => setC((p) => ({ ...p, c1: { ...p.c1, linkedMccOther: e.target.value } }))}
                />
              </div>
            )}
          </div>
          <RadioRow
            name="cdis"
            legend="Owner disability (C22)"
            value={c.c1.ownerDisability}
            onChange={(v) =>
              setC((p) => ({
                ...p,
                c1: { ...p.c1, ownerDisability: v as CollectorFormState['c1']['ownerDisability'] },
              }))
            }
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
              { value: 'prefer_not', label: 'Prefer not to say' },
            ]}
          />
          <RadioRow
            name="cbiz"
            legend="Business type (C23)"
            value={c.c1.businessType}
            onChange={(v) =>
              setC((p) => ({
                ...p,
                c1: { ...p.c1, businessType: v as CollectorFormState['c1']['businessType'] },
              }))
            }
            options={[
              { value: 'informal', label: 'Informal' },
              { value: 'rdb', label: 'Individual registered (RDB)' },
              { value: 'coop_member', label: 'Cooperative member' },
              { value: 'ltd', label: 'Private company (Ltd)' },
            ]}
          />
        </div>
      </WizardStepPanel>
      )}

      {onlyStep === 'c2' && (
      <WizardStepPanel
        id="c-s2"
        title="C2 — Collection operations"
        subtitle="Volumes, transport, cooling, transit time"
      >
        {c.collectorKind === 'pure_collector' && (
          <Hint>
            Peak and low = total litres you collect for other farms and deliver to the MCC (no own-herd production on
            this profile).
          </Hint>
        )}
        {c.collectorKind === 'farmer_collector' && (
          <Hint>
            Peak and low = combined daily volume you bring to the MCC (your own milk plus others). Farm-by-farm
            manifest will split the collected portion.
          </Hint>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="c2sec">Collection area — sector</FieldLabel>
            <TextInput
              id="c2sec"
              value={c.c2.sector}
              placeholder={P.sector}
              onChange={(e) => setC((p) => ({ ...p, c2: { ...p.c2, sector: e.target.value } }))}
            />
          </div>
          <div>
            <FieldLabel htmlFor="c2cells">Collection area — cells</FieldLabel>
            <TextInput
              id="c2cells"
              value={c.c2.cells}
              placeholder="e.g. Cell A, Cell B"
              onChange={(e) => setC((p) => ({ ...p, c2: { ...p.c2, cells: e.target.value } }))}
            />
          </div>
          <div>
            <FieldLabel htmlFor="crad">Approx. collection radius (km)</FieldLabel>
            <TextInput
              id="crad"
              inputMode="decimal"
              value={c.c2.radiusKm}
              placeholder={P.radiusKm}
              onChange={(e) => setC((p) => ({ ...p, c2: { ...p.c2, radiusKm: e.target.value } }))}
            />
          </div>
          <div>
            <FieldLabel htmlFor="cfarms">
              {c.collectorKind === 'pure_collector' ? 'Farms you collect from (count)' : 'Farms on route (count)'}
            </FieldLabel>
            <TextInput
              id="cfarms"
              inputMode="numeric"
              value={c.c2.farmCount}
              placeholder={P.farmCount}
              onChange={(e) => setC((p) => ({ ...p, c2: { ...p.c2, farmCount: e.target.value } }))}
            />
          </div>
        </div>
        <RadioRow
          name="cdays"
          legend="Days per week collecting"
          value={c.c2.daysWeek}
          onChange={(v) => setC((p) => ({ ...p, c2: { ...p.c2, daysWeek: v } }))}
          options={[
            { value: '1_2', label: '1–2' },
            { value: '3_4', label: '3–4' },
            { value: '5_6', label: '5–6' },
            { value: '7', label: 'Every day' },
          ]}
        />
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="cpk">
              {c.collectorKind === 'pure_collector'
                ? 'Peak season — total collected (L/day)'
                : 'Peak season avg daily volume (L)'}
            </FieldLabel>
            <TextInput
              id="cpk"
              inputMode="decimal"
              value={c.c2.peakL}
              placeholder={P.litersDay}
              onChange={(e) => setC((p) => ({ ...p, c2: { ...p.c2, peakL: e.target.value } }))}
            />
          </div>
          <div>
            <FieldLabel htmlFor="clow">
              {c.collectorKind === 'pure_collector'
                ? 'Low season — total collected (L/day)'
                : 'Low season avg daily volume (L)'}
            </FieldLabel>
            <TextInput
              id="clow"
              inputMode="decimal"
              value={c.c2.lowL}
              placeholder={P.litersDayLow}
              onChange={(e) => setC((p) => ({ ...p, c2: { ...p.c2, lowL: e.target.value } }))}
            />
          </div>
        </div>
        <CheckboxRow
          legend="Transport method"
          options={[
            { key: 'moto', label: 'Motorcycle (jerry cans)' },
            { key: 'bike', label: 'Bicycle' },
            { key: 'vehicle', label: 'Vehicle / pickup' },
            { key: 'foot', label: 'On foot' },
            { key: 'other_tr', label: 'Other' },
          ]}
          selected={c.c2.transport}
          onToggle={(key, on) =>
            setC((p) => ({
              ...p,
              c2: {
                ...p.c2,
                transport: on ? [...p.c2.transport, key] : p.c2.transport.filter((x) => x !== key),
              },
            }))
          }
        />
        {c.c2.transport.includes('other_tr') && (
          <div>
            <FieldLabel htmlFor="trot">Other transport</FieldLabel>
            <TextInput
              id="trot"
              value={c.c2.transportOther}
              placeholder={P.transportOther}
              onChange={(e) => setC((p) => ({ ...p, c2: { ...p.c2, transportOther: e.target.value } }))}
            />
          </div>
        )}
        <RadioRow
          name="cool"
          legend="Cooling or chilling equipment"
          value={c.c2.cooling}
          onChange={(v) => setC((p) => ({ ...p, c2: { ...p.c2, cooling: v as 'yes' | 'no' } }))}
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]}
        />
        {showCooling && (
          <div>
            <FieldLabel htmlFor="coold">Type and capacity</FieldLabel>
            <TextInput
              id="coold"
              value={c.c2.coolingDetail}
              placeholder={P.coolingDetail}
              onChange={(e) => setC((p) => ({ ...p, c2: { ...p.c2, coolingDetail: e.target.value } }))}
            />
          </div>
        )}
        <div>
          <FieldLabel htmlFor="trn">Avg transit time — first farm to MCC (minutes)</FieldLabel>
          <TextInput
            id="trn"
            inputMode="numeric"
            value={c.c2.transitMin}
            placeholder={P.transitMin}
            onChange={(e) => setC((p) => ({ ...p, c2: { ...p.c2, transitMin: e.target.value } }))}
          />
          {Number(c.c2.transitMin) > 90 && (
            <RiskBanner>High Umurara (fermentation) risk — transit over 90 minutes.</RiskBanner>
          )}
        </div>
        <CheckboxRow
          legend="Other delivery destinations"
          options={[
            { key: 'only_mcc', label: 'Only this MCC' },
            { key: 'other_mcc', label: 'Another MCC' },
            { key: 'processor', label: 'Direct to processor' },
            { key: 'informal', label: 'Informal market / middleman' },
          ]}
          selected={c.c2.otherDestinations}
          onToggle={(key, on) =>
            setC((p) => ({
              ...p,
              c2: {
                ...p.c2,
                otherDestinations: on
                  ? [...p.c2.otherDestinations, key]
                  : p.c2.otherDestinations.filter((x) => x !== key),
              },
            }))
          }
        />
        {destOtherMcc && (
          <div>
            <FieldLabel htmlFor="omccn">Other MCC name</FieldLabel>
            <TextInput
              id="omccn"
              value={c.c2.otherMccName}
              placeholder={P.mccName}
              onChange={(e) => setC((p) => ({ ...p, c2: { ...p.c2, otherMccName: e.target.value } }))}
            />
          </div>
        )}
      </WizardStepPanel>
      )}

      {onlyStep === 'c3' && (
      <WizardStepPanel
        id="c-s3"
        title="C3 — Farmer roster"
        subtitle="Farms served and registration status"
      >
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <p className="text-sm text-gray-700">Add farms the collector serves.</p>
          <button
            type="button"
            className="btn btn-secondary min-h-[44px]"
            onClick={() =>
              setC((p) => ({
                ...p,
                roster: [
                  ...p.roster,
                  { id: `r-${Date.now()}`, nameOrId: '', registration: '' },
                ],
              }))
            }
          >
            Add farm
          </button>
        </div>
        <div className="rounded-sm border border-gray-200 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Farmer name / ID</th>
                <th className="text-left p-2">Registration</th>
                <th className="p-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {c.roster.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="p-2">
                    <TextInput
                      aria-label="Farmer name or Gemura ID"
                      value={row.nameOrId}
                      placeholder={P.rosterName}
                      onChange={(e) =>
                        setC((p) => ({
                          ...p,
                          roster: p.roster.map((r) =>
                            r.id === row.id ? { ...r, nameOrId: e.target.value } : r
                          ),
                        }))
                      }
                    />
                  </td>
                  <td className="p-2">
                    <select
                      className={wizardNativeSelectClass()}
                      value={row.registration}
                      onChange={(e) =>
                        setC((p) => ({
                          ...p,
                          roster: p.roster.map((r) =>
                            r.id === row.id
                              ? {
                                  ...r,
                                  registration: e.target.value as '' | 'registered' | 'not_registered',
                                }
                              : r
                          ),
                        }))
                      }
                    >
                      <option value="">Select…</option>
                      <option value="registered">Registered on Gemura</option>
                      <option value="not_registered">Not yet registered</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <button
                      type="button"
                      className="text-red-600 text-sm underline min-h-[44px] px-2"
                      onClick={() =>
                        setC((p) => ({ ...p, roster: p.roster.filter((r) => r.id !== row.id) }))
                      }
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-sm bg-gray-50 rounded-sm p-3 border border-gray-200">
          <div>
            <div className="text-gray-500">Total farms</div>
            <div className="text-lg font-semibold">{total}</div>
          </div>
          <div>
            <div className="text-gray-500">Registered</div>
            <div className="text-lg font-semibold text-[#052A54]">{reg}</div>
          </div>
          <div>
            <div className="text-gray-500">Not registered</div>
            <div className="text-lg font-semibold text-amber-900">{notReg}</div>
          </div>
        </div>
      </WizardStepPanel>
      )}

      {onlyStep === 'c4' && (
      <WizardStepPanel
        id="c-s4"
        title="C4 — Workforce (VIBE)"
        subtitle="Collector and helpers — reporting counts"
      >
        <Hint>Include collector and hired helpers. Same VIBE logic as farmer Section 6.</Hint>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="wtotc">Total workers incl. collector (C45)</FieldLabel>
            <TextInput
              id="wtotc"
              inputMode="numeric"
              value={c.workforceC.total}
              placeholder={P.workers}
              onChange={(e) => setC((p) => ({ ...p, workforceC: { ...p.workforceC, total: e.target.value } }))}
            />
          </div>
          <div>
            <FieldLabel htmlFor="wwomc">Women (C46)</FieldLabel>
            <TextInput
              id="wwomc"
              inputMode="numeric"
              value={c.workforceC.women}
              placeholder={P.women}
              onChange={(e) => setC((p) => ({ ...p, workforceC: { ...p.workforceC, women: e.target.value } }))}
            />
          </div>
          <div>
            <FieldLabel htmlFor="w18c">Aged 18–35 (C48)</FieldLabel>
            <TextInput
              id="w18c"
              inputMode="numeric"
              value={c.workforceC.aged1835}
              placeholder={P.youth}
              onChange={(e) => setC((p) => ({ ...p, workforceC: { ...p.workforceC, aged1835: e.target.value } }))}
            />
          </div>
          <div>
            <FieldLabel htmlFor="wwy18c">Women aged 18–35 (C49)</FieldLabel>
            <TextInput
              id="wwy18c"
              inputMode="numeric"
              value={c.workforceC.women1835}
              placeholder={P.women}
              onChange={(e) => setC((p) => ({ ...p, workforceC: { ...p.workforceC, women1835: e.target.value } }))}
            />
          </div>
          <div>
            <FieldLabel htmlFor="wpwdc">Workers with disability (C51)</FieldLabel>
            <TextInput
              id="wpwdc"
              inputMode="numeric"
              value={c.workforceC.disabled}
              placeholder={P.pwdCount}
              onChange={(e) => setC((p) => ({ ...p, workforceC: { ...p.workforceC, disabled: e.target.value } }))}
            />
          </div>
        </div>
      </WizardStepPanel>
      )}

      {onlyStep === 'c5' && (
      <WizardStepPanel
        id="c-s5"
        title="C5 — Digital & financial readiness"
        subtitle="Records, payments, revenue, credit intent"
      >
        {c.collectorKind === 'pure_collector' && (
          <Hint>
            Pure collectors often pre-pay farmers at the gate; advances and settlement are reconciled when the MCC
            accepts the batch. Capture how you usually pay farmers below; add detail in agent notes if needed.
          </Hint>
        )}
        {c.collectorKind === 'farmer_collector' && (
          <Hint>
            You may receive both farmer milk income and collection fees — payment methods here cover what you use with
            route farms.
          </Hint>
        )}
        <RadioRow
          name="crec"
          legend="Record-keeping for collections"
          value={c.financeC.records}
          onChange={(v) =>
            setC((p) => ({
              ...p,
              financeC: { ...p.financeC, records: v as CollectorFormState['financeC']['records'] },
            }))
          }
          options={[
            { value: 'none', label: 'No records' },
            { value: 'paper', label: 'Paper / tally' },
            { value: 'phone', label: 'Phone notes / spreadsheet' },
            { value: 'app', label: 'App or software' },
          ]}
        />
        <CheckboxRow
          legend="How collector pays farmers"
          options={[
            { key: 'pickup', label: 'Cash at pickup' },
            { key: 'week', label: 'Cash weekly / monthly' },
            { key: 'momo', label: 'MTN MoMo' },
            { key: 'airtel', label: 'Airtel Money' },
            { key: 'through_mcc', label: 'Through MCC' },
          ]}
          selected={c.financeC.paysFarmers}
          onToggle={(key, on) =>
            setC((p) => ({
              ...p,
              financeC: {
                ...p.financeC,
                paysFarmers: on
                  ? [...p.financeC.paysFarmers, key]
                  : p.financeC.paysFarmers.filter((x) => x !== key),
              },
            }))
          }
        />
        <RadioRow
          name="cph"
          legend="Phone type"
          value={c.financeC.phoneType}
          onChange={(v) =>
            setC((p) => ({
              ...p,
              financeC: { ...p.financeC, phoneType: v as CollectorFormState['financeC']['phoneType'] },
            }))
          }
          options={[
            { value: 'basic', label: 'Basic phone' },
            { value: 'smart', label: 'Smartphone' },
            { value: 'none', label: 'No mobile phone' },
          ]}
        />
        <RadioRow
          name="cmomo"
          legend="Willing to receive MCC payments via mobile money"
          value={c.financeC.momoWilling}
          onChange={(v) =>
            setC((p) => ({
              ...p,
              financeC: { ...p.financeC, momoWilling: v as CollectorFormState['financeC']['momoWilling'] },
            }))
          }
          options={[
            { value: 'happy', label: 'Yes — happy' },
            { value: 'try', label: 'Yes — willing to try' },
            { value: 'unsure', label: 'Unsure' },
            { value: 'cash', label: 'No — prefer cash' },
          ]}
        />
        <RadioRow
          name="cbor"
          legend="Borrowed for collection business before"
          value={c.financeC.borrowed}
          onChange={(v) => setC((p) => ({ ...p, financeC: { ...p.financeC, borrowed: v as 'yes' | 'no' } }))}
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]}
        />
        <div>
          <FieldLabel htmlFor="crev">Average annual revenue from collection (RWF) — C75</FieldLabel>
          <TextInput
            id="crev"
            inputMode="numeric"
            value={c.financeC.annualRevenueRwf}
            placeholder={P.revenue}
            onChange={(e) => setC((p) => ({ ...p, financeC: { ...p.financeC, annualRevenueRwf: e.target.value } }))}
          />
        </div>
        <CheckboxRow
          legend="Credit use intent (max 2)"
          maxSelections={2}
          options={[
            { key: 'vehicle', label: 'Buy motorcycle or vehicle' },
            { key: 'cooling', label: 'Buy cooling / insulated equipment' },
            { key: 'expand', label: 'Expand farms collected' },
            { key: 'wc', label: 'Pay farmers faster (working capital)' },
            { key: 'formal', label: 'Formalise / register business' },
            { key: 'other', label: 'Other' },
          ]}
          selected={c.financeC.creditIntent}
          onToggle={(key, on) =>
            setC((p) => ({
              ...p,
              financeC: {
                ...p.financeC,
                creditIntent: toggleCreditIntent(p.financeC.creditIntent, key, on, 2),
              },
            }))
          }
        />
      </WizardStepPanel>
      )}

      {onlyStep === 'c6' && (
      <WizardStepPanel
        id="c-s6"
        title="C6 — Goals"
        subtitle="Targets and delivery reliability"
      >
        <RadioRow
          name="cg12"
          legend="Main goal (12 months)"
          value={c.goalsC.goal12m}
          onChange={(v) => setC((p) => ({ ...p, goalsC: { ...p.goalsC, goal12m: v } }))}
          options={[
            { value: 'maintain', label: 'Maintain volume & farms' },
            { value: 'more_farms', label: 'Add more farms' },
            { value: 'increase', label: 'Increase volume from existing' },
            { value: 'contract', label: 'Secure formal MCC contract' },
            { value: 'credit', label: 'Access credit for equipment / transport' },
            { value: 'formal', label: 'Formalise the business' },
          ]}
        />
        <RadioRow
          name="cmiss"
          legend="Missed or late deliveries to MCC (4 weeks)"
          value={c.goalsC.missed4w}
          onChange={(v) => setC((p) => ({ ...p, goalsC: { ...p.goalsC, missed4w: v } }))}
          options={[
            { value: 'never', label: 'Never' },
            { value: '1_2', label: '1–2 times' },
            { value: '3_5', label: '3–5 times' },
            { value: 'gt5', label: 'More than 5' },
          ]}
        />
        <div>
          <FieldLabel htmlFor="cmissr" optional>
            Main reason
          </FieldLabel>
          <TextArea
            id="cmissr"
            value={c.goalsC.missedReason}
            placeholder={P.reason}
            onChange={(e) => setC((p) => ({ ...p, goalsC: { ...p.goalsC, missedReason: e.target.value } }))}
          />
        </div>
        <RadioRow
          name="cscale"
          legend="If MCC guaranteed daily pickup — increase volume in 3 months?"
          value={c.goalsC.scaleCapacity}
          onChange={(v) => setC((p) => ({ ...p, goalsC: { ...p.goalsC, scaleCapacity: v } }))}
          options={[
            { value: 'immediately', label: 'Yes — more farms reachable' },
            { value: 'transport', label: 'Yes — better transport / equipment' },
            { value: 'wc', label: 'Yes — working capital to pay farmers' },
            { value: 'max', label: 'No — at capacity' },
            { value: 'unsure', label: 'Not sure' },
          ]}
        />
      </WizardStepPanel>
      )}

      {onlyStep === 'agent' && (
      <AgentPanel title="Agent panel — Collector pathway assignment">
        {collectorRiskFlags(c).length > 0 && (
          <ul className="list-disc pl-5 text-sm text-amber-950 space-y-0.5">
            {collectorRiskFlags(c).map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
        {notReg > 0 && (
          <Hint>Unregistered farms on roster: {notReg} — priority follow-up targets.</Hint>
        )}
        <RadioRow
          name="p4"
          legend="Pathway 4 — Sector logistics node"
          value={c.agentCollector.pathwayP4}
          onChange={(v) =>
            setC((p) => ({
              ...p,
              agentCollector: {
                ...p.agentCollector,
                pathwayP4: v as '' | 'qualifies' | 'not',
              },
            }))
          }
          options={[
            { value: 'qualifies', label: 'Qualifies' },
            { value: 'not', label: 'Does not qualify' },
          ]}
        />
        <div>
          <FieldLabel htmlFor="p4r">Reason</FieldLabel>
          <TextArea
            id="p4r"
            value={c.agentCollector.reason}
            placeholder={P.reason}
            onChange={(e) =>
              setC((p) => ({ ...p, agentCollector: { ...p.agentCollector, reason: e.target.value } }))
            }
          />
        </div>
        <RadioRow
          name="unreg"
          legend="Unregistered farms — priority next visit"
          value={c.agentCollector.unregisteredFollowup}
          onChange={(v) =>
            setC((p) => ({
              ...p,
              agentCollector: {
                ...p.agentCollector,
                unregisteredFollowup: v as '' | 'yes' | 'no',
              },
            }))
          }
          options={[
            { value: 'yes', label: 'Yes — schedule visit' },
            { value: 'no', label: 'No action yet' },
          ]}
        />
        {c.collectorKind === 'pure_collector' && (
          <Hint>
            <span className="font-medium text-slate-800">Credit tier (optional)</span> — pure collectors are not
            offered Gemura credit in the collector role. You may still pick a band for routing, limits, and reporting, or
            leave blank.
          </Hint>
        )}
        <RadioRow
          name="ctier"
          legend={c.collectorKind === 'pure_collector' ? 'Volume band (optional)' : 'Initial credit tier'}
          value={c.agentCollector.creditTier}
          onChange={(v) =>
            setC((p) => ({
              ...p,
              agentCollector: {
                ...p.agentCollector,
                creditTier: v as '' | 'starter' | 'reliable',
              },
            }))
          }
          options={[
            { value: 'starter', label: 'Starter (< 50 L/day)' },
            { value: 'reliable', label: 'Reliable (100+ L/day)' },
          ]}
        />
        <div>
          <FieldLabel htmlFor="cagn">Agent notes</FieldLabel>
          <TextArea
            id="cagn"
            value={c.agentCollector.notes}
            placeholder={P.notes}
            onChange={(e) =>
              setC((p) => ({ ...p, agentCollector: { ...p.agentCollector, notes: e.target.value } }))
            }
          />
        </div>
      </AgentPanel>
      )}
    </div>
  );
}
