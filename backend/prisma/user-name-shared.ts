/**
 * Same behavior as src/common/utils/user-name.util.ts — duplicated here so
 * `tsx prisma/*.ts` runs in production Docker (image has dist/ + prisma/, no src/).
 */

export function splitIntoFirstLast(full: string): { first_name: string; last_name: string } {
  const t = (full || '').trim();
  if (!t) return { first_name: '', last_name: '' };
  const i = t.indexOf(' ');
  if (i === -1) return { first_name: t, last_name: '' };
  return { first_name: t.slice(0, i).trim(), last_name: t.slice(i + 1).trim() };
}

export function composeUserFullName(first: string, last: string): string {
  return `${(first || '').trim()} ${(last || '').trim()}`.trim();
}
