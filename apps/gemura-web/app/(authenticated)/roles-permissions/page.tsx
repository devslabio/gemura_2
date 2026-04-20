'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermission } from '@/hooks/usePermission';

const ROLE_DEFINITIONS = [
  {
    name: 'Milk Receptionist',
    description: 'Access to sales, collections, suppliers, customers, and inventory with ability to add inventory items.',
    permissionGroup: 'Milk Receptionist Access',
  },
  {
    name: 'Veterinary',
    description: 'Same access as Milk Receptionist, plus can add inventory items.',
    permissionGroup: 'Milk Receptionist Access',
  },
  {
    name: 'Accountant',
    description: 'Access to overall dashboard, payroll, loans, charges, and finance only.',
    permissionGroup: 'General Full Access',
  },
  {
    name: 'Manager',
    description: 'Oversees center-wide activities and team operations.',
    permissionGroup: 'General Full Access',
  },
];

const PERMISSION_GROUPS = [
  {
    name: 'General Full Access',
    summary: 'Allowed to view all sidebar tabs.',
    grantedTo: ['Manager', 'Accountant'],
    tabs: ['All sidebar tabs'],
  },
  {
    name: 'Milk Receptionist Access',
    summary: 'Limited operational access for daily milk-center workflows.',
    grantedTo: ['Milk Receptionist', 'Veterinary'],
    tabs: ['Sales', 'Collections', 'Suppliers', 'Customers', 'Inventory (Add Item enabled)'],
  },
];

export default function RolesPermissionsPage() {
  const router = useRouter();
  const { canManageUsers, isAdmin } = usePermission();

  useEffect(() => {
    if (!canManageUsers() && !isAdmin()) {
      router.replace('/dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Roles & Permissions</h1>
        <p className="text-sm text-gray-600 mt-1">
          Role definitions and access groups for milk collection center teams.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <p className="text-sm text-gray-600">Roles</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">4</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <p className="text-sm text-gray-600">Permission Groups</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">2</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <p className="text-sm text-gray-600">Restricted Tabs (Receptionist Access)</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">5</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm p-5">
        <h2 className="text-lg font-semibold text-gray-900">Roles</h2>
        <p className="text-sm text-gray-600 mt-1">
          These are the primary user roles currently used in this dashboard.
        </p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {ROLE_DEFINITIONS.map((role) => (
            <div key={role.name} className="border border-gray-200 rounded-sm p-4 bg-gray-50/40">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-gray-900">{role.name}</h3>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-medium">
                  {role.permissionGroup}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-2">{role.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm p-5">
        <h2 className="text-lg font-semibold text-gray-900">Permission Groups</h2>
        <p className="text-sm text-gray-600 mt-1">
          Access is assigned through these permission groups.
        </p>

        <div className="mt-4 space-y-4">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.name} className="border border-gray-200 rounded-sm p-4">
              <h3 className="font-semibold text-gray-900">{group.name}</h3>
              <p className="text-sm text-gray-600 mt-1">{group.summary}</p>

              <div className="mt-3">
                <p className="text-xs uppercase tracking-wide text-gray-500 font-medium">Granted To</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {group.grantedTo.map((role) => (
                    <span
                      key={role}
                      className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-800 text-xs font-medium"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-3">
                <p className="text-xs uppercase tracking-wide text-gray-500 font-medium">Sidebar Tabs</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {group.tabs.map((tab) => (
                    <span
                      key={tab}
                      className="inline-flex items-center px-2.5 py-1 rounded-full bg-green-50 text-green-800 text-xs font-medium"
                    >
                      {tab}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}