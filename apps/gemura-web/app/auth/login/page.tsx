'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Icon, { faEye, faEyeSlash, faEnvelope, faLock, faPhone } from '@/app/components/Icon';
import { useAuthStore } from '@/store/auth';
import { isBusinessAccount } from '@/lib/config/nav.config';
import { profileApi } from '@/lib/api/profile';
import { supplierOnboardingApi } from '@/lib/api/supplierOnboardingApi';
import { computeOnboardingRecordCompletion } from '@/app/(authenticated)/suppliers/onboarding/onboardingRecordCompletion';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isPhoneLogin, setIsPhoneLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('registered') === 'true') {
        setSuccessMessage('Registration successful! Please log in with your credentials.');
        setTimeout(() => {
          router.replace('/auth/login', { scroll: false });
        }, 100);
      }
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!identifier.trim()) {
        setError(isPhoneLogin ? 'Phone number is required' : 'Email is required');
        setLoading(false);
        return;
      }

      let normalizedIdentifier = identifier.trim();
      if (isPhoneLogin) {
        if (!normalizedIdentifier || normalizedIdentifier.length < 9) {
          setError('Please enter a valid phone number');
          setLoading(false);
          return;
        }
        normalizedIdentifier = normalizedIdentifier.replace(/\D/g, '');
      } else {
        if (!normalizedIdentifier.includes('@')) {
          setError('Please enter a valid email address');
          setLoading(false);
          return;
        }
      }

      if (!normalizedIdentifier) {
        setError(isPhoneLogin ? 'Invalid phone number format' : 'Email is required');
        setLoading(false);
        return;
      }

      const { login } = useAuthStore.getState();
      const result = await login({ email: normalizedIdentifier, password });

      if ('error' in result) {
        setError(result.error);
        setLoading(false);
        return;
      }

      const defaultAccount = result.accounts.find((acc) => acc.is_default) || result.accounts[0] || null;
      const defaultRole = (defaultAccount?.role || '').toLowerCase();
      const accType = (defaultAccount?.account_type ?? '').toLowerCase();
      const isOpsCollectorOrAgent = defaultRole === 'collector' || defaultRole === 'agent';

      let targetRoute =
        isOpsCollectorOrAgent && isBusinessAccount(accType) ? '/collections' : '/dashboard';

      if (isOpsCollectorOrAgent && isBusinessAccount(accType)) {
        await new Promise((r) => setTimeout(r, 100));
      } else if (accType === 'supplier' || accType === 'farmer' || accType === 'customer') {
        await new Promise((r) => setTimeout(r, 200));
        try {
          const [prof, ob] = await Promise.all([
            profileApi.getProfile().catch(() => null),
            supplierOnboardingApi.getMy().catch(() => null),
          ]);
          const serverPct = prof?.data?.profile_completion;
          const pct =
            typeof serverPct === 'number' && !Number.isNaN(serverPct)
              ? Math.round(Math.min(100, serverPct))
              : ob?.data?.onboarding
                ? computeOnboardingRecordCompletion(ob.data.onboarding)
                : 0;
          if (pct < 100) {
            targetRoute = '/profile';
          }
        } catch {
          /* keep /dashboard */
        }
      } else {
        await new Promise((r) => setTimeout(r, 100));
      }

      router.push(targetRoute);
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Login Form */}
      <div className="w-full lg:w-[40%] flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-white">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="mb-8">
            <Link href="/" className="inline-block mb-4">
              <Image src="/logo.png" alt="Gemura" width={80} height={80} className="object-contain" priority />
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Log In to Gemura</h1>
            <p className="text-sm text-gray-600">
              New Here?{' '}
              <Link href="/auth/register" className="text-primary hover:text-primary-600 font-medium">
                Create Account
              </Link>
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Setting up a new business profile?{' '}
              <Link href="/auth/onboarding" className="text-primary hover:text-primary-600 font-medium">
                Start Onboarding Wizard
              </Link>
            </p>
          </div>

          {successMessage && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-sm text-sm text-green-600">
              {successMessage}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-sm text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Phone / Email toggle — segmented control */}
            <div className="p-1 rounded-xl bg-gray-100 border border-gray-200/80 mb-2">
              <div className="flex gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsPhoneLogin(true);
                    setIdentifier('');
                    setError('');
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ease-out ${
                    isPhoneLogin
                      ? 'bg-white text-primary shadow-sm ring-1 ring-gray-200/50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50/80'
                  }`}
                  disabled={loading}
                >
                  <Icon icon={faPhone} size="sm" className="shrink-0" />
                  Phone
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPhoneLogin(false);
                    setIdentifier('');
                    setError('');
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ease-out ${
                    !isPhoneLogin
                      ? 'bg-white text-primary shadow-sm ring-1 ring-gray-200/50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50/80'
                  }`}
                  disabled={loading}
                >
                  <Icon icon={faEnvelope} size="sm" className="shrink-0" />
                  Email
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 mb-2">
                {isPhoneLogin ? 'Phone Number' : 'Email'}
              </label>
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none text-gray-400">
                  <Icon icon={isPhoneLogin ? faPhone : faEnvelope} size="sm" />
                </div>
                <input
                  id="identifier"
                  type={isPhoneLogin ? 'tel' : 'email'}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary text-sm"
                  placeholder={isPhoneLogin ? 'Enter your phone number' : 'Enter your email'}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none text-gray-400">
                  <Icon icon={faLock} size="sm" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-2.5 bg-gray-50 border border-gray-200 rounded-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary text-sm"
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon icon={showPassword ? faEyeSlash : faEye} size="sm" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Link
                href="/auth/forgot-password"
                className="text-sm text-primary hover:text-primary-600 font-medium"
              >
                Forgot Password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Logging in...</span>
                </>
              ) : (
                'Log In'
              )}
            </button>
          </form>

          <div className="mt-12 text-center">
            <p className="text-xs text-gray-500 mb-2">© 2020–{new Date().getFullYear()} Gemura</p>
            <p className="text-xs text-gray-500">
              Milk collection services platform
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Image Cover (same as Orora: black overlay, no clock) */}
      <div className="hidden lg:flex lg:w-[60%] relative bg-black">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url("/cover.jpg")' }}
        >
          <div className="absolute inset-0 bg-black/50" />
        </div>
      </div>
    </div>
  );
}
