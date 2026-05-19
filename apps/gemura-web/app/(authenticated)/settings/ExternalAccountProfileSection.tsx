'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { profileApi } from '@/lib/api/profile';
import { supplierOnboardingApi } from '@/lib/api/supplierOnboardingApi';
import { computeOnboardingRecordCompletion } from '../suppliers/onboarding/onboardingRecordCompletion';
import { FarmerOnboardingPreview, CollectorOnboardingPreview } from '../suppliers/onboarding/OnboardingPreview';
import type { FarmerFormState, CollectorFormState } from '../suppliers/onboarding/model';
import Icon, { faSpinner, faCheckCircle, faUser, faEnvelope, faPhone } from '@/app/components/Icon';
import { useToastStore } from '@/store/toast';

/**
 * Profile tab content for supplier / farmer / customer accounts (portal “external” users).
 * Matches prior `/profile` behaviour: completion, contact form, read-only onboarding previews.
 */
export default function ExternalAccountProfileSection() {
  const formId = useId();
  const nameId = `${formId}-name`;
  const phoneId = `${formId}-phone`;
  const emailId = `${formId}-email`;
  const { user, setUser } = useAuthStore();
  const showToast = useToastStore((s) => s.show);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [onboardingRecord, setOnboardingRecord] = useState<Record<string, unknown> | null>(null);
  const [serverCompletion, setServerCompletion] = useState<number | null>(null);
  const [profileAccountType, setProfileAccountType] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [prof, ob] = await Promise.all([
        profileApi.getProfile(),
        supplierOnboardingApi.getMy().catch(() => ({ code: 404, data: null })),
      ]);
      if (prof.code === 200 && prof.data?.user) {
        const u = prof.data.user;
        setName(u.name || '');
        setEmail(u.email || '');
        setPhone(u.phone || '');
        if (typeof prof.data.profile_completion === 'number') {
          setServerCompletion(prof.data.profile_completion);
        }
        if (typeof prof.data.user.account_type === 'string') {
          setProfileAccountType(prof.data.user.account_type);
        } else {
          setProfileAccountType(null);
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
    void load();
  }, [load]);

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

  const canSelfMilkOnboard = ['farmer', 'supplier'].includes((profileAccountType ?? '').toLowerCase());

  const saveBasics = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await profileApi.updateProfile({
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.replace(/\D/g, '') || undefined,
      });
      if (res.code === 200 && res.data?.user && user) {
        setError('');
        const u = res.data.user;
        const parts = (u.name || '').split(/\s+/);
        setUser({
          ...user,
          firstName: (u.first_name ?? parts[0] ?? '').trim() || parts[0] || '',
          lastName: (u.last_name ?? parts.slice(1).join(' ') ?? '').trim(),
          email: u.email || '',
          phone: u.phone || '',
        });
        showToast('Profile updated successfully', 'success');
        await load();
      } else if (res.code === 200) {
        setError('');
        showToast('Profile updated successfully', 'success');
        await load();
      } else {
        setError(res.message || 'Update failed');
        showToast(res.message || 'Update failed', 'error');
      }
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Update failed';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-600 gap-2">
        <Icon icon={faSpinner} className="text-lg animate-spin" />
        Loading profile…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2 rounded-lg" role="alert">
          {error}
        </div>
      )}

      <section className="rounded-lg border border-gray-200 bg-gray-50/40 overflow-hidden">
        <div className="px-5 py-4 sm:px-6 border-b border-gray-200 bg-gray-50/80">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="text-lg font-semibold text-gray-900 m-0">Profile completion</h3>
            <div className="flex items-center gap-2 tabular-nums">
              {completion >= 100 ? (
                <Icon icon={faCheckCircle} className="text-emerald-600 shrink-0" size="sm" />
              ) : null}
              <span className="text-xl font-bold text-gray-900">{completion}%</span>
            </div>
          </div>
        </div>
        <div className="p-5 sm:p-6 bg-white">
          <div
            className="h-2.5 rounded-sm bg-slate-200/90 overflow-hidden border border-slate-300/60"
            role="progressbar"
            aria-valuenow={completion}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Profile completion"
          >
            <div
              className="h-full rounded-sm bg-gradient-to-r from-[#052A54] to-[#004AAD] transition-[width] duration-500 ease-out"
              style={{ width: `${Math.min(100, completion)}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-3 leading-relaxed m-0">
            {onboardingRecord
              ? 'Based on the onboarding you submitted. Update contact details below; ask your MCC to change farm or collection data if needed.'
              : canSelfMilkOnboard
                ? serverCompletion != null
                  ? `The ${completion}% score is from basic account fields (name, contact, ID photos). Milk onboarding is separate: complete the questionnaire to save herd or collection data on Gemura.`
                  : 'You have not saved milk onboarding yet. Use the link below to complete the questionnaire; your progress bar will reflect onboarding once data exists on the server.'
                : 'No milk onboarding file was found on the server yet. If you just registered, try refreshing in a moment.'}
          </p>
          {canSelfMilkOnboard ? (
            <p className="text-sm mt-3 m-0">
              <Link href="/supplier/onboarding" className="text-primary font-medium hover:underline">
                {onboardingRecord ? 'Update milk onboarding' : 'Complete milk onboarding'}
              </Link>
            </p>
          ) : null}
        </div>
      </section>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 m-0 mb-1">Contact &amp; sign-in</h3>
        <p className="text-sm text-gray-600 m-0 mb-4">These details are used to sign in and how we display your name.</p>
        <form onSubmit={saveBasics} className="max-w-md space-y-4">
          <div>
            <label htmlFor={nameId} className="block text-sm font-medium text-gray-700 mb-1">
              Display name
            </label>
            <div className="relative">
              <Icon
                icon={faUser}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                size="sm"
              />
              <input
                id={nameId}
                className="input w-full pl-11"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder="Your name"
              />
            </div>
          </div>
          <div>
            <label htmlFor={phoneId} className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <div className="relative">
              <Icon
                icon={faPhone}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                size="sm"
              />
              <input
                id={phoneId}
                className="input w-full pl-11"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                autoComplete="tel"
                placeholder="250788123456"
              />
            </div>
          </div>
          <div>
            <label htmlFor={emailId} className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <div className="relative">
              <Icon
                icon={faEnvelope}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                size="sm"
              />
              <input
                id={emailId}
                className="input w-full pl-11"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
              />
            </div>
          </div>
          <div className="pt-4 border-t border-gray-200">
            <button type="submit" disabled={saving} className="btn btn-primary inline-flex items-center gap-2">
              {saving ? (
                <>
                  <Icon icon={faSpinner} className="animate-spin" size="sm" />
                  Saving…
                </>
              ) : (
                <>
                  <Icon icon={faCheckCircle} size="sm" />
                  Save contact details
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {draftFarmer && (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 m-0">Your farm onboarding (read-only)</h3>
          <FarmerOnboardingPreview f={draftFarmer} gpsText={gpsText} hasNidPhoto={hasNid} />
        </section>
      )}

      {draftCollector && (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 m-0">Your collection onboarding (read-only)</h3>
          <CollectorOnboardingPreview c={draftCollector} gpsText={gpsText} hasNidPhoto={hasNid} />
        </section>
      )}

      {!draftFarmer && !draftCollector && (
        <p className="text-sm text-gray-600 max-w-3xl leading-relaxed m-0">
          Onboarding details will show here when your MCC or the server has linked your registration data.
        </p>
      )}

      <div className="pt-2 border-t border-gray-100">
        <Link href="/dashboard" className="text-sm text-primary font-medium hover:underline">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
