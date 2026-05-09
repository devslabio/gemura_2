'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useAuthHydrated } from '@/store/auth';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const hasHydrated = useAuthHydrated();

  useEffect(() => {
    if (!hasHydrated) return;
    if (isAuthenticated && user) router.replace('/dashboard');
    else router.replace('/auth/login');
  }, [hasHydrated, isAuthenticated, user, router]);

  if (!hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-sm text-gray-600">Loading admin…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <p className="text-sm text-gray-600">Redirecting…</p>
    </div>
  );
}

