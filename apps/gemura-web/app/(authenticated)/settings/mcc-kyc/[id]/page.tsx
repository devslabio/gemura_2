'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Icon, { faArrowLeft, faClipboardList } from '@/app/components/Icon';
import { profileApi } from '@/lib/api/profile';
import { useToastStore } from '@/store/toast';
import { SkeletonBar } from '@/app/components/SkeletonLoader';

function formatText(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string' && !v.trim()) return '—';
  return String(v);
}

export default function SettingsMccKycDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    profileApi
      .getOwnMccOnboarding(id)
      .then((res) => {
        if (cancelled) return;
        if (res.code === 200 && res.data && typeof res.data === 'object') {
          setRow(res.data as Record<string, unknown>);
        } else {
          useToastStore.getState().show(res.message || 'Could not load onboarding', 'error');
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          const msg =
            typeof e === 'object' &&
            e !== null &&
            'response' in e &&
            typeof (e as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
              ? (e as { response: { data: { message: string } } }).response.data.message
              : 'Could not load onboarding';
          useToastStore.getState().show(msg, 'error');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl">
        <SkeletonBar className="h-8 w-48" />
        <SkeletonBar className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  if (!row) {
    return (
      <div className="space-y-4">
        <Link href="/settings" className="text-sm text-gray-600 inline-flex items-center gap-2 hover:text-(--primary)">
          <Icon icon={faArrowLeft} size="sm" />
          Back to settings
        </Link>
        <p className="text-sm text-gray-600">Nothing to show.</p>
      </div>
    );
  }

  const payload = (row.section_payload || {}) as Record<string, unknown>;
  const linkedAccount = row.linked_account as { name?: string; code?: string } | null;

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/settings" className="text-sm text-gray-600 inline-flex items-center gap-2 hover:text-(--primary)">
        <Icon icon={faArrowLeft} size="sm" />
        Back to settings
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Icon icon={faClipboardList} />
          {formatText(row.business_name)}
        </h1>
        <p className="text-sm text-gray-500 font-mono mt-1">{formatText(row.submission_code)}</p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3 text-sm">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Review status</dt>
            <dd className="mt-0.5 font-medium text-gray-900">{formatText(row.review_status)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Wizard decision</dt>
            <dd className="mt-0.5 font-medium text-gray-900">
              {formatText(row.final_decision)} ({formatText(row.pass_count)} / 8)
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Submitted</dt>
            <dd className="mt-0.5 text-gray-900">
              {row.created_at ? new Date(String(row.created_at)).toLocaleString() : '—'}
            </dd>
          </div>
          {row.reviewed_at != null && String(row.reviewed_at).length > 0 && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">Reviewed</dt>
              <dd className="mt-0.5 text-gray-900">{new Date(String(row.reviewed_at)).toLocaleString()}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Manager</dt>
            <dd className="mt-0.5 text-gray-900">
              {formatText(row.manager_first_name)} {formatText(row.manager_last_name)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Manager phone</dt>
            <dd className="mt-0.5 font-mono text-gray-900">{formatText(row.manager_phone)}</dd>
          </div>
          {linkedAccount?.name && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-gray-500">Linked tenant</dt>
              <dd className="mt-0.5 text-gray-900">
                {linkedAccount.name}
                {linkedAccount.code ? <span className="text-gray-500 font-mono text-xs ml-2">{linkedAccount.code}</span> : null}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <button
          type="button"
          className="text-sm font-medium text-(--primary) hover:underline"
          onClick={() => setShowJson(!showJson)}
        >
          {showJson ? 'Hide' : 'Show'} full application data (JSON)
        </button>
        {showJson && (
          <pre className="mt-3 text-xs bg-gray-50 border border-gray-200 rounded-md p-3 overflow-auto max-h-[min(70vh,560px)]">
            {JSON.stringify(payload, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
