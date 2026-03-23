'use client';

import { useEffect, useMemo, useState } from 'react';
import { farmsApi, Farm } from '@/lib/api/farms';
import { useAuthStore } from '@/store/auth';
import DataTable, { TableColumn } from '@/app/components/DataTable';
import FilterBar, { FilterBarGroup, FilterBarSearch, FilterBarActions } from '@/app/components/FilterBar';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';

export default function AdminFarmsPage() {
  const { currentAccount } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [farms, setFarms] = useState<Farm[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const load = async (next?: { status?: string; search?: string }) => {
    try {
      setLoading(true);
      setError('');
      const nextStatus = next?.status !== undefined ? next.status : status;
      const nextSearch = next?.search !== undefined ? next.search : search;
      const response = await farmsApi.getFarms(currentAccount?.account_id, {
        status: nextStatus || undefined,
        search: nextSearch || undefined,
      });
      if (response.code === 200) setFarms(response.data?.farms || []);
      else setError(response.message || 'Failed to load farms');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load farms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [currentAccount?.account_id]);

  const filteredFarms = useMemo(() => farms, [farms]);

  const columns: TableColumn<Farm>[] = [
    { key: 'name', label: 'Farm Name', sortable: true },
    { key: 'code', label: 'Code', sortable: true },
    { key: 'location', label: 'Location', sortable: true, render: (v) => v || '-' },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => <span className={`px-2 py-1 rounded text-xs font-medium ${value === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{String(value)}</span>,
    },
    { key: 'animals_count', label: 'Animals', sortable: true, render: (v) => (v ?? 0) as any },
  ];

  if (loading && farms.length === 0) return <ListPageSkeleton title="Farms" filterFields={2} tableRows={8} tableCols={5} />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Farms</h1>

      <FilterBar>
        <FilterBarSearch value={search} onChange={setSearch} placeholder="Search by name, code, or location..." />
        <FilterBarGroup label="Status">
          <select
            value={status}
            onChange={(e) => {
              const v = e.target.value;
              setStatus(v);
              load({ status: v });
            }}
            className="input h-9 !py-1.5 !px-3 text-sm w-full text-gray-900"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>
        </FilterBarGroup>
        <FilterBarActions
          onClear={() => {
            setSearch('');
            setStatus('');
            load({ search: '', status: '' });
          }}
        />
      </FilterBar>

      {error && <div className="bg-red-50 border border-red-200 rounded-sm p-4 text-sm text-red-600">{error}</div>}

      <DataTable data={filteredFarms} columns={columns} loading={loading} emptyMessage="No farms found" />
    </div>
  );
}

