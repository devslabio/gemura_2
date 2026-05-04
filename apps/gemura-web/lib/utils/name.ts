/**
 * Split a display full name into first / last (first token vs remainder). Prefer API `first_name` / `last_name` when present.
 */
export function splitFullName(full: string): { firstName: string; lastName: string } {
  const trimmed = (full || '').trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const parts = trimmed.split(/\s+/);
  const firstName = parts[0] ?? '';
  const lastName = parts.slice(1).join(' ') ?? '';
  return { firstName, lastName };
}

/**
 * Build a single display string from first + last (e.g. supplier/customer `name` fields that are not yet split in the API).
 */
export function fullNameFromParts(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ').trim();
}
