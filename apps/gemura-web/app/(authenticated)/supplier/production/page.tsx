'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { supplierOperationsApi, type ManagedCollection, type ManagedProduction } from '@/lib/api/supplierOperations';
import { useToastStore } from '@/store/toast';

export default function SupplierProductionPage() {
  const { currentAccount } = useAuthStore();
  const accountType = (currentAccount?.account_type || '').toLowerCase();
  const [production, setProduction] = useState<ManagedProduction[]>([]);
  const [collections, setCollections] = useState<ManagedCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [liters, setLiters] = useState('');
  const [producedAt, setProducedAt] = useState(() => new Date().toISOString().slice(0, 16));

  const load = async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([supplierOperationsApi.getProduction(), supplierOperationsApi.getCollections()]);
      setProduction(p.data ?? []);
      setCollections(c.data ?? []);
    } catch (e) {
      useToastStore.getState().error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load production'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const ownProduced = useMemo(() => production.reduce((a, p) => a + Number(p.liters || 0), 0), [production]);
  const ownCollected = useMemo(
    () =>
      collections
        .filter((c) => c.source_type === 'own_farm')
        .reduce((a, c) => a + Number(c.liters || 0), 0),
    [collections]
  );

  if (!(accountType === 'supplier' || accountType === 'farmer')) {
    return <p className="text-sm text-gray-500">Only supplier/farmer accounts can access this page.</p>;
  }

  const onCreate = async () => {
    const l = Number(liters);
    if (Number.isNaN(l) || l <= 0) {
      useToastStore.getState().error('Enter valid liters');
      return;
    }
    try {
      await supplierOperationsApi.createProduction({ liters: l, produced_at: new Date(producedAt).toISOString() });
      setLiters('');
      useToastStore.getState().success('Production saved');
      await load();
    } catch (e) {
      useToastStore.getState().error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save production'
      );
    }
  };

  return (
    <div className="space-y-4 -mt-1">
      <div className="border-b-2 border-gray-200 pb-3">
        <h1 className="text-2xl font-semibold text-gray-900">Own production</h1>
        <p className="text-sm text-gray-600 mt-1">Track your own production versus own-farm collections.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <div className="text-xs font-medium text-gray-500 uppercase">Produced (own)</div>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{ownProduced.toFixed(1)} L</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <div className="text-xs font-medium text-gray-500 uppercase">Collected (own source)</div>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{ownCollected.toFixed(1)} L</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <div className="text-xs font-medium text-gray-500 uppercase">Variance</div>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{(ownProduced - ownCollected).toFixed(1)} L</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Log production</h2>
        <div className="grid sm:grid-cols-3 gap-2">
          <input value={liters} onChange={(e) => setLiters(e.target.value)} type="number" placeholder="Liters" className="rounded border border-gray-300 px-3 py-2 text-sm" />
          <input value={producedAt} onChange={(e) => setProducedAt(e.target.value)} type="datetime-local" className="rounded border border-gray-300 px-3 py-2 text-sm" />
          <button type="button" onClick={onCreate} className="rounded bg-primary text-white px-4 py-2 text-sm font-medium">Save</button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">History</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : production.length === 0 ? (
          <p className="text-sm text-gray-500">No production records yet.</p>
        ) : (
          <div className="space-y-2">
            {production
              .slice()
              .reverse()
              .map((p) => (
                <div key={p.id} className="flex items-center justify-between border border-gray-200 rounded px-3 py-2 text-sm">
                  <span>{new Date(p.produced_at).toLocaleString()}</span>
                  <span className="font-semibold">{Number(p.liters || 0).toFixed(1)} L</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

