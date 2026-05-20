'use client';

import { useDashboardPeriod } from '@/app/(authenticated)/admin/dashboard/dashboard-period-context';

/** Shared period preset control (day / week / month / quarter / year / custom). */
export default function PeriodToolbar({ className = '' }: { className?: string }) {
  const { period, customFrom, customTo, periodLabel, setPeriodPreset, setCustomDates } = useDashboardPeriod();

  return (
    <div className={`relative flex-shrink-0 ${className}`.trim()}>
      <select
        value={period}
        onChange={(e) => setPeriodPreset(e.target.value as typeof period)}
        title={periodLabel}
        aria-label="Period"
        className="min-w-0 w-[128px] rounded border border-gray-300 bg-white py-1.5 pl-2 pr-7 text-sm text-gray-900 focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] focus:outline-none sm:w-[132px]"
      >
        <option value="day">Day</option>
        <option value="week">Week</option>
        <option value="month">Month</option>
        <option value="quarter">Quarter</option>
        <option value="year">Year</option>
        <option value="custom">Custom</option>
      </select>

      {period === 'custom' && (
        <div className="absolute top-full right-0 z-[60] mt-1 flex items-center gap-1.5 rounded border border-gray-200 bg-white px-2 py-2 shadow-lg">
          <input
            type="date"
            value={customFrom}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setCustomDates(e.target.value, customTo || e.target.value)}
            className="border border-gray-300 rounded px-1.5 py-1 text-xs w-28"
            aria-label="From date"
          />
          <span className="text-gray-400 text-[10px]">–</span>
          <input
            type="date"
            value={customTo}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setCustomDates(customFrom || e.target.value, e.target.value)}
            className="border border-gray-300 rounded px-1.5 py-1 text-xs w-28"
            aria-label="To date"
          />
        </div>
      )}
    </div>
  );
}
