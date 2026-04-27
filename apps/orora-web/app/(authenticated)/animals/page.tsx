'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { animalsApi, Animal } from '@/lib/api/animals';
import { speciesApi, Species } from '@/lib/api/species';
import { useAuthStore } from '@/store/auth';
import { useFarmStore } from '@/store/farms';
import DataTableWithPagination from '@/app/components/DataTableWithPagination';
import FilterBar, {
  FilterBarSearch,
  FilterBarGroup,
  FilterBarActions,
  FilterBarExport,
} from '@/app/components/FilterBar';
import type { TableColumn } from '@/app/components/DataTable';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';
import Modal from '@/app/components/Modal';
import CreateAnimalForm from './CreateAnimalForm';
import Icon, { faPlus, faEye, faPaw } from '@/app/components/Icon';
import Select from '@/app/components/Select';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'lactating', label: 'Lactating' },
  { value: 'dry', label: 'Dry' },
  { value: 'pregnant', label: 'Pregnant' },
  { value: 'sick', label: 'Sick' },
  { value: 'sold', label: 'Sold' },
  { value: 'dead', label: 'Dead' },
  { value: 'culled', label: 'Culled' },
];

const GENDER_OPTIONS = [
  { value: '', label: 'All genders' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

export default function AnimalsPage() {
  const { currentAccount } = useAuthStore();
  const accountId = currentAccount?.account_id;
  const farmsByAccount = useFarmStore((state) => state.farmsByAccount);
  const selectedFarmByAccount = useFarmStore((state) => state.selectedFarmByAccount);
  const farmsForAccount = accountId ? farmsByAccount[accountId] || [] : [];
  const selectedFarmId = accountId ? selectedFarmByAccount[accountId] ?? null : null;
  const selectedFarm = farmsForAccount.find((f) => f.id === selectedFarmId) || null;
  const [loading, setLoading] = useState(true);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [error, setError] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('');
  const [speciesOptions, setSpeciesOptions] = useState<Species[]>([]);

  const loadAnimals = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const filters: {
        status?: string;
        gender?: string;
        species_id?: string;
        search?: string;
        farm_id?: string;
      } = {};
      if (statusFilter) filters.status = statusFilter;
      if (genderFilter) filters.gender = genderFilter;
      if (speciesFilter) filters.species_id = speciesFilter;
      if (search.trim()) filters.search = search.trim();
      if (selectedFarmId) filters.farm_id = selectedFarmId;
      const response = await animalsApi.getList(accountId, Object.keys(filters).length ? filters : undefined);
      if (response.code === 200) {
        setAnimals(response.data ?? []);
      } else {
        setError(response.message || 'Failed to load animals');
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message || e?.message || 'Failed to load animals');
    } finally {
      setLoading(false);
    }
  }, [accountId, statusFilter, genderFilter, speciesFilter, search, selectedFarmId]);

  useEffect(() => {
    loadAnimals();
  }, [loadAnimals]);

  useEffect(() => {
    speciesApi.getList().then((res) => res.data && setSpeciesOptions(res.data)).catch(() => {});
  }, []);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setGenderFilter('');
    setSpeciesFilter('');
  };

  const columns: TableColumn<Animal>[] = [
    {
      key: 'tag_number',
      label: 'Tag',
      sortable: true,
      render: (value, row) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          {row.name && <div className="text-xs text-gray-500">{row.name}</div>}
        </div>
      ),
    },
    {
      key: 'species',
      label: 'Species',
      sortable: true,
      render: (_, row) => <span className="text-gray-900">{row.species?.name ?? '—'}</span>,
    },
    {
      key: 'breed',
      label: 'Breed',
      sortable: true,
      render: (_, row) => <span className="text-gray-900">{row.breed?.name ?? '—'}</span>,
    },
    {
      key: 'gender',
      label: 'Gender',
      sortable: true,
      render: (value) => (
        <span className="capitalize text-gray-900">{String(value)}</span>
      ),
    },
    {
      key: 'date_of_birth',
      label: 'Date of birth',
      sortable: true,
      render: (value) => (
        <span className="text-gray-900">
          {value ? new Date(value).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => (
        <span
          className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
            value === 'active'
              ? 'bg-green-100 text-green-700'
              : value === 'lactating' || value === 'pregnant'
                ? 'bg-blue-100 text-blue-700'
                : value === 'sick'
                  ? 'bg-amber-100 text-amber-700'
                  : value === 'dead' || value === 'sold'
                    ? 'bg-gray-100 text-gray-700'
                    : 'bg-gray-100 text-gray-600'
          }`}
        >
          {String(value).charAt(0).toUpperCase() + String(value).slice(1)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <Link
          href={`/animals/${row.id}`}
          className="p-1.5 text-gray-600 hover:text-[var(--primary)] transition-colors inline-flex"
          title="View details"
        >
          <Icon icon={faEye} size="sm" />
        </Link>
      ),
    },
  ];

  if (loading && animals.length === 0) {
    return (
      <ListPageSkeleton title="Animals" filterFields={4} tableRows={10} tableCols={5} />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Animals</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Livestock registration and tracking{selectedFarm ? ` · ${selectedFarm.name}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="btn btn-primary"
        >
          <Icon icon={faPlus} size="sm" className="mr-2" />
          Add Animal
        </button>
      </div>

      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Register Animal"
        maxWidth="max-w-lg"
      >
        <CreateAnimalForm
          onSuccess={() => {
            setCreateModalOpen(false);
            loadAnimals();
          }}
          onCancel={() => setCreateModalOpen(false)}
        />
      </Modal>

      <FilterBar>
        <FilterBarSearch
          value={search}
          onChange={setSearch}
          placeholder="Search by tag, name, breed..."
        />
        <FilterBarGroup label="Status">
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS.filter((o) => o.value !== '')}
            placeholder="All statuses"
            allowEmpty
            className="w-full"
          />
        </FilterBarGroup>
        <FilterBarGroup label="Gender">
          <Select
            value={genderFilter}
            onChange={setGenderFilter}
            options={GENDER_OPTIONS.filter((o) => o.value !== '')}
            placeholder="All genders"
            allowEmpty
            className="w-full"
          />
        </FilterBarGroup>
        <FilterBarGroup label="Species">
          <Select
            value={speciesFilter}
            onChange={setSpeciesFilter}
            options={speciesOptions.map((s) => ({ value: s.id, label: s.name }))}
            placeholder="All species"
            allowEmpty
            className="w-full"
          />
        </FilterBarGroup>
        <FilterBarActions onClear={clearFilters} />
        <FilterBarExport<Animal>
          data={animals}
          exportFilename="animals"
          exportColumns={[
            { key: 'tag_number', label: 'Tag' },
            { key: 'name', label: 'Name', getValue: (r) => r.name ?? '' },
            { key: 'species', label: 'Species', getValue: (r) => r.species?.name ?? '' },
            { key: 'breed', label: 'Breed', getValue: (r) => r.breed?.name ?? '' },
            { key: 'gender', label: 'Gender' },
            { key: 'date_of_birth', label: 'DOB', getValue: (r) => (r.date_of_birth ? new Date(r.date_of_birth).toLocaleDateString() : '') },
            { key: 'status', label: 'Status' },
          ]}
          disabled={loading}
        />
      </FilterBar>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <DataTableWithPagination<Animal>
        data={animals}
        columns={columns}
        loading={loading}
        emptyMessage={
          currentAccount
            ? 'No animals registered. Add your first animal to get started.'
            : 'Select an account to view animals'
        }
        itemLabel="animals"
      />
    </div>
  );
}
