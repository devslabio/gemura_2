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

  return null;
}

