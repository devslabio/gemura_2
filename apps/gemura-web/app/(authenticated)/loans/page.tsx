'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { loansApi, Loan, CreateLoanData } from '@/lib/api/loans';
import { useAuthStore } from '@/store/auth';
import { useCrudPermissions } from '@/hooks/useCrudPermissions';
import DataTableWithPagination from '@/app/components/DataTableWithPagination';
import FilterBar, {
  FilterBarGroup,
  FilterBarSearch,
  FilterBarActions,
  FilterBarExport,
} from '@/app/components/FilterBar';
import type { TableColumn } from '@/app/components/DataTable';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';
import Modal from '@/app/components/Modal';
import BulkImportModal from '@/app/components/BulkImportModal';
import CreateLoanForm from './CreateLoanForm';
import Icon, {
  faPlus,
  faEye,
  faHandHoldingDollar,
  faFile,
  faCalendar,
} from '@/app/components/Icon';
import Link from 'next/link';

const BORROWER_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'customer', label: 'Customer' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
];

export default function LoansPage() {
  const { currentAccount } = useAuthStore();
  const { financeMutations } = useCrudPermissions();
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [error, setError] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [borrowerTypeFilter, setBorrowerTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadLoans = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await loansApi.getLoans({
        account_id: currentAccount?.account_id,
        status: statusFilter || undefined,
        borrower_type: borrowerTypeFilter || undefined,
        search: search.trim() || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      if (response.code === 200) {
        setLoans(response.data || []);
      } else {
        setError(response.message || 'Failed to load loans');
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string | string[] } }; message?: string };
      const msg = ax?.response?.data?.message;
      const str =
        typeof msg === 'string'
          ? msg
          : Array.isArray(msg)
            ? msg[0]
            : ax?.response?.data && typeof ax.response.data === 'string'
              ? ax.response.data
              : ax?.message || 'Failed to load loans';
      setError(str);
    } finally {
      setLoading(false);
    }
  }, [
    currentAccount?.account_id,
    statusFilter,
    borrowerTypeFilter,
    search,
    dateFrom,
    dateTo,
  ]);

  useEffect(() => {
    loadLoans();
  }, [loadLoans]);

  const filteredLoans = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return loans;
    return loans.filter(
      (l) =>
        (l.borrower_label && l.borrower_label.toLowerCase().includes(q)) ||
        (l.borrower_account?.code && l.borrower_account.code.toLowerCase().includes(q)) ||
        (l.borrower_account?.name && l.borrower_account.name.toLowerCase().includes(q)) ||
        (l.notes && l.notes.toLowerCase().includes(q))
    );
  }, [loans, search]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setBorrowerTypeFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-RW', {
      style: 'currency',
      currency: 'RWF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString() : '—');

  const columns: TableColumn<Loan>[] = [
    {
      key: 'borrower_label',
      label: 'Borrower',
      sortable: true,
      render: (_, row) => (
        <div>
          <div className="font-medium text-gray-900">{row.borrower_label}</div>
          <div className="text-xs text-gray-500 capitalize">{row.borrower_type}</div>
        </div>
      ),
    },
    {
      key: 'principal',
      label: 'Principal',
      sortable: true,
      render: (value) => (
        <div className="flex items-center text-gray-900">
          <Icon icon={faHandHoldingDollar} size="sm" className="mr-2 text-gray-400" />
          {formatCurrency(Number(value))}
        </div>
      ),
    },
    {
      key: 'outstanding',
      label: 'Outstanding',
      sortable: true,
      render: (value) => (
        <span className={Number(value) > 0 ? 'font-medium text-amber-700' : 'text-gray-500'}>
          {formatCurrency(Number(value))}
        </span>
      ),
    },
    {
      key: 'disbursement_date',
      label: 'Disbursed',
      sortable: true,
      render: (value) => (
        <div className="flex items-center text-gray-600">
          <Icon icon={faCalendar} size="sm" className="mr-2 text-gray-400" />
          {formatDate(value)}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => (
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${
            value === 'active' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
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
          href={`/loans/${row.id}`}
          className="p-1.5 text-gray-600 hover:text-[var(--primary)] transition-colors inline-flex"
          title="View details"
        >
          <Icon icon={faEye} size="sm" />
        </Link>
      ),
    },
  ];

  if (loading) {
    return (
      <ListPageSkeleton title="Loans" filterFields={4} tableRows={10} tableCols={5} />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loans</h1>
        </div>
        {financeMutations ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setBulkImportOpen(true)}
              className="btn btn-secondary"
            >
              <Icon icon={faFile} size="sm" className="mr-2" />
              Bulk import
            </button>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                loansApi.downloadTemplate().catch(() => {});
              }}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-4 text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors"
            >
              Download template
            </a>
            <button type="button" onClick={() => setCreateModalOpen(true)} className="btn btn-primary">
              <Icon icon={faPlus} size="sm" className="mr-2" />
              Add loan
            </button>
          </div>
        ) : null}
      </div>

      <BulkImportModal
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        title="Loans"
        columns={[
          { key: 'borrower_type', label: 'Borrower type (supplier/customer/other)', required: true },
          { key: 'borrower_account_id', label: 'Borrower account ID (UUID)' },
          { key: 'borrower_name', label: 'Borrower name (for other)' },
          { key: 'borrower_phone', label: 'Borrower phone (required for other)' },
          { key: 'principal', label: 'Principal', required: true },
          { key: 'currency', label: 'Currency' },
          { key: 'disbursement_date', label: 'Disbursement date (YYYY-MM-DD)', required: true },
          { key: 'due_date', label: 'Due date (YYYY-MM-DD)' },
          { key: 'notes', label: 'Notes' },
        ]}
        onDownloadTemplate={() => loansApi.downloadTemplate()}
        onBulkCreate={(rows) => {
          const data: CreateLoanData[] = rows.map((row) => ({
            borrower_type: (row.borrower_type as 'supplier' | 'customer' | 'other') || 'other',
            borrower_account_id:
              row.borrower_account_id && String(row.borrower_account_id).trim()
                ? String(row.borrower_account_id)
                : undefined,
            borrower_name:
              row.borrower_name != null && String(row.borrower_name).trim()
                ? String(row.borrower_name)
                : undefined,
            borrower_phone:
              row.borrower_phone != null && String(row.borrower_phone).trim()
                ? String(row.borrower_phone).trim()
                : undefined,
            principal: Number(row.principal) || 0,
            currency: row.currency ? String(row.currency) : 'RWF',
            disbursement_date: String(row.disbursement_date || ''),
            due_date: row.due_date ? String(row.due_date) : undefined,
            notes: row.notes ? String(row.notes) : undefined,
          }));
          return loansApi.bulkCreate(data).then((r) => ({
            success: r.data.success,
            failed: r.data.failed,
            errors: (r.data.errors || []).map((e: { row: number; message: string }) => ({
              row: e.row,
              phone: '',
              message: e.message,
            })),
          }));
        }}
        mapRow={(row) => ({
          borrower_type: row.borrower_type || '',
          borrower_account_id: row.borrower_account_id || '',
          borrower_name: row.borrower_name || '',
          borrower_phone: row.borrower_phone || '',
          principal: Number(row.principal) || 0,
          currency: row.currency || 'RWF',
          disbursement_date: row.disbursement_date || '',
          due_date: row.due_date || '',
          notes: row.notes || '',
        })}
        onSuccess={loadLoans}
      />

      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add loan"
        maxWidth="max-w-lg"
      >
        <CreateLoanForm
          onSuccess={() => {
            setCreateModalOpen(false);
            loadLoans();
          }}
          onCancel={() => setCreateModalOpen(false)}
        />
      </Modal>

      <FilterBar>
        <FilterBarSearch
          value={search}
          onChange={setSearch}
          placeholder="Search by borrower, notes..."
        />
        <FilterBarGroup label="Borrower type">
          <select
            value={borrowerTypeFilter}
            onChange={(e) => setBorrowerTypeFilter(e.target.value)}
            className="input h-9 min-h-[2.25rem] !py-1.5 !px-3 text-sm w-full text-gray-900"
          >
            {BORROWER_TYPE_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FilterBarGroup>
        <FilterBarGroup label="Status">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input h-9 min-h-[2.25rem] !py-1.5 !px-3 text-sm w-full text-gray-900"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FilterBarGroup>
        <FilterBarGroup label="From date">
          <input
            type="date"
            value={dateFrom}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDateFrom(e.target.value)}
            className="input h-9 min-h-[2.25rem] !py-1.5 !px-3 text-sm w-full text-gray-900"
          />
        </FilterBarGroup>
        <FilterBarGroup label="To date">
          <input
            type="date"
            value={dateTo}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDateTo(e.target.value)}
            className="input h-9 min-h-[2.25rem] !py-1.5 !px-3 text-sm w-full text-gray-900"
          />
        </FilterBarGroup>
        <FilterBarActions onClear={clearFilters} />
        <FilterBarExport<Loan>
          data={filteredLoans}
          exportFilename="loans"
          exportColumns={[
            { key: 'borrower_label', label: 'Borrower' },
            { key: 'borrower_type', label: 'Type' },
            { key: 'principal', label: 'Principal', getValue: (r) => String(r.principal) },
            { key: 'amount_repaid', label: 'Repaid', getValue: (r) => String(r.amount_repaid) },
            { key: 'outstanding', label: 'Outstanding', getValue: (r) => String(r.outstanding) },
            { key: 'status', label: 'Status' },
            {
              key: 'disbursement_date',
              label: 'Disbursement date',
              getValue: (r) => formatDate(r.disbursement_date),
            },
            { key: 'due_date', label: 'Due date', getValue: (r) => formatDate(r.due_date) },
          ]}
          disabled={loading}
        />
      </FilterBar>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <DataTableWithPagination<Loan>
        data={filteredLoans}
        columns={columns}
        loading={loading}
        emptyMessage={
          currentAccount
            ? filteredLoans.length === 0 && loans.length > 0
              ? 'No loans match the filters'
              : 'No loans for this account'
            : 'Select an account to view loans'
        }
        itemLabel="loans"
      />
    </div>
  );
}
