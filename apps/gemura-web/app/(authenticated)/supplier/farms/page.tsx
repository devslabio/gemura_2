'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { supplierOperationsApi, type ManagedFarm } from '@/lib/api/supplierOperations';
import { useToastStore } from '@/store/toast';

export default function SupplierFarmsPage() {
  const { currentAccount } = useAuthStore();
  const accountType = (currentAccount?.account_type || '').toLowerCase();
  const [farms, setFarms] = useState<ManagedFarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await supplierOperationsApi.getFarms();
      setFarms(res.data ?? []);
    } catch (e) {
      useToastStore.getState().error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load farms'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (!(accountType === 'supplier' || accountType === 'farmer')) {
    return <p className="text-sm text-gray-500">Only supplier/farmer accounts can access this page.</p>;
  }

  const onCreate = async () => {
    if (!name.trim()) return;
    try {
      await supplierOperationsApi.createFarm({ name: name.trim(), location: location.trim() || undefined });
      setName('');
      setLocation('');
      useToastStore.getState().success('Farm saved');
      await load();
    } catch (e) {
      useToastStore.getState().error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save farm'
      );
    }
  };

  const onDelete = async (id: string) => {
    try {
      await supplierOperationsApi.deleteFarm(id);
      useToastStore.getState().success('Farm removed');
      await load();
    } catch (e) {
      useToastStore.getState().error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to remove farm'
      );
    }
  };

  return (
    <div className="space-y-4 -mt-1">
      <div className="border-b-2 border-gray-200 pb-3">
        <h1 className="text-2xl font-semibold text-gray-900">Managed farms</h1>
        <p className="text-sm text-gray-600 mt-1">Farms where you collect milk, including your own farm.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Add farm</h2>
        <div className="grid sm:grid-cols-3 gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Farm name"
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (optional)"
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={onCreate}
            className="rounded bg-primary text-white px-4 py-2 text-sm font-medium"
          >
            Save
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Farm list</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : farms.length === 0 ? (
          <p className="text-sm text-gray-500">No farms yet.</p>
        ) : (
          <div className="space-y-2">
            {farms.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded border border-gray-200 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{f.name}</p>
                  <p className="text-xs text-gray-600">{f.location || 'No location'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(f.id)}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

