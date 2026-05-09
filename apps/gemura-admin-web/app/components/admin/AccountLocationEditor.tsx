'use client';

import { useEffect, useRef, useState } from 'react';

import { adminApi } from '@/lib/api/admin';
import { locationsApi, type Location } from '@/lib/api/locations';

export default function AccountLocationEditor({
  initialLocationId,
  onCancel,
  onSaved,
  accountId,
  adminAccountId,
}: {
  initialLocationId: string | null;
  onCancel: () => void;
  onSaved: () => void;
  accountId: string;
  adminAccountId: string | undefined;
}) {
  const [provinces, setProvinces] = useState<Location[]>([]);
  const [districts, setDistricts] = useState<Location[]>([]);
  const [sectors, setSectors] = useState<Location[]>([]);
  const [cells, setCells] = useState<Location[]>([]);
  const [villages, setVillages] = useState<Location[]>([]);
  const [provinceId, setProvinceId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [cellId, setCellId] = useState('');
  const [villageId, setVillageId] = useState('');
  const [loadingPath, setLoadingPath] = useState(!!initialLocationId);
  const restoringPathRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    locationsApi.getProvinces().then((r) => setProvinces(Array.isArray(r?.data) ? r.data : [])).catch(() => setProvinces([]));
  }, []);

  useEffect(() => {
    if (!initialLocationId) return;
    setLoadingPath(true);
    restoringPathRef.current = true;
    locationsApi
      .getPath(initialLocationId)
      .then(async (res) => {
        const path = Array.isArray(res?.data) ? res.data : [];
        const prov = path.find((p) => p.location_type === 'PROVINCE');
        const dist = path.find((p) => p.location_type === 'DISTRICT');
        const sec = path.find((p) => p.location_type === 'SECTOR');
        const cell = path.find((p) => p.location_type === 'CELL');
        const vill = path.find((p) => p.location_type === 'VILLAGE');
        if (prov) setProvinceId(prov.id);
        if (dist && prov) {
          const r = await locationsApi.getChildren(prov.id);
          setDistricts(Array.isArray(r?.data) ? r.data : []);
          setDistrictId(dist.id);
        }
        if (sec && dist) {
          const r = await locationsApi.getChildren(dist.id);
          setSectors(Array.isArray(r?.data) ? r.data : []);
          setSectorId(sec.id);
        }
        if (cell && sec) {
          const r = await locationsApi.getChildren(sec.id);
          setCells(Array.isArray(r?.data) ? r.data : []);
          setCellId(cell.id);
        }
        if (vill && cell) {
          const r = await locationsApi.getChildren(cell.id);
          setVillages(Array.isArray(r?.data) ? r.data : []);
          setVillageId(vill.id);
        }
      })
      .finally(() => {
        setLoadingPath(false);
        setTimeout(() => {
          restoringPathRef.current = false;
        }, 0);
      });
  }, [initialLocationId]);

  useEffect(() => {
    if (restoringPathRef.current) return;
    if (!provinceId) {
      setDistricts([]);
      setDistrictId('');
      setSectorId('');
      setSectors([]);
      setCellId('');
      setCells([]);
      setVillageId('');
      setVillages([]);
      return;
    }
    locationsApi.getChildren(provinceId).then((r) => setDistricts(Array.isArray(r?.data) ? r.data : [])).catch(() => setDistricts([]));
    setDistrictId('');
    setSectorId('');
    setSectors([]);
    setCellId('');
    setCells([]);
    setVillageId('');
    setVillages([]);
  }, [provinceId]);

  useEffect(() => {
    if (restoringPathRef.current) return;
    if (!districtId) {
      setSectors([]);
      setSectorId('');
      setCellId('');
      setCells([]);
      setVillageId('');
      setVillages([]);
      return;
    }
    locationsApi.getChildren(districtId).then((r) => setSectors(Array.isArray(r?.data) ? r.data : [])).catch(() => setSectors([]));
    setSectorId('');
    setCellId('');
    setCells([]);
    setVillageId('');
    setVillages([]);
  }, [districtId]);

  useEffect(() => {
    if (restoringPathRef.current) return;
    if (!sectorId) {
      setCells([]);
      setCellId('');
      setVillageId('');
      setVillages([]);
      return;
    }
    locationsApi.getChildren(sectorId).then((r) => setCells(Array.isArray(r?.data) ? r.data : [])).catch(() => setCells([]));
    setCellId('');
    setVillageId('');
    setVillages([]);
  }, [sectorId]);

  useEffect(() => {
    if (restoringPathRef.current) return;
    if (!cellId) {
      setVillages([]);
      setVillageId('');
      return;
    }
    locationsApi.getChildren(cellId).then((r) => setVillages(Array.isArray(r?.data) ? r.data : [])).catch(() => setVillages([]));
    setVillageId('');
  }, [cellId]);

  const handleSave = async () => {
    setError('');
    if (!villageId) {
      setError('Select a village (full path province → village).');
      return;
    }
    setSaving(true);
    try {
      const res = await adminApi.updateTenantAccountOperationalLocation(adminAccountId, accountId, {
        operational_location_id: villageId,
      });
      if (res.code === 200) {
        onSaved();
      } else {
        setError(res.message || 'Failed to save');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await adminApi.updateTenantAccountOperationalLocation(adminAccountId, accountId, {
        operational_location_id: null,
      });
      if (res.code === 200) onSaved();
      else setError(res.message || 'Failed to clear');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to clear');
    } finally {
      setSaving(false);
    }
  };

  const selectCls =
    'w-full rounded-sm border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30';

  return (
    <div className="space-y-4">
      {error ? <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-sm p-3">{error}</div> : null}
      {loadingPath ? <p className="text-sm text-gray-500">Loading location…</p> : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Province</label>
          <select className={selectCls} value={provinceId} onChange={(e) => setProvinceId(e.target.value)}>
            <option value="">—</option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">District</label>
          <select className={selectCls} value={districtId} onChange={(e) => setDistrictId(e.target.value)} disabled={!provinceId}>
            <option value="">—</option>
            {districts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Sector</label>
          <select className={selectCls} value={sectorId} onChange={(e) => setSectorId(e.target.value)} disabled={!districtId}>
            <option value="">—</option>
            {sectors.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Cell</label>
          <select className={selectCls} value={cellId} onChange={(e) => setCellId(e.target.value)} disabled={!sectorId}>
            <option value="">—</option>
            {cells.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Village (required)</label>
          <select className={selectCls} value={villageId} onChange={(e) => setVillageId(e.target.value)} disabled={!cellId}>
            <option value="">—</option>
            {villages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-gray-100">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="button" className="btn btn-secondary" onClick={handleClear} disabled={saving || loadingPath}>
          Clear location
        </button>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || loadingPath}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
