/**
 * Canonical Rwanda mobile in DB is digits-only with country code 250 (e.g. 250788409034).
 * Users often type local 078… or 788… — normalize before login API calls.
 */
export function normalizeRwandaLoginPhoneDigits(digitsOnly: string): string {
  const d = digitsOnly.replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('0')) return `250${d.slice(1)}`;
  if (d.length === 9 && d.startsWith('7')) return `250${d}`;
  return d;
}
