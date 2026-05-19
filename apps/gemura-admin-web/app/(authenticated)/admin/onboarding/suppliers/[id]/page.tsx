'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { PermissionService } from '@/lib/services/permission.service';
import { usePermission } from '@/hooks/usePermission';
import { adminApi } from '@/lib/api/admin';
import { useToastStore } from '@/store/toast';
import Icon, { faArrowLeft } from '@/app/components/Icon';
import { DetailPageSkeleton } from '@/app/components/SkeletonLoader';
import { SupplierOnboardingPayloadDisplay } from '../SupplierOnboardingReadView';

export default function SupplierOnboardingDetailPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const { currentAccount } = useAuthStore();
  const { canManageUsers, isAdmin } = usePermission();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!id || (!PermissionService.canManageUsers() && !PermissionService.isAdmin())) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await adminApi.getSupplierMilkOnboarding(id, currentAccount?.account_id);
        if (cancelled) return;
        if (res.code === 200 && res.data) {
          setData(res.data as Record<string, unknown>);
        } else {
          setError((res as { message?: string }).message || 'Failed to load');
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
  }, [id, currentAccount?.account_id]);

  if (!canManageUsers() && !isAdmin()) {
    return (
      <div className="p-6">
        <p className="text-gray-600">You do not have access to this page.</p>
      </div>
    );
  }

  if (loading) return <DetailPageSkeleton />;

  if (error || !data) {
    return (
      <div className="p-6 space-y-3">
        <Link href="/admin/onboarding/suppliers" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <Icon icon={faArrowLeft} size="sm" />
          Back to suppliers onboarding
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-sm p-4 text-sm text-red-700">{error || 'Not found'}</div>
      </div>
    );
  }

  const user = data.user as Record<string, unknown> | undefined;
  const linkedMcc = data.linked_mcc as { id?: string; code?: string; name?: string } | null;
  const linkedSupplier = data.linked_supplier_account as { id?: string; code?: string; name?: string } | null;

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/onboarding/suppliers" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <Icon icon={faArrowLeft} size="sm" />
          Suppliers onboarding
        </Link>
      </div>

      <h1 className="text-xl font-semibold text-gray-900">Supplier onboarding record</h1>
      <p className="text-sm text-gray-500">
        Wizard payload captured when this supplier was onboarded onto the platform via an MCC user.
      </p>

      <section className="bg-white border border-gray-200 rounded-sm p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">Summary</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Record id</dt>
            <dd className="font-mono text-xs mt-1 text-gray-900">{String(data.id)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Registered</dt>
            <dd className="mt-1 text-gray-900">
              {data.created_at ? new Date(String(data.created_at)).toLocaleString() : '—'}
            </dd>
          </div>
          {user && (
            <>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">User</dt>
                <dd className="mt-1 text-gray-900">
                  <span className="font-medium">{String(user.name ?? '')}</span>
                  <div className="font-mono text-xs text-gray-600">{String(user.code ?? '')}</div>
                  <Link href={`/admin/users/${String(user.id ?? '')}`} className="text-primary text-xs hover:underline">
                    Open user
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">Phone · type</dt>
                <dd className="mt-1 text-gray-900 font-mono text-xs">{String(user.phone ?? '')}</dd>
                <dd className="text-gray-600 text-xs capitalize">
                  {String(user.account_type ?? '')}
                  {user.supplier_segment != null && user.supplier_segment !== '' ? ` · ${String(user.supplier_segment)}` : ''}
                </dd>
              </div>
            </>
          )}
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Supplier account</dt>
            <dd className="mt-1">
              {linkedSupplier?.id ? (
                <Link href={`/admin/accounts/${linkedSupplier.id}`} className="text-primary hover:underline text-sm">
                  <span className="font-mono text-xs">{linkedSupplier.code}</span>
                  <span className="ml-2 text-gray-700">{linkedSupplier.name}</span>
                </Link>
              ) : (
                <span className="text-gray-400 text-sm">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Linked MCC</dt>
            <dd className="mt-1">
              {linkedMcc?.id && data.mcc_account_id ? (
                <Link href={`/admin/accounts/${String(data.mcc_account_id)}`} className="text-primary hover:underline text-sm">
                  <span className="font-mono text-xs">{linkedMcc.code}</span>
                  <span className="ml-2 text-gray-700">{linkedMcc.name}</span>
                </Link>
              ) : (
                <span className="text-gray-400 text-sm">—</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {data.payload != null && typeof data.payload === 'object' ? (
        <SupplierOnboardingPayloadDisplay payload={data.payload} />
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-sm p-4 text-sm text-amber-900">
          No wizard payload is stored for this record.
        </div>
      )}
    </div>
  );
}
