'use client';

import {
  computeKycReadinessPct,
  kycPendingItems,
  roleBadgesFromDraft,
} from './kycOnboardingProgress';
import type { SupplierKycDraft } from './kycModel';
import { kycFullName } from './kycModel';

function completionTone(pct: number): string {
  return pct >= 85 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#94a3b8';
}

function ReadinessRing({ pct }: { pct: number }) {
  const tone = completionTone(pct);
  return (
    <div
      className="relative mx-auto flex h-36 w-36 items-center justify-center rounded-full border-[6px] border-gray-100"
      style={{ background: `conic-gradient(${tone} ${pct}%, #f3f4f6 0)` }}
      role="img"
      aria-label={`KYC ${pct}% ready`}
    >
      <span className="rounded-full bg-white px-3 py-1.5 text-2xl font-bold text-gray-900 tabular-nums shadow-sm">
        {pct}%
      </span>
    </div>
  );
}

type Props = {
  draft: SupplierKycDraft;
  stepIndex: number;
  mccName?: string;
};

export default function SupplierKycSidebar({ draft, stepIndex, mccName }: Props) {
  const pct = computeKycReadinessPct(draft, stepIndex);
  const pending = kycPendingItems(draft);
  const badges = roleBadgesFromDraft(draft);

  const docStats = {
    uploaded: draft.documents.filter((d) => d.status !== 'missing').length,
    verified: draft.documents.filter((d) => d.status === 'verified').length,
    missing: draft.documents.filter((d) => d.status === 'missing').length,
    rejected: draft.documents.filter((d) => d.status === 'rejected').length,
  };

  return (
    <aside className="hidden lg:flex w-[280px] shrink-0 flex-col gap-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">KYC status</p>
        <p className="mt-1 text-sm font-semibold text-amber-700">In progress</p>
        {mccName && <p className="text-xs text-gray-600 mt-1">{mccName}</p>}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Readiness</p>
        <ReadinessRing pct={pct} />
        <p className="mt-3 text-sm text-gray-700">
          <span className="font-medium text-gray-900">{kycFullName(draft) || 'New supplier'}</span>
        </p>
      </div>

      {badges.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Role badges</p>
          <div className="flex flex-wrap gap-1.5">
            {badges.map((b) => (
              <span
                key={b}
                className="inline-flex rounded-full bg-[#004AAD]/10 px-2 py-0.5 text-[11px] font-medium text-[#031A3A]"
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm text-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Documents</p>
        <ul className="space-y-1 text-gray-700">
          <li>{docStats.uploaded} uploaded</li>
          <li>{docStats.verified} verified</li>
          <li>{docStats.missing} missing</li>
          {docStats.rejected > 0 && <li className="text-red-700">{docStats.rejected} rejected</li>}
        </ul>
      </div>

      {pending.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-900 mb-2">Pending</p>
          <ul className="text-xs text-amber-950 space-y-1 list-disc pl-4">
            {pending.slice(0, 5).map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
