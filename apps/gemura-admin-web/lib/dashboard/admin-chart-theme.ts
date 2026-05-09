import type { ApexOptions } from 'apexcharts';

/** Align with `globals.css` body stack — ApexCharts renders SVG text outside Tailwind context */
export const ADMIN_CHART_FONT_STACK =
  "'Source Sans Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/** Gemura admin dashboard palette */
export const ADMIN_CHART_COLORS = {
  primary: '#004AAD',
  green: '#059669',
  teal: '#0f766e',
  tealBright: '#0d9488',
  blue: '#2563eb',
  violet: '#6d28d9',
  violetLight: '#7c3aed',
  cyan: '#0891b2',
  amber: '#d97706',
  slate: '#64748b',
  gray500: '#6b7280',
  gray400: '#9ca3af',
  danger: '#dc2626',
} as const;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge(base: unknown, override: unknown): unknown {
  if (override === undefined) return base;
  if (override === null) return override;
  if (typeof override !== 'object' || Array.isArray(override)) return override;
  if (typeof base !== 'object' || base === null || Array.isArray(base)) return override;

  const b = base as Record<string, unknown>;
  const o = override as Record<string, unknown>;
  const out: Record<string, unknown> = { ...b };
  for (const key of Object.keys(o)) {
    const ov = o[key];
    if (ov === undefined) continue;
    if (isPlainObject(b[key]) && isPlainObject(ov)) {
      out[key] = deepMerge(b[key], ov);
    } else {
      out[key] = ov;
    }
  }
  return out;
}

/**
 * Defaults applied to every admin dashboard Apex chart.
 * Pass chart-specific options (type, series-derived axes, colors); theme merges underneath.
 */
export const adminChartRootDefaults: ApexOptions = {
  chart: {
    fontFamily: ADMIN_CHART_FONT_STACK,
    foreColor: '#4b5563',
    toolbar: { show: false },
    zoom: { enabled: false },
    animations: { enabled: true, speed: 420 },
  },
  grid: {
    borderColor: '#e5e7eb',
    strokeDashArray: 4,
    padding: { top: 6, right: 10, bottom: 4, left: 10 },
    xaxis: { lines: { show: false } },
    yaxis: { lines: { show: true } },
  },
  xaxis: {
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: { style: { colors: '#6b7280', fontSize: '11px', fontWeight: 500 } },
  },
  yaxis: {
    labels: { style: { colors: '#6b7280', fontSize: '11px', fontWeight: 500 } },
  },
  legend: {
    fontSize: '12px',
    fontWeight: 500,
    labels: { colors: '#6b7280' },
    markers: { size: 5, shape: 'circle' },
    itemMargin: { horizontal: 10, vertical: 2 },
  },
  tooltip: {
    theme: 'light',
    style: { fontSize: '12px' },
    fillSeriesColor: false,
    x: { show: true },
  },
  plotOptions: {
    bar: {
      borderRadius: 4,
      columnWidth: '72%',
    },
  },
  states: {
    hover: { filter: { type: 'darken' } },
    active: { filter: { type: 'none' } },
  },
};

export function mergeAdminChartOptions(overrides: ApexOptions): ApexOptions {
  return deepMerge(adminChartRootDefaults, overrides) as ApexOptions;
}
