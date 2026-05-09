'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

export default function PlatformDrilldownShell({
  title,
  periodLabel,
  backHref,
  children,
}: {
  title: string;
  periodLabel?: string;
  backHref: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
      <div>
        <Link href={backHref} className="text-sm font-medium text-[var(--primary)] hover:underline">
          ← Back to dashboard overview
        </Link>
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">{title}</h1>
        {periodLabel ? <p className="mt-1 text-sm text-gray-600">{periodLabel}</p> : null}
      </div>
      {children}
    </div>
  );
}
