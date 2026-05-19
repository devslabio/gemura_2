'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import SupplierOnboardingModal from '../../suppliers/onboarding/SupplierOnboardingModal';

export default function SupplierSelfOnboardingPage() {
  const router = useRouter();
  const { currentAccount, _hasHydrated, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) {
      router.replace('/auth/login');
      return;
    }
    const org = (currentAccount?.account_type ?? '').toLowerCase();
    if (org && org !== 'farmer' && org !== 'supplier') {
      router.replace('/settings');
    }
  }, [_hasHydrated, isAuthenticated, currentAccount, router]);

  if (!_hasHydrated || !isAuthenticated) {
    return <div className="p-8 text-center text-gray-600 text-sm">Loading…</div>;
  }

  const org = (currentAccount?.account_type ?? '').toLowerCase();
  if (org !== 'farmer' && org !== 'supplier') {
    return <div className="p-8 text-center text-gray-600 text-sm">Redirecting…</div>;
  }

  return (
    <div className="min-h-[60vh] p-4 md:p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Milk onboarding</h1>
      <p className="text-gray-600 text-sm mb-6 max-w-2xl">
        Complete your farm or collection profile. Your answers are saved to your Gemura milk onboarding record.
      </p>
      <SupplierOnboardingModal
        open
        selfService
        onClose={() => router.push('/settings')}
        onRegistered={() => router.push('/settings')}
      />
    </div>
  );
}
