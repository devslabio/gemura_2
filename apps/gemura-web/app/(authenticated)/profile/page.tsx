'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { profileApi } from '@/lib/api/profile';
import { supplierOnboardingApi } from '@/lib/api/supplierOnboardingApi';
import { isBusinessAccount } from '@/lib/config/nav.config';
import { useRouter } from 'next/navigation';
import { computeOnboardingRecordCompletion } from '../suppliers/onboarding/onboardingRecordCompletion';
import { FarmerOnboardingPreview, CollectorOnboardingPreview } from '../suppliers/onboarding/OnboardingPreview';
import type { FarmerFormState, CollectorFormState } from '../suppliers/onboarding/model';
import Icon, { faSpinner, faCheckCircle } from '@/app/components/Icon';

export default function ExternalProfilePage() {
  const router = useRouter();
  const { currentAccount } = useAuthStore();
  const accountType = (currentAccount?.account_type ?? '').toLowerCase();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [onboardingRecord, setOnboardingRecord] = useState<Record<string, unknown> | null>(null);
  const [serverCompletion, setServerCompletion] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [prof, ob] = await Promise.all([
        profileApi.getProfile(),
        supplierOnboardingApi.getMy().catch(() => ({ code: 404, data: null })),
      ]);
      if (prof.code === 200 && prof.data?.user) {
        setName(prof.data.user.name || '');
        setEmail(prof.data.user.email || '');
        setPhone(prof.data.user.phone || '');
        if (typeof prof.data.profile_completion === 'number') {
          setServerCompletion(prof.data.profile_completion);
        }
      }
      if (ob?.code === 200 && ob.data?.onboarding) {
        setOnboardingRecord(ob.data.onboarding as Record<string, unknown>);
      } else {
        setOnboardingRecord(null);
      }
    } catch (e) {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Could not load profile.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isBusinessAccount(accountType)) {
      router.replace('/settings');
      return;
    }
    if (accountType !== 'supplier' && accountType !== 'farmer' && accountType !== 'customer') {
      router.replace('/dashboard');
      return;
    }
    void load();
  }, [accountType, router, load]);

  const completion =
    serverCompletion != null
      ? Math.round(Math.min(100, Math.max(0, serverCompletion)))
      : onboardingRecord
        ? computeOnboardingRecordCompletion(onboardingRecord)
        : 0;

  const st = onboardingRecord?.supplier_type;
  const draftFarmer = st === 'farmer' && onboardingRecord?.draft ? (onboardingRecord.draft as FarmerFormState) : null;
  const draftCollector =
    st === 'collector' && onboardingRecord?.draft ? (onboardingRecord.draft as CollectorFormState) : null;
  const gpsText =
    onboardingRecord && typeof onboardingRecord.gps === 'object' && onboardingRecord.gps != null
      ? (() => {
          const g = onboardingRecord.gps as { lat?: number; lng?: number };
          return g.lat != null && g.lng != null ? `${g.lat}, ${g.lng}` : '—';
        })()
    : '—';
  const hasNid = Boolean(onboardingRecord && onboardingRecord.nid_photo_meta);

  const saveBasics = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await profileApi.updateProfile({
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.replace(/\D/g, '') || undefined,
      });
      if (res.code === 200) {
        setError('');
        await load();
      } else {
        setError(res.message || 'Update failed');
      }
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Update failed'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-600 gap-2">
        <Icon icon={faSpinner} className="text-lg animate-spin" />
        Loading profile…
      </div>
    );
  }

  if (isBusinessAccount(accountType)) {
    return null;
  }

  return (
    <div className="max-w-4xl space-y-6 -mt-1">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">My profile</h1>
        <p className="text-sm text-gray-600 mt-1">Account details, onboarding progress, and data you provided.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2 rounded-sm">{error}</div>
      )}

      <div className="bg-white border border-gray-200 rounded-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Profile completion</h2>
          <div className="flex items-center gap-2 text-sm text-gray-700">
            {completion >= 100 ? (
              <Icon icon={faCheckCircle} className="text-emerald-600" />
            ) : null}
            <span className="text-2xl font-bold text-gray-900">{completion}%</span>
          </div>
        </div>
        <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-emerald-600 transition-all rounded-full"
            style={{ width: `${Math.min(100, completion)}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {onboardingRecord
            ? 'Based on the onboarding you submitted. Update contact details below; ask your MCC to change farm or collection data if needed.'
            : 'No onboarding file was found on the server yet. If you just registered, try refreshing in a moment.'}
        </p>
      </div>

      <form onSubmit={saveBasics} className="bg-white border border-gray-200 rounded-sm p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Contact &amp; sign-in</h2>
        <label className="block text-sm">
          <span className="text-gray-600">Display name</span>
          <input
            className="mt-1 w-full max-w-md border border-gray-300 rounded-sm px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Phone</span>
          <input
            className="mt-1 w-full max-w-md border border-gray-300 rounded-sm px-3 py-2"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            autoComplete="tel"
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Email</span>
          <input
            className="mt-1 w-full max-w-md border border-gray-300 rounded-sm px-3 py-2"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded border border-gray-200 bg-primary text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save contact details'}
        </button>
      </form>

      {draftFarmer && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-900">Your farm onboarding (read-only)</h2>
          <FarmerOnboardingPreview f={draftFarmer} gpsText={gpsText} hasNidPhoto={hasNid} />
        </div>
      )}

      {draftCollector && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-900">Your collection onboarding (read-only)</h2>
          <CollectorOnboardingPreview c={draftCollector} gpsText={gpsText} hasNidPhoto={hasNid} />
        </div>
      )}

      {!draftFarmer && !draftCollector && !loading && (
        <p className="text-sm text-gray-500">
          Onboarding details will show here when your MCC or the server has linked your registration data.
        </p>
      )}

      <p className="text-xs text-gray-500">
        <Link href="/dashboard" className="text-primary font-medium">
          Back to dashboard
        </Link>
        <span className="mx-2">·</span>
        <Link href="/settings" className="text-primary font-medium">
          Settings
        </Link>
      </p>
    </div>
  );
}
