const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  accountant: 'Accountant',
  collector: 'Milk Receptionist',
  agent: 'Veterinary',
  viewer: 'Viewer',
  supplier: 'Supplier',
  customer: 'Customer',
};

export function getRoleLabel(role?: string | null): string {
  const normalized = (role || '').trim().toLowerCase();
  if (!normalized) return 'User';
  return ROLE_LABELS[normalized] || normalized.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
