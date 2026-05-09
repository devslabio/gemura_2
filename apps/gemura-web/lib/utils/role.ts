const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  regional_supervisor: 'Regional supervisor',
  leadership: 'Leadership',
  regulator: 'Regulator',
  manager: 'Manager',
  accountant: 'Accountant',
  collector: 'Milk Receptionist',
  agent: 'Veterinary',
  viewer: 'Viewer',
  supplier: 'Supplier',
  customer: 'Customer',
};

/**
 * @param accountType From UserAccount / login (e.g. farmer, supplier, mcc) — distinguishes org owner from milk farmer.
 */
export function getRoleLabel(role?: string | null, accountType?: string | null): string {
  const at = (accountType || '').trim().toLowerCase();
  const r = (role || '').trim().toLowerCase();
  // “owner” on a farmer/supplier/customer login is tenant ownership, not MCC admin — show the business type.
  if (r === 'owner' && (at === 'farmer' || at === 'supplier' || at === 'customer')) {
    if (at === 'farmer') return 'Farmer';
    if (at === 'supplier') return 'Milk supplier';
    return 'Customer';
  }
  if (!r) return 'User';
  return ROLE_LABELS[r] || r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
