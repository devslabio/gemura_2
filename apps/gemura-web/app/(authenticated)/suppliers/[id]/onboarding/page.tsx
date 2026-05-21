'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { usePermission } from '@/hooks/usePermission';
import { suppliersApi } from '@/lib/api/suppliers';
import { DetailPageSkeleton } from '@/app/components/SkeletonLoader';
import SupplierOnboardingResultsContent from '../../onboarding/SupplierOnboardingResultsContent';
import Icon, { faArrowLeft } from '@/app/components/Icon';

export default function SupplierOnboardingResultsPage() {
  const router = useRouter();
  const params = useParams();
  const supplierId = params.id as string;
  const { hasPermission, isAdmin } = usePermission();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState<string | undefined>();
  const [supplierEmail, setSupplierEmail] = useState<string | null | undefined>();
  const [pricePerLiter, setPricePerLiter] = useState<number | undefined>();
  const [hasRelationship, setHasRelationship] = useState(true);
  const [hasMilkOnboardingKey, setHasMilkOnboardingKey] = useState(false);
  const [onboardingRecord, setOnboardingRecord] = useState<Record<string, unknown> | null>(null);
  const [onboardingUpdatedAt, setOnboardingUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPermission('view_suppliers') && !isAdmin()) {
      router.push('/suppliers');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const response = await suppliersApi.getSupplierById(supplierId);
        if (cancelled) return;
        if (response.code === 200 && response.data) {
          const s = response.data.supplier;
          setSupplierName(s.name || s.user?.name || 'Supplier');
          setSupplierPhone(s.user?.phone);
          setSupplierEmail(s.user?.email);
          setPricePerLiter(Number(s.relationship?.price_per_liter));
          setHasRelationship(!!s.relationship);
          const mo = response.data.milk_onboarding;
          if (mo?.onboarding != null && typeof mo.onboarding === 'object') {
            setOnboardingRecord(mo.onboarding as Record<string, unknown>);
          } else {
            setOnboardingRecord(null);
          }
          setOnboardingUpdatedAt(mo?.updated_at ?? null);
          setHasMilkOnboardingKey(
            response.data != null && Object.prototype.hasOwnProperty.call(response.data, 'milk_onboarding'),
          );
        } else {
          setError('Failed to load supplier onboarding data');
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
              (err as Error)?.message ||
              'Failed to load supplier onboarding data',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // hasPermission/isAdmin are new function refs each render — only re-fetch when supplier changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  if (loading) {
    return <DetailPageSkeleton />;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
        <Link href={`/suppliers/${supplierId}`} className="btn btn-secondary">
          <Icon icon={faArrowLeft} size="sm" className="mr-2" />
          Back to supplier
        </Link>
      </div>
    );
  }

  return (
    <SupplierOnboardingResultsContent
      supplierName={supplierName}
      supplierId={supplierId}
      supplierPhone={supplierPhone}
      supplierEmail={supplierEmail}
      pricePerLiter={pricePerLiter}
      hasMilkOnboardingKey={hasMilkOnboardingKey}
      onboardingRecord={onboardingRecord}
      onboardingUpdatedAt={onboardingUpdatedAt}
      hasRelationship={hasRelationship}
    />
  );
}
