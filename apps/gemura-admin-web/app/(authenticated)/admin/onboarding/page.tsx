'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePermission } from '@/hooks/usePermission';
import { useAuthStore } from '@/store/auth';
import { PermissionService } from '@/lib/services/permission.service';
import { adminApi } from '@/lib/api/admin';
import { useToastStore } from '@/store/toast';
import Icon, { faClipboardList, faEye } from '@/app/components/Icon';
import Pagination from '@/app/components/Pagination';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Onboarded (approved)' },
  { value: 'needs_changes', label: 'Needs changes' },
  { value: 'rejected', label: 'Rejected' },
];

const DATE_PRESET_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'custom', label: 'Custom range' },
];

type Row = {
  id: string;
  submission_code: string;
  business_name: string;
  common_name: string | null;
  manager_first_name: string;
  manager_last_name: string;
  manager_phone: string;
  final_decision: string;
  pass_count: number;
  review_status: string;
  created_at: string;
  reviewed_at: string | null;
  linked_user_id: string | null;
  linked_account_id: string | null;
  linked_account: {
    code: string;
    name: string;
  } | null;
};

export default function OnboardingSubmissionsPage() {
  const { currentAccount } = useAuthStore();
  const { canManageUsers, isAdmin } = usePermission();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [pendingCount, setPendingCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [query, setQuery] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [onboardedFrom, setOnboardedFrom] = useState('');
  const [onboardedTo, setOnboardedTo] = useState('');
  const [exporting, setExporting] = useState<'csv' | 'xlsx' | null>(null);
  const [error, setError] = useState('');
  const tzOffsetMinutes = new Date().getTimezoneOffset();

  const toLocalYmd = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const onExport = async (format: 'csv' | 'xlsx') => {
    try {
      setExporting(format);
      const reviewStatus = statusFilter || undefined;
      const activeFrom = onboardedFrom || undefined;
      const activeTo = onboardedTo || undefined;
      const blob =
        format === 'csv'
          ? await adminApi.exportOnboardingSubmissionsCsv(
              currentAccount?.account_id,
              reviewStatus,
              activeFrom,
              activeTo,
              tzOffsetMinutes,
            )
          : await adminApi.exportOnboardingSubmissionsXlsx(
              currentAccount?.account_id,
              reviewStatus,
              activeFrom,
              activeTo,
              tzOffsetMinutes,
            );
      const day = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `mcc-onboarding-${statusFilter || 'all'}-${day}.${format}`);
      useToastStore.getState().success(`MCC onboarding ${format.toUpperCase()} exported.`);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || `Failed to export ${format.toUpperCase()}`;
      useToastStore.getState().error(msg);
    } finally {
      setExporting(null);
    }
  };

  useEffect(() => {
    // Permission guard checked separately below; do NOT include the
    // hook-returned functions in deps - they are new refs every render and
    // would re-fire this effect forever (endless skeleton loop).
    if (!PermissionService.canManageUsers() && !PermissionService.isAdmin()) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const activeFrom = onboardedFrom || undefined;
        const activeTo = onboardedTo || undefined;
        const res = await adminApi.listOnboardingSubmissions(
          pagination.page,
          pagination.limit,
          currentAccount?.account_id,
          statusFilter || undefined,
          query || undefined,
          activeFrom,
          activeTo,
          tzOffsetMinutes,
        );
        if (cancelled) return;
        if (res.code === 200 && res.data) {
          setRows(res.data.submissions as Row[]);
          setPagination(res.data.pagination);
          setPendingCount(res.data.pendingCount ?? 0);
        } else {
          setError(res.message || 'Failed to load');
        }
      } catch (e: any) {
        if (cancelled) return;
        const msg = e?.response?.data?.message || e?.message || 'Failed to load';
        setError(msg);
        useToastStore.getState().error(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    currentAccount?.account_id,
    statusFilter,
    query,
    onboardedFrom,
    onboardedTo,
    pagination.page,
    pagination.limit,
  ]);

  useEffect(() => {
    const now = new Date();
    if (datePreset === 'all') {
      setOnboardedFrom('');
      setOnboardedTo('');
      return;
    }
    if (datePreset === 'today') {
      const today = toLocalYmd(now);
      setOnboardedFrom(today);
      setOnboardedTo(today);
      return;
    }
    if (datePreset === 'last_7_days') {
      const from = new Date(now);
      from.setDate(now.getDate() - 6);
      setOnboardedFrom(toLocalYmd(from));
      setOnboardedTo(toLocalYmd(now));
      return;
    }
    if (datePreset === 'this_month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      setOnboardedFrom(toLocalYmd(first));
      setOnboardedTo(toLocalYmd(now));
      return;
    }
    if (datePreset === 'last_month') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      setOnboardedFrom(toLocalYmd(first));
      setOnboardedTo(toLocalYmd(last));
    }
  }, [datePreset]);

  if (!canManageUsers() && !isAdmin()) {
    return (
      <div className="p-6">
        <p className="text-gray-600">You do not have access to this page.</p>
      </div>
    );
  }

  if (loading && rows.length === 0) return <ListPageSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Icon icon={faClipboardList} />
            MCC onboarding
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Superadmin view for MCCs from the public onboarding wizard. Approve to create an account and link the applicant.
            Rows come from the API database (<span className="font-mono text-xs">mcc_onboarding_submissions</span>
            ); use <span className="font-medium">Status</span> to filter — default is <span className="font-medium">all</span>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-900 px-3 py-1 text-sm font-medium">
              {pendingCount} pending
            </span>
          )}
          <button
            type="button"
            className="btn border border-gray-300 bg-white"
            onClick={() => onExport('csv')}
            disabled={exporting !== null}
          >
            {exporting === 'csv' ? 'Exporting CSV...' : 'Export CSV'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onExport('xlsx')}
            disabled={exporting !== null}
          >
            {exporting === 'xlsx' ? 'Exporting Excel...' : 'Export Excel'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(searchTerm.trim());
            setPagination((p) => ({ ...p, page: 1 }));
          }}
        >
          <input
            className="border border-gray-200 rounded-sm px-3 py-2 text-sm bg-white w-72"
            placeholder="Search business, manager, phone, or account code"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            Search
          </button>
          {query && (
            <button
              type="button"
              className="btn border border-gray-300 bg-white"
              onClick={() => {
                setSearchTerm('');
                setQuery('');
                setPagination((p) => ({ ...p, page: 1 }));
              }}
            >
              Clear
            </button>
          )}
        </form>
        <label className="text-sm text-gray-600">Status</label>
        <select
          className="border border-gray-200 rounded-sm px-3 py-2 text-sm bg-white"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <label className="text-sm text-gray-600">Onboarded date</label>
        <select
          className="border border-gray-200 rounded-sm px-3 py-2 text-sm bg-white"
          value={datePreset}
          onChange={(e) => {
            setDatePreset(e.target.value);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
        >
          {DATE_PRESET_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {datePreset === 'custom' && (
          <>
            <input
              type="date"
              className="border border-gray-200 rounded-sm px-3 py-2 text-sm bg-white"
              value={onboardedFrom}
              onChange={(e) => {
                setOnboardedFrom(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
            />
            <span className="text-gray-500 text-sm">to</span>
            <input
              type="date"
              className="border border-gray-200 rounded-sm px-3 py-2 text-sm bg-white"
              value={onboardedTo}
              onChange={(e) => {
                setOnboardedTo(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
            />
          </>
        )}
        {!loading && (
          <span className="text-sm text-gray-500">
            {pagination.total} total matching filter
            {statusFilter === '' ? ' (all statuses)' : statusFilter === 'approved' ? ' (onboarded)' : ''}
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">Business</th>
                <th className="px-4 py-3 font-medium">Manager</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Linked account</th>
                <th className="px-4 py-3 font-medium">Review</th>
                <th className="px-4 py-3 font-medium">Onboarded / Submitted</th>
                <th className="px-4 py-3 font-medium w-24"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No submissions found.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50/80">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{r.business_name}</div>
                      {r.common_name && <div className="text-gray-500 text-xs">{r.common_name}</div>}
                      <div className="text-xs text-gray-400 font-mono">{r.submission_code}</div>
                    </td>
                    <td className="px-4 py-3">
                      {r.manager_first_name} {r.manager_last_name}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{r.manager_phone}</td>
                    <td className="px-4 py-3">
                      {r.linked_account_id && r.linked_account ? (
                        <Link href={`/admin/accounts/${r.linked_account_id}`} className="text-primary hover:underline">
                          <span className="font-mono text-xs">{r.linked_account.code}</span>
                          <span className="ml-2 text-gray-600 text-xs">{r.linked_account.name}</span>
                        </Link>
                      ) : (
                        <span className="text-gray-400 text-xs">Not created yet</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          r.review_status === 'pending'
                            ? 'bg-amber-100 text-amber-900'
                            : r.review_status === 'approved'
                              ? 'bg-green-100 text-green-800'
                              : r.review_status === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {r.review_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {r.review_status === 'approved' && r.reviewed_at
                        ? new Date(r.reviewed_at).toLocaleString()
                        : new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/onboarding/${r.id}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline text-sm font-medium"
                      >
                        <Icon icon={faEye} size="sm" />
                        Review
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pagination.total > 0 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          pageSize={pagination.limit}
          itemLabel="submissions"
          onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
        />
      )}
    </div>
  );
}
