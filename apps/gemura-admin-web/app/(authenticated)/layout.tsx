'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useAuthHydrated } from '@/store/auth';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const hasHydrated = useAuthHydrated();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated || !user) {
      router.push('/auth/login');
    }
  }, [hasHydrated, isAuthenticated, user, router]);

  if (!hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-sm text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;

  return <>{children}</>;
}

