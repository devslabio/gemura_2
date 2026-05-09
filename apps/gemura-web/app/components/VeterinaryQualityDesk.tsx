'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  mccOperationsApi,
  type MccGateDeliveryRow,
  type MccManifestRow,
  type MccTestResultRow,
} from '@/lib/api/mcc-operations';
import { usePermission } from '@/hooks/usePermission';
import StatCard from '@/app/components/StatCard';
import Icon, { faBox, faClipboardList, faEye, faPlus, faTruck } from '@/app/components/Icon';

type Props = {
  accountId: string;
  dateFrom: string;
  dateTo: string;
};

function isUmucunda(st: string) {
  return st === 'umucunda_a' || st === 'umucunda_b';
}

const BLUE = { iconBgColor: '#eff6ff', iconColor: 'var(--primary)' };
const GREEN = { iconBgColor: '#dcfce7', iconColor: '#059669' };
const AMBER = { iconBgColor: '#fef3c7', iconColor: '#b45309' };
const RED = { iconBgColor: '#fee2e2', iconColor: '#b91c1c' };

/**
 * Full-screen quality desk for veterinary roles (web only): KPIs from existing MCC APIs + deep links to traceability.
 */
export default function VeterinaryQualityDesk({ accountId, dateFrom, dateTo }: Props) {
  const { hasPermission } = usePermission();
  const canRecordTests = hasPermission('mcc_manage_operations');
  const [loading, setLoading] = useState(true);
  const [gates, setGates] = useState<MccGateDeliveryRow[]>([]);
  const [manifests, setManifests] = useState<MccManifestRow[]>([]);
  const [pending, setPending] = useState<MccTestResultRow[]>([]);
  const [accepted, setAccepted] = useState(0);
  const [rejected, setRejected] = useState(0);
  const [unresolvedRejections, setUnresolvedRejections] = useState(0);

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const [gatesRes, manifestsRes, pendRes, accRes, rejRes] = await Promise.all([
        mccOperationsApi.listGateDeliveries(accountId, dateFrom, dateTo),
        mccOperationsApi.listManifests(accountId, dateFrom, dateTo),
        mccOperationsApi.listTestResults(accountId, 'pending', dateFrom, dateTo),
        mccOperationsApi.listTestResults(accountId, 'accepted', dateFrom, dateTo),
        mccOperationsApi.listTestResults(accountId, 'rejected', dateFrom, dateTo),
      ]);
      const gateList = gatesRes.data ?? [];
      setGates(gateList);
      setManifests(manifestsRes.data ?? []);
      setPending(pendRes.data ?? []);
      const rejList = rejRes.data ?? [];
      setAccepted((accRes.data ?? []).length);
      setRejected(rejList.length);
      setUnresolvedRejections(
        rejList.filter((r) => !r.source_resolution_status || r.source_resolution_status === 'unresolved').length,
      );
    } finally {
      setLoading(false);
    }
  }, [accountId, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const umucundaGates = gates.filter((g) => isUmucunda(g.source_type)).length;
    const directGates = gates.length - umucundaGates;
    const manifestsReady = manifests.filter((m) => m.status === 'submitted' || m.status === 'accepted').length;
    const decided = accepted + rejected;
    const acceptanceRatePct = decided > 0 ? Math.round((accepted / decided) * 100) : null;
    const eligibleForTest = gateListEligible(gates);
    return {
      umucundaGates,
      directGates,
      manifestsReady,
      acceptanceRatePct,
      eligibleForTestCount: eligibleForTest.length,
      nextGateId: eligibleForTest[0]?.id ?? null,
    };
  }, [gates, manifests, accepted, rejected]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600 py-8">
        <span className="inline-block w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        Loading quality desk…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Quality desk</h2>
          <p className="text-sm text-gray-600 mt-1">
            Period <span className="font-medium text-gray-800">{dateFrom}</span> –{' '}
            <span className="font-medium text-gray-800">{dateTo}</span>. Gate and manifest activity plus milk-test outcomes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link
            href="/operations/traceability?outcome=pending"
            className="btn btn-secondary btn-sm inline-flex items-center gap-1.5 no-underline"
          >
            <Icon icon={faEye} size="sm" />
            Pending queue
          </Link>
          {canRecordTests ? (
            <Link
              href="/operations/traceability?testNext=1"
              className="btn btn-primary btn-sm inline-flex items-center gap-1.5 no-underline"
            >
              <Icon icon={faPlus} size="sm" />
              Test next arrival
            </Link>
          ) : null}
          <Link href="/operations/manifests" className="btn btn-secondary btn-sm inline-flex items-center gap-1.5 no-underline">
            <Icon icon={faClipboardList} size="sm" />
            Manifests
          </Link>
          <Link href="/operations/gate" className="btn btn-secondary btn-sm inline-flex items-center gap-1.5 no-underline">
            <Icon icon={faTruck} size="sm" />
            Gate
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Gate arrivals"
          value={gates.length}
          subtitle={`Direct ${stats.directGates}\nUmucunda ${stats.umucundaGates}`}
          icon={faTruck}
          href="/operations/gate"
          {...BLUE}
        />
        <StatCard
          label="Manifests ready"
          value={stats.manifestsReady}
          subtitle={`Submitted or accepted in range`}
          icon={faClipboardList}
          href="/operations/manifests"
          {...GREEN}
        />
        <StatCard
          label="Pending milk tests"
          value={pending.length}
          subtitle={
            stats.acceptanceRatePct != null
              ? `${stats.acceptanceRatePct}% accepted among decided`
              : 'No decided tests yet'
          }
          icon={faPlus}
          href="/operations/traceability?outcome=pending"
          {...AMBER}
        />
        <StatCard
          label="Unresolved rejections"
          value={unresolvedRejections}
          subtitle={`Accepted ${accepted} · Rejected ${rejected}`}
          icon={faBox}
          href="/operations/traceability"
          {...RED}
        />
      </div>

      {canRecordTests && stats.eligibleForTestCount === 0 && gates.length > 0 && (
        <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          No gate deliveries are eligible for a new test right now (Umucunda batches need a{' '}
          <strong>submitted</strong> manifest first).
        </div>
      )}
    </div>
  );
}

function gateListEligible(gates: MccGateDeliveryRow[]): MccGateDeliveryRow[] {
  const fifo = [...gates].sort((a, b) => new Date(a.arrived_at).getTime() - new Date(b.arrived_at).getTime());
  return fifo.filter((g) => {
    if (!isUmucunda(g.source_type)) return true;
    if (!g.manifest) return false;
    if (g.manifest.status === 'draft') return false;
    return true;
  });
}
