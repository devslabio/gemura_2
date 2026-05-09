'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { mccOperationsApi } from '@/lib/api/mcc-operations';
import Icon, { faBox, faEye, faTruck } from '@/app/components/Icon';

type Props = {
  accountId: string;
  dateFrom: string;
  dateTo: string;
};

/**
 * Compact quality/traceability summary for veterinary-focused dashboard overview.
 * Uses existing MCC operations APIs (no new endpoints).
 */
export default function VeterinaryQualityStrip({ accountId, dateFrom, dateTo }: Props) {
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(0);
  const [accepted, setAccepted] = useState(0);
  const [rejected, setRejected] = useState(0);
  const [unresolvedRejections, setUnresolvedRejections] = useState(0);
  const [gateArrivals, setGateArrivals] = useState(0);

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const [pendingRes, acceptedRes, rejectedRes, gatesRes] = await Promise.all([
        mccOperationsApi.listTestResults(accountId, 'pending', dateFrom, dateTo),
        mccOperationsApi.listTestResults(accountId, 'accepted', dateFrom, dateTo),
        mccOperationsApi.listTestResults(accountId, 'rejected', dateFrom, dateTo),
        mccOperationsApi.listGateDeliveries(accountId, dateFrom, dateTo),
      ]);
      const pend = pendingRes.data ?? [];
      const acc = acceptedRes.data ?? [];
      const rej = rejectedRes.data ?? [];
      setPending(pend.length);
      setAccepted(acc.length);
      setRejected(rej.length);
      setUnresolvedRejections(
        rej.filter((r) => !r.source_resolution_status || r.source_resolution_status === 'unresolved').length,
      );
      setGateArrivals((gatesRes.data ?? []).length);
    } finally {
      setLoading(false);
    }
  }, [accountId, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="rounded-sm border border-gray-200 bg-white p-4 text-sm text-gray-500 flex items-center gap-2">
        <span className="inline-block w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        Loading quality summary…
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Quality &amp; traceability</h2>
          <p className="text-xs text-gray-600 mt-0.5">
            Period {dateFrom} – {dateTo}. Uses gate arrivals and milk tests already stored for this MCC.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link
            href="/operations/traceability"
            className="btn btn-primary btn-sm inline-flex items-center gap-1.5 no-underline"
          >
            <Icon icon={faEye} size="sm" />
            Milk tests
          </Link>
          <Link
            href="/operations/gate"
            className="btn btn-secondary btn-sm inline-flex items-center gap-1.5 no-underline"
          >
            <Icon icon={faTruck} size="sm" />
            Gate
          </Link>
          <Link href="/collections" className="btn btn-secondary btn-sm inline-flex items-center gap-1.5 no-underline">
            <Icon icon={faBox} size="sm" />
            Collections
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
        <div className="rounded bg-white border border-gray-100 py-2 px-2">
          <div className="text-lg font-bold text-gray-900 tabular-nums">{gateArrivals}</div>
          <div className="text-[11px] text-gray-600 uppercase tracking-wide">Gate arrivals</div>
        </div>
        <div className="rounded bg-white border border-amber-100 py-2 px-2">
          <div className="text-lg font-bold text-amber-900 tabular-nums">{pending}</div>
          <div className="text-[11px] text-gray-600 uppercase tracking-wide">Pending tests</div>
        </div>
        <div className="rounded bg-white border border-green-100 py-2 px-2">
          <div className="text-lg font-bold text-green-800 tabular-nums">{accepted}</div>
          <div className="text-[11px] text-gray-600 uppercase tracking-wide">Accepted</div>
        </div>
        <div className="rounded bg-white border border-red-100 py-2 px-2">
          <div className="text-lg font-bold text-red-800 tabular-nums">{rejected}</div>
          <div className="text-[11px] text-gray-600 uppercase tracking-wide">Rejected</div>
        </div>
        <div className="rounded bg-white border border-gray-200 py-2 px-2 col-span-2 sm:col-span-1">
          <div className="text-lg font-bold text-gray-900 tabular-nums">{unresolvedRejections}</div>
          <div className="text-[11px] text-gray-600 uppercase tracking-wide">Unresolved rejections</div>
        </div>
      </div>
      {pending > 5 && (
        <p className="text-xs text-amber-900 bg-amber-100/80 border border-amber-200 rounded px-2 py-1.5">
          More than five pending tests in this period — prioritize outcomes on the traceability screen.
        </p>
      )}
    </div>
  );
}
