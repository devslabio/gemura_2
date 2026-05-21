'use client';

import { ReviewRow, ReviewSection } from './formPrimitives';
import type { SupplierKycDraft } from './kycModel';
import { kycFullName } from './kycModel';
import { roleBadgesFromDraft } from './kycOnboardingProgress';
import type { ParticipantKycOnboardingRecord } from './parseKycOnboardingRecord';
import OnboardingDocumentViewer from './OnboardingDocumentViewer';
import { resolveNidPhotoView } from './onboardingDocumentUtils';

function labelize(value: string): string {
  if (!value) return '—';
  return value
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

function joinList(items: string[]): string {
  return items.length ? items.map(labelize).join(', ') : '—';
}

type Props = {
  draft: SupplierKycDraft;
  record?: ParticipantKycOnboardingRecord | null;
  gpsText?: string;
  /** From supplier API when credentials are not in stored JSON */
  commercialHint?: {
    pricePerLiter?: number;
    phone?: string;
    email?: string;
  };
};

export default function KycOnboardingPreview({ draft, record, gpsText, commercialHint }: Props) {
  const badges = roleBadgesFromDraft(draft);
  const pr = record?.participant_relationship;
  const nidView = resolveNidPhotoView(record?.nid_photo_meta, draft.documents);

  return (
    <div className="space-y-4">
      <div className="rounded-sm border border-[#004AAD]/25 bg-[#004AAD]/5 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#031A3A]">
          Participant KYC onboarding
        </p>
        <p className="text-sm text-gray-700 mt-1">
          Stored under the new relationship model ({record?.schema_version ?? 'participant_kyc_v1'}).
          {record?.supplier_type ? (
            <>
              {' '}
              Account routing: <strong>{labelize(record.supplier_type)}</strong>
              {record.collector_kind ? ` (${labelize(record.collector_kind)})` : null}.
            </>
          ) : null}
        </p>
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {badges.map((b) => (
              <span
                key={b}
                className="text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full bg-white border border-[#004AAD]/20 text-[#031A3A]"
              >
                {b}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ReviewSection title="1. Identity">
          <ReviewRow label="Name" value={kycFullName(draft)} />
          <ReviewRow label="Other names" value={draft.identity.otherNames || '—'} />
          <ReviewRow label="Gender" value={labelize(draft.identity.gender)} />
          <ReviewRow label="Date of birth" value={draft.identity.dateOfBirth || '—'} />
          <ReviewRow label="Phone" value={draft.identity.primaryPhone || commercialHint?.phone || '—'} />
          <ReviewRow label="WhatsApp" value={draft.identity.whatsapp || '—'} />
          <ReviewRow label="NID" value={draft.identity.nid || '—'} />
          <ReviewRow
            label="Location"
            value={[draft.identity.village, draft.identity.cell, draft.identity.sector, draft.identity.district, draft.identity.province]
              .filter(Boolean)
              .join(', ') || '—'}
          />
          <ReviewRow label="GPS" value={gpsText ?? '—'} />
          <ReviewRow
            label="NID / photo"
            value={
              <OnboardingDocumentViewer
                label={nidView.label || 'National ID'}
                fileName={nidView.label}
                dataUrl={nidView.dataUrl ?? undefined}
                mimeType={nidView.mimeType ?? undefined}
              />
            }
          />
        </ReviewSection>

        <ReviewSection title="2. Supplier type & role">
          <ReviewRow label="Ownership" value={labelize(draft.classification.ownershipStatus)} />
          <ReviewRow label="Supplier type" value={labelize(draft.classification.supplierType)} />
          <ReviewRow label="Delivery mode" value={labelize(draft.classification.deliveryMode)} />
          <ReviewRow label="Relationship to MCC" value={labelize(draft.classification.relationshipToMcc)} />
          <ReviewRow label="Active" value={draft.classification.activeStatus ? 'Yes' : 'No'} />
          <ReviewRow label="Service eligibility" value={joinList(draft.classification.serviceEligibility)} />
          <ReviewRow label="Credit" value={labelize(draft.classification.creditEligible)} />
          <ReviewRow label="Payment recipient" value={labelize(draft.classification.paymentRecipient)} />
          {pr ? (
            <>
              <ReviewRow label="Credit eligible (rules)" value={pr.credit_eligible != null ? String(pr.credit_eligible) : '—'} />
              <ReviewRow label="Milk payment scenario" value={labelize(String(pr.milk_payment_scenario ?? ''))} />
            </>
          ) : null}
        </ReviewSection>
      </div>

      <ReviewSection title="3. Farm & supply profile">
        <div className="grid sm:grid-cols-2 gap-x-6">
          <ReviewRow label="Farm name" value={draft.farm.farmName || '—'} />
          <ReviewRow label="Farm code" value={draft.farm.farmCode || '—'} />
          <ReviewRow label="Avg daily (L)" value={draft.farm.avgDailyLiters || '—'} />
          <ReviewRow label="Peak (L)" value={draft.farm.peakLiters || '—'} />
          <ReviewRow label="Lactating cows" value={draft.farm.lactatingCows || '—'} />
          <ReviewRow label="Total herd" value={draft.farm.totalHerd || '—'} />
          <ReviewRow label="Breed" value={draft.farm.breedType || '—'} />
          <ReviewRow label="Main route" value={draft.farm.mainRoute || '—'} />
          <ReviewRow label="Distance (km)" value={draft.farm.distanceKm || '—'} />
          <ReviewRow label="Collection frequency" value={draft.farm.collectionFrequency || '—'} />
          <ReviewRow label="Quality score" value={draft.farm.qualityScore || '—'} />
          <ReviewRow label="Avg grade" value={draft.farm.avgGrade || '—'} />
          <ReviewRow label="Services needed" value={joinList(draft.farm.servicesNeeded)} />
        </div>
      </ReviewSection>

      <ReviewSection title="4. Payment setup">
        <ReviewRow label="Payment methods" value={joinList(draft.payment.paymentMethods)} />
        <ReviewRow label="MoMo" value={draft.payment.momoNumber ? `${draft.payment.momoProvider || 'MoMo'} — ${draft.payment.momoNumber}` : '—'} />
        <ReviewRow label="Bank" value={draft.payment.bankAccount ? `${draft.payment.bankName} — ${draft.payment.bankAccount}` : '—'} />
        <ReviewRow label="Payment frequency" value={labelize(draft.payment.paymentFrequency)} />
        <ReviewRow label="Milk payment scenario" value={labelize(draft.payment.milkPaymentScenario)} />
        <ReviewRow label="Collection fee %" value={draft.payment.collectionFeePct || '—'} />
        <ReviewRow label="Service deductions" value={joinList(draft.payment.serviceDeductions)} />
        <ReviewRow label="Wallet activation" value={draft.payment.walletActivation ? 'Yes' : 'No'} />
        {commercialHint?.pricePerLiter != null ? (
          <ReviewRow
            label="MCC price / L (live)"
            value={`RWF ${commercialHint.pricePerLiter.toLocaleString('en-RW')}`}
          />
        ) : null}
      </ReviewSection>

      <ReviewSection title="5. Documents">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-3">Document</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">File</th>
                <th className="py-2">View</th>
              </tr>
            </thead>
            <tbody>
              {draft.documents.map((doc) => (
                <tr key={doc.id} className="border-b border-gray-100">
                  <td className="py-2 pr-3">{doc.label}</td>
                  <td className="py-2 pr-3 capitalize">{doc.status.replace('_', ' ')}</td>
                  <td className="py-2 pr-3 text-gray-600">{doc.fileName || '—'}</td>
                  <td className="py-2">
                    {doc.status !== 'missing' ? (
                      <OnboardingDocumentViewer
                        label={doc.label}
                        fileName={doc.fileName}
                        dataUrl={doc.dataUrl}
                        mimeType={doc.mimeType}
                        compact
                      />
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReviewSection>

      <ReviewSection title="6. Review & declarations">
        <ReviewRow label="Information accurate" value={draft.review.declarationAccurate ? 'Yes' : 'No'} />
        <ReviewRow label="Data consent" value={draft.review.declarationConsent ? 'Yes' : 'No'} />
        <ReviewRow label="Terms accepted" value={draft.review.declarationTerms ? 'Yes' : 'No'} />
        {draft.review.reviewerNotes ? (
          <ReviewRow label="Reviewer notes" value={draft.review.reviewerNotes} />
        ) : null}
        <p className="text-xs text-gray-500 mt-2">
          Login password is not stored in onboarding JSON. Phone and commercial terms are on the supplier account.
        </p>
      </ReviewSection>
    </div>
  );
}
