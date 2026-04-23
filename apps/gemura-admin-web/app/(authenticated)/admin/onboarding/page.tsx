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
  { value: 'needs_changes', label: 'Needs changes' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
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
  linked_user_id: string | null;
};

export default function OnboardingSubmissionsPage() {
  const { currentAccount } = useAuthStore();
  const { canManageUsers, isAdmin } = usePermission();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [pendingCount, setPendingCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [error, setError] = useState('');

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
        const res = await adminApi.listOnboardingSubmissions(
          pagination.page,
          pagination.limit,
          currentAccount?.account_id,
          statusFilter || undefined,
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
    pagination.page,
    pagination.limit,
  ]);

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
            Review submissions from the public wizard. Approve to create an account and link the applicant.
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-900 px-3 py-1 text-sm font-medium">
            {pendingCount} pending
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
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
                <th className="px-4 py-3 font-medium">Review</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
                <th className="px-4 py-3 font-medium w-24"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
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
                      {new Date(r.created_at).toLocaleString()}
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
