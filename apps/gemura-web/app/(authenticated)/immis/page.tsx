'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** IMMIS directory is served from gemura-admin-web only. */
export default function ImmisTenantRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
