'use client';

import PeriodToolbar from '@/app/components/PeriodToolbar';

/** Page-level period control (top-right of content). */
export default function AdminPagePeriodBar() {
  return (
    <div className="flex flex-wrap items-center justify-end">
      <PeriodToolbar />
    </div>
  );
}
