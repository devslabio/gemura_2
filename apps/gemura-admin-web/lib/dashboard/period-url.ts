export type PeriodKey = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export function toYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getPeriodRange(
  period: PeriodKey,
  customFrom?: string,
  customTo?: string,
): { date_from: string; date_to: string } {
  const now = new Date();
  if (period === 'custom' && customFrom && customTo) {
    return { date_from: customFrom, date_to: customTo };
  }

  let start: Date;
  let end: Date;
  switch (period) {
    case 'day':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'quarter': {
      const q = Math.ceil((now.getMonth() + 1) / 3);
      start = new Date(now.getFullYear(), (q - 1) * 3, 1);
      end = new Date(now.getFullYear(), q * 3, 0);
      break;
    }
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now);
  }

  return { date_from: toYYYYMMDD(start), date_to: toYYYYMMDD(end) };
}

/** Resolves API date range; incomplete custom falls back to this calendar month. */
export function getEffectiveDateRange(
  period: PeriodKey,
  customFrom: string,
  customTo: string,
): { date_from: string; date_to: string } {
  if (period === 'custom' && (!customFrom || !customTo)) {
    return getPeriodRange('month');
  }
  return getPeriodRange(period, customFrom || undefined, customTo || undefined);
}

/** Same-length window immediately before the effective current range (for KPI trend badges). */
export function getPreviousPeriodRange(
  period: PeriodKey,
  customFrom: string,
  customTo: string,
): { date_from: string; date_to: string } {
  const { date_from, date_to } = getEffectiveDateRange(period, customFrom, customTo);
  const [y1, m1, d1] = date_from.split('-').map(Number);
  const [y2, m2, d2] = date_to.split('-').map(Number);
  const start = new Date(y1, (m1 ?? 1) - 1, d1 ?? 1);
  const end = new Date(y2, (m2 ?? 1) - 1, d2 ?? 1);
  const days = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1);
  const priorEnd = new Date(start);
  priorEnd.setDate(priorEnd.getDate() - 1);
  const priorStart = new Date(priorEnd);
  priorStart.setDate(priorStart.getDate() - (days - 1));
  return { date_from: toYYYYMMDD(priorStart), date_to: toYYYYMMDD(priorEnd) };
}

const PERIOD_SET = new Set<PeriodKey>(['day', 'week', 'month', 'quarter', 'year', 'custom']);

export function parsePeriodFromSearchParams(searchParams: URLSearchParams): {
  period: PeriodKey;
  customFrom: string;
  customTo: string;
} {
  const raw = searchParams.get('period');
  const period: PeriodKey = raw && PERIOD_SET.has(raw as PeriodKey) ? (raw as PeriodKey) : 'quarter';
  const customFrom = searchParams.get('date_from') ?? '';
  const customTo = searchParams.get('date_to') ?? '';
  return { period, customFrom, customTo };
}

/** Preserve period query when navigating between admin routes (drops page/limit/search). */
export function periodQuerySuffixFromSearchParams(searchParams: URLSearchParams): string {
  const p = new URLSearchParams();
  for (const key of ['period', 'date_from', 'date_to', 'tz_offset_minutes'] as const) {
    const v = searchParams.get(key);
    if (v) p.set(key, v);
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function periodLabel(period: PeriodKey, customFrom: string, customTo: string): string {
  if (period === 'custom') {
    if (customFrom && customTo) return `${customFrom} – ${customTo}`;
    return 'Custom range';
  }
  if (period === 'day') return 'Today';
  if (period === 'week') return 'Last 7 days';
  if (period === 'month') return 'This month';
  if (period === 'quarter') return 'This quarter';
  if (period === 'year') return 'This year';
  return 'Selected range';
}
