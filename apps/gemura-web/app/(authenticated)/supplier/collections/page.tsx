'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { supplierOperationsApi, type ManagedCollection, type ManagedFarm } from '@/lib/api/supplierOperations';
import { useToastStore } from '@/store/toast';

export default function SupplierCollectionsPage() {
  const { currentAccount } = useAuthStore();
  const accountType = (currentAccount?.account_type || '').toLowerCase();
  const [farms, setFarms] = useState<ManagedFarm[]>([]);
  const [rows, setRows] = useState<ManagedCollection[]>([]);
  const [loading, setLoading] = useState(true);

  const [farmId, setFarmId] = useState('');
  const [sourceType, setSourceType] = useState<'own_farm' | 'external_farm'>('external_farm');
  const [liters, setLiters] = useState('');
  const [collectedAt, setCollectedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [grade, setGrade] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [f, c] = await Promise.all([supplierOperationsApi.getFarms(), supplierOperationsApi.getCollections()]);
      setFarms(f.data ?? []);
      setRows(c.data ?? []);
      if (!farmId && (f.data ?? []).length > 0) setFarmId((f.data ?? [])[0].id);
    } catch (e) {
      useToastStore.getState().error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load collections'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const farmNameById = useMemo(
    () => Object.fromEntries(farms.map((f) => [f.id, f.name])),
    [farms]
  );

  if (!(accountType === 'supplier' || accountType === 'farmer')) {
    return <p className="text-sm text-gray-500">Only supplier/farmer accounts can access this page.</p>;
  }

  const onCreate = async () => {
    const l = Number(liters);
    if (!farmId || Number.isNaN(l) || l <= 0) {
      useToastStore.getState().error('Pick a farm and valid liters');
      return;
    }
    try {
      await supplierOperationsApi.createCollection({
        farm_id: farmId,
        farm_name: farmNameById[farmId] || '',
        source_type: sourceType,
        liters: l,
        collected_at: new Date(collectedAt).toISOString(),
        quality_grade: grade || undefined,
      });
      setLiters('');
      setGrade('');
      useToastStore.getState().success('Collection saved');
      await load();
    } catch (e) {
      useToastStore.getState().error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save collection'
      );
    }
  };

  return (
    <div className="space-y-4 -mt-1">
      <div className="border-b-2 border-gray-200 pb-3">
        <h1 className="text-2xl font-semibold text-gray-900">Collections</h1>
        <p className="text-sm text-gray-600 mt-1">Record liters from your own farm and other farms you collect from.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Add collection</h2>
        <div className="grid sm:grid-cols-5 gap-2">
          <select value={farmId} onChange={(e) => setFarmId(e.target.value)} className="rounded border border-gray-300 px-2 py-2 text-sm">
            {farms.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <select value={sourceType} onChange={(e) => setSourceType(e.target.value as 'own_farm' | 'external_farm')} className="rounded border border-gray-300 px-2 py-2 text-sm">
            <option value="own_farm">Own farm</option>
            <option value="external_farm">Collected from others</option>
          </select>
          <input value={liters} onChange={(e) => setLiters(e.target.value)} placeholder="Liters" type="number" className="rounded border border-gray-300 px-3 py-2 text-sm" />
          <input value={collectedAt} onChange={(e) => setCollectedAt(e.target.value)} type="datetime-local" className="rounded border border-gray-300 px-3 py-2 text-sm" />
          <button type="button" onClick={onCreate} className="rounded bg-primary text-white px-4 py-2 text-sm font-medium">Save</button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Recent records</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500">No collection records yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200 text-xs uppercase text-gray-500">
                  <th className="py-2 pr-3">Farm</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Liters</th>
                  <th className="py-2 pr-3">Transferred</th>
                  <th className="py-2 pr-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice().reverse().map((r) => (
                  <tr key={r.id} className="border-b border-gray-100">
                    <td className="py-2 pr-3">{r.farm_name || farmNameById[r.farm_id] || '—'}</td>
                    <td className="py-2 pr-3">{r.source_type === 'own_farm' ? 'Own' : 'External'}</td>
                    <td className="py-2 pr-3">{Number(r.liters || 0).toFixed(1)}</td>
                    <td className="py-2 pr-3">{r.transferred ? 'Yes' : 'No'}</td>
                    <td className="py-2 pr-3">{new Date(r.collected_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

