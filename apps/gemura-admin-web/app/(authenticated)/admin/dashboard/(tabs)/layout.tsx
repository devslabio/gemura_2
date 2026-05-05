import { Suspense } from 'react';

import DashboardShell from '../DashboardShell';

export default function DashboardTabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500 text-sm">Loading dashboard…</div>}>
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}
