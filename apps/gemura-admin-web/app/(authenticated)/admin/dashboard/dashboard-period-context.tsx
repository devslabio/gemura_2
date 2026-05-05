'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  type PeriodKey,
  getEffectiveDateRange,
  parsePeriodFromSearchParams,
  periodLabel as periodLabelFn,
  toYYYYMMDD,
} from '@/lib/dashboard/period-url';

export type DashboardPeriodContextValue = {
  period: PeriodKey;
  customFrom: string;
  customTo: string;
  dateRange: { date_from: string; date_to: string };
  periodLabel: string;
  setPeriodPreset: (p: PeriodKey) => void;
  setCustomDates: (from: string, to: string) => void;
};

const DashboardPeriodContext = createContext<DashboardPeriodContextValue | null>(null);

export function DashboardPeriodProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const parsed = useMemo(() => parsePeriodFromSearchParams(searchParams), [searchParams]);

  const pushQuery = useCallback(
    (mutate: (q: URLSearchParams) => void) => {
      const q = new URLSearchParams(searchParams.toString());
      mutate(q);
      const s = q.toString();
      router.replace(s ? `${pathname}?${s}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const setPeriodPreset = useCallback(
    (p: PeriodKey) => {
      if (p === 'custom') {
        const n = new Date();
        const from = toYYYYMMDD(new Date(n.getFullYear(), n.getMonth(), 1));
        const to = toYYYYMMDD(n);
        pushQuery((q) => {
          q.set('period', 'custom');
          q.set('date_from', from);
          q.set('date_to', to);
        });
        return;
      }
      pushQuery((q) => {
        q.set('period', p);
        q.delete('date_from');
        q.delete('date_to');
      });
    },
    [pushQuery],
  );

  const setCustomDates = useCallback(
    (from: string, to: string) => {
      pushQuery((q) => {
        q.set('period', 'custom');
        q.set('date_from', from);
        q.set('date_to', to);
      });
    },
    [pushQuery],
  );

  const dateRange = useMemo(
    () => getEffectiveDateRange(parsed.period, parsed.customFrom, parsed.customTo),
    [parsed.period, parsed.customFrom, parsed.customTo],
  );

  const label = useMemo(
    () => periodLabelFn(parsed.period, parsed.customFrom, parsed.customTo),
    [parsed.period, parsed.customFrom, parsed.customTo],
  );

  const value = useMemo<DashboardPeriodContextValue>(
    () => ({
      period: parsed.period,
      customFrom: parsed.customFrom,
      customTo: parsed.customTo,
      dateRange,
      periodLabel: label,
      setPeriodPreset,
      setCustomDates,
    }),
    [parsed.period, parsed.customFrom, parsed.customTo, dateRange, label, setPeriodPreset, setCustomDates],
  );

  return <DashboardPeriodContext.Provider value={value}>{children}</DashboardPeriodContext.Provider>;
}

export function useDashboardPeriod(): DashboardPeriodContextValue {
  const ctx = useContext(DashboardPeriodContext);
  if (!ctx) {
    throw new Error('useDashboardPeriod must be used within DashboardPeriodProvider');
  }
  return ctx;
}
