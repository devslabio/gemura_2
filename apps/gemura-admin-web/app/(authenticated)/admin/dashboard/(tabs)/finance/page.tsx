'use client';

import { useDashboardPeriod } from '../../dashboard-period-context';

export default function AdminDashboardFinancePage() {
  const { periodLabel } = useDashboardPeriod();

  return (
    <div className="rounded-sm border border-dashed border-gray-300 bg-gray-50/80 p-8 text-center space-y-2">
      <h2 className="text-lg font-semibold text-gray-900">Finance dashboards</h2>
      <p className="text-sm text-gray-600 max-w-lg mx-auto">
        Period-aware income statements, revenue vs expenses over time, and payables/receivables will plug in here using accounting reports and
        analytics APIs. Current shell respects <span className="font-medium text-gray-800">{periodLabel}</span> via the shared dashboard URL
        query so charts stay consistent across tabs.
      </p>
    </div>
  );
}
