'use client';

import {
  CheckboxRow,
  FieldLabel,
  RadioRow,
  ReviewRow,
  ReviewSection,
  TextInput,
  WizardStepPanel,
} from './formPrimitives';
import { RwandaLocationFields } from './RwandaLocationFields';
import type { KycStepKey, SupplierKycDraft } from './kycModel';
import { KYC_STEP_LABELS, kycFullName } from './kycModel';
import { roleBadgesFromDraft } from './kycOnboardingProgress';
import { readFileAsDataUrl } from './onboardingDocumentUtils';
import { useToastStore } from '@/store/toast';

type Props = {
  step: KycStepKey;
  draft: SupplierKycDraft;
  onChange: (next: SupplierKycDraft) => void;
  /** Review step: Gemura login + MCC commercial fields */
  credentials?: React.ReactNode;
  reviewPreview?: React.ReactNode;
};

const OWNERSHIP_OPTS = [
  { value: 'member', label: 'Member' },
  { value: 'non_member', label: 'Non-member' },
  { value: 'shareholder', label: 'Shareholder' },
  { value: 'none', label: 'None' },
];

const SUPPLIER_TYPE_OPTS = [
  { value: 'individual_farmer', label: 'Individual farmer' },
  { value: 'farmer_aggregator', label: 'Farmer-aggregator' },
  { value: 'pure_aggregator', label: 'Pure aggregator' },
  { value: 'institutional', label: 'Institutional' },
  { value: 'trader', label: 'Trader' },
];

const DELIVERY_OPTS = [
  { value: 'direct_mcc', label: 'Direct to MCC' },
  { value: 'via_route', label: 'Via route' },
  { value: 'collection_center', label: 'Collection center' },
  { value: 'transported', label: 'Transported' },
];

const SERVICE_OPTS = [
  { key: 'vet', label: 'Vet' },
  { key: 'credit', label: 'Credit' },
  { key: 'inputs', label: 'Inputs' },
  { key: 'training', label: 'Training' },
  { key: 'equipment', label: 'Equipment' },
];

const PAYMENT_SCENARIO_OPTS = [
  { value: 'direct_own', label: 'Direct farmer (own milk)' },
  { value: 'non_member_farmer', label: 'Non-member farmer' },
  { value: 'farmer_agg_own', label: 'Farmer-aggregator (own milk)' },
  { value: 'farmer_agg_collected', label: 'Farmer-aggregator (collected milk)' },
  { value: 'pure_agg_passthrough', label: 'Pure aggregator (pass-through)' },
];

export default function SupplierKycStepPanels({
  step,
  draft,
  onChange,
  credentials,
  reviewPreview,
}: Props) {
  const meta = KYC_STEP_LABELS[step];
  const patch = (partial: Partial<SupplierKycDraft>) => onChange({ ...draft, ...partial });

  if (step === 'identity') {
    const i = draft.identity;
    return (
      <WizardStepPanel title={`1. ${meta.title}`} subtitle={meta.subtitle}>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="kyc-surname">Surname</FieldLabel>
            <TextInput
              id="kyc-surname"
              value={i.surname}
              onChange={(e) => patch({ identity: { ...i, surname: e.target.value } })}
            />
          </div>
          <div>
            <FieldLabel htmlFor="kyc-first">First name</FieldLabel>
            <TextInput
              id="kyc-first"
              value={i.firstName}
              onChange={(e) => patch({ identity: { ...i, firstName: e.target.value } })}
            />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="kyc-other" optional>
              Other names
            </FieldLabel>
            <TextInput
              id="kyc-other"
              value={i.otherNames}
              onChange={(e) => patch({ identity: { ...i, otherNames: e.target.value } })}
            />
          </div>
          <div>
            <FieldLabel htmlFor="kyc-gender" optional>
              Gender
            </FieldLabel>
            <select
              id="kyc-gender"
              className="select w-full min-h-[44px]"
              value={i.gender}
              onChange={(e) =>
                patch({
                  identity: { ...i, gender: e.target.value as typeof i.gender },
                })
              }
            >
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="kyc-dob" optional>
              Date of birth
            </FieldLabel>
            <TextInput
              id="kyc-dob"
              type="date"
              value={i.dateOfBirth}
              onChange={(e) => patch({ identity: { ...i, dateOfBirth: e.target.value } })}
            />
          </div>
        </div>
        <RwandaLocationFields
          idPrefix="kyc"
          names={{
            province: i.province,
            district: i.district,
            sector: i.sector,
            cell: i.cell,
            village: i.village,
          }}
          locationVillageId={i.locationVillageId}
          onUpdate={(next) =>
            patch({
              identity: {
                ...i,
                province: next.province,
                district: next.district,
                sector: next.sector,
                cell: next.cell,
                village: next.village,
                locationVillageId: next.locationVillageId,
              },
            })
          }
        />
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="kyc-phone">Primary phone</FieldLabel>
            <TextInput
              id="kyc-phone"
              value={i.primaryPhone}
              onChange={(e) => patch({ identity: { ...i, primaryPhone: e.target.value } })}
              placeholder="250788123456"
            />
          </div>
          <div>
            <FieldLabel htmlFor="kyc-wa" optional>
              WhatsApp
            </FieldLabel>
            <TextInput
              id="kyc-wa"
              value={i.whatsapp}
              onChange={(e) => patch({ identity: { ...i, whatsapp: e.target.value } })}
            />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="kyc-nid">National ID</FieldLabel>
            <TextInput
              id="kyc-nid"
              value={i.nid}
              maxLength={16}
              inputMode="numeric"
              onChange={(e) =>
                patch({ identity: { ...i, nid: e.target.value.replace(/\D/g, '').slice(0, 16) } })
              }
            />
          </div>
        </div>
      </WizardStepPanel>
    );
  }

  if (step === 'supplier_type') {
    const c = draft.classification;
    return (
      <WizardStepPanel title={`2. ${meta.title}`} subtitle={meta.subtitle}>
        <RadioRow
          legend="Ownership status"
          name="ownership"
          value={c.ownershipStatus}
          onChange={(v) => patch({ classification: { ...c, ownershipStatus: v as typeof c.ownershipStatus } })}
          options={OWNERSHIP_OPTS}
        />
        <RadioRow
          legend="Supplier type"
          name="supplierType"
          value={c.supplierType}
          onChange={(v) => patch({ classification: { ...c, supplierType: v as typeof c.supplierType } })}
          options={SUPPLIER_TYPE_OPTS}
        />
        <RadioRow
          legend="Delivery mode"
          name="delivery"
          value={c.deliveryMode}
          onChange={(v) => patch({ classification: { ...c, deliveryMode: v as typeof c.deliveryMode } })}
          options={DELIVERY_OPTS}
        />
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="kyc-rel">Relationship to MCC</FieldLabel>
            <TextInput
              id="kyc-rel"
              value={c.relationshipToMcc}
              onChange={(e) => patch({ classification: { ...c, relationshipToMcc: e.target.value } })}
            />
          </div>
          <div>
            <FieldLabel htmlFor="kyc-since" optional>
              Relationship since
            </FieldLabel>
            <TextInput
              id="kyc-since"
              type="date"
              value={c.relationshipSince}
              onChange={(e) => patch({ classification: { ...c, relationshipSince: e.target.value } })}
            />
          </div>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-800">
          <input
            type="checkbox"
            checked={c.activeStatus}
            onChange={(e) => patch({ classification: { ...c, activeStatus: e.target.checked } })}
            className="rounded-sm"
          />
          Active supplier
        </label>
        <CheckboxRow
          legend="Service eligibility"
          selected={c.serviceEligibility}
          onToggle={(key, checked) => {
            const next = checked
              ? [...c.serviceEligibility, key]
              : c.serviceEligibility.filter((x) => x !== key);
            patch({ classification: { ...c, serviceEligibility: next } });
          }}
          options={SERVICE_OPTS}
        />
        <RadioRow
          legend="Credit eligibility"
          name="credit"
          value={c.creditEligible}
          onChange={(v) => patch({ classification: { ...c, creditEligible: v as typeof c.creditEligible } })}
          options={[
            { value: 'eligible', label: 'Eligible' },
            { value: 'not_eligible', label: 'Not eligible' },
            { value: 'pending', label: 'Pending review' },
          ]}
        />
        <RadioRow
          legend="Milk payment recipient"
          name="payRecip"
          value={c.paymentRecipient}
          onChange={(v) =>
            patch({ classification: { ...c, paymentRecipient: v as typeof c.paymentRecipient } })
          }
          options={[
            { value: 'supplier', label: 'Supplier (self)' },
            { value: 'designated', label: 'Designated person' },
            { value: 'organization', label: 'Organization' },
          ]}
        />
        <div className="rounded-lg border border-[#004AAD]/20 bg-[#004AAD]/5 p-3">
          <p className="text-xs font-semibold text-gray-700 mb-2">Role badges preview</p>
          <div className="flex flex-wrap gap-1.5">
            {roleBadgesFromDraft(draft).map((b) => (
              <span key={b} className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-gray-200">
                {b}
              </span>
            ))}
          </div>
        </div>
      </WizardStepPanel>
    );
  }

  if (step === 'farm_supply') {
    const f = draft.farm;
    const isAgg = draft.classification.supplierType === 'pure_aggregator';
    return (
      <WizardStepPanel title={`3. ${meta.title}`} subtitle={meta.subtitle}>
        {!isAgg && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="kyc-farm">Farm name</FieldLabel>
              <TextInput
                id="kyc-farm"
                value={f.farmName}
                onChange={(e) => patch({ farm: { ...f, farmName: e.target.value } })}
              />
            </div>
            <div>
              <FieldLabel htmlFor="kyc-fcode" optional>
                Farm code
              </FieldLabel>
              <TextInput
                id="kyc-fcode"
                value={f.farmCode}
                onChange={(e) => patch({ farm: { ...f, farmCode: e.target.value } })}
              />
            </div>
            <div>
              <FieldLabel htmlFor="kyc-lact">Lactating cows</FieldLabel>
              <TextInput
                id="kyc-lact"
                inputMode="numeric"
                value={f.lactatingCows}
                onChange={(e) => patch({ farm: { ...f, lactatingCows: e.target.value } })}
              />
            </div>
            <div>
              <FieldLabel htmlFor="kyc-herd" optional>
                Total herd
              </FieldLabel>
              <TextInput
                id="kyc-herd"
                inputMode="numeric"
                value={f.totalHerd}
                onChange={(e) => patch({ farm: { ...f, totalHerd: e.target.value } })}
              />
            </div>
            <div>
              <FieldLabel htmlFor="kyc-breed" optional>
                Breed
              </FieldLabel>
              <TextInput
                id="kyc-breed"
                value={f.breedType}
                onChange={(e) => patch({ farm: { ...f, breedType: e.target.value } })}
                placeholder="e.g. Friesian"
              />
            </div>
            <div>
              <FieldLabel htmlFor="kyc-avg">Avg. daily production (L)</FieldLabel>
              <TextInput
                id="kyc-avg"
                inputMode="decimal"
                value={f.avgDailyLiters}
                onChange={(e) => patch({ farm: { ...f, avgDailyLiters: e.target.value } })}
              />
            </div>
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="kyc-route">Main collection route</FieldLabel>
            <TextInput
              id="kyc-route"
              value={f.mainRoute}
              onChange={(e) => patch({ farm: { ...f, mainRoute: e.target.value } })}
            />
          </div>
          <div>
            <FieldLabel htmlFor="kyc-dist">Distance to MCC (km)</FieldLabel>
            <TextInput
              id="kyc-dist"
              inputMode="decimal"
              value={f.distanceKm}
              onChange={(e) => patch({ farm: { ...f, distanceKm: e.target.value } })}
            />
          </div>
          <div>
            <FieldLabel htmlFor="kyc-gps-lat" optional>
              GPS latitude
            </FieldLabel>
            <TextInput
              id="kyc-gps-lat"
              value={f.gpsLat}
              onChange={(e) => patch({ farm: { ...f, gpsLat: e.target.value } })}
            />
          </div>
          <div>
            <FieldLabel htmlFor="kyc-gps-lng" optional>
              GPS longitude
            </FieldLabel>
            <TextInput
              id="kyc-gps-lng"
              value={f.gpsLng}
              onChange={(e) => patch({ farm: { ...f, gpsLng: e.target.value } })}
            />
          </div>
        </div>
        <CheckboxRow
          legend="Farm services needed"
          selected={f.servicesNeeded}
          onToggle={(key, checked) => {
            const next = checked ? [...f.servicesNeeded, key] : f.servicesNeeded.filter((x) => x !== key);
            patch({ farm: { ...f, servicesNeeded: next } });
          }}
          options={SERVICE_OPTS}
        />
      </WizardStepPanel>
    );
  }

  if (step === 'payment') {
    const p = draft.payment;
    return (
      <WizardStepPanel title={`4. ${meta.title}`} subtitle={meta.subtitle}>
        <p className="text-sm text-gray-600 -mt-2">
          Recipient: <strong>{kycFullName(draft) || '—'}</strong>
        </p>
        <CheckboxRow
          legend="Payment methods"
          selected={p.paymentMethods}
          onToggle={(key, checked) => {
            const next = checked ? [...p.paymentMethods, key] : p.paymentMethods.filter((x) => x !== key);
            patch({ payment: { ...p, paymentMethods: next } });
          }}
          options={[
            { key: 'momo', label: 'Mobile money' },
            { key: 'bank', label: 'Bank transfer' },
          ]}
        />
        {p.paymentMethods.includes('momo') && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="kyc-momo-p">MoMo provider</FieldLabel>
              <TextInput
                id="kyc-momo-p"
                value={p.momoProvider}
                onChange={(e) => patch({ payment: { ...p, momoProvider: e.target.value } })}
              />
            </div>
            <div>
              <FieldLabel htmlFor="kyc-momo-n">MoMo number</FieldLabel>
              <TextInput
                id="kyc-momo-n"
                value={p.momoNumber}
                onChange={(e) => patch({ payment: { ...p, momoNumber: e.target.value } })}
              />
            </div>
          </div>
        )}
        {p.paymentMethods.includes('bank') && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="kyc-bank">Bank name</FieldLabel>
              <TextInput
                id="kyc-bank"
                value={p.bankName}
                onChange={(e) => patch({ payment: { ...p, bankName: e.target.value } })}
              />
            </div>
            <div>
              <FieldLabel htmlFor="kyc-bacct">Account number</FieldLabel>
              <TextInput
                id="kyc-bacct"
                value={p.bankAccount}
                onChange={(e) => patch({ payment: { ...p, bankAccount: e.target.value } })}
              />
            </div>
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="kyc-freq">Payment frequency</FieldLabel>
            <select
              id="kyc-freq"
              className="select w-full min-h-[44px]"
              value={p.paymentFrequency}
              onChange={(e) => patch({ payment: { ...p, paymentFrequency: e.target.value } })}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="kyc-cut">Cut-off time</FieldLabel>
            <TextInput
              id="kyc-cut"
              type="time"
              value={p.cutoffTime}
              onChange={(e) => patch({ payment: { ...p, cutoffTime: e.target.value } })}
            />
          </div>
        </div>
        <RadioRow
          legend="Milk payment scenario"
          name="scenario"
          value={p.milkPaymentScenario}
          onChange={(v) =>
            patch({ payment: { ...p, milkPaymentScenario: v as typeof p.milkPaymentScenario } })
          }
          options={PAYMENT_SCENARIO_OPTS}
        />
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="kyc-fee">Collection fee (%)</FieldLabel>
            <TextInput
              id="kyc-fee"
              inputMode="decimal"
              value={p.collectionFeePct}
              onChange={(e) => patch({ payment: { ...p, collectionFeePct: e.target.value } })}
            />
          </div>
        </div>
        <CheckboxRow
          legend="Service deductions"
          selected={p.serviceDeductions}
          onToggle={(key, checked) => {
            const next = checked
              ? [...p.serviceDeductions, key]
              : p.serviceDeductions.filter((x) => x !== key);
            patch({ payment: { ...p, serviceDeductions: next } });
          }}
          options={[
            { key: 'loan', label: 'Loan repayments' },
            { key: 'vet', label: 'Veterinary' },
            { key: 'inputs', label: 'Inputs' },
          ]}
        />
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={p.walletActivation}
            onChange={(e) => patch({ payment: { ...p, walletActivation: e.target.checked } })}
          />
          Activate Gemura supplier wallet
        </label>
      </WizardStepPanel>
    );
  }

  if (step === 'documents') {
    return (
      <WizardStepPanel title={`5. ${meta.title}`} subtitle={meta.subtitle}>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2">Document</th>
                <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Preview</th>
                  <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {draft.documents.map((doc, idx) => (
                <tr key={doc.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    <span className="font-medium text-gray-900">{doc.label}</span>
                    {doc.conditional && (
                      <span className="block text-xs text-gray-500">{doc.conditionalHint}</span>
                    )}
                  </td>
                      <td className="px-3 py-2 capitalize text-gray-700">{doc.status.replace('_', ' ')}</td>
                      <td className="px-3 py-2">
                        {doc.dataUrl ? (
                          <button
                            type="button"
                            className="text-xs font-medium text-[#004AAD] hover:underline"
                            onClick={() => {
                              const w = window.open('', '_blank');
                              if (!w || !doc.dataUrl) return;
                              if ((doc.mimeType || doc.dataUrl).includes('pdf')) {
                                w.document.write(
                                  `<iframe src="${doc.dataUrl}" style="border:0;width:100%;height:100vh"></iframe>`,
                                );
                              } else {
                                w.document.write(
                                  `<img src="${doc.dataUrl}" style="max-width:100%;height:auto" alt="${doc.label}" />`,
                                );
                              }
                            }}
                          >
                            View
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <label className="inline-flex cursor-pointer items-center gap-2 text-[#004AAD] font-medium text-xs">
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="sr-only"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                const { dataUrl, mimeType } = await readFileAsDataUrl(file);
                                const docs = [...draft.documents];
                                docs[idx] = {
                                  ...doc,
                                  status: 'uploaded',
                                  fileName: file.name,
                                  dataUrl,
                                  mimeType,
                                };
                                patch({ documents: docs });
                              } catch (err) {
                                useToastStore
                                  .getState()
                                  .error((err as Error).message || 'Could not read file');
                              }
                              e.target.value = '';
                            }}
                          />
                          {doc.fileName ? 'Replace' : 'Upload'}
                        </label>
                        {doc.fileName && (
                          <span className="block text-xs text-gray-500 truncate max-w-[140px]">{doc.fileName}</span>
                        )}
                      </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WizardStepPanel>
    );
  }

  const r = draft.review;
  return (
    <WizardStepPanel title={`6. ${meta.title}`} subtitle={meta.subtitle}>
      <div className="grid lg:grid-cols-2 gap-4">
        <ReviewSection title="Identity summary">
          <ReviewRow label="Name" value={kycFullName(draft)} />
          <ReviewRow label="Phone" value={draft.identity.primaryPhone} />
          <ReviewRow label="NID" value={draft.identity.nid} />
          <ReviewRow
            label="Location"
            value={[draft.identity.village, draft.identity.cell, draft.identity.sector, draft.identity.district]
              .filter(Boolean)
              .join(', ')}
          />
        </ReviewSection>
        <ReviewSection title="Classification">
          <ReviewRow label="Ownership" value={draft.classification.ownershipStatus} />
          <ReviewRow label="Supplier type" value={draft.classification.supplierType} />
          <ReviewRow label="Delivery" value={draft.classification.deliveryMode} />
        </ReviewSection>
      </div>
      {credentials}
      <div className="space-y-3 pt-2">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={r.declarationAccurate}
            onChange={(e) => patch({ review: { ...r, declarationAccurate: e.target.checked } })}
          />
          I confirm the information provided is accurate.
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={r.declarationConsent}
            onChange={(e) => patch({ review: { ...r, declarationConsent: e.target.checked } })}
          />
          I consent to data processing for KYC and payments.
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={r.declarationTerms}
            onChange={(e) => patch({ review: { ...r, declarationTerms: e.target.checked } })}
          />
          I accept Gemura terms and conditions.
        </label>
      </div>
      {reviewPreview}
    </WizardStepPanel>
  );
}
