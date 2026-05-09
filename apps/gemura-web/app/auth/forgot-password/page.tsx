'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Icon, { faArrowLeft, faArrowRight, faEnvelope, faPhone } from '@/app/components/Icon';
import { authApi } from '@/lib/api/auth';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [isPhoneMode, setIsPhoneMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimmed = identifier.trim();
    if (!trimmed) {
      setError(isPhoneMode ? 'Phone number is required.' : 'Email is required.');
      return;
    }

    const payload = isPhoneMode
      ? { phone: trimmed.replace(/\D/g, '') }
      : { email: trimmed.toLowerCase() };

    setLoading(true);
    try {
      const response = await authApi.forgotPassword(payload);
      setSuccess(response.message || 'Reset code sent successfully.');

      const userId = response?.data?.user_id;
      if (userId) {
        const query = new URLSearchParams({
          user_id: userId,
          via: isPhoneMode ? 'phone' : 'email',
          contact: trimmed,
        });
        router.push(`/auth/reset-password?${query.toString()}`);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to request reset code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="w-full lg:w-[40%] flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-white">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <Link href="/" className="inline-block mb-4">
              <Image src="/logo.png" alt="Gemura" width={80} height={80} className="object-contain" priority />
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Forgot Password</h1>
            <p className="text-sm text-gray-600">Enter your phone number or email to receive a reset code.</p>
          </div>

          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-sm text-sm text-red-600">{error}</div>}
          {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-sm text-sm text-green-700">{success}</div>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="p-1 rounded-xl bg-gray-100 border border-gray-200/80">
              <div className="flex gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsPhoneMode(true);
                    setIdentifier('');
                    setError('');
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isPhoneMode ? 'bg-white text-primary shadow-sm ring-1 ring-gray-200/50' : 'text-gray-500 hover:text-gray-700'
                  }`}
                  disabled={loading}
                >
                  <Icon icon={faPhone} size="sm" />
                  Phone
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPhoneMode(false);
                    setIdentifier('');
                    setError('');
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                    !isPhoneMode ? 'bg-white text-primary shadow-sm ring-1 ring-gray-200/50' : 'text-gray-500 hover:text-gray-700'
                  }`}
                  disabled={loading}
                >
                  <Icon icon={faEnvelope} size="sm" />
                  Email
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 mb-2">
                {isPhoneMode ? 'Phone Number' : 'Email'}
              </label>
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none text-gray-400">
                  <Icon icon={isPhoneMode ? faPhone : faEnvelope} size="sm" />
                </div>
                <input
                  id="identifier"
                  type={isPhoneMode ? 'tel' : 'email'}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary text-sm"
                  placeholder={isPhoneMode ? 'Enter your phone number' : 'Enter your email'}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Sending code...</span>
                </>
              ) : (
                <>
                  <Icon icon={faArrowRight} size="sm" />
                  Send Reset Code
                </>
              )}
            </button>
          </form>

          <div className="mt-6">
            <Link href="/auth/login" className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary-600 font-medium">
              <Icon icon={faArrowLeft} size="sm" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex lg:w-[60%] relative bg-black">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url("/cover.jpg")' }}>
          <div className="absolute inset-0 bg-black/50" />
        </div>
      </div>
    </div>
  );
}
