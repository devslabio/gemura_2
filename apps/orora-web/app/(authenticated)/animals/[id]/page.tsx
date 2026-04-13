'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  animalsApi,
  Animal,
  AnimalWeight,
  AnimalHealth,
  AnimalBreeding,
  AnimalCalving,
  CreateWeightData,
  CreateHealthData,
  CreateBreedingData,
  CreateCalvingData,
  HealthEventType,
  BreedingMethod,
  CalvingOutcome,
} from '@/lib/api/animals';
import { milkProductionApi, MilkProductionRecord, MILK_PRODUCTION_SESSIONS } from '@/lib/api/milk-production';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import Modal from '@/app/components/Modal';
import SectionRecordsModal, { SECTION_PREVIEW_LIMIT } from '@/app/components/SectionRecordsModal';
import DatePicker from '@/app/components/DatePicker';
import DateTimePicker from '@/app/components/DateTimePicker';
import Select from '@/app/components/Select';
import Icon, {
  faArrowLeft,
  faEdit,
  faPaw,
  faWeightScale,
  faNotesMedical,
  faPlus,
  faTrash,
  faCalendar,
  faSpinner,
  faBox,
  faHeart,
  faBaby,
  faList,
} from '@/app/components/Icon';
import { DetailPageSkeleton } from '@/app/components/SkeletonLoader';
import type { TableColumn } from '@/app/components/DataTable';

const HEALTH_EVENT_LABELS: Record<HealthEventType, string> = {
  vaccination: 'Vaccination',
  treatment: 'Treatment',
  deworming: 'Deworming',
  examination: 'Examination',
  surgery: 'Surgery',
  injury: 'Injury',
  illness: 'Illness',
  other: 'Other',
};

export default function AnimalDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { currentAccount } = useAuthStore();
  const accountId = currentAccount?.account_id;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [healthModalOpen, setHealthModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [weightForm, setWeightForm] = useState<CreateWeightData>({
    weight_kg: 0,
    recorded_at: new Date().toISOString().slice(0, 16),
    notes: '',
  });
  const [healthForm, setHealthForm] = useState<CreateHealthData>({
    event_type: 'vaccination',
    event_date: new Date().toISOString().slice(0, 10),
    description: '',
    vet_first_name: '',
    vet_last_name: '',
    vet_phone: '',
    notes: '',
  });

  const [productionList, setProductionList] = useState<MilkProductionRecord[]>([]);
  const [breedingList, setBreedingList] = useState<AnimalBreeding[]>([]);
  const [calvingList, setCalvingList] = useState<AnimalCalving[]>([]);
  const [productionModalOpen, setProductionModalOpen] = useState(false);
  const [breedingModalOpen, setBreedingModalOpen] = useState(false);
  const [calvingModalOpen, setCalvingModalOpen] = useState(false);
  const [productionForm, setProductionForm] = useState({ production_date: new Date().toISOString().slice(0, 10), session: '', quantity_litres: 0, notes: '' });
  const [breedingForm, setBreedingForm] = useState<CreateBreedingData>({
    breeding_date: new Date().toISOString().slice(0, 10),
    heat_date: '',
    method: 'natural',
    bull_animal_id: '',
    bull_name: '',
    expected_calving_date: '',
    outcome: 'unknown',
    notes: '',
  });
  const [calvingForm, setCalvingForm] = useState<CreateCalvingData>({
    calving_date: new Date().toISOString().slice(0, 10),
    outcome: 'live',
    calf_id: '',
    gender: undefined,
    weight_kg: undefined,
    notes: '',
  });
  const [maleAnimals, setMaleAnimals] = useState<Animal[]>([]);
  const [allAnimals, setAllAnimals] = useState<Animal[]>([]);
  type ViewMoreSection = 'weights' | 'health' | 'production' | 'breeding' | 'calving';
  const [viewMoreSection, setViewMoreSection] = useState<ViewMoreSection | null>(null);

  const loadAnimal = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await animalsApi.getById(id, accountId);
      if (res.code === 200 && res.data) setAnimal(res.data);
      else setError(res.message || 'Animal not found');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message || e?.message || 'Failed to load animal');
    } finally {
      setLoading(false);
    }
  }, [id, accountId]);

  useEffect(() => {
    loadAnimal();
  }, [loadAnimal]);

  const loadProduction = useCallback(async () => {
    if (!id || !accountId) return;
    try {
      const res = await milkProductionApi.list(accountId, { animal_id: id });
      if (res.code === 200 && res.data) setProductionList(res.data);
    } catch {
      setProductionList([]);
    }
  }, [id, accountId]);

  const loadBreeding = useCallback(async () => {
    if (!id || !accountId) return;
    try {
      const res = await animalsApi.getBreeding(id, accountId);
      if (res.code === 200 && res.data) setBreedingList(res.data);
    } catch {
      setBreedingList([]);
    }
  }, [id, accountId]);

  const loadCalvings = useCallback(async () => {
    if (!id || !accountId) return;
    try {
      const res = await animalsApi.getCalvings(id, accountId);
      if (res.code === 200 && res.data) setCalvingList(res.data);
    } catch {
      setCalvingList([]);
    }
  }, [id, accountId]);

  useEffect(() => {
    if (!animal?.id) return;
    loadProduction();
    if (animal.gender === 'female') {
      loadBreeding();
      loadCalvings();
    }
  }, [animal?.id, animal?.gender, loadProduction, loadBreeding, loadCalvings]);

  useEffect(() => {
    if (!accountId) return;
    animalsApi.getList(accountId).then((res) => {
      if (res.code === 200 && res.data) {
        setAllAnimals(res.data);
        setMaleAnimals(res.data.filter((a) => a.gender === 'male' && a.id !== id));
      }
    }).catch(() => {});
  }, [accountId, id]);

  const handleAddProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productionForm.quantity_litres || productionForm.quantity_litres <= 0) return;
    setSubmitting(true);
    try {
      await milkProductionApi.create(
        { animal_id: id, production_date: productionForm.production_date, session: productionForm.session || undefined, quantity_litres: productionForm.quantity_litres, notes: productionForm.notes || undefined },
        accountId
      );
      useToastStore.getState().show('Milk production recorded', 'success');
      setProductionModalOpen(false);
      setProductionForm({ production_date: new Date().toISOString().slice(0, 10), session: '', quantity_litres: 0, notes: '' });
      loadProduction();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      useToastStore.getState().show(e?.response?.data?.message || e?.message || 'Failed to record production', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduction = async (prodId: string) => {
    if (!confirm('Delete this production record?')) return;
    try {
      await milkProductionApi.delete(prodId, accountId);
      useToastStore.getState().show('Production record deleted', 'success');
      loadProduction();
    } catch {
      useToastStore.getState().show('Failed to delete production record', 'error');
    }
  };

  const handleAddBreeding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await animalsApi.addBreeding(
        id,
        {
          breeding_date: breedingForm.breeding_date,
          method: breedingForm.method,
          bull_animal_id: breedingForm.bull_animal_id?.trim() || undefined,
          bull_name: breedingForm.bull_name?.trim() || undefined,
          expected_calving_date: breedingForm.expected_calving_date?.trim() || undefined,
          outcome: breedingForm.outcome || 'unknown',
          notes: breedingForm.notes?.trim() || undefined,
        },
        accountId
      );
      useToastStore.getState().show('Breeding record added', 'success');
      setBreedingModalOpen(false);
      setBreedingForm({ breeding_date: new Date().toISOString().slice(0, 10), method: 'natural', bull_animal_id: '', bull_name: '', expected_calving_date: '', outcome: 'unknown', notes: '' });
      loadBreeding();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      useToastStore.getState().show(e?.response?.data?.message || e?.message || 'Failed to add breeding record', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBreeding = async (breedingId: string) => {
    if (!confirm('Delete this breeding record?')) return;
    try {
      await animalsApi.deleteBreeding(id, breedingId, accountId);
      useToastStore.getState().show('Breeding record deleted', 'success');
      loadBreeding();
    } catch {
      useToastStore.getState().show('Failed to delete breeding record', 'error');
    }
  };

  const handleAddCalving = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await animalsApi.addCalving(
        id,
        {
          calving_date: calvingForm.calving_date,
          outcome: calvingForm.outcome,
          calf_id: calvingForm.calf_id?.trim() || undefined,
          gender: calvingForm.gender,
          weight_kg: calvingForm.weight_kg,
          notes: calvingForm.notes?.trim() || undefined,
        },
        accountId
      );
      useToastStore.getState().show('Calving record added', 'success');
      setCalvingModalOpen(false);
      setCalvingForm({ calving_date: new Date().toISOString().slice(0, 10), outcome: 'live', calf_id: '', gender: undefined, weight_kg: undefined, notes: '' });
      loadCalvings();
      loadAnimal();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      useToastStore.getState().show(e?.response?.data?.message || e?.message || 'Failed to add calving record', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCalving = async (calvingId: string) => {
    if (!confirm('Delete this calving record?')) return;
    try {
      await animalsApi.deleteCalving(id, calvingId, accountId);
      useToastStore.getState().show('Calving record deleted', 'success');
      loadCalvings();
      loadAnimal();
    } catch {
      useToastStore.getState().show('Failed to delete calving record', 'error');
    }
  };

  const handleAddWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weightForm.weight_kg || weightForm.weight_kg <= 0) return;
    setSubmitting(true);
    try {
      await animalsApi.addWeight(id, { ...weightForm, recorded_at: weightForm.recorded_at || new Date().toISOString() }, accountId);
      useToastStore.getState().show('Weight recorded', 'success');
      setWeightModalOpen(false);
      setWeightForm({ weight_kg: 0, recorded_at: new Date().toISOString().slice(0, 16), notes: '' });
      loadAnimal();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      useToastStore.getState().show(e?.response?.data?.message || e?.message || 'Failed to add weight', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWeight = async (weightId: string) => {
    if (!confirm('Delete this weight record?')) return;
    try {
      await animalsApi.deleteWeight(id, weightId, accountId);
      useToastStore.getState().show('Weight record deleted', 'success');
      loadAnimal();
    } catch {
      useToastStore.getState().show('Failed to delete weight record', 'error');
    }
  };

  const handleAddHealth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!healthForm.description.trim()) return;
    setSubmitting(true);
    try {
      await animalsApi.addHealth(id, healthForm, accountId);
      useToastStore.getState().show('Health record added', 'success');
      setHealthModalOpen(false);
      setHealthForm({
        event_type: 'vaccination',
        event_date: new Date().toISOString().slice(0, 10),
        description: '',
        vet_first_name: '',
        vet_last_name: '',
        vet_phone: '',
        notes: '',
      });
      loadAnimal();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      useToastStore.getState().show(e?.response?.data?.message || e?.message || 'Failed to add health record', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteHealth = async (healthId: string) => {
    if (!confirm('Delete this health record?')) return;
    try {
      await animalsApi.deleteHealth(id, healthId, accountId);
      useToastStore.getState().show('Health record deleted', 'success');
      loadAnimal();
    } catch {
      useToastStore.getState().show('Failed to delete health record', 'error');
    }
  };

  // All hooks must run before any conditional return (Rules of Hooks)
  const weightTableColumns: TableColumn<AnimalWeight>[] = useMemo(
    () => [
      { key: 'recorded_at', label: 'Date', sortable: true, render: (v) => new Date(String(v)).toLocaleDateString() },
      { key: 'weight_kg', label: 'Weight (kg)', sortable: true, render: (v) => Number(v) },
      { key: 'notes', label: 'Notes', sortable: true, render: (v) => (v ? String(v) : '—') },
    ],
    []
  );
  const weightExportColumns = useMemo(
    () => [
      { key: 'recorded_at', label: 'Date', getValue: (r: AnimalWeight) => new Date(r.recorded_at).toLocaleDateString() },
      { key: 'weight_kg', label: 'Weight (kg)', getValue: (r: AnimalWeight) => String(Number(r.weight_kg)) },
      { key: 'notes', label: 'Notes', getValue: (r: AnimalWeight) => r.notes ?? '' },
    ],
    []
  );

  const healthTableColumns: TableColumn<AnimalHealth>[] = useMemo(
    () => [
      { key: 'event_type', label: 'Type', sortable: true, render: (v, r) => HEALTH_EVENT_LABELS[r.event_type] ?? r.event_type },
      { key: 'event_date', label: 'Date', sortable: true, render: (v) => new Date(String(v)).toLocaleDateString() },
      { key: 'description', label: 'Description', sortable: true },
      { key: 'treatment', label: 'Treatment', sortable: true, render: (v) => (v ? String(v) : '—') },
      { key: 'medicine_name', label: 'Medicine', sortable: true, render: (v) => (v ? String(v) : '—') },
      {
        key: 'vet',
        label: 'Vet',
        sortable: true,
        render: (_, r) =>
          [r.vet_first_name, r.vet_last_name].filter(Boolean).join(' ') || (r.vet_phone ? String(r.vet_phone) : '—'),
      },
    ],
    []
  );
  const healthExportColumns = useMemo(
    () => [
      { key: 'event_type', label: 'Type', getValue: (r: AnimalHealth) => HEALTH_EVENT_LABELS[r.event_type] ?? r.event_type },
      { key: 'event_date', label: 'Date', getValue: (r: AnimalHealth) => new Date(r.event_date).toLocaleDateString() },
      { key: 'description', label: 'Description', getValue: (r: AnimalHealth) => r.description },
      { key: 'treatment', label: 'Treatment', getValue: (r: AnimalHealth) => r.treatment ?? '' },
      { key: 'medicine_name', label: 'Medicine', getValue: (r: AnimalHealth) => r.medicine_name ?? '' },
    ],
    []
  );

  const productionTableColumns: TableColumn<MilkProductionRecord>[] = useMemo(
    () => [
      { key: 'production_date', label: 'Date', sortable: true, render: (v) => new Date(String(v)).toLocaleDateString() },
      {
        key: 'session',
        label: 'Session',
        sortable: true,
        render: (v) => (v ? MILK_PRODUCTION_SESSIONS.find((s) => s.value === v)?.label ?? v : '—'),
      },
      { key: 'quantity_litres', label: 'Quantity (L)', sortable: true, render: (v) => Number(v) },
      { key: 'notes', label: 'Notes', sortable: true, render: (v) => (v ? String(v) : '—') },
    ],
    []
  );
  const productionExportColumns = useMemo(
    () => [
      { key: 'production_date', label: 'Date', getValue: (r: MilkProductionRecord) => new Date(r.production_date).toLocaleDateString() },
      {
        key: 'session',
        label: 'Session',
        getValue: (r: MilkProductionRecord) => (r.session ? MILK_PRODUCTION_SESSIONS.find((s) => s.value === r.session)?.label ?? r.session : ''),
      },
      { key: 'quantity_litres', label: 'Quantity (L)', getValue: (r: MilkProductionRecord) => String(Number(r.quantity_litres)) },
      { key: 'notes', label: 'Notes', getValue: (r: MilkProductionRecord) => r.notes ?? '' },
    ],
    []
  );

  const breedingTableColumns: TableColumn<AnimalBreeding>[] = useMemo(
    () => [
      { key: 'breeding_date', label: 'Date', sortable: true, render: (v) => new Date(String(v)).toLocaleDateString() },
      { key: 'method', label: 'Method', sortable: true, render: (v) => String(v).replace('_', ' ') },
      {
        key: 'bull',
        label: 'Bull',
        sortable: true,
        render: (_, r) =>
          r.bull_animal ? `${r.bull_animal.tag_number} ${r.bull_animal.name || ''}`.trim() : r.bull_name || '—',
      },
      {
        key: 'heat_date',
        label: 'Heat date',
        sortable: true,
        render: (v) => (v ? new Date(String(v)).toLocaleDateString() : '—'),
      },
      {
        key: 'expected_calving_date',
        label: 'Expected calving',
        sortable: true,
        render: (v) => (v ? new Date(String(v)).toLocaleDateString() : '—'),
      },
      { key: 'outcome', label: 'Outcome', sortable: true, render: (v) => (v && v !== 'unknown' ? String(v).replace('_', ' ') : '—') },
    ],
    []
  );
  const breedingExportColumns = useMemo(
    () => [
      { key: 'breeding_date', label: 'Date', getValue: (r: AnimalBreeding) => new Date(r.breeding_date).toLocaleDateString() },
      { key: 'method', label: 'Method', getValue: (r: AnimalBreeding) => r.method.replace('_', ' ') },
      {
        key: 'bull',
        label: 'Bull',
        getValue: (r: AnimalBreeding) =>
          r.bull_animal ? `${r.bull_animal.tag_number} ${r.bull_animal.name || ''}`.trim() : r.bull_name ?? '',
      },
      { key: 'heat_date', label: 'Heat date', getValue: (r: AnimalBreeding) => (r.heat_date ? new Date(r.heat_date).toLocaleDateString() : '') },
      { key: 'expected_calving_date', label: 'Expected calving', getValue: (r: AnimalBreeding) => (r.expected_calving_date ? new Date(r.expected_calving_date).toLocaleDateString() : '') },
      { key: 'outcome', label: 'Outcome', getValue: (r: AnimalBreeding) => (r.outcome && r.outcome !== 'unknown' ? r.outcome.replace('_', ' ') : '') },
    ],
    []
  );

  const calvingTableColumns: TableColumn<AnimalCalving>[] = useMemo(
    () => [
      { key: 'calving_date', label: 'Date', sortable: true, render: (v) => new Date(String(v)).toLocaleDateString() },
      { key: 'outcome', label: 'Outcome', sortable: true, render: (v) => String(v).charAt(0).toUpperCase() + String(v).slice(1) },
      {
        key: 'calf',
        label: 'Calf',
        sortable: true,
        render: (_, r) => (r.calf ? `${r.calf.tag_number} ${r.calf.name || ''}`.trim() : '—'),
      },
      { key: 'gender', label: 'Gender', sortable: true, render: (v) => (v ? String(v) : '—') },
      { key: 'weight_kg', label: 'Birth weight (kg)', sortable: true, render: (v) => (v != null ? Number(v) : '—') },
      { key: 'notes', label: 'Notes', sortable: true, render: (v) => (v ? String(v) : '—') },
    ],
    []
  );
  const calvingExportColumns = useMemo(
    () => [
      { key: 'calving_date', label: 'Date', getValue: (r: AnimalCalving) => new Date(r.calving_date).toLocaleDateString() },
      { key: 'outcome', label: 'Outcome', getValue: (r: AnimalCalving) => r.outcome },
      { key: 'calf', label: 'Calf', getValue: (r: AnimalCalving) => (r.calf ? `${r.calf.tag_number} ${r.calf.name || ''}`.trim() : '') },
      { key: 'gender', label: 'Gender', getValue: (r: AnimalCalving) => r.gender ?? '' },
      { key: 'weight_kg', label: 'Birth weight (kg)', getValue: (r: AnimalCalving) => (r.weight_kg != null ? String(Number(r.weight_kg)) : '') },
      { key: 'notes', label: 'Notes', getValue: (r: AnimalCalving) => r.notes ?? '' },
    ],
    []
  );

  if (loading && !animal) return <DetailPageSkeleton />;

  if (error && !animal) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
        <Link href="/animals" className="btn btn-secondary">
          <Icon icon={faArrowLeft} size="sm" className="mr-2" />
          Back to Animals
        </Link>
      </div>
    );
  }

  if (!animal) return null;

  const weights = animal.weights ?? [];
  const healthRecords = animal.health_records ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/animals" className="text-sm text-gray-600 hover:text-[var(--primary)] mb-2 inline-flex items-center">
            <Icon icon={faArrowLeft} size="sm" className="mr-2" />
            Back to Animals
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {animal.tag_number}
            {animal.name && <span className="font-normal text-gray-600"> · {animal.name}</span>}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {animal.breed?.name ?? '—'} · {animal.gender} · {new Date(animal.date_of_birth).toLocaleDateString()}
          </p>
        </div>
        <Link href={`/animals/${id}/edit`} className="btn btn-primary">
          <Icon icon={faEdit} size="sm" className="mr-2" />
          Edit Animal
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-gray-200 rounded-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Icon icon={faPaw} size="sm" className="mr-2 text-gray-500" />
              Basic information
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Tag number</dt>
                <dd className="text-gray-900">{animal.tag_number}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Breed</dt>
                <dd className="text-gray-900">{animal.breed?.name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Gender</dt>
                <dd className="text-gray-900 capitalize">{animal.gender}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Date of birth</dt>
                <dd className="text-gray-900">{new Date(animal.date_of_birth).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Source</dt>
                <dd className="text-gray-900">{animal.source.replace('_', ' ')}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd>
                  <span
                    className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                      animal.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : animal.status === 'lactating' || animal.status === 'pregnant'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {animal.status}
                  </span>
                </dd>
              </div>
              {animal.mother && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Mother</dt>
                  <dd className="text-gray-900">
                    <Link href={`/animals/${animal.mother.id}`} className="text-[var(--primary)] hover:underline">
                      {animal.mother.tag_number} {animal.mother.name && `(${animal.mother.name})`}
                    </Link>
                  </dd>
                </div>
              )}
              {animal.father && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Father</dt>
                  <dd className="text-gray-900">
                    <Link href={`/animals/${animal.father!.id}`} className="text-[var(--primary)] hover:underline">
                      {animal.father!.tag_number} {animal.father!.name && `(${animal.father!.name})`}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
            {animal.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <dt className="text-sm font-medium text-gray-500 mb-1">Notes</dt>
                <dd className="text-gray-700 text-sm">{animal.notes}</dd>
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Icon icon={faWeightScale} size="sm" className="mr-2 text-gray-500" />
                Weight history
              </h2>
              <button
                type="button"
                onClick={() => setWeightModalOpen(true)}
                className="btn btn-secondary text-sm"
              >
                <Icon icon={faPlus} size="sm" className="mr-1" />
                Add weight
              </button>
            </div>
            {weights.length === 0 ? (
              <p className="text-sm text-gray-500">No weight records yet.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-500">
                        <th className="py-2 pr-4">Date</th>
                        <th className="py-2 pr-4">Weight (kg)</th>
                        <th className="py-2 pr-4">Notes</th>
                        <th className="py-2 w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {(weights.length > SECTION_PREVIEW_LIMIT ? weights.slice(0, SECTION_PREVIEW_LIMIT) : weights).map((w) => (
                        <tr key={w.id} className="border-b border-gray-100">
                          <td className="py-2 pr-4 text-gray-900">
                            {new Date(w.recorded_at).toLocaleDateString()}
                          </td>
                          <td className="py-2 pr-4 font-medium">{Number(w.weight_kg)}</td>
                          <td className="py-2 pr-4 text-gray-600">{w.notes || '—'}</td>
                          <td className="py-2">
                            <button
                              type="button"
                              onClick={() => handleDeleteWeight(w.id)}
                              className="text-gray-400 hover:text-red-600 p-1"
                              title="Delete"
                            >
                              <Icon icon={faTrash} size="sm" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {weights.length > SECTION_PREVIEW_LIMIT && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setViewMoreSection('weights')}
                      className="btn btn-secondary text-sm"
                    >
                      <Icon icon={faList} size="sm" className="mr-1" />
                      View more ({weights.length} records)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Icon icon={faNotesMedical} size="sm" className="mr-2 text-gray-500" />
                Health records
              </h2>
              <button
                type="button"
                onClick={() => setHealthModalOpen(true)}
                className="btn btn-secondary text-sm"
              >
                <Icon icon={faPlus} size="sm" className="mr-1" />
                Add record
              </button>
            </div>
            {healthRecords.length === 0 ? (
              <p className="text-sm text-gray-500">No health records yet.</p>
            ) : (
              <>
                <div className="space-y-3">
                  {(healthRecords.length > SECTION_PREVIEW_LIMIT ? healthRecords.slice(0, SECTION_PREVIEW_LIMIT) : healthRecords).map((h) => (
                    <div
                      key={h.id}
                      className="border border-gray-100 rounded-sm p-3 flex items-start justify-between gap-2"
                    >
                      <div>
                        <span className="text-xs font-medium text-gray-500 uppercase">
                          {HEALTH_EVENT_LABELS[h.event_type] ?? h.event_type}
                        </span>
                        <span className="text-gray-500 text-sm ml-2">
                          {new Date(h.event_date).toLocaleDateString()}
                        </span>
                        <p className="text-gray-900 mt-1">{h.description}</p>
                        {h.treatment && (
                          <p className="text-sm text-gray-600 mt-1">Treatment: {h.treatment}</p>
                        )}
                        {h.medicine_name && (
                          <p className="text-sm text-gray-600">Medicine: {h.medicine_name}</p>
                        )}
                        {(h.vet_first_name || h.vet_last_name || h.vet_phone) && (
                          <p className="text-sm text-gray-600 mt-1">
                            Vet:{' '}
                            {[h.vet_first_name, h.vet_last_name].filter(Boolean).join(' ')}
                            {h.vet_phone ? ` · ${h.vet_phone}` : ''}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteHealth(h.id)}
                        className="text-gray-400 hover:text-red-600 p-1 shrink-0"
                        title="Delete"
                      >
                        <Icon icon={faTrash} size="sm" />
                      </button>
                    </div>
                  ))}
                </div>
                {healthRecords.length > SECTION_PREVIEW_LIMIT && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setViewMoreSection('health')}
                      className="btn btn-secondary text-sm"
                    >
                      <Icon icon={faList} size="sm" className="mr-1" />
                      View more ({healthRecords.length} records)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Milk production */}
          <div className="bg-white border border-gray-200 rounded-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Icon icon={faBox} size="sm" className="mr-2 text-gray-500" />
                Milk production
              </h2>
              <button type="button" onClick={() => setProductionModalOpen(true)} className="btn btn-secondary text-sm">
                <Icon icon={faPlus} size="sm" className="mr-1" />
                Record production
              </button>
            </div>
            {productionList.length === 0 ? (
              <p className="text-sm text-gray-500">No production records yet.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-500">
                        <th className="py-2 pr-4">Date</th>
                        <th className="py-2 pr-4">Session</th>
                        <th className="py-2 pr-4">Quantity (L)</th>
                        <th className="py-2 pr-4">Notes</th>
                        <th className="py-2 w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {(productionList.length > SECTION_PREVIEW_LIMIT ? productionList.slice(0, SECTION_PREVIEW_LIMIT) : productionList).map((p) => (
                        <tr key={p.id} className="border-b border-gray-100">
                          <td className="py-2 pr-4 text-gray-900">{new Date(p.production_date).toLocaleDateString()}</td>
                          <td className="py-2 pr-4 text-gray-600">{p.session ? MILK_PRODUCTION_SESSIONS.find((s) => s.value === p.session)?.label ?? p.session : '—'}</td>
                          <td className="py-2 pr-4 font-medium">{Number(p.quantity_litres)}</td>
                          <td className="py-2 pr-4 text-gray-600">{p.notes || '—'}</td>
                          <td className="py-2">
                            <button type="button" onClick={() => handleDeleteProduction(p.id)} className="text-gray-400 hover:text-red-600 p-1" title="Delete">
                              <Icon icon={faTrash} size="sm" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {productionList.length > SECTION_PREVIEW_LIMIT && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setViewMoreSection('production')}
                      className="btn btn-secondary text-sm"
                    >
                      <Icon icon={faList} size="sm" className="mr-1" />
                      View more ({productionList.length} records)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Breeding (female only) */}
          {animal.gender === 'female' && (
            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Icon icon={faHeart} size="sm" className="mr-2 text-gray-500" />
                  Breeding records
                </h2>
                <button type="button" onClick={() => setBreedingModalOpen(true)} className="btn btn-secondary text-sm">
                  <Icon icon={faPlus} size="sm" className="mr-1" />
                  Add breeding
                </button>
              </div>
              {breedingList.length === 0 ? (
                <p className="text-sm text-gray-500">No breeding records yet.</p>
              ) : (
                <>
                  <div className="space-y-3">
                    {(breedingList.length > SECTION_PREVIEW_LIMIT ? breedingList.slice(0, SECTION_PREVIEW_LIMIT) : breedingList).map((b) => (
                      <div key={b.id} className="border border-gray-100 rounded-sm p-3 flex items-start justify-between gap-2">
                        <div>
                          <span className="text-sm font-medium text-gray-900">{new Date(b.breeding_date).toLocaleDateString()}</span>
                          <span className="text-gray-500 text-sm ml-2">{b.method.replace('_', ' ')}</span>
                          {(b.bull_animal || b.bull_name) && (
                            <p className="text-sm text-gray-600 mt-0.5">Bull: {b.bull_animal ? `${b.bull_animal.tag_number} ${b.bull_animal.name || ''}` : b.bull_name || '—'}</p>
                          )}
                          {b.heat_date && (
                            <p className="text-xs text-gray-500">Heat: {new Date(b.heat_date).toLocaleDateString()}</p>
                          )}
                          {b.expected_calving_date && (
                            <p className="text-xs text-gray-500">Expected calving: {new Date(b.expected_calving_date).toLocaleDateString()}</p>
                          )}
                          {b.outcome && b.outcome !== 'unknown' && (
                            <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">{b.outcome.replace('_', ' ')}</span>
                          )}
                        </div>
                        <button type="button" onClick={() => handleDeleteBreeding(b.id)} className="text-gray-400 hover:text-red-600 p-1 shrink-0" title="Delete">
                          <Icon icon={faTrash} size="sm" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {breedingList.length > SECTION_PREVIEW_LIMIT && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => setViewMoreSection('breeding')}
                        className="btn btn-secondary text-sm"
                      >
                        <Icon icon={faList} size="sm" className="mr-1" />
                        View more ({breedingList.length} records)
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Calving (female only) */}
          {animal.gender === 'female' && (
            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Icon icon={faBaby} size="sm" className="mr-2 text-gray-500" />
                  Calving records
                </h2>
                <button type="button" onClick={() => setCalvingModalOpen(true)} className="btn btn-secondary text-sm">
                  <Icon icon={faPlus} size="sm" className="mr-1" />
                  Add calving
                </button>
              </div>
              {calvingList.length === 0 ? (
                <p className="text-sm text-gray-500">No calving records yet.</p>
              ) : (
                <>
                  <div className="space-y-3">
                    {(calvingList.length > SECTION_PREVIEW_LIMIT ? calvingList.slice(0, SECTION_PREVIEW_LIMIT) : calvingList).map((c) => (
                      <div key={c.id} className="border border-gray-100 rounded-sm p-3 flex items-start justify-between gap-2">
                        <div>
                          <span className="text-sm font-medium text-gray-900">{new Date(c.calving_date).toLocaleDateString()}</span>
                          <span className="text-gray-500 text-sm ml-2 capitalize">{c.outcome}</span>
                          {c.calf && (
                            <p className="text-sm text-gray-600 mt-0.5">
                              Calf: <Link href={`/animals/${c.calf.id}`} className="text-[var(--primary)] hover:underline">{c.calf.tag_number} {c.calf.name || ''}</Link>
                            </p>
                          )}
                          {(c.gender || c.weight_kg != null) && (
                            <p className="text-xs text-gray-500">{[c.gender, c.weight_kg != null ? `${c.weight_kg} kg` : null].filter(Boolean).join(' · ')}</p>
                          )}
                        </div>
                        <button type="button" onClick={() => handleDeleteCalving(c.id)} className="text-gray-400 hover:text-red-600 p-1 shrink-0" title="Delete">
                          <Icon icon={faTrash} size="sm" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {calvingList.length > SECTION_PREVIEW_LIMIT && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => setViewMoreSection('calving')}
                        className="btn btn-secondary text-sm"
                      >
                        <Icon icon={faList} size="sm" className="mr-1" />
                        View more ({calvingList.length} records)
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Quick info</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span className="text-gray-900">{new Date(animal.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Updated</span>
                <span className="text-gray-900">{new Date(animal.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal open={weightModalOpen} onClose={() => setWeightModalOpen(false)} title="Record weight" maxWidth="max-w-md">
        <form onSubmit={handleAddWeight} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={weightForm.weight_kg || ''}
              onChange={(e) => setWeightForm((p) => ({ ...p, weight_kg: parseFloat(e.target.value) || 0 }))}
              className="input w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date & time</label>
            <DateTimePicker
              value={weightForm.recorded_at}
              onChange={(v) => setWeightForm((p) => ({ ...p, recorded_at: v }))}
              max={new Date().toISOString().slice(0, 16)}
              placeholder="Select date and time"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input
              type="text"
              value={weightForm.notes ?? ''}
              onChange={(e) => setWeightForm((p) => ({ ...p, notes: e.target.value }))}
              className="input w-full"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setWeightModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !weightForm.weight_kg}>
              {submitting ? <Icon icon={faSpinner} size="sm" className="animate-spin" /> : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={healthModalOpen} onClose={() => setHealthModalOpen(false)} title="Add health record" maxWidth="max-w-md">
        <form onSubmit={handleAddHealth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event type *</label>
            <Select
              value={healthForm.event_type}
              onChange={(v) => setHealthForm((p) => ({ ...p, event_type: v as HealthEventType }))}
              options={(Object.keys(HEALTH_EVENT_LABELS) as HealthEventType[]).map((k) => ({
                value: k,
                label: HEALTH_EVENT_LABELS[k],
              }))}
              placeholder="Select event type"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <DatePicker
              value={healthForm.event_date}
              onChange={(v) => setHealthForm((p) => ({ ...p, event_date: v }))}
              max={new Date().toISOString().slice(0, 10)}
              placeholder="Select date"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <textarea
              value={healthForm.description}
              onChange={(e) => setHealthForm((p) => ({ ...p, description: e.target.value }))}
              className="input w-full min-h-[80px]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Treatment</label>
            <input
              type="text"
              value={healthForm.treatment ?? ''}
              onChange={(e) => setHealthForm((p) => ({ ...p, treatment: e.target.value }))}
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Medicine</label>
            <input
              type="text"
              value={healthForm.medicine_name ?? ''}
              onChange={(e) => setHealthForm((p) => ({ ...p, medicine_name: e.target.value }))}
              className="input w-full"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vet first name</label>
              <input
                type="text"
                value={healthForm.vet_first_name ?? ''}
                onChange={(e) => setHealthForm((p) => ({ ...p, vet_first_name: e.target.value }))}
                className="input w-full"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vet last name</label>
              <input
                type="text"
                value={healthForm.vet_last_name ?? ''}
                onChange={(e) => setHealthForm((p) => ({ ...p, vet_last_name: e.target.value }))}
                className="input w-full"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vet phone (with country code)</label>
              <input
                type="tel"
                value={healthForm.vet_phone ?? ''}
                onChange={(e) => setHealthForm((p) => ({ ...p, vet_phone: e.target.value }))}
                className="input w-full"
                placeholder="+250 7..."
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input
              type="text"
              value={healthForm.notes ?? ''}
              onChange={(e) => setHealthForm((p) => ({ ...p, notes: e.target.value }))}
              className="input w-full"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setHealthModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !healthForm.description.trim()}>
              {submitting ? <Icon icon={faSpinner} size="sm" className="animate-spin" /> : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={productionModalOpen} onClose={() => setProductionModalOpen(false)} title="Record milk production" maxWidth="max-w-md">
        <form onSubmit={handleAddProduction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <DatePicker
              value={productionForm.production_date}
              onChange={(v) => setProductionForm((p) => ({ ...p, production_date: v }))}
              max={new Date().toISOString().slice(0, 10)}
              placeholder="Select date"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Session</label>
            <Select
              value={productionForm.session}
              onChange={(v) => setProductionForm((p) => ({ ...p, session: v }))}
              options={MILK_PRODUCTION_SESSIONS.map((s) => ({ value: s.value, label: s.label }))}
              placeholder="Select session"
              allowEmpty
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (litres) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={productionForm.quantity_litres || ''}
              onChange={(e) => setProductionForm((p) => ({ ...p, quantity_litres: parseFloat(e.target.value) || 0 }))}
              className="input w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input
              type="text"
              value={productionForm.notes}
              onChange={(e) => setProductionForm((p) => ({ ...p, notes: e.target.value }))}
              className="input w-full"
              placeholder="e.g. quality notes"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setProductionModalOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !productionForm.quantity_litres}>
              {submitting ? <Icon icon={faSpinner} size="sm" className="animate-spin" /> : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={breedingModalOpen} onClose={() => setBreedingModalOpen(false)} title="Add breeding record" maxWidth="max-w-md">
        <form onSubmit={handleAddBreeding} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Breeding date *</label>
            <DatePicker
              value={breedingForm.breeding_date}
              onChange={(v) => setBreedingForm((p) => ({ ...p, breeding_date: v }))}
              max={new Date().toISOString().slice(0, 10)}
              placeholder="Select date"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Method *</label>
            <Select
              value={breedingForm.method}
              onChange={(v) => setBreedingForm((p) => ({ ...p, method: v as BreedingMethod }))}
              options={[
                { value: 'natural', label: 'Natural' },
                { value: 'artificial_insemination', label: 'Artificial insemination' },
              ]}
              placeholder="Select method"
              className="w-full"
            />
          </div>
          {breedingForm.method === 'natural' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bull (optional)</label>
                <Select
                  value={breedingForm.bull_animal_id}
                  onChange={(v) => setBreedingForm((p) => ({ ...p, bull_animal_id: v, bull_name: '' }))}
                  options={maleAnimals.map((a) => ({ value: a.id, label: `${a.tag_number} ${a.name ? `(${a.name})` : ''}` }))}
                  placeholder="— Select bull —"
                  allowEmpty
                  className="w-full"
                />
              </div>
              {!breedingForm.bull_animal_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bull name (if not registered)</label>
                  <input
                    type="text"
                    value={breedingForm.bull_name}
                    onChange={(e) => setBreedingForm((p) => ({ ...p, bull_name: e.target.value }))}
                    className="input w-full"
                    placeholder="Optional"
                  />
                </div>
              )}
            </>
          )}
          {breedingForm.method === 'artificial_insemination' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Semen code</label>
              <input
                type="text"
                value={breedingForm.semen_code ?? ''}
                onChange={(e) => setBreedingForm((p) => ({ ...p, semen_code: e.target.value }))}
                className="input w-full"
                placeholder="Optional"
              />
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Heat date</label>
              <DatePicker
                value={breedingForm.heat_date ?? ''}
                onChange={(v) => setBreedingForm((p) => ({ ...p, heat_date: v }))}
                placeholder="Optional"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expected calving date</label>
              <DatePicker
                value={breedingForm.expected_calving_date ?? ''}
                onChange={(v) => setBreedingForm((p) => ({ ...p, expected_calving_date: v }))}
                placeholder="Optional"
                className="w-full"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Outcome</label>
            <Select
              value={breedingForm.outcome ?? 'unknown'}
              onChange={(v) => setBreedingForm((p) => ({ ...p, outcome: (v || 'unknown') as CreateBreedingData['outcome'] }))}
              options={[
                { value: 'unknown', label: 'Unknown' },
                { value: 'pregnant', label: 'Pregnant' },
                { value: 'not_pregnant', label: 'Not pregnant' },
              ]}
              placeholder="Select outcome"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input type="text" value={breedingForm.notes ?? ''} onChange={(e) => setBreedingForm((p) => ({ ...p, notes: e.target.value }))} className="input w-full" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setBreedingModalOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <Icon icon={faSpinner} size="sm" className="animate-spin" /> : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={calvingModalOpen} onClose={() => setCalvingModalOpen(false)} title="Add calving record" maxWidth="max-w-md">
        <form onSubmit={handleAddCalving} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Calving date *</label>
            <DatePicker
              value={calvingForm.calving_date}
              onChange={(v) => setCalvingForm((p) => ({ ...p, calving_date: v }))}
              max={new Date().toISOString().slice(0, 10)}
              placeholder="Select date"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Outcome *</label>
            <Select
              value={calvingForm.outcome}
              onChange={(v) => setCalvingForm((p) => ({ ...p, outcome: v as CalvingOutcome }))}
              options={[
                { value: 'live', label: 'Live' },
                { value: 'stillborn', label: 'Stillborn' },
                { value: 'aborted', label: 'Aborted' },
              ]}
              placeholder="Select outcome"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Calf (if already registered)</label>
            <Select
              value={calvingForm.calf_id ?? ''}
              onChange={(v) => setCalvingForm((p) => ({ ...p, calf_id: v }))}
              options={allAnimals.filter((a) => a.id !== id).map((a) => ({ value: a.id, label: `${a.tag_number} ${a.name ? `(${a.name})` : ''}` }))}
              placeholder="— None / register later —"
              allowEmpty
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Calf gender</label>
            <Select
              value={calvingForm.gender ?? ''}
              onChange={(v) => setCalvingForm((p) => ({ ...p, gender: (v || undefined) as 'male' | 'female' | undefined }))}
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
              ]}
              placeholder="— Optional —"
              allowEmpty
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Birth weight (kg)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={calvingForm.weight_kg ?? ''}
              onChange={(e) => setCalvingForm((p) => ({ ...p, weight_kg: e.target.value ? parseFloat(e.target.value) : undefined }))}
              className="input w-full"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input type="text" value={calvingForm.notes ?? ''} onChange={(e) => setCalvingForm((p) => ({ ...p, notes: e.target.value }))} className="input w-full" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCalvingModalOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <Icon icon={faSpinner} size="sm" className="animate-spin" /> : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      {viewMoreSection === 'weights' && (
        <SectionRecordsModal<AnimalWeight>
          open
          onClose={() => setViewMoreSection(null)}
          title={`Weight history – ${animal.tag_number}`}
          data={weights}
          columns={weightTableColumns}
          exportColumns={weightExportColumns}
          exportFilename={`animal-${animal.tag_number}-weight-history`}
          emptyMessage="No weight records"
          itemLabel="weight records"
          searchPlaceholder="Search dates, weight, notes..."
        />
      )}
      {viewMoreSection === 'health' && (
        <SectionRecordsModal<AnimalHealth>
          open
          onClose={() => setViewMoreSection(null)}
          title={`Health records – ${animal.tag_number}`}
          data={healthRecords}
          columns={healthTableColumns}
          exportColumns={healthExportColumns}
          exportFilename={`animal-${animal.tag_number}-health-records`}
          emptyMessage="No health records"
          itemLabel="health records"
          searchPlaceholder="Search type, date, description..."
        />
      )}
      {viewMoreSection === 'production' && (
        <SectionRecordsModal<MilkProductionRecord>
          open
          onClose={() => setViewMoreSection(null)}
          title={`Milk production – ${animal.tag_number}`}
          data={productionList}
          columns={productionTableColumns}
          exportColumns={productionExportColumns}
          exportFilename={`animal-${animal.tag_number}-milk-production`}
          emptyMessage="No production records"
          itemLabel="production records"
          searchPlaceholder="Search date, session, quantity..."
        />
      )}
      {viewMoreSection === 'breeding' && (
        <SectionRecordsModal<AnimalBreeding>
          open
          onClose={() => setViewMoreSection(null)}
          title={`Breeding records – ${animal.tag_number}`}
          data={breedingList}
          columns={breedingTableColumns}
          exportColumns={breedingExportColumns}
          exportFilename={`animal-${animal.tag_number}-breeding-records`}
          emptyMessage="No breeding records"
          itemLabel="breeding records"
          searchPlaceholder="Search date, method, bull..."
        />
      )}
      {viewMoreSection === 'calving' && (
        <SectionRecordsModal<AnimalCalving>
          open
          onClose={() => setViewMoreSection(null)}
          title={`Calving records – ${animal.tag_number}`}
          data={calvingList}
          columns={calvingTableColumns}
          exportColumns={calvingExportColumns}
          exportFilename={`animal-${animal.tag_number}-calving-records`}
          emptyMessage="No calving records"
          itemLabel="calving records"
          searchPlaceholder="Search date, outcome, calf..."
        />
      )}
    </div>
  );
}
