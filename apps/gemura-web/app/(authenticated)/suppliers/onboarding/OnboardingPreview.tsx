'use client';

import { useMemo } from 'react';
import type { FarmerFormState, CollectorFormState } from './model';
import { BREEDS, BreedKey } from './model';
import { farmerRiskFlags } from './FarmerOnboardingPath';
import { collectorRiskFlags, rosterSummary } from './CollectorOnboardingPath';
import { mergeCollectorDraft, mergeFarmerDraft } from './mergeOnboardingDraft';
import { ReviewRow, ReviewSection, RiskBanner } from './formPrimitives';
import {
  computeCollectorAutoSummary,
  computeFarmerAutoSummary,
  type OnboardingAutoSummary,
  type AutoInsightTone,
} from './onboardingAutoResults';
import { MILK_COLLECTOR_KIND } from './model';

const BL: Record<BreedKey, string> = {
  friesian: 'Friesian',
  jersey: 'Jersey',
  cross: 'Cross',
  local: 'Local',
  other: 'Other',
};

function joinObj(o: Record<string, string>): string {
  return BREEDS.map((b) => (o[b] ? `${BL[b]}: ${o[b]}` : null))
    .filter(Boolean)
    .join(' · ');
}

function insightToneClass(tone: AutoInsightTone): string {
  switch (tone) {
    case 'positive':
      return 'border-l-[#004AAD] bg-[#004AAD]/10 text-[#031A3A]';
    case 'caution':
      return 'border-l-amber-500 bg-amber-50/70 text-amber-950';
    default:
      return 'border-l-slate-400 bg-slate-50/80 text-slate-800';
  }
}

function AutoSummaryPanel({
  summary,
  accent,
}: {
  summary: OnboardingAutoSummary;
  accent: 'primary' | 'secondary';
}) {
  const borderAccent =
    accent === 'primary' ? 'border-[#004AAD]/20' : 'border-[#052A54]/25';
  const bar =
    accent === 'primary'
      ? 'bg-gradient-to-r from-[#031A3A] to-[#004AAD]'
      : 'bg-gradient-to-r from-[#052A54] to-[#004AAD]';

  return (
    <div className={`rounded-sm border bg-white overflow-hidden ${borderAccent}`}>
      <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/90 to-white">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Auto-generated from answers</p>
        <h3 className="text-base sm:text-lg font-semibold text-slate-900 mt-0.5">{summary.headline}</h3>
        <p className="text-sm text-slate-600 mt-1 leading-snug">{summary.subline}</p>
        {summary.score != null && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
              <span>Readiness index</span>
              <span className="font-semibold tabular-nums text-slate-900">{summary.score}/100</span>
            </div>
            <div className="h-2.5 rounded-sm bg-slate-200/90 overflow-hidden border border-slate-300/60 box-border">
              <div className={`h-full rounded-sm ${bar} transition-all`} style={{ width: `${summary.score}%` }} />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Heuristic blend of production data, digital signals, and (for collectors) cold-chain fit — not a credit decision.
            </p>
          </div>
        )}
      </div>

      {summary.vibeFarmer && (
        <div className="px-4 py-3 sm:px-5 border-b border-indigo-100/90 bg-indigo-50/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-900/85">
            VIBE reporting — agent panel (guide v3)
          </p>
          <p className="text-[11px] text-indigo-900/70 mt-0.5 mb-2 leading-snug">
            C77 (Intervention 2), C78 (Intervention 3), C79 (Ownership) follow the MCC and farmer onboarding flow. Values below are
            what will be sent on sync when the agent selection applies.
          </p>
          <dl className="space-y-2 text-sm text-slate-800">
            <div>
              <dt className="text-[11px] font-medium text-slate-500">C77 — if Pathway 1 = Qualifies</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {summary.vibeFarmer.c77 ?? '— (not set: Pathway 1 is not Qualifies)'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-slate-500">C78 — if breed improvement = Yes</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {summary.vibeFarmer.c78 ?? '— (not set: not flagged for breed credit)'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-slate-500">C79 — from initial credit tier (agent)</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {summary.vibeFarmer.c79 ?? '— (not set: pick Starter or Reliable)'}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {summary.metrics.length > 0 && (
        <div className="px-4 py-3 sm:px-5 grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm border-b border-slate-100">
          {summary.metrics.map((m) => (
            <div key={m.label} className="min-w-0">
              <div className="text-[11px] text-slate-500 truncate">{m.label}</div>
              <div className="font-medium text-slate-900 tabular-nums truncate">{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {summary.insights.length > 0 && (
        <ul className="px-4 py-3 sm:px-5 space-y-2">
          {summary.insights.map((ins, i) => (
            <li
              key={`${ins.title}-${i}`}
              className={`text-sm pl-3 py-2 rounded-sm border-l-4 ${insightToneClass(ins.tone)}`}
            >
              <span className="font-medium">{ins.title}</span>
              <span className="text-slate-700"> — {ins.detail}</span>
            </li>
          ))}
        </ul>
      )}

      {summary.agentCompare.length > 0 && (
        <div className="px-4 py-3 sm:px-5 border-t border-slate-100 bg-slate-50/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Agent vs auto-inference</p>
          <div className="space-y-2 text-sm">
            {summary.agentCompare.map((row) => (
              <div
                key={row.field}
                className="rounded-sm border border-slate-200/80 bg-white px-3 py-2.5"
              >
                <div className="font-medium text-slate-800">{row.field}</div>
                <div className="mt-1 text-xs text-slate-600">
                  <span className="text-slate-500">From answers: </span>
                  {row.fromAnswers}
                </div>
                <div className="text-xs text-slate-600">
                  <span className="text-slate-500">Agent: </span>
                  {row.fromAgent}
                </div>
                {row.aligned != null && (
                  <div
                    className={`text-xs font-medium mt-1.5 ${
                      row.aligned ? 'text-[#052A54]' : 'text-amber-800'
                    }`}
                  >
                    {row.aligned ? 'Aligned' : 'Review mismatch'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function previewScrollClass(fullPage?: boolean): string {
  return fullPage ? 'space-y-4' : 'space-y-4 max-h-[min(70vh,560px)] overflow-y-auto pr-1';
}

export function FarmerOnboardingPreview({
  f,
  gpsText,
  hasNidPhoto,
  fullPage = false,
}: {
  f: FarmerFormState;
  gpsText: string;
  hasNidPhoto: boolean;
  /** When true, show full content (dedicated page). When false, scroll inside modal height. */
  fullPage?: boolean;
}) {
  const fSafe = useMemo(() => mergeFarmerDraft(f as unknown), [f]);
  const risks = farmerRiskFlags(fSafe);
  const auto = computeFarmerAutoSummary(fSafe, { districtForRefugee: fSafe.identity.district });

  return (
    <div className={previewScrollClass(fullPage)}>
      <div className="rounded-sm border border-[#004AAD]/25 bg-[#004AAD]/10 px-4 py-3 text-sm text-[#031A3A]">
        <p className="font-semibold">Direct farmer — review</p>
        <p className="text-[#052A54]/90 mt-1">Check all answers before saving. You can go Back to edit any step.</p>
      </div>

      <AutoSummaryPanel summary={auto} accent="primary" />

      <ReviewSection title="Location & capture">
        <ReviewRow label="GPS" value={gpsText} />
        <ReviewRow label="National ID photo" value={hasNidPhoto ? 'Attached' : 'Not attached'} />
      </ReviewSection>

      <ReviewSection title="1 — Identity & location">
        <ReviewRow label="Name" value={`${fSafe.identity.firstName} ${fSafe.identity.surname} ${fSafe.identity.otherNames}`.trim()} />
        <ReviewRow label="Province / District" value={`${fSafe.identity.province} / ${fSafe.identity.district}`} />
        <ReviewRow label="Sector / Cell / Village" value={`${fSafe.identity.sector} / ${fSafe.identity.cell} / ${fSafe.identity.village}`} />
        <ReviewRow label="Phones" value={`${fSafe.identity.primaryPhone}${fSafe.identity.whatsapp ? ` · WA: ${fSafe.identity.whatsapp}` : ''}`} />
        <ReviewRow label="NID" value={fSafe.identity.nid} />
        <ReviewRow label="Distance to MCC (km)" value={fSafe.identity.distanceMccKm} />
        <ReviewRow label="Who brings milk" value={fSafe.identity.whoBringsMilk} />
        <ReviewRow label="Business type" value={fSafe.identity.businessType} />
        <ReviewRow label="Disability" value={fSafe.identity.ownerDisability} />
      </ReviewSection>

      <ReviewSection title="2 — Herd & production">
        <ReviewRow label="Total cows" value={fSafe.herd.totalCows} />
        <ReviewRow label="Breed counts" value={joinObj(fSafe.herd.breedCounts)} />
        <ReviewRow label="Peak / low season (L/day)" value={`${fSafe.herd.peakTotal} / ${fSafe.herd.lowTotal}`} />
        <ReviewRow label="% sold" value={fSafe.herd.soldPct} />
        <ReviewRow label="Sales channels" value={fSafe.herd.salesChannels.join(', ')} />
      </ReviewSection>

      <ReviewSection title="3 — Lactation & breeding">
        <ReviewRow label="Breeding methods" value={fSafe.lactation.breedingMethod.join(', ')} />
        <ReviewRow label="Insurance" value={fSafe.lactation.cowsInsured} />
      </ReviewSection>

      <ReviewSection title="4 — Farming & infrastructure">
        <ReviewRow label="Grazing" value={fSafe.farming.grazing} />
        <ReviewRow label="Land (dairy / other ha)" value={`${fSafe.farming.dairyHa} / ${fSafe.farming.otherHa}`} />
      </ReviewSection>

      <ReviewSection title="5 — Management">
        <ReviewRow label="Dedicated manager" value={fSafe.management.dedicatedManager} />
        <ReviewRow label="Vet access" value={fSafe.management.vetAccess} />
      </ReviewSection>

      <ReviewSection title="6 — Workforce">
        <ReviewRow label="Total / women / 18–35 / women 18–35 / PWD" value={`${fSafe.workforce.total} / ${fSafe.workforce.women} / ${fSafe.workforce.aged1835} / ${fSafe.workforce.women1835} / ${fSafe.workforce.disabled}`} />
      </ReviewSection>

      <ReviewSection title="7 — Finance">
        <ReviewRow label="Records" value={fSafe.financeFarmer.records} />
        <ReviewRow label="Annual revenue (RWF)" value={fSafe.financeFarmer.annualRevenueRwf} />
        <ReviewRow label="Credit intent (max 2)" value={fSafe.financeFarmer.creditIntent.join(', ')} />
      </ReviewSection>

      <ReviewSection title="8 — Goals">
        <ReviewRow label="12-month goal" value={fSafe.goalsFarmer.goal12m} />
        <ReviewRow label="Supply days / missed" value={`${fSafe.goalsFarmer.supplyDays} / ${fSafe.goalsFarmer.missed4w}`} />
      </ReviewSection>

      <ReviewSection title="Agent — pathway">
        <ReviewRow label="Pathway 1" value={fSafe.agentFarmer.pathwayP1} />
        <ReviewRow label="Pathway 1 reason" value={fSafe.agentFarmer.pathwayP1Reason || '—'} />
        <ReviewRow label="Breed improvement" value={fSafe.agentFarmer.breedImprovement} />
        <ReviewRow label="Credit tier" value={fSafe.agentFarmer.creditTier} />
        <ReviewRow label="Agent notes" value={fSafe.agentFarmer.notes} />
      </ReviewSection>

      {risks.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-800">Risk & quality flags</p>
          {risks.map((r) => (
            <RiskBanner key={r}>{r}</RiskBanner>
          ))}
        </div>
      )}
    </div>
  );
}

export function CollectorOnboardingPreview({
  c,
  gpsText,
  hasNidPhoto,
  fullPage = false,
}: {
  c: CollectorFormState;
  gpsText: string;
  hasNidPhoto: boolean;
  fullPage?: boolean;
}) {
  const cSafe = useMemo(() => mergeCollectorDraft(c as unknown), [c]);
  const risks = collectorRiskFlags(cSafe);
  const { total, reg, notReg } = rosterSummary(cSafe);
  const auto = computeCollectorAutoSummary(cSafe, { districtForRefugee: cSafe.c1.district });

  return (
    <div className={previewScrollClass(fullPage)}>
      <div className="rounded-sm border border-[#052A54]/25 bg-[#052A54]/10 px-4 py-3 text-sm text-[#031A3A]">
        <p className="font-semibold">Milk collector — review</p>
        <p className="text-[#052A54]/90 mt-1">Verify roster and logistics before saving.</p>
      </div>

      <AutoSummaryPanel summary={auto} accent="secondary" />

      <ReviewSection title="Location & capture">
        <ReviewRow label="GPS" value={gpsText} />
        <ReviewRow label="National ID photo" value={hasNidPhoto ? 'Attached' : 'Not attached'} />
      </ReviewSection>

      <ReviewSection title="Collector profile">
        <ReviewRow
          label="Type"
          value={cSafe.collectorKind ? MILK_COLLECTOR_KIND[cSafe.collectorKind].label : '—'}
        />
        <p className="text-xs text-slate-600 -mt-2 mb-0">
          {cSafe.collectorKind ? MILK_COLLECTOR_KIND[cSafe.collectorKind].description : null}
        </p>
      </ReviewSection>

      <ReviewSection title="C1 — Identity">
        <ReviewRow
          label="Name"
          value={`${cSafe.c1.firstName} ${cSafe.c1.surname} ${cSafe.c1.otherNames}`.trim()}
        />
        <ReviewRow label="Phones" value={`${cSafe.c1.primaryPhone}${cSafe.c1.whatsapp ? ` · ${cSafe.c1.whatsapp}` : ''}`} />
        <ReviewRow label="Location" value={`${cSafe.c1.province}, ${cSafe.c1.district}, ${cSafe.c1.sector}`} />
        <ReviewRow label="Linked MCC" value={cSafe.c1.linkedMcc === 'other' ? cSafe.c1.linkedMccOther : cSafe.c1.linkedMcc} />
      </ReviewSection>

      <ReviewSection title="C2 — Operations">
        <ReviewRow label="Peak / low (L/day)" value={`${cSafe.c2.peakL} / ${cSafe.c2.lowL}`} />
        <ReviewRow label="Transit (min)" value={cSafe.c2.transitMin} />
        <ReviewRow label="Farms count" value={cSafe.c2.farmCount} />
      </ReviewSection>

      <ReviewSection title="C3 — Farmer roster">
        <ReviewRow label="Total farms" value={String(total)} />
        <ReviewRow label="Registered / not registered" value={`${reg} / ${notReg}`} />
        <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1 mt-2">
          {cSafe.roster.map((r) => (
            <li key={r.id}>
              {r.nameOrId || '(unnamed)'} — {r.registration || '—'}
            </li>
          ))}
        </ul>
      </ReviewSection>

      <ReviewSection title="C4–C6 — Workforce & goals">
        <ReviewRow label="Workforce counts" value={`${cSafe.workforceC.total} total`} />
        <ReviewRow label="Goal 12m" value={cSafe.goalsC.goal12m} />
      </ReviewSection>

      <ReviewSection title="Agent">
        <ReviewRow label="Pathway 4" value={cSafe.agentCollector.pathwayP4} />
        <ReviewRow label="Credit tier" value={cSafe.agentCollector.creditTier} />
        <ReviewRow label="Notes" value={cSafe.agentCollector.notes} />
      </ReviewSection>

      {risks.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-800">Risk flags</p>
          {risks.map((r) => (
            <RiskBanner key={r}>{r}</RiskBanner>
          ))}
        </div>
      )}
    </div>
  );
}
