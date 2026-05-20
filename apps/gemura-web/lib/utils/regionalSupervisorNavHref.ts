/**
 * Build sidebar links for regional supervisors: carry dashboard geo scope and
 * the same rolling date windows as {@link RegionalSupervisorDashboard} quick actions.
 */

import type { ReadonlyURLSearchParams } from 'next/navigation';

/** ~30-day UTC date range (inclusive), matching supervisor dashboard drill-down. */
export function getSupervisorRollingDateRangeUtc(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - 30);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

export type RegionalSupervisorNavQuery =
  | 'none'
  | 'geo'
  | 'geo_ops_dates'
  | 'geo_sales_dates';

/**
 * @param href - Path or path+query from nav config
 * @param kind - How to merge scope / default dates
 * @param currentSearch - Current page search params (region_id, district_id)
 */
export function buildRegionalSupervisorNavHref(
  href: string,
  kind: RegionalSupervisorNavQuery,
  currentSearch: URLSearchParams | ReadonlyURLSearchParams | null | undefined,
): string {
  if (kind === 'none') return href;

  const regionId = currentSearch?.get('region_id')?.trim() ?? '';
  const districtId = currentSearch?.get('district_id')?.trim() ?? '';

  let path: string;
  const params = new URLSearchParams();
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const u = new URL(href, base);
    path = u.pathname;
    u.searchParams.forEach((v, k) => params.set(k, v));
  } catch {
    return href;
  }

  if (regionId) params.set('region_id', regionId);
  if (districtId) params.set('district_id', districtId);

  if (kind === 'geo_ops_dates') {
    const { from, to } = getSupervisorRollingDateRangeUtc();
    if (!params.has('from')) params.set('from', from);
    if (!params.has('to')) params.set('to', to);
  }
  if (kind === 'geo_sales_dates') {
    const { from, to } = getSupervisorRollingDateRangeUtc();
    if (!params.has('date_from')) params.set('date_from', from);
    if (!params.has('date_to')) params.set('date_to', to);
  }

  const q = params.toString();
  return q ? `${path}?${q}` : path;
}
