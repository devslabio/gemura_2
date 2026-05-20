'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { mccManagerApi, type MccManagerOperationalProfile, type MccManagerCoolingTank } from '@/lib/api/mcc-manager';
import { MccOnboardingProfilePanel, type OnboardingCompletion } from '@/app/components/manager/MccOnboardingProfilePanel';

type OperationalProfileData = {
  account: { id: string; code: string | null; name: string; district_label: string | null };
  profile: MccManagerOperationalProfile | null;
  cooling_tanks: MccManagerCoolingTank[];
  completion: OnboardingCompletion;
};

export default function MccProfilePage() {
  const currentAccount = useAuthStore((s) => s.currentAccount);
  const accountId = currentAccount?.account_id;
  const [data, setData] = useState<OperationalProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!accountId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    mccManagerApi
      .getOperationalProfile(accountId)
      .then((res) => {
        if (cancelled) return;
        if (res.code === 200 && res.data) {
          setData(res.data as OperationalProfileData);
        } else {
          setError('Could not load MCC profile.');
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not load MCC profile. Check that the API is running.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  if (!accountId) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-600">Select an MCC account to view profile.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full max-w-none space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">MCC profile</h1>
        <p className="text-sm text-gray-500 mt-1">
          Baseline from onboarding wizard — used for dashboard KPIs and tank capacity.
        </p>
        {data?.account && (
          <p className="text-sm text-gray-700 mt-2">
            {data.account.name}
            {data.account.code ? (
              <span className="font-mono text-gray-500 ml-2">{data.account.code}</span>
            ) : null}
            {data.account.district_label ? (
              <span className="text-gray-500"> · {data.account.district_label}</span>
            ) : null}
          </p>
        )}
      </div>

      <section className="bg-white border border-gray-200 rounded-sm p-6 sm:p-8 lg:p-10 w-full min-h-[calc(100vh-12rem)]">
        {loading ? (
          <p className="text-sm text-gray-500 py-16 text-center">Loading profile…</p>
        ) : error ? (
          <p className="text-sm text-amber-700 py-16 text-center">{error}</p>
        ) : (
          <MccOnboardingProfilePanel
            variant="full"
            profile={data?.profile ?? null}
            coolingTanks={data?.cooling_tanks ?? []}
            completion={data?.completion ?? null}
            accountName={data?.account.name}
          />
        )}
      </section>
    </div>
  );
}
