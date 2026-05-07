/**
 * YYYY-MM-DD calendar bounds in a fixed offset east of UTC (see GetOverviewDto.tz_offset_minutes).
 * Uses 24h spans (no DST). Omit tz for legacy UTC-midnight boundaries per date string.
 */
export function saleAtBoundsUtcInclusive(
  dateFromStr: string,
  dateToStr: string,
  tzOffsetEastMinutes?: number,
): { gte: Date; lte: Date } {
  const dayBounds = (dateStr: string): { start: Date; end: Date } => {
    const [y, mo, d] = dateStr.split('-').map(Number);
    if (tzOffsetEastMinutes === undefined) {
      return {
        start: new Date(`${dateStr}T00:00:00.000Z`),
        end: new Date(`${dateStr}T23:59:59.999Z`),
      };
    }
    const startMs = Date.UTC(y, mo - 1, d, 0, 0, 0, 0) - tzOffsetEastMinutes * 60 * 1000;
    const endMs = startMs + 86400000 - 1;
    return { start: new Date(startMs), end: new Date(endMs) };
  };
  const from = dayBounds(dateFromStr);
  const to = dayBounds(dateToStr);
  return { gte: from.start, lte: to.end };
}

/** UTC calendar dates from start of `gte`'s UTC day through start of `lte`'s UTC day (inclusive). */
export function utcCalendarDatesBetweenInclusive(gte: Date, lte: Date): string[] {
  const dates: string[] = [];
  let t = Date.UTC(gte.getUTCFullYear(), gte.getUTCMonth(), gte.getUTCDate());
  const endT = Date.UTC(lte.getUTCFullYear(), lte.getUTCMonth(), lte.getUTCDate());
  while (t <= endT) {
    dates.push(new Date(t).toISOString().split('T')[0]);
    t += 86400000;
  }
  return dates;
}
