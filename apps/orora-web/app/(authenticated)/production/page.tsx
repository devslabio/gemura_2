'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/store/auth';
import {
  milkProductionApi,
  MilkProductionRecord,
  MILK_PRODUCTION_SESSIONS,
  MilkProductionFilters,
  MilkCostPerLitreReport,
} from '@/lib/api/milk-production';
import { animalsApi, Animal } from '@/lib/api/animals';
import { farmsApi, Farm } from '@/lib/api/farms';
import { useToastStore } from '@/store/toast';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';
import FilterBar, { FilterBarGroup, FilterBarActions } from '@/app/components/FilterBar';
import Icon, { faBox, faChartLine, faPlus, faSpinner } from '@/app/components/Icon';
import DatePicker from '@/app/components/DatePicker';
import Modal from '@/app/components/Modal';
import Select from '@/app/components/Select';
import SearchableSelect from '@/app/components/SearchableSelect';
import Link from 'next/link';
import DataTableWithPagination from '@/app/components/DataTableWithPagination';
import type { TableColumn } from '@/app/components/DataTable';

const SESSION_OPTIONS = [
  { value: '', label: 'All sessions' },
  ...MILK_PRODUCTION_SESSIONS.map((s) => ({ value: s.value, label: s.label })),
];

export default function MilkProductionPage() {
  const { currentAccount } = useAuthStore();
  const accountId = currentAccount?.account_id;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [records, setRecords] = useState<MilkProductionRecord[]>([]);
  const [report, setReport] = useState<{ total_production_litres: number; total_sold_litres: number } | null>(null);
  const [costReport, setCostReport] = useState<MilkCostPerLitreReport | null>(null);
  const [includeInventoryFeedCosts, setIncludeInventoryFeedCosts] = useState(true);
  const [avoidDoubleCounting, setAvoidDoubleCounting] = useState(true);
  const [filters, setFilters] = useState<MilkProductionFilters>({});
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [recordForm, setRecordForm] = useState({
    animal_id: '',
    production_date: new Date().toISOString().slice(0, 10),
    session: '',
    quantity_litres: '' as number | '',
    notes: '',
  });

  const load = useCallback(async () => {
    if (!accountId) return;
    try {
      setLoading(true);
      setError('');
      const hasFilters = filters.animal_id || filters.farm_id || filters.session || filters.from || filters.to;
      const listFilters = hasFilters ? filters : undefined;
      const [listRes, reportRes, costRes] = await Promise.all([
        milkProductionApi.list(accountId, listFilters),
        milkProductionApi.report(accountId, filters.from, filters.to),
        milkProductionApi.costPerLitre(
          accountId,
          filters.from,
          filters.to,
          filters.farm_id,
          includeInventoryFeedCosts,
          avoidDoubleCounting,
        ),
      ]);
      if (listRes.code === 200 && listRes.data) setRecords(listRes.data);
      if (reportRes.code === 200 && reportRes.data) setReport(reportRes.data);
      if (costRes.code === 200 && costRes.data) setCostReport(costRes.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message || e?.message || 'Failed to load production');
      setRecords([]);
      setReport(null);
      setCostReport(null);
    } finally {
      setLoading(false);
    }
  }, [accountId, filters, includeInventoryFeedCosts, avoidDoubleCounting]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!accountId) {
      setAnimals([]);
      setFarms([]);
      return;
    }
    animalsApi.getList(accountId).then((res) => {
      if (res.code === 200 && res.data) setAnimals(res.data);
      else setAnimals([]);
    }).catch(() => setAnimals([]));
    farmsApi.list(accountId).then((res) => {
      if (res.code === 200 && res.data) setFarms(res.data);
      else setFarms([]);
    }).catch(() => setFarms([]));
  }, [accountId]);

  const animalOptions = useMemo(
    () => [
      { value: '', label: 'All animals' },
      ...animals.map((a) => ({ value: a.id, label: `${a.tag_number}${a.name ? ` (${a.name})` : ''}` })),
    ],
    [animals],
  );

  const clearFilters = () => {
    setFilters({});
  };

  const handleFilterChange = (key: keyof MilkProductionFilters, value: string | undefined) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const openRecordModal = () => {
    setRecordForm({
      animal_id: '',
      production_date: new Date().toISOString().slice(0, 10),
      session: '',
      quantity_litres: '',
      notes: '',
    });
    setRecordModalOpen(true);
  };

  const handleRecordProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = typeof recordForm.quantity_litres === 'number' ? recordForm.quantity_litres : parseFloat(String(recordForm.quantity_litres));
    if (!recordForm.animal_id || !accountId || qty <= 0 || Number.isNaN(qty)) {
      useToastStore.getState().show('Please select an animal and enter a valid quantity', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await milkProductionApi.create(
        {
          animal_id: recordForm.animal_id,
          production_date: recordForm.production_date,
          session: recordForm.session.trim() || undefined,
          quantity_litres: qty,
          notes: recordForm.notes.trim() || undefined,
        },
        accountId
      );
      useToastStore.getState().show('Milk production recorded', 'success');
      setRecordModalOpen(false);
      load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      useToastStore.getState().show(e?.response?.data?.message || e?.message || 'Failed to record production', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: TableColumn<MilkProductionRecord>[] = [
    {
      key: 'production_date',
      label: 'Date',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'session',
      label: 'Session',
      sortable: true,
      render: (value) => (value ? MILK_PRODUCTION_SESSIONS.find((s) => s.value === value)?.label ?? value : '—'),
    },
    {
      key: 'quantity_litres',
      label: 'Quantity (L)',
      sortable: true,
      render: (value) => Number(value),
    },
    {
      key: 'animal',
      label: 'Animal',
      sortable: false,
      render: (_, row) =>
        row.animal ? (
          <Link href={`/animals/${row.animal.id}`} className="text-[var(--primary)] hover:underline">
            {row.animal.tag_number} {row.animal.name ? `(${row.animal.name})` : ''}
          </Link>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'farm',
      label: 'Farm',
      sortable: false,
      render: (_, row) => row.farm?.name ?? '—',
    },
    {
      key: 'notes',
      label: 'Notes',
      sortable: false,
      render: (value) => value || '—',
    },
  ];

  if (!accountId) {
    return (
      <div className="p-4">
        <p className="text-sm text-gray-500">Select an account to view milk production.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Milk production</h1>
        <button type="button" onClick={openRecordModal} className="btn btn-primary flex items-center gap-2">
          <Icon icon={faPlus} size="sm" />
          Record production
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {report != null && (
        <div className="space-y-3">
          <div className="bg-white border border-gray-200 rounded-sm p-3">
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={includeInventoryFeedCosts}
                  onChange={(e) => setIncludeInventoryFeedCosts(e.target.checked)}
                />
                Include inventory feed costs
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={avoidDoubleCounting}
                  onChange={(e) => setAvoidDoubleCounting(e.target.checked)}
                  disabled={!includeInventoryFeedCosts}
                />
                Avoid double counting (inventory-linked tags)
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Use these switches for scenario analysis before locking pricing policy.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-sm p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-sm bg-[var(--primary)]/10 flex items-center justify-center">
              <Icon icon={faBox} className="text-[var(--primary)]" size="lg" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total produced (L)</p>
              <p className="text-2xl font-bold text-gray-900">{Number(report.total_production_litres).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</p>
              {(filters.from || filters.to) && <p className="text-xs text-gray-400">In selected period</p>}
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-sm p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-sm bg-emerald-100 flex items-center justify-center">
              <Icon icon={faChartLine} className="text-emerald-600" size="lg" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total sold (L)</p>
              <p className="text-2xl font-bold text-gray-900">{Number(report.total_sold_litres).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</p>
              {(filters.from || filters.to) && <p className="text-xs text-gray-400">In selected period</p>}
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-sm p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-sm bg-amber-100 flex items-center justify-center">
              <Icon icon={faChartLine} className="text-amber-700" size="lg" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Cost per litre (producing cows)</p>
              <p className="text-2xl font-bold text-gray-900">
                {costReport
                  ? new Intl.NumberFormat('en-RW', {
                      style: 'currency',
                      currency: 'RWF',
                      minimumFractionDigits: 0,
                    }).format(costReport.cost_per_litre_producing_cows)
                  : '—'}
              </p>
              <p className="text-xs text-gray-400">
                {costReport ? `${costReport.producing_cows} producing / ${costReport.total_cows} cows` : '—'}
              </p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-sm p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-sm bg-slate-100 flex items-center justify-center">
              <Icon icon={faBox} className="text-slate-600" size="lg" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Allocated non-producing cost</p>
              <p className="text-2xl font-bold text-gray-900">
                {costReport
                  ? new Intl.NumberFormat('en-RW', {
                      style: 'currency',
                      currency: 'RWF',
                      minimumFractionDigits: 0,
                    }).format(costReport.non_producing_cost_estimate)
                  : '—'}
              </p>
              <p className="text-xs text-gray-400">
                {costReport ? `${costReport.non_producing_cows} non-producing cows` : '—'}
              </p>
            </div>
          </div>
          </div>

          {costReport && (
            <div className="bg-white border border-gray-200 rounded-sm p-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">Costing assumptions</h3>
              <p className="text-sm text-gray-700">
                Accounting expense: {new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF', minimumFractionDigits: 0 }).format(costReport.total_expense_accounting)}
                {' · '}
                Inventory feed expense: {new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF', minimumFractionDigits: 0 }).format(costReport.total_expense_inventory_feed)}
              </p>
              {costReport.farm_id && (
                <p className="text-xs text-amber-700">
                  Farm filter is applied to production/cow counts, but some costs can remain account-level unless farm-tagged.
                </p>
              )}
              <ul className="text-xs text-gray-500 list-disc pl-4">
                {costReport.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <FilterBar>
        <FilterBarGroup label="Animal">
          <SearchableSelect
            value={filters.animal_id || ''}
            onChange={(v) => handleFilterChange('animal_id', v)}
            options={animalOptions}
            placeholder="Search or select animal..."
            className="w-full"
          />
        </FilterBarGroup>
        <FilterBarGroup label="Session">
          <Select
            value={filters.session || ''}
            onChange={(v) => handleFilterChange('session', v)}
            options={SESSION_OPTIONS}
            placeholder="All sessions"
            className="w-full"
          />
        </FilterBarGroup>
        <FilterBarGroup label="Farm">
          <Select
            value={filters.farm_id || ''}
            onChange={(v) => handleFilterChange('farm_id', v)}
            options={[{ value: '', label: 'All farms' }, ...farms.map((f) => ({ value: f.id, label: f.name }))]}
            placeholder="All farms"
            className="w-full"
          />
        </FilterBarGroup>
        <FilterBarGroup label="From date">
          <DatePicker value={filters.from || ''} onChange={(v) => handleFilterChange('from', v)} max={new Date().toISOString().slice(0, 10)} placeholder="From" className="w-full" />
        </FilterBarGroup>
        <FilterBarGroup label="To date">
          <DatePicker value={filters.to || ''} onChange={(v) => handleFilterChange('to', v)} max={new Date().toISOString().slice(0, 10)} placeholder="To" className="w-full" />
        </FilterBarGroup>
        <FilterBarActions onClear={clearFilters} />
      </FilterBar>

      {loading ? (
        <ListPageSkeleton title="Milk production" filterFields={4} tableRows={10} tableCols={6} />
      ) : (
        <DataTableWithPagination<MilkProductionRecord>
          data={records}
          columns={columns}
          loading={false}
          emptyMessage="No production records. Use filters or record production above."
          itemLabel="records"
        />
      )}

      <Modal open={recordModalOpen} onClose={() => setRecordModalOpen(false)} title="Record milk production" maxWidth="max-w-md">
        <form onSubmit={handleRecordProduction} className="space-y-4">
          <div className="input-group">
            <label htmlFor="prod-animal" className="input-group-label">Animal *</label>
            <Select
              id="prod-animal"
              value={recordForm.animal_id}
              onChange={(v) => setRecordForm((p) => ({ ...p, animal_id: v }))}
              options={animals.map((a) => ({ value: a.id, label: `${a.tag_number}${a.name ? ` (${a.name})` : ''}` }))}
              placeholder="Select animal"
              allowEmpty
              required
              className="w-full"
            />
          </div>
          <div className="input-group">
            <label className="input-group-label">Date *</label>
            <DatePicker
              value={recordForm.production_date}
              onChange={(v) => setRecordForm((p) => ({ ...p, production_date: v }))}
              max={new Date().toISOString().slice(0, 10)}
              placeholder="Select date"
              className="w-full"
            />
          </div>
          <div className="input-group">
            <label htmlFor="prod-session" className="input-group-label">Session</label>
            <Select
              id="prod-session"
              value={recordForm.session}
              onChange={(v) => setRecordForm((p) => ({ ...p, session: v }))}
              options={MILK_PRODUCTION_SESSIONS.map((s) => ({ value: s.value, label: s.label }))}
              placeholder="Select session"
              allowEmpty
              className="w-full"
            />
          </div>
          <div className="input-group">
            <label htmlFor="prod-qty" className="input-group-label">Quantity (litres) *</label>
            <input
              id="prod-qty"
              type="number"
              step="0.01"
              min="0"
              value={recordForm.quantity_litres === '' ? '' : recordForm.quantity_litres}
              onChange={(e) => setRecordForm((p) => ({ ...p, quantity_litres: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 }))}
              className="input w-full"
              required
            />
          </div>
          <div className="input-group">
            <label htmlFor="prod-notes" className="input-group-label">Notes</label>
            <input
              id="prod-notes"
              type="text"
              value={recordForm.notes}
              onChange={(e) => setRecordForm((p) => ({ ...p, notes: e.target.value }))}
              className="input w-full"
              placeholder="e.g. quality notes"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setRecordModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !recordForm.animal_id || recordForm.quantity_litres === '' || (typeof recordForm.quantity_litres === 'number' && recordForm.quantity_litres <= 0)}>
              {submitting ? <Icon icon={faSpinner} size="sm" className="animate-spin" /> : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
