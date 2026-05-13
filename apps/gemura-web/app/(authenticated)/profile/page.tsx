'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Profile is merged into Settings › Profile for all users. */
export default function ProfileRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/settings');
  }, [router]);
  return (
    <div className="flex items-center justify-center py-20 text-gray-600 text-sm">
      Redirecting to settings…
    </div>
  );
}
