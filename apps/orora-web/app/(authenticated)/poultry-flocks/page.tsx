'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { useFarmStore } from '@/store/farms';
import { poultryFlocksApi, type PoultryFlock } from '@/lib/api/poultry-flocks';
import { speciesApi } from '@/lib/api/species';
import { breedsApi } from '@/lib/api/breeds';
import Modal from '@/app/components/Modal';
import Icon, { faPlus, faSpinner, faEye } from '@/app/components/Icon';
import Select from '@/app/components/Select';

export default function PoultryFlocksPage() {
  const { currentAccount } = useAuthStore();
  const accountId = currentAccount?.account_id;
  const farmsByAccount = useFarmStore((s) => s.farmsByAccount);
  const selectedFarmByAccount = useFarmStore((s) => s.selectedFarmByAccount);
  const farms = accountId ? farmsByAccount[accountId] || [] : [];
  const selectedFarmId = accountId ? selectedFarmByAccount[accountId] ?? null : null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<PoultryFlock[]>([]);
  const [open, setOpen] = useState(false);
  const [poultrySpeciesId, setPoultrySpeciesId] = useState('');
  const [breedOptions, setBreedOptions] = useState<{ value: string; label: string }[]>([]);
  const [form, setForm] = useState({
    name: '',
    farm_id: '',
    breed_id: '',
    started_at: '',
    opening_head_count: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError('');
    try {
      const res = await poultryFlocksApi.list(accountId, selectedFarmId || undefined);
      if (res.code === 200) setRows(res.data ?? []);
      else setError(res.message || 'Failed to load flocks');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err?.response?.data?.message || err?.message || 'Failed to load flocks');
    } finally {
      setLoading(false);
    }
  }, [accountId, selectedFarmId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    speciesApi
      .getList()
      .then((res) => {
        const poultry = res.data?.find((s) => s.code === 'poultry');
        setPoultrySpeciesId(poultry?.id ?? '');
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!poultrySpeciesId) {
      setBreedOptions([]);
      return;
    }
    breedsApi
      .getList(poultrySpeciesId)
      .then((res) => {
        setBreedOptions((res.data ?? []).map((b) => ({ value: b.id, label: b.name })));
      })
      .catch(() => setBreedOptions([]));
  }, [poultrySpeciesId]);

  const createFlock = async () => {
    if (!accountId || !form.name.trim() || !form.started_at || !form.opening_head_count) return;
    const opening = parseInt(form.opening_head_count, 10);
    if (Number.isNaN(opening)) {
      setError('Opening head count must be a number');
      return;
    }
    setSaving(true);
    try {
      await poultryFlocksApi.create(
        {
          name: form.name.trim(),
          farm_id: form.farm_id || undefined,
          breed_id: form.breed_id || undefined,
          started_at: form.started_at,
          opening_head_count: opening,
          notes: form.notes.trim() || undefined,
        },
        accountId,
      );
      setOpen(false);
      setForm({
        name: '',
        farm_id: '',
        breed_id: '',
        started_at: '',
        opening_head_count: '',
        notes: '',
      });
      setError('');
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err?.response?.data?.message || err?.message || 'Failed to create flock');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Poultry flocks</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Daily eggs, mortality, and batch intake per flock
            {selectedFarmId ? ' (filtered by selected farm)' : ''}.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          <Icon icon={faPlus} size="sm" className="mr-2" />
          Add flock
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-3 text-sm text-red-600">{error}</div>
      )}

      <div className="bg-white border border-gray-200 rounded-sm">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-base font-semibold text-gray-900">Flocks</h2>
          {loading && (
            <span className="inline-flex items-center text-xs text-gray-500">
              <Icon icon={faSpinner} size="sm" className="mr-1 animate-spin" />
              Loading
            </span>
          )}
        </div>
        <div className="divide-y divide-gray-100">
          {rows.length === 0 && !loading ? (
            <div className="p-6 text-sm text-gray-500">No flocks yet.</div>
          ) : (
            rows.map((f) => (
              <div key={f.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-gray-900">{f.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {f.farm?.name ?? 'No farm'} · {f.current_head_count} birds
                    {f.breed?.name ? ` · ${f.breed.name}` : ''}
                  </div>
                </div>
                <Link
                  href={`/poultry-flocks/${f.id}`}
                  className="inline-flex items-center text-sm text-[var(--primary)] font-medium"
                >
                  <Icon icon={faEye} size="sm" className="mr-1" />
                  Open
                </Link>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New flock" maxWidth="max-w-lg">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              className="input w-full"
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              placeholder="e.g. Layer house A"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Farm</label>
            <Select
              value={form.farm_id}
              onChange={(farm_id) => setForm((s) => ({ ...s, farm_id }))}
              options={farms.map((x) => ({ value: x.id, label: x.name }))}
              placeholder="Optional"
              allowEmpty
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Breed</label>
            <Select
              value={form.breed_id}
              onChange={(breed_id) => setForm((s) => ({ ...s, breed_id }))}
              options={breedOptions}
              placeholder="Poultry breed"
              allowEmpty
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start date *</label>
            <input
              type="date"
              className="input w-full"
              value={form.started_at}
              onChange={(e) => setForm((s) => ({ ...s, started_at: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Opening head count *</label>
            <input
              type="number"
              min={0}
              className="input w-full"
              value={form.opening_head_count}
              onChange={(e) => setForm((s) => ({ ...s, opening_head_count: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              className="input w-full min-h-[72px]"
              value={form.notes}
              onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void createFlock()}>
              {saving && <Icon icon={faSpinner} size="sm" className="mr-2 animate-spin" />}
              Save
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
