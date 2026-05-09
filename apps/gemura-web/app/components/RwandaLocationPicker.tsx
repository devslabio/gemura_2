'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '@/lib/api/client';

type LocationNode = {
  id: string;
  name: string;
  location_type: string;
  parent_id: string | null;
};

type LocationsResponse = {
  code: number;
  status: string;
  message?: string;
  data: LocationNode[];
};

export type RwandaLocationValue = {
  province?: LocationNode | null;
  district?: LocationNode | null;
  sector?: LocationNode | null;
  cell?: LocationNode | null;
  village?: LocationNode | null;
};

export default function RwandaLocationPicker({
  value,
  onChange,
  disabled = false,
  required = false,
}: {
  value: RwandaLocationValue;
  onChange: (next: RwandaLocationValue) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  const baseUrl = apiClient.instance.defaults.baseURL || '';
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [provinces, setProvinces] = useState<LocationNode[]>([]);
  const [districts, setDistricts] = useState<LocationNode[]>([]);
  const [sectors, setSectors] = useState<LocationNode[]>([]);
  const [cells, setCells] = useState<LocationNode[]>([]);
  const [villages, setVillages] = useState<LocationNode[]>([]);

  const selectedProvinceId = value.province?.id || '';
  const selectedDistrictId = value.district?.id || '';
  const selectedSectorId = value.sector?.id || '';
  const selectedCellId = value.cell?.id || '';
  const selectedVillageId = value.village?.id || '';

  const provinceRef = useRef('');
  const districtRef = useRef('');
  const sectorRef = useRef('');
  const cellRef = useRef('');

  const toOptions = (nodes: LocationNode[]) =>
    (nodes || []).map((n) => ({ id: String(n.id), label: String(n.name) }));

  const provinceOptions = useMemo(() => toOptions(provinces), [provinces]);
  const districtOptions = useMemo(() => toOptions(districts), [districts]);
  const sectorOptions = useMemo(() => toOptions(sectors), [sectors]);
  const cellOptions = useMemo(() => toOptions(cells), [cells]);
  const villageOptions = useMemo(() => toOptions(villages), [villages]);

  useEffect(() => {
    let cancelled = false;
    const loadProvinces = async () => {
      setLoading(true);
      setError('');
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('gemura-auth-token') : null;
        const res = await fetch(`${baseUrl}/locations/provinces`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('Failed to load provinces.');
        const payload = (await res.json()) as LocationsResponse;
        if (cancelled) return;
        setProvinces(payload.data || []);
      } catch (e) {
        if (!cancelled) setError((e as Error)?.message || 'Failed to load provinces.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (baseUrl) loadProvinces();
    return () => {
      cancelled = true;
    };
  }, [baseUrl]);

  const loadChildren = async (parentId: string): Promise<LocationNode[]> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('gemura-auth-token') : null;
    const res = await fetch(`${baseUrl}/locations?parent_id=${encodeURIComponent(parentId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to load locations.');
    const payload = (await res.json()) as LocationsResponse;
    return payload.data || [];
  };

  const handleProvince = async (provinceId: string) => {
    provinceRef.current = provinceId;
    districtRef.current = '';
    sectorRef.current = '';
    cellRef.current = '';
    const province = provinces.find((p) => p.id === provinceId) || null;
    onChange({ province, district: null, sector: null, cell: null, village: null });
    setDistricts([]);
    setSectors([]);
    setCells([]);
    setVillages([]);
    if (!provinceId) return;
    try {
      const children = await loadChildren(provinceId);
      if (provinceRef.current !== provinceId) return;
      setDistricts(children);
      setError('');
    } catch (e) {
      setError((e as Error)?.message || 'Failed to load districts.');
    }
  };

  const handleDistrict = async (districtId: string) => {
    districtRef.current = districtId;
    sectorRef.current = '';
    cellRef.current = '';
    const district = districts.find((d) => d.id === districtId) || null;
    onChange({ ...value, district, sector: null, cell: null, village: null });
    setSectors([]);
    setCells([]);
    setVillages([]);
    if (!districtId) return;
    try {
      const children = await loadChildren(districtId);
      if (districtRef.current !== districtId) return;
      setSectors(children);
      setError('');
    } catch (e) {
      setError((e as Error)?.message || 'Failed to load sectors.');
    }
  };

  const handleSector = async (sectorId: string) => {
    sectorRef.current = sectorId;
    cellRef.current = '';
    const sector = sectors.find((s) => s.id === sectorId) || null;
    onChange({ ...value, sector, cell: null, village: null });
    setCells([]);
    setVillages([]);
    if (!sectorId) return;
    try {
      const children = await loadChildren(sectorId);
      if (sectorRef.current !== sectorId) return;
      setCells(children);
      setError('');
    } catch (e) {
      setError((e as Error)?.message || 'Failed to load cells.');
    }
  };

  const handleCell = async (cellId: string) => {
    cellRef.current = cellId;
    const cell = cells.find((c) => c.id === cellId) || null;
    onChange({ ...value, cell, village: null });
    setVillages([]);
    if (!cellId) return;
    try {
      const children = await loadChildren(cellId);
      if (cellRef.current !== cellId) return;
      setVillages(children);
      setError('');
    } catch (e) {
      setError((e as Error)?.message || 'Failed to load villages.');
    }
  };

  const handleVillage = (villageId: string) => {
    const village = villages.find((v) => v.id === villageId) || null;
    onChange({ ...value, village });
  };

  return (
    <div className="space-y-3">
      {error ? <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</div> : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Province{required ? ' *' : ''}</label>
          <select className="input w-full" value={selectedProvinceId} onChange={(e) => handleProvince(e.target.value)} disabled={disabled || loading}>
            <option value="">{loading ? 'Loading…' : 'Select province'}</option>
            {provinceOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">District{required ? ' *' : ''}</label>
          <select className="input w-full" value={selectedDistrictId} onChange={(e) => handleDistrict(e.target.value)} disabled={disabled || !selectedProvinceId}>
            <option value="">{selectedProvinceId ? 'Select district' : 'Select province first'}</option>
            {districtOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sector</label>
          <select className="input w-full" value={selectedSectorId} onChange={(e) => handleSector(e.target.value)} disabled={disabled || !selectedDistrictId}>
            <option value="">{selectedDistrictId ? 'Select sector' : 'Select district first'}</option>
            {sectorOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cell</label>
          <select className="input w-full" value={selectedCellId} onChange={(e) => handleCell(e.target.value)} disabled={disabled || !selectedSectorId}>
            <option value="">{selectedSectorId ? 'Select cell' : 'Select sector first'}</option>
            {cellOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Village</label>
          <select className="input w-full" value={selectedVillageId} onChange={(e) => handleVillage(e.target.value)} disabled={disabled || !selectedCellId}>
            <option value="">{selectedCellId ? 'Select village' : 'Select cell first'}</option>
            {villageOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

