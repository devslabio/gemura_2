import type { RoleItem } from '@/lib/api/admin';

/** Platform roles usable in employee/user assignment pickers. */
export function selectPlatformRolesForAssignment(
  roles: RoleItem[],
  currentPlatformRoleId?: string | null,
): RoleItem[] {
  return [...roles].filter((r) => {
    if (!r.id || r.is_active === false) return false;
    if (r.id === currentPlatformRoleId) return true;
    return r.is_assignable !== false;
  }).sort((a, b) => a.name.localeCompare(b.name));
}
