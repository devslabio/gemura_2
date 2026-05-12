'use client';

import type { ReactNode } from 'react';

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

function str(value: unknown): string {
  if (isBlank(value)) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return String(value);
}

function joinList(value: unknown, sep = ', '): string {
  if (!Array.isArray(value)) return '';
  const parts = value.map((v) => str(v)).filter(Boolean);
  return parts.length ? parts.join(sep) : '';
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded-sm overflow-hidden">
      <header className="border-b border-gray-100 px-5 py-3 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4 py-2.5 border-b border-gray-100 last:border-0 text-sm">
      <dt className="shrink-0 sm:w-[38%] font-medium text-gray-500">{label}</dt>
      <dd className="text-gray-900 break-words flex-1">
        {value === '' || value == null ? <span className="text-gray-400">—</span> : value}
      </dd>
    </div>
  );
}

function SubCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-sm border border-gray-200 overflow-hidden">
      <h4 className="bg-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600">{title}</h4>
      <dl className="px-4 py-1">{children}</dl>
    </div>
  );
}

const BREED_LABEL: Record<string, string> = {
  friesian: 'Friesian',
  jersey: 'Jersey',
  cross: 'Cross',
  local: 'Local',
  other: 'Other',
};

function joinBreedRecord(o: unknown): string {
  const r = asRecord(o);
  return (['friesian', 'jersey', 'cross', 'local', 'other'] as const)
    .map((k) => {
      const v = str(r[k]);
      return v ? `${BREED_LABEL[k] ?? k}: ${v}` : null;
    })
    .filter(Boolean)
    .join(' · ');
}

function insightToneClass(tone: string): string {
  switch (tone) {
    case 'positive':
      return 'border-l-[var(--primary)] bg-[var(--primary)]/5 text-gray-900';
    case 'caution':
      return 'border-l-amber-500 bg-amber-50 text-amber-950';
    default:
      return 'border-l-gray-400 bg-gray-50 text-gray-800';
  }
}

function AssessmentFromPayload({ assessment }: { assessment: Record<string, unknown> }) {
  const headline = str(assessment.headline) || 'Assessment';
  const subline = str(assessment.subline);
  const score = assessment.score;
  const metrics = Array.isArray(assessment.metrics) ? assessment.metrics : [];
  const insights = Array.isArray(assessment.insights) ? assessment.insights : [];
  const agentCompare = Array.isArray(assessment.agentCompare) ? assessment.agentCompare : [];
  const vibeFarmer = asRecord(assessment.vibeFarmer);

  return (
    <Card title="Auto-assessment" subtitle="Generated at registration from wizard answers (read-only).">
      <div className="space-y-4">
        <div>
          <p className="text-base font-semibold text-gray-900">{headline}</p>
          {subline && <p className="text-sm text-gray-600 mt-1 leading-snug">{subline}</p>}
          {typeof score === 'number' && Number.isFinite(score) && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>Readiness index</span>
                <span className="font-semibold tabular-nums text-gray-900">{score}/100</span>
              </div>
              <div className="h-2.5 rounded-sm bg-gray-200 overflow-hidden border border-gray-200">
                <div
                  className="h-full rounded-sm bg-[var(--primary)]"
                  style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {Object.keys(vibeFarmer).length > 0 && (
          <div className="rounded-sm border border-indigo-100 bg-indigo-50/50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-900/90">VIBE reporting (agent)</p>
            <dl className="mt-2 space-y-2 text-sm text-gray-800">
              <div>
                <dt className="text-[11px] font-medium text-gray-500">C77</dt>
                <dd className="mt-0.5">{str(vibeFarmer.c77) || '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-gray-500">C78</dt>
                <dd className="mt-0.5">{str(vibeFarmer.c78) || '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-gray-500">C79</dt>
                <dd className="mt-0.5">{str(vibeFarmer.c79) || '—'}</dd>
              </div>
            </dl>
          </div>
        )}

        {metrics.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm border-t border-gray-100 pt-4">
            {metrics.map((m: unknown, i: number) => {
              const row = asRecord(m);
              return (
                <div key={`${str(row.label)}-${i}`} className="min-w-0">
                  <div className="text-[11px] text-gray-500 truncate">{str(row.label)}</div>
                  <div className="font-medium text-gray-900 tabular-nums truncate">{str(row.value)}</div>
                </div>
              );
            })}
          </div>
        )}

        {insights.length > 0 && (
          <ul className="space-y-2 border-t border-gray-100 pt-4">
            {insights.map((ins: unknown, i: number) => {
              const o = asRecord(ins);
              const tone = str(o.tone) || 'info';
              return (
                <li
                  key={`${str(o.title)}-${i}`}
                  className={`text-sm pl-3 py-2 rounded-sm border-l-4 ${insightToneClass(tone)}`}
                >
                  <span className="font-medium">{str(o.title)}</span>
                  {o.detail != null && <span className="text-gray-700"> — {str(o.detail)}</span>}
                </li>
              );
            })}
          </ul>
        )}

        {agentCompare.length > 0 && (
          <div className="border-t border-gray-100 pt-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Agent vs auto-inference</p>
            {agentCompare.map((row: unknown, i: number) => {
              const o = asRecord(row);
              const aligned = o.aligned;
              return (
                <div key={`${str(o.field)}-${i}`} className="rounded-sm border border-gray-200 bg-gray-50/80 px-3 py-2.5">
                  <div className="font-medium text-gray-800">{str(o.field)}</div>
                  <div className="mt-1 text-xs text-gray-600">
                    <span className="text-gray-500">From answers: </span>
                    {str(o.fromAnswers)}
                  </div>
                  <div className="text-xs text-gray-600">
                    <span className="text-gray-500">Agent: </span>
                    {str(o.fromAgent)}
                  </div>
                  {aligned != null && (
                    <div className={`text-xs font-medium mt-1.5 ${aligned === true ? 'text-green-800' : 'text-amber-800'}`}>
                      {aligned === true ? 'Aligned' : 'Review mismatch'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

function FarmerPayloadBody({ draft, gpsText, hasNidPhoto }: { draft: Record<string, unknown>; gpsText: string; hasNidPhoto: boolean }) {
  const id = asRecord(draft.identity);
  const herd = asRecord(draft.herd);
  const lact = asRecord(draft.lactation);
  const farm = asRecord(draft.farming);
  const mgmt = asRecord(draft.management);
  const wf = asRecord(draft.workforce);
  const fin = asRecord(draft.financeFarmer);
  const goals = asRecord(draft.goalsFarmer);
  const agent = asRecord(draft.agentFarmer);

  return (
    <div className="space-y-4">
      <SubCard title="Location & capture">
        <Row label="GPS" value={gpsText} />
        <Row label="National ID photo" value={hasNidPhoto ? 'Attached' : 'Not attached'} />
      </SubCard>

      <SubCard title="1 — Identity & location">
        <Row label="Name" value={`${str(id.firstName)} ${str(id.surname)} ${str(id.otherNames)}`.trim()} />
        <Row label="Province / District" value={`${str(id.province)} / ${str(id.district)}`} />
        <Row label="Sector / Cell / Village" value={`${str(id.sector)} / ${str(id.cell)} / ${str(id.village)}`} />
        <Row
          label="Phones"
          value={`${str(id.primaryPhone)}${str(id.whatsapp) ? ` · WhatsApp: ${str(id.whatsapp)}` : ''}`}
        />
        <Row label="NID" value={str(id.nid)} />
        <Row label="Distance to MCC (km)" value={str(id.distanceMccKm)} />
        <Row label="Who brings milk" value={str(id.whoBringsMilk)} />
        {str(id.whoBringsMilk) === 'other' && <Row label="Who brings milk (detail)" value={str(id.whoBringsOther)} />}
        <Row label="Business type" value={str(id.businessType)} />
        <Row label="Disability" value={str(id.ownerDisability)} />
        <Row label="Coop members" value={str(id.coopMembers)} />
        <Row label="Coop women" value={str(id.coopWomen)} />
        <Row label="Coop youth 18–35" value={str(id.coopYouth1835)} />
        <Row label="Coop young women" value={str(id.coopYoungWomen)} />
      </SubCard>

      <SubCard title="2 — Herd & production">
        <Row label="Total cows" value={str(herd.totalCows)} />
        <Row label="Breed counts" value={joinBreedRecord(herd.breedCounts)} />
        <Row label="Lactating by breed" value={joinBreedRecord(herd.lactatingByBreed)} />
        <Row label="Avg L/cow/day by breed" value={joinBreedRecord(herd.avgDailyPerCowByBreed)} />
        <Row label="Peak / low season (L/day)" value={`${str(herd.peakTotal)} / ${str(herd.lowTotal)}`} />
        <Row label="% sold to this MCC" value={str(herd.soldPct)} />
        <Row label="Sales channels" value={joinList(herd.salesChannels)} />
        <Row label="Other MCC name" value={str(herd.otherMccName)} />
      </SubCard>

      <SubCard title="3 — Lactation & breeding">
        <Row label="Lactation per breed (vs 305d)" value={joinBreedRecord(lact.lactationPerBreed)} />
        <Row label="Calving interval by breed" value={joinBreedRecord(lact.calvingIntervalByBreed)} />
        <Row label="Breeding methods" value={joinList(lact.breedingMethod)} />
        <Row label="Cows insured" value={str(lact.cowsInsured)} />
        <Row label="Insured count" value={str(lact.cowsInsuredCount)} />
        <Row label="Insurance provider" value={str(lact.insuranceProvider)} />
      </SubCard>

      <SubCard title="4 — Farming & infrastructure">
        <Row label="Grazing" value={str(farm.grazing)} />
        <Row label="Feed types" value={joinList(farm.feedTypes)} />
        <Row label="Clean water" value={str(farm.cleanWater)} />
        <Row label="Water source" value={joinList(farm.waterSource)} />
        <Row label="Land dairy / other (ha)" value={`${str(farm.dairyHa)} / ${str(farm.otherHa)}`} />
        <Row label="Infrastructure" value={joinList(farm.infrastructure)} />
      </SubCard>

      <SubCard title="5 — Management">
        <Row label="Dedicated manager" value={str(mgmt.dedicatedManager)} />
        <Row label="Manager name" value={str(mgmt.managerName)} />
        <Row label="Vet access" value={str(mgmt.vetAccess)} />
        <Row label="Biosecurity" value={joinList(mgmt.biosecurity)} />
        <Row label="Training (3y)" value={str(mgmt.training3y)} />
        <Row label="Subsidy / grant" value={`${str(mgmt.subsidy)} · ${str(mgmt.grantSource)} — ${str(mgmt.grantWhat)}`} />
      </SubCard>

      <SubCard title="6 — Workforce">
        <Row
          label="Total / women / 18–35 / women 18–35 / PWD"
          value={`${str(wf.total)} / ${str(wf.women)} / ${str(wf.aged1835)} / ${str(wf.women1835)} / ${str(wf.disabled)}`}
        />
        <Row label="Manager sex / age" value={`${str(wf.managerSex)} / ${str(wf.managerAge)}`} />
      </SubCard>

      <SubCard title="7 — Finance">
        <Row label="Records" value={str(fin.records)} />
        <Row label="Payment methods" value={joinList(fin.paymentMethods)} />
        <Row label="Phone type" value={str(fin.phoneType)} />
        <Row label="MoMo willingness" value={str(fin.momoWilling)} />
        <Row label="Borrowed" value={str(fin.borrowed)} />
        <Row label="Borrow sources" value={joinList(fin.borrowSources)} />
        <Row label="Annual revenue (RWF)" value={str(fin.annualRevenueRwf)} />
        <Row label="Credit intent" value={joinList(fin.creditIntent)} />
      </SubCard>

      <SubCard title="8 — Goals">
        <Row label="12-month goal" value={str(goals.goal12m)} />
        <Row label="Supply days / missed (4w)" value={`${str(goals.supplyDays)} / ${str(goals.missed4w)}`} />
        <Row label="Missed reason" value={str(goals.missedReason)} />
        <Row label="Scale capacity" value={str(goals.scaleCapacity)} />
      </SubCard>

      <SubCard title="Agent — pathway">
        <Row label="Pathway 1" value={str(agent.pathwayP1)} />
        <Row label="Pathway 1 reason" value={str(agent.pathwayP1Reason)} />
        <Row label="Breed improvement" value={str(agent.breedImprovement)} />
        <Row label="Credit tier" value={str(agent.creditTier)} />
        <Row label="Agent notes" value={str(agent.notes)} />
      </SubCard>
    </div>
  );
}

const COLLECTOR_KIND_LABEL: Record<string, { label: string; description: string }> = {
  farmer_collector: {
    label: 'Farmer–collector',
    description: 'Own milk and collected milk are handled separately.',
  },
  pure_collector: {
    label: 'Pure collector',
    description: 'Collects only for others.',
  },
};

function CollectorPayloadBody({ draft, gpsText, hasNidPhoto }: { draft: Record<string, unknown>; gpsText: string; hasNidPhoto: boolean }) {
  const c1 = asRecord(draft.c1);
  const c2 = asRecord(draft.c2);
  const wf = asRecord(draft.workforceC);
  const fin = asRecord(draft.financeC);
  const goals = asRecord(draft.goalsC);
  const agent = asRecord(draft.agentCollector);
  const kind = str(draft.collectorKind);
  const kindMeta = kind ? COLLECTOR_KIND_LABEL[kind] : null;

  const rosterRaw = draft.roster;
  const roster = Array.isArray(rosterRaw) ? rosterRaw : [];
  let reg = 0;
  let notReg = 0;
  roster.forEach((item) => {
    const r = asRecord(item);
    if (r.registration === 'registered') reg += 1;
    else if (r.registration === 'not_registered') notReg += 1;
  });

  return (
    <div className="space-y-4">
      <SubCard title="Location & capture">
        <Row label="GPS" value={gpsText} />
        <Row label="National ID photo" value={hasNidPhoto ? 'Attached' : 'Not attached'} />
      </SubCard>

      <SubCard title="Collector profile">
        <Row label="Type" value={kindMeta?.label ?? (kind || '—')} />
        {kindMeta?.description && <p className="text-xs text-gray-600 px-4 pb-2 -mt-2">{kindMeta.description}</p>}
      </SubCard>

      <SubCard title="C1 — Identity">
        <Row label="Name" value={`${str(c1.firstName)} ${str(c1.surname)} ${str(c1.otherNames)}`.trim()} />
        <Row label="Phones" value={`${str(c1.primaryPhone)}${str(c1.whatsapp) ? ` · ${str(c1.whatsapp)}` : ''}`} />
        <Row label="NID" value={str(c1.nid)} />
        <Row label="Location" value={`${str(c1.province)}, ${str(c1.district)}, ${str(c1.sector)}`} />
        <Row label="Cell / Village" value={`${str(c1.cell)} / ${str(c1.village)}`} />
        <Row label="Linked MCC (form)" value={str(c1.linkedMcc) === 'other' ? str(c1.linkedMccOther) : str(c1.linkedMcc)} />
        <Row label="Business type" value={str(c1.businessType)} />
        <Row label="Disability" value={str(c1.ownerDisability)} />
      </SubCard>

      <SubCard title="C2 — Operations">
        <Row label="Sector / cells / radius" value={`${str(c2.sector)} / ${str(c2.cells)} / ${str(c2.radiusKm)} km`} />
        <Row label="Days per week" value={str(c2.daysWeek)} />
        <Row label="Peak / low (L/day)" value={`${str(c2.peakL)} / ${str(c2.lowL)}`} />
        <Row label="Transport" value={`${joinList(c2.transport)}${str(c2.transportOther) ? ` · ${str(c2.transportOther)}` : ''}`} />
        <Row label="Cooling" value={`${str(c2.cooling)} ${str(c2.coolingDetail) ? `(${str(c2.coolingDetail)})` : ''}`} />
        <Row label="Transit (min)" value={str(c2.transitMin)} />
        <Row label="Farms count" value={str(c2.farmCount)} />
        <Row label="Other destinations" value={joinList(c2.otherDestinations)} />
        <Row label="Other MCC name" value={str(c2.otherMccName)} />
      </SubCard>

      <SubCard title="C3 — Farmer roster">
        <Row label="Total farms" value={String(roster.length)} />
        <Row label="Registered / not registered" value={`${reg} / ${notReg}`} />
        {roster.length > 0 && (
          <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1 mt-2 pb-2">
            {roster.map((item, idx) => {
              const r = asRecord(item);
              const nm = str(r.nameOrId) || '(unnamed)';
              const regLbl = str(r.registration) || '—';
              return (
                <li key={`${str(r.id)}-${idx}`}>
                  {nm} — {regLbl}
                </li>
              );
            })}
          </ul>
        )}
      </SubCard>

      <SubCard title="C4–C6 — Workforce & finance & goals">
        <Row label="Workforce" value={`${str(wf.total)} total · women ${str(wf.women)} · 18–35 ${str(wf.aged1835)} · women 18–35 ${str(wf.women1835)} · PWD ${str(wf.disabled)}`} />
        <Row label="Pays farmers" value={joinList(fin.paysFarmers)} />
        <Row label="Records" value={str(fin.records)} />
        <Row label="Phone / MoMo" value={`${str(fin.phoneType)} / ${str(fin.momoWilling)}`} />
        <Row label="Borrowed" value={str(fin.borrowed)} />
        <Row label="Annual revenue (RWF)" value={str(fin.annualRevenueRwf)} />
        <Row label="Credit intent" value={joinList(fin.creditIntent)} />
        <Row label="Goal 12m" value={str(goals.goal12m)} />
        <Row label="Missed (4w) / reason" value={`${str(goals.missed4w)} / ${str(goals.missedReason)}`} />
        <Row label="Scale capacity" value={str(goals.scaleCapacity)} />
      </SubCard>

      <SubCard title="Agent">
        <Row label="Pathway 4" value={str(agent.pathwayP4)} />
        <Row label="Reason" value={str(agent.reason)} />
        <Row label="Unregistered follow-up" value={str(agent.unregisteredFollowup)} />
        <Row label="Credit tier" value={str(agent.creditTier)} />
        <Row label="Notes" value={str(agent.notes)} />
      </SubCard>
    </div>
  );
}

function gpsTextFromPayload(payload: Record<string, unknown>): string {
  const g = payload.gps;
  if (!g || typeof g !== 'object' || Array.isArray(g)) return '—';
  const o = g as Record<string, unknown>;
  const lat = o.lat;
  const lng = o.lng;
  if (typeof lat === 'number' && typeof lng === 'number') return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  return '—';
}

export function SupplierOnboardingPayloadDisplay({ payload }: { payload: unknown }) {
  const p = asRecord(payload);
  const supplierType = str(p.supplier_type);
  const draft = asRecord(p.draft);
  const idShape = asRecord(draft.identity);
  const looksFarmer = idShape.surname != null || idShape.firstName != null || draft.herd != null;
  const c1Shape = asRecord(draft.c1);
  const looksCollector =
    draft.collectorKind != null ||
    c1Shape.primaryPhone != null ||
    c1Shape.nid != null ||
    draft.c2 != null ||
    (Array.isArray(draft.roster) && draft.roster.length > 0);

  const isCollectorFlow = supplierType === 'collector' || (supplierType !== 'farmer' && looksCollector);
  const isFarmer = !isCollectorFlow;

  const assessment = asRecord(p.assessment);
  const vibeReporting = asRecord(p.vibe_reporting);
  const hasNid = !isBlank(p.nid_photo_meta);
  const gpsText = gpsTextFromPayload(p);

  return (
    <div className="space-y-4">
      <Card
        title="Wizard overview"
        subtitle={isFarmer ? 'Direct farmer profile' : 'Milk collector profile'}
      >
        <dl>
          <Row label="Recorded type" value={supplierType || (isFarmer ? 'farmer' : 'collector')} />
          {!isFarmer && p.collector_kind && <Row label="Collector kind" value={str(p.collector_kind)} />}
          {!isFarmer && draft.collectorKind && <Row label="Collector kind (draft)" value={str(draft.collectorKind)} />}
          <Row label="National ID photo file ref." value={hasNid ? <span className="font-mono text-xs">{str(p.nid_photo_meta)}</span> : 'Not attached'} />
        </dl>
      </Card>

      {Object.keys(vibeReporting).length > 0 && (
        <Card title="VIBE reporting codes" subtitle="Derived from answers at registration (before sync).">
          <dl>
            {Object.entries(vibeReporting).map(([k, v]) => (
              <Row key={k} label={k.replace(/_/g, ' ')} value={str(v)} />
            ))}
          </dl>
        </Card>
      )}

      {Object.keys(assessment).length > 0 && <AssessmentFromPayload assessment={assessment} />}

      {isFarmer ? (
        <FarmerPayloadBody draft={draft} gpsText={gpsText} hasNidPhoto={hasNid} />
      ) : (
        <CollectorPayloadBody draft={draft} gpsText={gpsText} hasNidPhoto={hasNid} />
      )}
    </div>
  );
}
