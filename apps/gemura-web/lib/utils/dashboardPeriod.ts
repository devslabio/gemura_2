export type PeriodKey = 'day' | 'month' | 'quarter' | 'year' | 'custom';

export function toYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getPeriodRange(
  period: PeriodKey,
  customFrom?: string,
  customTo?: string
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
      end = new Date(now.getFullYear(), 11, 31);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date();
  }
  return { date_from: toYYYYMMDD(start), date_to: toYYYYMMDD(end) };
}
