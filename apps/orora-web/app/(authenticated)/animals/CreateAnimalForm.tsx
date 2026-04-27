'use client';

import { useState, useEffect } from 'react';
import { animalsApi, CreateAnimalData, Animal, AnimalStatus, AnimalSource, AnimalGender } from '@/lib/api/animals';
import { breedsApi, Breed } from '@/lib/api/breeds';
import { speciesApi, Species } from '@/lib/api/species';
import { useAuthStore } from '@/store/auth';
import { useFarmStore } from '@/store/farms';
import { useToastStore } from '@/store/toast';
import Icon, { faCheckCircle, faSpinner } from '@/app/components/Icon';
import DatePicker from '@/app/components/DatePicker';
import Select from '@/app/components/Select';

const STATUS_OPTIONS: { value: AnimalStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'lactating', label: 'Lactating' },
  { value: 'dry', label: 'Dry' },
  { value: 'pregnant', label: 'Pregnant' },
  { value: 'sick', label: 'Sick' },
  { value: 'sold', label: 'Sold' },
  { value: 'dead', label: 'Dead' },
  { value: 'culled', label: 'Culled' },
];

const SOURCE_OPTIONS: { value: AnimalSource; label: string }[] = [
  { value: 'born_on_farm', label: 'Born on farm' },
  { value: 'purchased', label: 'Purchased' },
  { value: 'donated', label: 'Donated' },
  { value: 'other', label: 'Other' },
];

const GENDER_OPTIONS: { value: AnimalGender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

interface CreateAnimalFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: Partial<CreateAnimalData> & { id?: string; species_id?: string };
}

export default function CreateAnimalForm({ onSuccess, onCancel, initialData }: CreateAnimalFormProps) {
  const { currentAccount } = useAuthStore();
  const accountId = currentAccount?.account_id;
  const farmsByAccount = useFarmStore((state) => state.farmsByAccount);
  const selectedFarmByAccount = useFarmStore((state) => state.selectedFarmByAccount);
  const farmsForAccount = accountId ? farmsByAccount[accountId] || [] : [];
  const selectedFarmId = accountId ? selectedFarmByAccount[accountId] ?? null : null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [parents, setParents] = useState<Animal[]>([]);
  const [speciesList, setSpeciesList] = useState<Species[]>([]);
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [formData, setFormData] = useState<CreateAnimalData>({
    tag_number: initialData?.tag_number ?? '',
    name: initialData?.name ?? '',
    species_id: initialData?.species_id ?? '',
    breed_id: initialData && 'breed_id' in initialData ? (initialData as any).breed_id : '',
    gender: initialData?.gender ?? 'female',
    date_of_birth: initialData?.date_of_birth ?? '',
    source: initialData?.source ?? 'born_on_farm',
    purchase_date: initialData?.purchase_date ?? '',
    purchase_price: initialData?.purchase_price ?? undefined,
    mother_id: initialData?.mother_id ?? '',
    father_id: initialData?.father_id ?? '',
    status: initialData?.status ?? 'active',
    notes: initialData?.notes ?? '',
    farm_id: initialData && 'farm_id' in initialData ? (initialData as any).farm_id : selectedFarmId ?? undefined,
  });

  const isEdit = Boolean(initialData?.id);

  useEffect(() => {
    animalsApi.getList(accountId).then((res) => res.data && setParents(res.data)).catch(() => {});
  }, [accountId]);

  useEffect(() => {
    speciesApi
      .getList()
      .then((res) => {
        if (!res.data?.length) return;
        setSpeciesList(res.data);
        if (!isEdit) {
          setFormData((prev) => {
            if (prev.species_id) return prev;
            const cattle = res.data!.find((s) => s.code === 'cattle') ?? res.data![0];
            return { ...prev, species_id: cattle.id };
          });
        }
      })
      .catch(() => {});
  }, [isEdit]);

  useEffect(() => {
    if (!formData.species_id) {
      setBreeds([]);
      return;
    }
    breedsApi
      .getList(formData.species_id)
      .then((res) => res.data && setBreeds(res.data))
      .catch(() => setBreeds([]));
  }, [formData.species_id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'purchase_price' ? (value === '' ? undefined : parseFloat(value)) : value,
    }));
    setError('');
  };

  const validate = (): boolean => {
    if (!formData.tag_number.trim()) {
      setError('Tag number is required');
      return false;
    }
    if (!formData.species_id?.trim()) {
      setError('Species is required');
      return false;
    }
    if (!formData.breed_id?.trim()) {
      setError('Breed is required');
      return false;
    }
    if (!formData.date_of_birth) {
      setError('Date of birth is required');
      return false;
    }
    if (new Date(formData.date_of_birth) > new Date()) {
      setError('Date of birth must not be in the future');
      return false;
    }
    if (formData.purchase_date && new Date(formData.purchase_date) > new Date()) {
      setError('Purchase date must not be in the future');
      return false;
    }
    if (!isEdit) {
      const farmId = formData.farm_id || selectedFarmId;
      if (!farmId) {
        setError(farmsForAccount.length === 0 ? 'Create a farm first, then register the animal.' : 'Please select a farm.');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const farmId = formData.farm_id || selectedFarmId;
      const payload: CreateAnimalData = {
        tag_number: formData.tag_number.trim(),
        species_id: formData.species_id?.trim(),
        breed_id: formData.breed_id.trim(),
        gender: formData.gender,
        date_of_birth: formData.date_of_birth,
        source: formData.source,
        name: formData.name?.trim() || undefined,
        purchase_date: formData.purchase_date?.trim() || undefined,
        purchase_price: formData.purchase_price,
        mother_id: formData.mother_id?.trim() || undefined,
        father_id: formData.father_id?.trim() || undefined,
        status: formData.status,
        notes: formData.notes?.trim() || undefined,
        farm_id: isEdit ? (farmId || undefined) : (farmId ?? undefined),
      };
      if (isEdit && initialData?.id) {
        await animalsApi.update(initialData.id, payload, accountId);
        useToastStore.getState().show('Animal updated successfully', 'success');
      } else {
        await animalsApi.create(payload, accountId);
        useToastStore.getState().show('Animal registered successfully', 'success');
      }
      onSuccess();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message || e?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tag number *</label>
          <input
            type="text"
            name="tag_number"
            value={formData.tag_number}
            onChange={handleChange}
            className="input w-full"
            placeholder="e.g. TAG-001"
            disabled={isEdit}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            name="name"
            value={formData.name ?? ''}
            onChange={handleChange}
            className="input w-full"
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Species *</label>
          <Select
            name="species_id"
            value={formData.species_id ?? ''}
            onChange={(v) => setFormData((prev) => ({ ...prev, species_id: v, breed_id: '' }))}
            options={speciesList.map((s) => ({ value: s.id, label: s.name }))}
            placeholder="— Select species —"
            allowEmpty
            required
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Breed *</label>
          <Select
            name="breed_id"
            value={formData.breed_id ?? ''}
            onChange={(v) => setFormData((prev) => ({ ...prev, breed_id: v }))}
            options={breeds.map((b) => ({ value: b.id, label: `${b.name}${b.code ? ` (${b.code})` : ''}` }))}
            placeholder={formData.species_id ? '— Select breed —' : '— Select species first —'}
            allowEmpty
            required
            className="w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
          <Select
            name="gender"
            value={formData.gender}
            onChange={(v) => setFormData((prev) => ({ ...prev, gender: v as AnimalGender }))}
            options={GENDER_OPTIONS}
            placeholder="Select gender"
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date of birth *</label>
          <DatePicker
            name="date_of_birth"
            value={formData.date_of_birth}
            onChange={(v) => setFormData((prev) => ({ ...prev, date_of_birth: v }))}
            max={today}
            placeholder="Select date"
            required
            className="w-full"
          />
        </div>
      </div>

      <div className="max-w-md">
        <label className="block text-sm font-medium text-gray-700 mb-1">Source *</label>
        <Select
          name="source"
          value={formData.source}
          onChange={(v) => setFormData((prev) => ({ ...prev, source: v as AnimalSource }))}
          options={SOURCE_OPTIONS}
          placeholder="Select source"
          className="w-full"
        />
      </div>

      {formData.source === 'purchased' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Purchase date</label>
            <DatePicker
              name="purchase_date"
              value={formData.purchase_date ?? ''}
              onChange={(v) => setFormData((prev) => ({ ...prev, purchase_date: v }))}
              max={today}
              placeholder="Select date"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Purchase price (RWF)</label>
            <input
              type="number"
              name="purchase_price"
              value={formData.purchase_price ?? ''}
              onChange={handleChange}
              min={0}
              step={1}
              className="input w-full"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mother</label>
          <Select
            name="mother_id"
            value={formData.mother_id ?? ''}
            onChange={(v) => setFormData((prev) => ({ ...prev, mother_id: v }))}
            options={parents
              .filter(
                (a) =>
                  a.gender === 'female' &&
                  a.id !== initialData?.id &&
                  (!formData.species_id || a.species?.id === formData.species_id),
              )
              .map((a) => ({ value: a.id, label: `${a.tag_number} ${a.name ? `(${a.name})` : ''}` }))}
            placeholder="— None —"
            allowEmpty
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Father</label>
          <Select
            name="father_id"
            value={formData.father_id ?? ''}
            onChange={(v) => setFormData((prev) => ({ ...prev, father_id: v }))}
            options={parents
              .filter(
                (a) =>
                  a.gender === 'male' &&
                  a.id !== initialData?.id &&
                  (!formData.species_id || a.species?.id === formData.species_id),
              )
              .map((a) => ({ value: a.id, label: `${a.tag_number} ${a.name ? `(${a.name})` : ''}` }))}
            placeholder="— None —"
            allowEmpty
            className="w-full"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <Select
          name="status"
          value={formData.status}
          onChange={(v) => setFormData((prev) => ({ ...prev, status: v as AnimalStatus }))}
          options={STATUS_OPTIONS}
          placeholder="Select status"
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Farm {!isEdit && '*'}
        </label>
        {farmsForAccount.length === 0 ? (
          <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-sm p-3">
            No farms yet. Create a farm first, then you can register animals to it.
          </p>
        ) : (
          <Select
            name="farm_id"
            value={formData.farm_id ?? selectedFarmId ?? ''}
            onChange={(v) => setFormData((prev) => ({ ...prev, farm_id: v || undefined }))}
            options={farmsForAccount.map((f) => ({ value: f.id, label: f.name }))}
            placeholder={isEdit ? '— Unchanged —' : '— Select farm —'}
            allowEmpty
            required={!isEdit}
            className="w-full"
          />
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          name="notes"
          value={formData.notes ?? ''}
          onChange={handleChange}
          className="input w-full min-h-[80px]"
          placeholder="Optional notes"
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn btn-secondary">
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || (!isEdit && farmsForAccount.length === 0)}
        >
          {loading ? (
            <Icon icon={faSpinner} size="sm" className="mr-2 animate-spin" />
          ) : (
            <Icon icon={faCheckCircle} size="sm" className="mr-2" />
          )}
          {isEdit ? 'Update Animal' : 'Register Animal'}
        </button>
      </div>
    </form>
  );
}
