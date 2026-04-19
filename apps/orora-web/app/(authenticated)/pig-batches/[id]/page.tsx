'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import {
  pigBatchesApi,
  pigFarrowingsApi,
  type PigBatch,
  type PigBatchWeight,
  type PigFarrowing,
} from '@/lib/api/pig-batches';
import Icon, { faSpinner, faTrash } from '@/app/components/Icon';

function fmtKg(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return String(v);
}

export default function PigBatchDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const { currentAccount } = useAuthStore();
  const accountId = currentAccount?.account_id;

  const [batch, setBatch] = useState<PigBatch | null>(null);
  const [weights, setWeights] = useState<PigBatchWeight[]>([]);
  const [farrowings, setFarrowings] = useState<PigFarrowing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [weightForm, setWeightForm] = useState({
    weighed_date: '',
    avg_weight_kg: '',
    animals_weighed: '',
    weight_band: '',
    notes: '',
  });
  const [farForm, setFarForm] = useState({
    farrowing_date: '',
    live_born: '',
    stillborn: '',
    mummified: '',
    notes: '',
  });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!accountId || !id) return;
    setLoading(true);
    setError('');
    try {
      const [one, w, f] = await Promise.all([
        pigBatchesApi.get(id, accountId),
        pigBatchesApi.listWeights(id, accountId),
        pigFarrowingsApi.list(accountId, undefined, id),
      ]);
      if (one.code === 200) setBatch(one.data);
      if (w.code === 200) setWeights(w.data ?? []);
      if (f.code === 200) setFarrowings(f.data ?? []);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err?.response?.data?.message || err?.message || 'Failed to load batch');
    } finally {
      setLoading(false);
    }
  }, [accountId, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveWeight = async () => {
    if (!accountId || !weightForm.weighed_date || !weightForm.avg_weight_kg) return;
    const avg = parseFloat(weightForm.avg_weight_kg);
    if (Number.isNaN(avg)) return;
    setBusy(true);
    try {
      await pigBatchesApi.upsertWeight(
        id,
        {
          weighed_date: weightForm.weighed_date,
          avg_weight_kg: avg,
          animals_weighed: weightForm.animals_weighed ? parseInt(weightForm.animals_weighed, 10) : undefined,
          weight_band: weightForm.weight_band.trim() || undefined,
          notes: weightForm.notes.trim() || undefined,
        },
        accountId,
      );
      setWeightForm({
        weighed_date: '',
        avg_weight_kg: '',
        animals_weighed: '',
        weight_band: '',
        notes: '',
      });
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err?.response?.data?.message || err?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const removeWeight = async (weightId: string) => {
    if (!accountId || !confirm('Delete this weight row?')) return;
    try {
      await pigBatchesApi.deleteWeight(id, weightId, accountId);
      await load();
    } catch {
      setError('Could not delete weight row');
    }
  };

  const saveFarrowing = async () => {
    if (!accountId || !farForm.farrowing_date) return;
    setBusy(true);
    try {
      await pigFarrowingsApi.create(
        {
          pig_batch_id: id,
          farm_id: batch?.farm_id ?? undefined,
          farrowing_date: farForm.farrowing_date,
          live_born: farForm.live_born ? parseInt(farForm.live_born, 10) : undefined,
          stillborn: farForm.stillborn ? parseInt(farForm.stillborn, 10) : undefined,
          mummified: farForm.mummified ? parseInt(farForm.mummified, 10) : undefined,
          notes: farForm.notes.trim() || undefined,
        },
        accountId,
      );
      setFarForm({ farrowing_date: '', live_born: '', stillborn: '', mummified: '', notes: '' });
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err?.response?.data?.message || err?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const removeFarrowing = async (fid: string) => {
    if (!accountId || !confirm('Delete this farrowing record?')) return;
    try {
      await pigFarrowingsApi.delete(fid, accountId);
      await load();
    } catch {
      setError('Could not delete farrowing');
    }
  };

  return (
    <div className="space-y-6">
      <Link href="/pig-batches" className="text-sm text-[var(--primary)] font-medium inline-block">
        ← Back to batches
      </Link>

      {loading ? (
        <p className="text-sm text-gray-500 inline-flex items-center gap-2">
          <Icon icon={faSpinner} size="sm" className="animate-spin" /> Loading…
        </p>
      ) : batch ? (
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{batch.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {batch.farm?.name ?? 'No farm'} · {batch.current_head_count} head current
          </p>
        </div>
      ) : (
        <p className="text-red-600 text-sm">Batch not found.</p>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-3 text-sm text-red-600">{error}</div>
      )}

      <section className="bg-white border border-gray-200 rounded-sm p-4 space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Weights & bands</h2>
        <p className="text-xs text-gray-500">One entry per weigh day; optional band label (e.g. “60–80 kg”).</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 items-end">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Date</label>
            <input
              type="date"
              className="input w-full"
              value={weightForm.weighed_date}
              onChange={(e) => setWeightForm((s) => ({ ...s, weighed_date: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Avg kg *</label>
            <input
              type="number"
              step="0.01"
              className="input w-full"
              value={weightForm.avg_weight_kg}
              onChange={(e) => setWeightForm((s) => ({ ...s, avg_weight_kg: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1"># weighed</label>
            <input
              type="number"
              min={0}
              className="input w-full"
              value={weightForm.animals_weighed}
              onChange={(e) => setWeightForm((s) => ({ ...s, animals_weighed: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Weight band</label>
            <input
              className="input w-full"
              placeholder="Optional"
              value={weightForm.weight_band}
              onChange={(e) => setWeightForm((s) => ({ ...s, weight_band: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Notes</label>
            <input
              className="input w-full"
              value={weightForm.notes}
              onChange={(e) => setWeightForm((s) => ({ ...s, notes: e.target.value }))}
            />
          </div>
        </div>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void saveWeight()}>
          Save weigh day
        </button>

        <div className="overflow-x-auto border border-gray-100 rounded-sm mt-4">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-600">
                <th className="p-2">Date</th>
                <th className="p-2">Avg kg</th>
                <th className="p-2">Band</th>
                <th className="p-2">Notes</th>
                <th className="p-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {weights.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="p-2 whitespace-nowrap">{r.weighed_date}</td>
                  <td className="p-2">{fmtKg(r.avg_weight_kg)}</td>
                  <td className="p-2">{r.weight_band ?? '—'}</td>
                  <td className="p-2 text-gray-600">{r.notes ?? '—'}</td>
                  <td className="p-2">
                    <button type="button" className="text-red-600" onClick={() => void removeWeight(r.id)}>
                      <Icon icon={faTrash} size="sm" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-sm p-4 space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Farrowing</h2>
        <p className="text-xs text-gray-500">
          Linked to this batch; live-born can increase batch head count per backend rules.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 items-end">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Date *</label>
            <input
              type="date"
              className="input w-full"
              value={farForm.farrowing_date}
              onChange={(e) => setFarForm((s) => ({ ...s, farrowing_date: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Live born</label>
            <input
              type="number"
              min={0}
              className="input w-full"
              value={farForm.live_born}
              onChange={(e) => setFarForm((s) => ({ ...s, live_born: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Stillborn</label>
            <input
              type="number"
              min={0}
              className="input w-full"
              value={farForm.stillborn}
              onChange={(e) => setFarForm((s) => ({ ...s, stillborn: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Mummified</label>
            <input
              type="number"
              min={0}
              className="input w-full"
              value={farForm.mummified}
              onChange={(e) => setFarForm((s) => ({ ...s, mummified: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Notes</label>
            <input
              className="input w-full"
              value={farForm.notes}
              onChange={(e) => setFarForm((s) => ({ ...s, notes: e.target.value }))}
            />
          </div>
        </div>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void saveFarrowing()}>
          Record farrowing
        </button>

        <div className="overflow-x-auto border border-gray-100 rounded-sm mt-4">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-600">
                <th className="p-2">Date</th>
                <th className="p-2">Live</th>
                <th className="p-2">Still</th>
                <th className="p-2">Mum.</th>
                <th className="p-2">Sow</th>
                <th className="p-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {farrowings.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="p-2 whitespace-nowrap">{r.farrowing_date}</td>
                  <td className="p-2">{r.live_born}</td>
                  <td className="p-2">{r.stillborn}</td>
                  <td className="p-2">{r.mummified}</td>
                  <td className="p-2 text-gray-600">{r.sow?.tag_number ?? '—'}</td>
                  <td className="p-2">
                    <button type="button" className="text-red-600" onClick={() => void removeFarrowing(r.id)}>
                      <Icon icon={faTrash} size="sm" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
