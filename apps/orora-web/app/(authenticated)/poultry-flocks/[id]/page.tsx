'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import {
  poultryFlocksApi,
  type FlockDailyRecord,
  type FlockMovement,
  type FlockMovementType,
  type PoultryFlock,
} from '@/lib/api/poultry-flocks';
import Icon, { faSpinner, faTrash } from '@/app/components/Icon';
import Select from '@/app/components/Select';

const MOVEMENT_TYPES: { value: FlockMovementType; label: string }[] = [
  { value: 'intake', label: 'Intake' },
  { value: 'sale', label: 'Sale' },
  { value: 'transfer_in', label: 'Transfer in' },
  { value: 'transfer_out', label: 'Transfer out' },
  { value: 'adjustment', label: 'Adjustment' },
];

export default function PoultryFlockDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const { currentAccount } = useAuthStore();
  const accountId = currentAccount?.account_id;

  const [flock, setFlock] = useState<PoultryFlock | null>(null);
  const [daily, setDaily] = useState<FlockDailyRecord[]>([]);
  const [movements, setMovements] = useState<FlockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [dailyForm, setDailyForm] = useState({
    record_date: '',
    eggs_collected: '',
    mortality_count: '',
    notes: '',
  });
  const [movForm, setMovForm] = useState({
    movement_date: '',
    type: '' as FlockMovementType | '',
    quantity: '',
    notes: '',
  });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!accountId || !id) return;
    setLoading(true);
    setError('');
    try {
      const [one, d, m] = await Promise.all([
        poultryFlocksApi.get(id, accountId),
        poultryFlocksApi.listDaily(id, accountId),
        poultryFlocksApi.listMovements(id, accountId),
      ]);
      if (one.code === 200) setFlock(one.data);
      if (d.code === 200) setDaily(d.data ?? []);
      if (m.code === 200) setMovements(m.data ?? []);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err?.response?.data?.message || err?.message || 'Failed to load flock');
    } finally {
      setLoading(false);
    }
  }, [accountId, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveDaily = async () => {
    if (!accountId || !dailyForm.record_date) return;
    setBusy(true);
    try {
      await poultryFlocksApi.upsertDaily(
        id,
        {
          record_date: dailyForm.record_date,
          eggs_collected: dailyForm.eggs_collected ? parseInt(dailyForm.eggs_collected, 10) : undefined,
          mortality_count: dailyForm.mortality_count ? parseInt(dailyForm.mortality_count, 10) : undefined,
          notes: dailyForm.notes.trim() || undefined,
        },
        accountId,
      );
      setDailyForm({ record_date: '', eggs_collected: '', mortality_count: '', notes: '' });
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err?.response?.data?.message || err?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const removeDaily = async (recordId: string) => {
    if (!accountId || !confirm('Remove this daily row?')) return;
    try {
      await poultryFlocksApi.deleteDaily(id, recordId, accountId);
      await load();
    } catch {
      setError('Could not delete row');
    }
  };

  const saveMovement = async () => {
    if (!accountId || !movForm.movement_date || !movForm.type || !movForm.quantity) return;
    const q = parseInt(movForm.quantity, 10);
    if (Number.isNaN(q)) return;
    setBusy(true);
    try {
      await poultryFlocksApi.addMovement(
        id,
        {
          movement_date: movForm.movement_date,
          type: movForm.type,
          quantity: q,
          notes: movForm.notes.trim() || undefined,
        },
        accountId,
      );
      setMovForm({ movement_date: '', type: '', quantity: '', notes: '' });
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err?.response?.data?.message || err?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/poultry-flocks" className="text-sm text-[var(--primary)] font-medium">
          ← Back to flocks
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 inline-flex items-center gap-2">
          <Icon icon={faSpinner} size="sm" className="animate-spin" /> Loading…
        </p>
      ) : flock ? (
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{flock.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {flock.farm?.name ?? 'No farm'} · {flock.current_head_count} birds current
          </p>
        </div>
      ) : (
        <p className="text-red-600 text-sm">Flock not found.</p>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-3 text-sm text-red-600">{error}</div>
      )}

      <section className="bg-white border border-gray-200 rounded-sm p-4 space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Daily records</h2>
        <p className="text-xs text-gray-500">Eggs collected and mortality per day (one row per date).</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 items-end">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Date</label>
            <input
              type="date"
              className="input w-full"
              value={dailyForm.record_date}
              onChange={(e) => setDailyForm((s) => ({ ...s, record_date: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Eggs</label>
            <input
              type="number"
              min={0}
              className="input w-full"
              value={dailyForm.eggs_collected}
              onChange={(e) => setDailyForm((s) => ({ ...s, eggs_collected: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Mortality</label>
            <input
              type="number"
              min={0}
              className="input w-full"
              value={dailyForm.mortality_count}
              onChange={(e) => setDailyForm((s) => ({ ...s, mortality_count: e.target.value }))}
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Notes</label>
            <input
              className="input w-full"
              value={dailyForm.notes}
              onChange={(e) => setDailyForm((s) => ({ ...s, notes: e.target.value }))}
            />
          </div>
        </div>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void saveDaily()}>
          Save day
        </button>

        <div className="overflow-x-auto border border-gray-100 rounded-sm mt-4">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-600">
                <th className="p-2">Date</th>
                <th className="p-2">Eggs</th>
                <th className="p-2">Mortality</th>
                <th className="p-2">Notes</th>
                <th className="p-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {daily.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="p-2 whitespace-nowrap">{r.record_date}</td>
                  <td className="p-2">{r.eggs_collected}</td>
                  <td className="p-2">{r.mortality_count}</td>
                  <td className="p-2 text-gray-600">{r.notes ?? '—'}</td>
                  <td className="p-2">
                    <button
                      type="button"
                      className="text-red-600"
                      aria-label="Delete"
                      onClick={() => void removeDaily(r.id)}
                    >
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
        <h2 className="text-base font-semibold text-gray-900">Movements (intake, sales, transfers)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Date</label>
            <input
              type="date"
              className="input w-full"
              value={movForm.movement_date}
              onChange={(e) => setMovForm((s) => ({ ...s, movement_date: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Type</label>
            <Select
              value={movForm.type}
              onChange={(type) => setMovForm((s) => ({ ...s, type: type as FlockMovementType }))}
              options={MOVEMENT_TYPES.map((o) => ({ value: o.value, label: o.label }))}
              placeholder="Type"
              allowEmpty
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Quantity</label>
            <input
              type="number"
              className="input w-full"
              value={movForm.quantity}
              onChange={(e) => setMovForm((s) => ({ ...s, quantity: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Notes</label>
            <input
              className="input w-full"
              value={movForm.notes}
              onChange={(e) => setMovForm((s) => ({ ...s, notes: e.target.value }))}
            />
          </div>
        </div>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void saveMovement()}>
          Record movement
        </button>

        <div className="overflow-x-auto border border-gray-100 rounded-sm mt-4">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-600">
                <th className="p-2">Date</th>
                <th className="p-2">Type</th>
                <th className="p-2">Qty</th>
                <th className="p-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="p-2 whitespace-nowrap">{r.movement_date}</td>
                  <td className="p-2">{r.type}</td>
                  <td className="p-2">{r.quantity}</td>
                  <td className="p-2 text-gray-600">{r.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
