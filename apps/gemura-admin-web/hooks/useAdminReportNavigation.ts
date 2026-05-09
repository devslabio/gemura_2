'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/** Matches `apps/gemura-admin-web/app/(authenticated)/admin/users/page.tsx` page sizes. */
export const ADMIN_REPORT_PAGE_SIZES = [10, 20, 50, 100] as const;

function parseReportParams(searchParams: URLSearchParams) {
  const page = Math.max(1, Number(searchParams.get('page') || 1) || 1);
  const rawLimit = Number(searchParams.get('limit'));
  const limit = ADMIN_REPORT_PAGE_SIZES.includes(rawLimit as (typeof ADMIN_REPORT_PAGE_SIZES)[number])
    ? rawLimit
    : 10;
  const date_from = searchParams.get('date_from') ?? undefined;
  const date_to = searchParams.get('date_to') ?? undefined;
  const tzRaw = searchParams.get('tz_offset_minutes');
  const tzParsed = tzRaw !== null && tzRaw !== '' ? Number.parseInt(tzRaw, 10) : NaN;
  const tz_offset_minutes = Number.isFinite(tzParsed) ? tzParsed : undefined;
  return {
    apiParams: { page, limit, date_from, date_to, tz_offset_minutes },
    filterInputs: {
      dateFrom: searchParams.get('date_from') ?? '',
      dateTo: searchParams.get('date_to') ?? '',
      pageSize: limit,
    },
  };
}

export function useAdminReportNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramsKey = searchParams.toString();

  const { apiParams, filterInputs } = useMemo(() => parseReportParams(new URLSearchParams(paramsKey)), [paramsKey]);

  const navigate = useCallback(
    (patch: Record<string, string | number | undefined | null>) => {
      const p = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === null || v === '') p.delete(k);
        else p.set(k, String(v));
      }
      router.push(`${pathname}?${p.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const setDateFrom = useCallback((v: string) => navigate({ date_from: v || null, page: 1 }), [navigate]);
  const setDateTo = useCallback((v: string) => navigate({ date_to: v || null, page: 1 }), [navigate]);
  const setPageSize = useCallback((n: number) => navigate({ limit: n, page: 1 }), [navigate]);
  const setPage = useCallback((page: number) => navigate({ page }), [navigate]);

  const clearFilters = useCallback(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete('date_from');
    p.delete('date_to');
    p.delete('page');
    p.set('limit', '10');
    router.push(`${pathname}?${p.toString()}`);
  }, [pathname, router, searchParams]);

  const backToOverviewHref = useMemo(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete('page');
    const s = p.toString();
    return `/admin/dashboard/overview${s ? `?${s}` : ''}`;
  }, [searchParams]);

  return {
    apiParams,
    filterInputs,
    navigate,
    setDateFrom,
    setDateTo,
    setPageSize,
    setPage,
    clearFilters,
    backToOverviewHref,
  };
}
