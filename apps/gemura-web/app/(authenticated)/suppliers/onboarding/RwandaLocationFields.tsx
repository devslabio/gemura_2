'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Select from '@/app/components/Select';
import { FieldLabel } from './formPrimitives';
import { locationsApi, type Location } from '@/lib/api/locations';

export type RwandaLocationNames = {
  province: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
};

type Props = {
  idPrefix: string;
  names: RwandaLocationNames;
  locationVillageId: string;
  onUpdate: (next: RwandaLocationNames & { locationVillageId: string }) => void;
};

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function findByName(list: Location[], name: string): Location | undefined {
  const n = norm(name);
  if (!n) return undefined;
  return list.find((x) => norm(x.name) === n);
}

async function resolveVillageIdFromNames(names: RwandaLocationNames): Promise<{
  names: RwandaLocationNames;
  locationVillageId: string;
} | null> {
  if (!names.province.trim() || !names.district.trim() || !names.sector.trim() || !names.cell.trim() || !names.village.trim()) {
    return null;
  }
  const provRes = await locationsApi.getProvinces();
  const provinceList = Array.isArray(provRes?.data) ? provRes.data : [];
  const p = findByName(provinceList, names.province);
  if (!p) return null;
  const dRes = await locationsApi.getChildren(p.id);
  const districtList = Array.isArray(dRes?.data) ? dRes.data : [];
  const d = findByName(districtList, names.district);
  if (!d) return null;
  const sRes = await locationsApi.getChildren(d.id);
  const sectorList = Array.isArray(sRes?.data) ? sRes.data : [];
  const s = findByName(sectorList, names.sector);
  if (!s) return null;
  const cRes = await locationsApi.getChildren(s.id);
  const cellList = Array.isArray(cRes?.data) ? cRes.data : [];
  const c = findByName(cellList, names.cell);
  if (!c) return null;
  const vRes = await locationsApi.getChildren(c.id);
  const villageList = Array.isArray(vRes?.data) ? vRes.data : [];
  const v = findByName(villageList, names.village);
  if (!v) return null;
  return {
    names: {
      province: p.name,
      district: d.name,
      sector: s.name,
      cell: c.name,
      village: v.name,
    },
    locationVillageId: v.id,
  };
}

/**
 * Province → district → sector → cell → village, backed by the same `/locations` API as Orora farms.
 * Persists human-readable names in the onboarding draft plus `locationVillageId` for reliable reload.
 */
export function RwandaLocationFields({ idPrefix, names, locationVillageId, onUpdate }: Props) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

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
  const [loadingPath, setLoadingPath] = useState(false);
  const [provincesLoaded, setProvincesLoaded] = useState(false);
  const restoringRef = useRef(false);
  const lastResolvedPrint = useRef<string | null>(null);

  useEffect(() => {
    locationsApi
      .getProvinces()
      .then((r) => {
        setProvinces(Array.isArray(r?.data) ? r.data : []);
      })
      .catch(() => setProvinces([]))
      .finally(() => setProvincesLoaded(true));
  }, []);

  const pushNamesFromIds = (p: Location, d: Location, s: Location, c: Location, v: Location) => {
    onUpdateRef.current({
      province: p.name,
      district: d.name,
      sector: s.name,
      cell: c.name,
      village: v.name,
      locationVillageId: v.id,
    });
  };

  /** Load full select chain from a village UUID (same idea as Orora farm form). */
  useEffect(() => {
    const vid = locationVillageId?.trim();
    if (!vid || !provincesLoaded) return;
    let cancelled = false;
    restoringRef.current = true;
    setLoadingPath(true);
    locationsApi
      .getPath(vid)
      .then(async (res) => {
        const path = Array.isArray(res?.data) ? res.data : [];
        const prov = path.find((x) => x.location_type === 'PROVINCE');
        const dist = path.find((x) => x.location_type === 'DISTRICT');
        const sec = path.find((x) => x.location_type === 'SECTOR');
        const cell = path.find((x) => x.location_type === 'CELL');
        const vill = path.find((x) => x.location_type === 'VILLAGE');
        if (cancelled || !prov || !dist || !sec || !cell || !vill) return;
        setProvinceId(prov.id);
        const dr = await locationsApi.getChildren(prov.id);
        const dlist = Array.isArray(dr?.data) ? dr.data : [];
        setDistricts(dlist);
        setDistrictId(dist.id);
        const sr = await locationsApi.getChildren(dist.id);
        const slist = Array.isArray(sr?.data) ? sr.data : [];
        setSectors(slist);
        setSectorId(sec.id);
        const cr = await locationsApi.getChildren(sec.id);
        const clist = Array.isArray(cr?.data) ? cr.data : [];
        setCells(clist);
        setCellId(cell.id);
        const vr = await locationsApi.getChildren(cell.id);
        const vlist = Array.isArray(vr?.data) ? vr.data : [];
        setVillages(vlist);
        setVillageId(vill.id);
      })
      .catch(() => {
        if (!cancelled) {
          setProvinceId('');
          setDistrictId('');
          setSectorId('');
          setCellId('');
          setVillageId('');
        }
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
  }, [locationVillageId, provincesLoaded]);

  const namesPrint = useMemo(
    () =>
      [names.province, names.district, names.sector, names.cell, names.village]
        .map((x) => norm(x))
        .join('|'),
    [names.province, names.district, names.sector, names.cell, names.village]
  );

  /** Legacy drafts: text names only — resolve once to village id + canonical labels. */
  useEffect(() => {
    if (!provincesLoaded) return;
    if (locationVillageId?.trim()) return;
    if (!namesPrint || namesPrint === '||||') return;
    if (lastResolvedPrint.current === namesPrint) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        const resolved = await resolveVillageIdFromNames(names);
        if (cancelled) return;
        if (!resolved) {
          lastResolvedPrint.current = namesPrint;
          return;
        }
        const canonicalPrint = [resolved.names.province, resolved.names.district, resolved.names.sector, resolved.names.cell, resolved.names.village]
          .map((x) => norm(x))
          .join('|');
        lastResolvedPrint.current = canonicalPrint;
        onUpdateRef.current({ ...resolved.names, locationVillageId: resolved.locationVillageId });
      })();
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [provincesLoaded, locationVillageId, namesPrint]);

  /** Clear selects when parent clears all location strings and village id. */
  useEffect(() => {
    if (locationVillageId?.trim()) return;
    const empty =
      !names.province.trim() &&
      !names.district.trim() &&
      !names.sector.trim() &&
      !names.cell.trim() &&
      !names.village.trim();
    if (!empty) return;
    lastResolvedPrint.current = null;
    setProvinceId('');
    setDistrictId('');
    setSectorId('');
    setCellId('');
    setVillageId('');
    setDistricts([]);
    setSectors([]);
    setCells([]);
    setVillages([]);
  }, [locationVillageId, names.province, names.district, names.sector, names.cell, names.village]);

  useEffect(() => {
    if (restoringRef.current) return;
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
    locationsApi
      .getChildren(provinceId)
      .then((r) => setDistricts(Array.isArray(r?.data) ? r.data : []))
      .catch(() => setDistricts([]));
    setDistrictId('');
    setSectorId('');
    setSectors([]);
    setCellId('');
    setCells([]);
    setVillageId('');
    setVillages([]);
  }, [provinceId]);

  useEffect(() => {
    if (restoringRef.current) return;
    if (!districtId) {
      setSectors([]);
      setSectorId('');
      setCellId('');
      setCells([]);
      setVillageId('');
      setVillages([]);
      return;
    }
    locationsApi
      .getChildren(districtId)
      .then((r) => setSectors(Array.isArray(r?.data) ? r.data : []))
      .catch(() => setSectors([]));
    setSectorId('');
    setCellId('');
    setCells([]);
    setVillageId('');
    setVillages([]);
  }, [districtId]);

  useEffect(() => {
    if (restoringRef.current) return;
    if (!sectorId) {
      setCells([]);
      setCellId('');
      setVillageId('');
      setVillages([]);
      return;
    }
    locationsApi
      .getChildren(sectorId)
      .then((r) => setCells(Array.isArray(r?.data) ? r.data : []))
      .catch(() => setCells([]));
    setCellId('');
    setVillageId('');
    setVillages([]);
  }, [sectorId]);

  useEffect(() => {
    if (restoringRef.current) return;
    if (!cellId) {
      setVillages([]);
      setVillageId('');
      return;
    }
    locationsApi
      .getChildren(cellId)
      .then((r) => setVillages(Array.isArray(r?.data) ? r.data : []))
      .catch(() => setVillages([]));
    setVillageId('');
  }, [cellId]);

  const pick = (list: Location[], id: string) => list.find((x) => x.id === id);

  const onProvinceSelect = (id: string) => {
    setProvinceId(id);
    if (!id) {
      onUpdateRef.current({ province: '', district: '', sector: '', cell: '', village: '', locationVillageId: '' });
      return;
    }
    const p = pick(provinces, id);
    onUpdateRef.current({
      province: p?.name ?? '',
      district: '',
      sector: '',
      cell: '',
      village: '',
      locationVillageId: '',
    });
  };

  const onDistrictSelect = (id: string) => {
    setDistrictId(id);
    const p = pick(provinces, provinceId);
    if (!id || !p) {
      onUpdateRef.current({
        province: p?.name ?? '',
        district: '',
        sector: '',
        cell: '',
        village: '',
        locationVillageId: '',
      });
      return;
    }
    const d = pick(districts, id);
    onUpdateRef.current({
      province: p.name,
      district: d?.name ?? '',
      sector: '',
      cell: '',
      village: '',
      locationVillageId: '',
    });
  };

  const onSectorSelect = (id: string) => {
    setSectorId(id);
    const p = pick(provinces, provinceId);
    const d = pick(districts, districtId);
    if (!id || !p || !d) {
      onUpdateRef.current({
        province: p?.name ?? '',
        district: d?.name ?? '',
        sector: '',
        cell: '',
        village: '',
        locationVillageId: '',
      });
      return;
    }
    const s = pick(sectors, id);
    onUpdateRef.current({
      province: p.name,
      district: d.name,
      sector: s?.name ?? '',
      cell: '',
      village: '',
      locationVillageId: '',
    });
  };

  const onCellSelect = (id: string) => {
    setCellId(id);
    const p = pick(provinces, provinceId);
    const d = pick(districts, districtId);
    const s = pick(sectors, sectorId);
    if (!id || !p || !d || !s) {
      onUpdateRef.current({
        province: p?.name ?? '',
        district: d?.name ?? '',
        sector: s?.name ?? '',
        cell: '',
        village: '',
        locationVillageId: '',
      });
      return;
    }
    const c = pick(cells, id);
    onUpdateRef.current({
      province: p.name,
      district: d.name,
      sector: s.name,
      cell: c?.name ?? '',
      village: '',
      locationVillageId: '',
    });
  };

  const onVillageSelect = (id: string) => {
    setVillageId(id);
    const p = pick(provinces, provinceId);
    const d = pick(districts, districtId);
    const s = pick(sectors, sectorId);
    const c = pick(cells, cellId);
    if (!p || !d || !s || !c) return;
    if (!id) {
      onUpdateRef.current({
        province: p.name,
        district: d.name,
        sector: s.name,
        cell: c.name,
        village: '',
        locationVillageId: '',
      });
      return;
    }
    const v = pick(villages, id);
    if (!v) return;
    pushNamesFromIds(p, d, s, c, v);
  };

  if (!provincesLoaded) {
    return (
      <div className="sm:col-span-2 text-sm text-gray-600 py-2" role="status">
        Loading locations…
      </div>
    );
  }

  return (
    <>
      {loadingPath && (
        <div className="sm:col-span-2 text-sm text-gray-600 py-1" role="status">
          Resolving saved location…
        </div>
      )}
      <div className="space-y-1">
        <FieldLabel htmlFor={`${idPrefix}-prov`}>Province</FieldLabel>
        <Select
          id={`${idPrefix}-prov`}
          value={provinceId}
          onChange={onProvinceSelect}
          options={provinces.map((p) => ({ value: p.id, label: p.name }))}
          placeholder="Select province"
          allowEmpty
          className="w-full"
        />
      </div>
      <div className="space-y-1">
        <FieldLabel htmlFor={`${idPrefix}-dist`}>District</FieldLabel>
        <Select
          id={`${idPrefix}-dist`}
          value={districtId}
          onChange={onDistrictSelect}
          options={districts.map((d) => ({ value: d.id, label: d.name }))}
          placeholder="Select district"
          allowEmpty
          disabled={!provinceId}
          className="w-full"
        />
      </div>
      <div className="space-y-1">
        <FieldLabel htmlFor={`${idPrefix}-sec`}>Sector</FieldLabel>
        <Select
          id={`${idPrefix}-sec`}
          value={sectorId}
          onChange={onSectorSelect}
          options={sectors.map((s) => ({ value: s.id, label: s.name }))}
          placeholder="Select sector"
          allowEmpty
          disabled={!districtId}
          className="w-full"
        />
      </div>
      <div className="space-y-1">
        <FieldLabel htmlFor={`${idPrefix}-cell`}>Cell</FieldLabel>
        <Select
          id={`${idPrefix}-cell`}
          value={cellId}
          onChange={onCellSelect}
          options={cells.map((c) => ({ value: c.id, label: c.name }))}
          placeholder="Select cell"
          allowEmpty
          disabled={!sectorId}
          className="w-full"
        />
      </div>
      <div className="space-y-1">
        <FieldLabel htmlFor={`${idPrefix}-vill`}>Village</FieldLabel>
        <Select
          id={`${idPrefix}-vill`}
          value={villageId}
          onChange={onVillageSelect}
          options={villages.map((v) => ({ value: v.id, label: v.name }))}
          placeholder="Select village"
          allowEmpty
          disabled={!cellId}
          className="w-full"
        />
      </div>
    </>
  );
}
