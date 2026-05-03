'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy route — gate intake lives on Milk collection (anchor scroll). */
export default function OperationsGateRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/collections#gate-arrivals');
  }, [router]);
  return (
    <div className="flex items-center justify-center py-12 text-sm text-gray-500" aria-live="polite">
      Redirecting…
    </div>
  );
}
