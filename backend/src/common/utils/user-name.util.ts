/** Split a single display string into first / last (first token vs remainder).
 *  Prisma seeds use a copy in `prisma/user-name-shared.ts` (Docker image has no `src/`). Keep behavior in sync. */
export function splitIntoFirstLast(full: string): { first_name: string; last_name: string } {
  const t = (full || '').trim();
  if (!t) return { first_name: '', last_name: '' };
  const i = t.indexOf(' ');
  if (i === -1) return { first_name: t, last_name: '' };
  return { first_name: t.slice(0, i).trim(), last_name: t.slice(i + 1).trim() };
}

/** Canonical display name stored on `users.name` (kept in sync with first/last). */
export function composeUserFullName(first: string, last: string): string {
  return `${(first || '').trim()} ${(last || '').trim()}`.trim();
}
