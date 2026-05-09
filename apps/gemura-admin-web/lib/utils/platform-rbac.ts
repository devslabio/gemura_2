/**
 * Client-side mirrors of backend platform RBAC helpers (`roles-permissions.config.ts`).
 */

export function canonicalPlatformRoleSlug(slug: string | null | undefined): string {
  let raw = (slug ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  raw = raw.replace(/-/g, '_');
  if (!raw) return '';
  if (raw === 'owner') return 'system_admin';
  if (raw === 'veterinary' || raw === 'veterinarian' || raw === 'veternary') return 'veterinary_officer';
  if (raw === 'milkreceptionist' || raw === 'milk_receptionist') return 'collector';
  return raw.slice(0, 64);
}

export function isPlatformSuperAdminRole(role: string | null | undefined): boolean {
  const r = (role ?? '').toLowerCase();
  return r === 'system_admin' || r === 'admin' || r === 'owner';
}

export function platformRolesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  return canonicalPlatformRoleSlug(a) === canonicalPlatformRoleSlug(b);
}
