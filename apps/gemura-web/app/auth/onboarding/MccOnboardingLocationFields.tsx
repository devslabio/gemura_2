'use client';

import { useEffect, useRef, useState } from 'react';
import { locationsApi, type Location } from '@/lib/api/locations';

export type MccOnboardingLocationIds = {
  provinceId: string;
  districtId: string;
  sectorId: string;
  cellId: string;
  villageId: string;
};

export type MccOnboardingLocationLabels = {
  province: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
};

type Props = {
  value: MccOnboardingLocationIds;
  onChange: (next: MccOnboardingLocationIds & MccOnboardingLocationLabels) => void;
  onError?: (message: string) => void;
};

function pick(list: Location[], id: string) {
  return list.find((x) => x.id === id);
}

function labelsFromChain(
  p?: Location,
  d?: Location,
  s?: Location,
  c?: Location,
  v?: Location,
): MccOnboardingLocationLabels {
  return {
    province: p?.name ?? '',
    district: d?.name ?? '',
    sector: s?.name ?? '',
    cell: c?.name ?? '',
    village: v?.name ?? '',
  };
}

/**
 * MCC onboarding location cascade — API only, no synthetic Central/East/West fallbacks.
 */
export function MccOnboardingLocationFields({ value, onChange, onError }: Props) {
  const onChangeRef = useRef(onChange);
  const onErrorRef = useRef(onError);
  onChangeRef.current = onChange;
  onErrorRef.current = onError;

  const [provinces, setProvinces] = useState<Location[]>([]);
  const [districts, setDistricts] = useState<Location[]>([]);
  const [sectors, setSectors] = useState<Location[]>([]);
  const [cells, setCells] = useState<Location[]>([]);
  const [villages, setVillages] = useState<Location[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(true);
  const [loadingPath, setLoadingPath] = useState(false);
  const [childLoading, setChildLoading] = useState<'district' | 'sector' | 'cell' | 'village' | null>(null);
  const restoringRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingProvinces(true);
    locationsApi
      .getProvincesPublic()
      .then((r) => {
        if (cancelled) return;
        const list = Array.isArray(r?.data) ? r.data : [];
        setProvinces(list);
        if (list.length === 0) {
          onErrorRef.current?.(
            'Location data is not available. Ask your administrator to import the Rwanda location hierarchy.',
          );
        } else {
          onErrorRef.current?.('');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProvinces([]);
          onErrorRef.current?.('Could not load provinces. Check your connection and try again.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingProvinces(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const vid = value.villageId?.trim();
    if (!vid || loadingProvinces || provinces.length === 0) return;
    let cancelled = false;
    restoringRef.current = true;
    setLoadingPath(true);
    locationsApi
      .getPathPublic(vid)
      .then(async (res) => {
        const path = Array.isArray(res?.data) ? res.data : [];
        const prov = path.find((x) => x.location_type === 'PROVINCE');
        const dist = path.find((x) => x.location_type === 'DISTRICT');
        const sec = path.find((x) => x.location_type === 'SECTOR');
        const cell = path.find((x) => x.location_type === 'CELL');
        const vill = path.find((x) => x.location_type === 'VILLAGE');
        if (cancelled || !prov || !dist || !sec || !cell || !vill) return;

        const dr = await locationsApi.getChildrenPublic(prov.id);
        const dlist = Array.isArray(dr?.data) ? dr.data : [];
        const sr = await locationsApi.getChildrenPublic(dist.id);
        const slist = Array.isArray(sr?.data) ? sr.data : [];
        const cr = await locationsApi.getChildrenPublic(sec.id);
        const clist = Array.isArray(cr?.data) ? cr.data : [];
        const vr = await locationsApi.getChildrenPublic(cell.id);
        const vlist = Array.isArray(vr?.data) ? vr.data : [];

        if (cancelled) return;
        setDistricts(dlist);
        setSectors(slist);
        setCells(clist);
        setVillages(vlist);

        const pNode = pick(provinces, prov.id) ?? ({ id: prov.id, name: prov.name } as Location);
        const dNode = pick(dlist, dist.id) ?? ({ id: dist.id, name: dist.name } as Location);
        const sNode = pick(slist, sec.id) ?? ({ id: sec.id, name: sec.name } as Location);
        const cNode = pick(clist, cell.id) ?? ({ id: cell.id, name: cell.name } as Location);
        const vNode = pick(vlist, vill.id) ?? ({ id: vill.id, name: vill.name } as Location);

        onChangeRef.current({
          provinceId: prov.id,
          districtId: dist.id,
          sectorId: sec.id,
          cellId: cell.id,
          villageId: vill.id,
          ...labelsFromChain(pNode, dNode, sNode, cNode, vNode),
        });
      })
      .catch(() => {
        if (!cancelled) onErrorRef.current?.('Could not restore saved location.');
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingPath(false);
          setTimeout(() => {
            restoringRef.current = false;
          }, 0);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [value.villageId, loadingProvinces, provinces]);

  /** Hydrate child dropdowns when a saved draft has parent IDs but lists are still empty. */
  useEffect(() => {
    if (loadingProvinces || loadingPath || value.villageId?.trim()) return;
    let cancelled = false;

    const hydrate = async () => {
      if (value.provinceId && districts.length === 0) {
        const p = pick(provinces, value.provinceId);
        if (!p) return;
        const r = await locationsApi.getChildrenPublic(value.provinceId);
        if (cancelled) return;
        setDistricts(Array.isArray(r?.data) ? r.data : []);
      }
      if (value.districtId && sectors.length === 0) {
        const r = await locationsApi.getChildrenPublic(value.districtId);
        if (cancelled) return;
        setSectors(Array.isArray(r?.data) ? r.data : []);
      }
      if (value.sectorId && cells.length === 0) {
        const r = await locationsApi.getChildrenPublic(value.sectorId);
        if (cancelled) return;
        setCells(Array.isArray(r?.data) ? r.data : []);
      }
      if (value.cellId && villages.length === 0) {
        const r = await locationsApi.getChildrenPublic(value.cellId);
        if (cancelled) return;
        setVillages(Array.isArray(r?.data) ? r.data : []);
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [
    loadingProvinces,
    loadingPath,
    value.provinceId,
    value.districtId,
    value.sectorId,
    value.cellId,
    value.villageId,
    provinces,
    districts.length,
    sectors.length,
    cells.length,
    villages.length,
  ]);

  const loadChildren = async (
    parentId: string,
    level: 'district' | 'sector' | 'cell' | 'village',
    parentLabel: string,
  ): Promise<Location[]> => {
    setChildLoading(level);
    try {
      const r = await locationsApi.getChildrenPublic(parentId);
      const list = Array.isArray(r?.data) ? r.data : [];
      if (list.length === 0) {
        const levelLabel =
          level === 'district' ? 'districts' : level === 'sector' ? 'sectors' : level === 'cell' ? 'cells' : 'villages';
        onErrorRef.current?.(
          `No ${levelLabel} found under “${parentLabel}”. Import the full Rwanda location hierarchy in the database.`,
        );
      } else {
        onErrorRef.current?.('');
      }
      return list;
    } catch {
      onErrorRef.current?.(`Could not load ${level}s. Check your connection and try again.`);
      return [];
    } finally {
      setChildLoading(null);
    }
  };

  const onProvinceChange = async (provinceId: string) => {
    if (restoringRef.current) return;
    const p = pick(provinces, provinceId);
    if (!provinceId || !p) {
      setDistricts([]);
      setSectors([]);
      setCells([]);
      setVillages([]);
      onChangeRef.current({
        provinceId: '',
        districtId: '',
        sectorId: '',
        cellId: '',
        villageId: '',
        province: '',
        district: '',
        sector: '',
        cell: '',
        village: '',
      });
      return;
    }
    const dlist = await loadChildren(provinceId, 'district', p.name);
    setDistricts(dlist);
    setSectors([]);
    setCells([]);
    setVillages([]);
    onChangeRef.current({
      provinceId,
      districtId: '',
      sectorId: '',
      cellId: '',
      villageId: '',
      ...labelsFromChain(p),
    });
  };

  const onDistrictChange = async (districtId: string) => {
    if (restoringRef.current) return;
    const p = pick(provinces, value.provinceId);
    const d = pick(districts, districtId);
    if (!p || !districtId || !d) {
      setSectors([]);
      setCells([]);
      setVillages([]);
      onChangeRef.current({
        ...value,
        districtId: '',
        sectorId: '',
        cellId: '',
        villageId: '',
        province: p?.name ?? '',
        district: '',
        sector: '',
        cell: '',
        village: '',
      });
      return;
    }
    const slist = await loadChildren(districtId, 'sector', d.name);
    setSectors(slist);
    setCells([]);
    setVillages([]);
    onChangeRef.current({
      provinceId: value.provinceId,
      districtId,
      sectorId: '',
      cellId: '',
      villageId: '',
      ...labelsFromChain(p, d),
    });
  };

  const onSectorChange = async (sectorId: string) => {
    if (restoringRef.current) return;
    const p = pick(provinces, value.provinceId);
    const d = pick(districts, value.districtId);
    const s = pick(sectors, sectorId);
    if (!p || !d || !sectorId || !s) {
      setCells([]);
      setVillages([]);
      onChangeRef.current({
        ...value,
        sectorId: '',
        cellId: '',
        villageId: '',
        province: p?.name ?? '',
        district: d?.name ?? '',
        sector: '',
        cell: '',
        village: '',
      });
      return;
    }
    const clist = await loadChildren(sectorId, 'cell', s.name);
    setCells(clist);
    setVillages([]);
    onChangeRef.current({
      provinceId: value.provinceId,
      districtId: value.districtId,
      sectorId,
      cellId: '',
      villageId: '',
      ...labelsFromChain(p, d, s),
    });
  };

  const onCellChange = async (cellId: string) => {
    if (restoringRef.current) return;
    const p = pick(provinces, value.provinceId);
    const d = pick(districts, value.districtId);
    const s = pick(sectors, value.sectorId);
    const c = pick(cells, cellId);
    if (!p || !d || !s || !cellId || !c) {
      setVillages([]);
      onChangeRef.current({
        ...value,
        cellId: '',
        villageId: '',
        province: p?.name ?? '',
        district: d?.name ?? '',
        sector: s?.name ?? '',
        cell: '',
        village: '',
      });
      return;
    }
    const vlist = await loadChildren(cellId, 'village', c.name);
    setVillages(vlist);
    onChangeRef.current({
      provinceId: value.provinceId,
      districtId: value.districtId,
      sectorId: value.sectorId,
      cellId,
      villageId: '',
      ...labelsFromChain(p, d, s, c),
    });
  };

  const onVillageChange = (villageId: string) => {
    if (restoringRef.current) return;
    const p = pick(provinces, value.provinceId);
    const d = pick(districts, value.districtId);
    const s = pick(sectors, value.sectorId);
    const c = pick(cells, value.cellId);
    const v = pick(villages, villageId);
    if (!p || !d || !s || !c) return;
    onChangeRef.current({
      provinceId: value.provinceId,
      districtId: value.districtId,
      sectorId: value.sectorId,
      cellId: value.cellId,
      villageId,
      ...labelsFromChain(p, d, s, c, v),
    });
  };

  if (loadingProvinces) {
    return (
      <div className="md:col-span-2 text-sm text-gray-600 py-2" role="status">
        Loading locations…
      </div>
    );
  }

  const selectClass = 'input w-full py-3 text-base';
  const disabledChild = childLoading !== null;

  return (
    <>
      {loadingPath && (
        <p className="md:col-span-2 text-sm text-gray-600" role="status">
          Resolving saved location…
        </p>
      )}
      <div>
        <label htmlFor="mcc-onb-province" className="block text-sm font-medium text-gray-700 mb-2">
          Province
        </label>
        <select
          id="mcc-onb-province"
          className={selectClass}
          value={value.provinceId}
          onChange={(e) => void onProvinceChange(e.target.value)}
        >
          <option value="">Select province</option>
          {provinces.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="mcc-onb-district" className="block text-sm font-medium text-gray-700 mb-2">
          District
        </label>
        <select
          id="mcc-onb-district"
          className={selectClass}
          value={value.districtId}
          disabled={!value.provinceId || disabledChild}
          onChange={(e) => void onDistrictChange(e.target.value)}
        >
          <option value="">{value.provinceId ? 'Select district' : 'Select province first'}</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="mcc-onb-sector" className="block text-sm font-medium text-gray-700 mb-2">
          Sector
        </label>
        <select
          id="mcc-onb-sector"
          className={selectClass}
          value={value.sectorId}
          disabled={!value.districtId || disabledChild}
          onChange={(e) => void onSectorChange(e.target.value)}
        >
          <option value="">{value.districtId ? 'Select sector' : 'Select district first'}</option>
          {sectors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="mcc-onb-cell" className="block text-sm font-medium text-gray-700 mb-2">
          Cell
        </label>
        <select
          id="mcc-onb-cell"
          className={selectClass}
          value={value.cellId}
          disabled={!value.sectorId || disabledChild}
          onChange={(e) => void onCellChange(e.target.value)}
        >
          <option value="">{value.sectorId ? 'Select cell' : 'Select sector first'}</option>
          {cells.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="md:col-span-2">
        <label htmlFor="mcc-onb-village" className="block text-sm font-medium text-gray-700 mb-2">
          Village
        </label>
        <select
          id="mcc-onb-village"
          className={selectClass}
          value={value.villageId}
          disabled={!value.cellId || disabledChild}
          onChange={(e) => onVillageChange(e.target.value)}
        >
          <option value="">{value.cellId ? 'Select village' : 'Select cell first'}</option>
          {villages.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}