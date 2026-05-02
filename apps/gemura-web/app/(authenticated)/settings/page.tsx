'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Icon, { faCog, faUser, faLock, faEnvelope, faPhone, faSpinner, faCheckCircle, faUsers, faUserShield, faUserPlus, faEdit, faUserMinus } from '@/app/components/Icon';
import { SkeletonBar } from '@/app/components/SkeletonLoader';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import { usePermission } from '@/hooks/usePermission';
import { fullNameFromParts, splitFullName } from '@/lib/utils/name';
import { profileApi, UpdateProfilePayload } from '@/lib/api/profile';
import { employeesApi, type EmployeeItem } from '@/lib/api/employees';
import Modal from '@/app/components/Modal';
import ConfirmDialog from '@/app/components/ConfirmDialog';

type TeamAccessGroup = 'general_access' | 'limited_access';
type TeamProfileKey = 'manager' | 'accountant' | 'milk_receptionist' | 'veterinary';

const TEAM_ROLE_PROFILES: Record<TeamProfileKey, {
  key: TeamProfileKey;
  label: string;
  description: string;
  accessGroup: TeamAccessGroup;
  backendRole: 'manager' | 'accountant' | 'collector' | 'agent';
}> = {
  manager: {
    key: 'manager',
    label: 'Manager',
    description: 'Oversees center-wide activities and team operations.',
    accessGroup: 'general_access',
    backendRole: 'manager',
  },
  accountant: {
    key: 'accountant',
    label: 'Accountant',
    description: 'Access to overall dashboard, payroll, loans, charges, and finance only.',
    accessGroup: 'general_access',
    backendRole: 'accountant',
  },
  milk_receptionist: {
    key: 'milk_receptionist',
    label: 'Milk Receptionist',
    description: 'Access to sales, collections, suppliers, customers, and inventory with ability to add inventory items.',
    accessGroup: 'limited_access',
    backendRole: 'collector',
  },
  veterinary: {
    key: 'veterinary',
    label: 'Veterinary',
    description: 'Same access as Milk Receptionist, plus can add inventory items.',
    accessGroup: 'limited_access',
    backendRole: 'agent',
  },
};

const TEAM_PROFILE_OPTIONS: TeamProfileKey[] = ['manager', 'accountant', 'milk_receptionist', 'veterinary'];

const profileFromEmployee = (employee: EmployeeItem): TeamProfileKey => {
  const r = (employee.role || '').toLowerCase();
  if (r === 'system_admin' || r === 'owner' || r === 'admin') return 'manager';
  if (r === 'manager') return 'manager';
  if (r === 'accountant') return 'accountant';
  if (r === 'agent') return 'veterinary';
  return 'milk_receptionist';
};

const ROLE_DEFINITIONS = [
  {
    name: 'Milk Receptionist',
    description: 'Access to sales, collections, suppliers, customers, and inventory with ability to add inventory items.',
    permissionGroup: 'Limited Access',
  },
  {
    name: 'Veterinary',
    description: 'Same access as Milk Receptionist, plus can add inventory items.',
    permissionGroup: 'Limited Access',
  },
  {
    name: 'Accountant',
    description: 'Access to overall dashboard, payroll, loans, charges, and finance only.',
    permissionGroup: 'General Access',
  },
  {
    name: 'Manager',
    description: 'Oversees center-wide activities and team operations.',
    permissionGroup: 'General Access',
  },
];

const PERMISSION_GROUPS = [
  {
    name: 'General Access',
    summary: 'Allowed to view all sidebar tabs.',
    grantedTo: ['Manager', 'Accountant'],
    tabs: ['All sidebar tabs'],
  },
  {
    name: 'Limited Access',
    summary: 'Operational access with role-based limits inside core workflows.',
    grantedTo: ['Milk Receptionist', 'Veterinary'],
    tabs: ['Sales', 'Collections', 'Suppliers', 'Customers', 'Inventory (Add Item enabled)'],
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, setUser, currentAccount } = useAuthStore();
  const showToast = useToastStore((s) => s.show);
  const { canManageUsers } = usePermission();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<{ firstName: string; lastName: string; email: string; phone: string }>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<EmployeeItem | null>(null);
  const [deactivateEmployee, setDeactivateEmployee] = useState<EmployeeItem | null>(null);
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    profileKey: 'milk_receptionist' as TeamProfileKey,
  });
  const [editProfileKey, setEditProfileKey] = useState<TeamProfileKey>('milk_receptionist');
  type TabId = 'profile' | 'password' | 'team' | 'roles_permissions' | 'preferences';
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  useEffect(() => {
    const role = (currentAccount?.role || '').toLowerCase();
    if (role === 'collector' || role === 'agent') {
      router.replace('/collections');
    }
  }, [currentAccount?.role, router]);

  /** Matches backend: employees endpoints require manage_users (or super-admin tier via PermissionService). */
  const canManageEmployees = !!currentAccount?.account_id && canManageUsers();

  const tabs: { id: TabId; label: string; icon: typeof faUser }[] = [
    { id: 'profile', label: 'Profile', icon: faUser },
    { id: 'password', label: 'Password', icon: faLock },
    ...(canManageEmployees ? [{ id: 'team' as const, label: 'Team', icon: faUsers }] : []),
    ...(canManageEmployees ? [{ id: 'roles_permissions' as const, label: 'Roles & Permissions', icon: faUserShield }] : []),
    { id: 'preferences', label: 'Preferences', icon: faCog },
  ];

  const loadEmployees = useCallback(async () => {
    if (!currentAccount?.account_id) return;
    setEmployeesLoading(true);
    try {
      const res = await employeesApi.getEmployees(currentAccount.account_id);
      if (res.code === 200 && res.data) setEmployees(Array.isArray(res.data) ? res.data : []);
      else setEmployees([]);
    } catch {
      setEmployees([]);
    } finally {
      setEmployeesLoading(false);
    }
  }, [currentAccount?.account_id]);

  useEffect(() => {
    if (canManageEmployees) {
      loadEmployees();
    }
  }, [canManageEmployees, loadEmployees]);

  useEffect(() => {
    profileApi
      .getProfile()
      .then((res) => {
        if (res.code === 200 && res.data?.user) {
          const u = res.data.user;
          const { firstName, lastName } = splitFullName(u.name || '');
          setProfile({
            firstName,
            lastName,
            email: u.email || '',
            phone: u.phone || '',
          });
        }
      })
      .catch(() => {
        if (user) {
          setProfile({
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email || '',
            phone: user.phone || '',
          });
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: UpdateProfilePayload = {
        name: fullNameFromParts(profile.firstName, profile.lastName) || undefined,
        email: profile.email.trim() || undefined,
        phone: profile.phone.trim() || undefined,
      };
      const res = await profileApi.updateProfile(payload);
      if (res.code === 200 && res.data?.user) {
        const u = res.data.user;
        const parts = (u.name || '').split(' ');
        setUser({
          ...user!,
          firstName: parts[0] || u.name || '',
          lastName: parts.slice(1).join(' ') || '',
          email: u.email || '',
          phone: u.phone || '',
        });
        showToast('Profile updated successfully', 'success');
      } else {
        showToast(res.message || 'Failed to update profile', 'error');
      }
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.email.trim() && !inviteForm.phone.trim()) {
      showToast('Email or phone is required', 'error');
      return;
    }
    if (!inviteForm.name.trim()) {
      showToast('Name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const selectedProfile = TEAM_ROLE_PROFILES[inviteForm.profileKey];
      const res = await employeesApi.inviteEmployee({
        name: inviteForm.name.trim(),
        email: inviteForm.email.trim() || undefined,
        phone: inviteForm.phone.trim() || undefined,
        password: inviteForm.password.trim() || undefined,
        role: selectedProfile.backendRole,
        access_group: selectedProfile.accessGroup,
        account_id: currentAccount?.account_id,
      });
      if (res.code === 201 || res.code === 200) {
        showToast('Team member added successfully', 'success');
        setInviteOpen(false);
        setInviteForm({ name: '', email: '', phone: '', password: '', profileKey: 'milk_receptionist' });
        loadEmployees();
      } else {
        showToast((res as any).message || 'Failed to add team member', 'error');
      }
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to add team member', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async () => {
    if (!editEmployee) return;
    setSaving(true);
    try {
      const selectedProfile = TEAM_ROLE_PROFILES[editProfileKey];
      const res = await employeesApi.updateEmployee(
        editEmployee.id,
        {
          role: selectedProfile.backendRole,
          access_group: selectedProfile.accessGroup,
        },
        currentAccount?.account_id,
      );
      if (res.code === 200) {
        showToast('Role updated', 'success');
        setEditEmployee(null);
        loadEmployees();
      } else {
        showToast((res as any).message || 'Failed to update', 'error');
      }
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to update', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivateConfirm = async () => {
    if (!deactivateEmployee) return;
    setSaving(true);
    try {
      const res = await employeesApi.updateEmployee(deactivateEmployee.id, { status: 'inactive' }, currentAccount?.account_id);
      if (res.code === 200) {
        showToast('Access deactivated', 'success');
        setDeactivateEmployee(null);
        loadEmployees();
      } else {
        showToast((res as any).message || 'Failed to deactivate', 'error');
      }
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to deactivate', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header – resolveIT style */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your account settings and preferences</p>
      </div>

      {/* Single card with top tabs */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        {/* Tab bar */}
        <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-5 py-4 text-sm font-medium whitespace-nowrap
                border-b-2 transition-colors
                ${activeTab === tab.id
                  ? 'bg-white text-(--primary) border-(--primary)'
                  : 'border-transparent text-gray-600 hover:bg-white hover:text-(--primary)'
                }
              `}
            >
              <Icon icon={tab.icon} size="sm" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Profile tab */}
        {activeTab === 'profile' && (
          <div className="p-6 sm:p-8">
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 m-0">Profile information</h3>
              <p className="mt-1 text-sm text-gray-600 m-0">Update your personal information</p>
            </div>
            {loading ? (
              <div className="max-w-md space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i}>
                    <SkeletonBar className="h-4 w-20 mb-1.5" />
                    <SkeletonBar className="h-10 w-full rounded-sm" />
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <SkeletonBar className="h-10 w-24 rounded-sm" />
                  <SkeletonBar className="h-10 w-20 rounded-sm" />
                </div>
              </div>
            ) : (
              <form onSubmit={handleProfileSubmit} className="max-w-md space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="settings-firstName" className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                    <input
                      id="settings-firstName"
                      type="text"
                      value={profile.firstName}
                      onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))}
                      className="input w-full"
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <label htmlFor="settings-lastName" className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                    <input
                      id="settings-lastName"
                      type="text"
                      value={profile.lastName}
                      onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))}
                      className="input w-full"
                      placeholder="Last name"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="settings-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="relative">
                    <Icon icon={faEnvelope} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size="sm" />
                    <input
                      id="settings-email"
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                      className="input w-full pl-10"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="settings-phone" className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <div className="relative">
                    <Icon icon={faPhone} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size="sm" />
                    <input
                      id="settings-phone"
                      type="tel"
                      value={profile.phone}
                      onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                      className="input w-full pl-10"
                      placeholder="250788123456"
                    />
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <button type="submit" disabled={saving} className="btn btn-primary">
                    {saving ? <><Icon icon={faSpinner} className="animate-spin" size="sm" /> Saving...</> : <><Icon icon={faCheckCircle} size="sm" /> Save changes</>}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Password tab */}
        {activeTab === 'password' && (
          <div className="p-6 sm:p-8">
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 m-0">Change password</h3>
              <p className="mt-1 text-sm text-gray-600 m-0">Update your password to keep your account secure</p>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              We&apos;ll send a reset link to your email to change your password.
            </p>
            <Link href="/auth/forgot-password" className="btn btn-primary inline-flex items-center gap-2">
              <Icon icon={faLock} size="sm" />
              Change password via email
            </Link>
          </div>
        )}

        {/* Team tab */}
        {activeTab === 'team' && canManageEmployees && (
          <div className="p-6 sm:p-8">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 m-0">Team members</h3>
                <p className="mt-1 text-sm text-gray-600 m-0">Manage who has access to this account</p>
              </div>
              <button type="button" onClick={() => setInviteOpen(true)} className="btn btn-primary inline-flex items-center gap-2">
                <Icon icon={faUserPlus} size="sm" />
                Add team member
              </button>
            </div>
            {!currentAccount?.account_id ? (
              <p className="text-sm text-gray-500">Select an account to manage team members.</p>
            ) : employeesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <SkeletonBar key={i} className="h-10 w-full rounded-sm" />
                ))}
              </div>
            ) : employees.length === 0 ? (
              <p className="text-sm text-gray-500">No team members yet. Add people by their email or phone number.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-3 px-4 font-medium text-gray-700">Name</th>
                      <th className="py-3 px-4 font-medium text-gray-700">Email</th>
                      <th className="py-3 px-4 font-medium text-gray-700">Phone</th>
                      <th className="py-3 px-4 font-medium text-gray-700">Role</th>
                      <th className="py-3 px-4 font-medium text-gray-700">Status</th>
                      <th className="py-3 px-4 font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {employees.map((emp) => {
                      const isOwner = emp.is_owner === true;
                      return (
                        <tr key={emp.id} className={`${isOwner ? 'bg-blue-50' : 'bg-white'} hover:bg-gray-50/50`}>
                          <td className="py-3 px-4 text-gray-900">{emp.user?.name ?? '—'}</td>
                          <td className="py-3 px-4 text-gray-600">{emp.user?.email ?? '—'}</td>
                          <td className="py-3 px-4 text-gray-600">{emp.user?.phone ?? '—'}</td>
                          <td className="py-3 px-4">
                            {isOwner ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Owner
                              </span>
                            ) : (
                              <span className="capitalize">{TEAM_ROLE_PROFILES[profileFromEmployee(emp)].label}</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className={emp.status === 'active' ? 'text-green-600 font-medium' : 'text-gray-500'}>{emp.status === 'active' ? 'Active' : 'Inactive'}</span>
                          </td>
                          <td className="py-3 px-4">
                            {isOwner ? (
                              <span className="text-xs text-gray-500" title="Owner cannot be edited">—</span>
                            ) : emp.status === 'active' ? (
                              <span className="inline-flex gap-1">
                                <button type="button" onClick={() => { setEditEmployee(emp); setEditProfileKey(profileFromEmployee(emp)); }} className="p-1.5 text-gray-500 hover:text-(--primary) rounded" title="Edit role"><Icon icon={faEdit} size="sm" /></button>
                                <button type="button" onClick={() => setDeactivateEmployee(emp)} className="p-1.5 text-gray-500 hover:text-red-600 rounded" title="Deactivate"><Icon icon={faUserMinus} size="sm" /></button>
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Roles & Permissions tab */}
        {activeTab === 'roles_permissions' && canManageEmployees && (
          <div className="p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 m-0">Roles & Permissions</h3>
              <p className="mt-1 text-sm text-gray-600 m-0">Definitions for roles and access groups used in this account.</p>
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
                <p className="text-2xl font-bold text-gray-900 mt-1">6</p>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-sm p-5">
              <h4 className="text-base font-semibold text-gray-900">Roles</h4>
              <p className="text-sm text-gray-600 mt-1">These are the primary user roles currently used in this dashboard.</p>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {ROLE_DEFINITIONS.map((role) => (
                  <div key={role.name} className="border border-gray-200 rounded-sm p-4 bg-gray-50/40">
                    <div className="flex items-center justify-between gap-3">
                      <h5 className="font-semibold text-gray-900">{role.name}</h5>
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
              <h4 className="text-base font-semibold text-gray-900">Permission Groups</h4>
              <p className="text-sm text-gray-600 mt-1">Access is assigned through these permission groups.</p>

              <div className="mt-4 space-y-4">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.name} className="border border-gray-200 rounded-sm p-4">
                    <h5 className="font-semibold text-gray-900">{group.name}</h5>
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
        )}

        {/* Preferences tab */}
        {activeTab === 'preferences' && (
          <div className="p-6 sm:p-8">
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 m-0">Preferences</h3>
              <p className="mt-1 text-sm text-gray-600 m-0">App and display preferences</p>
            </div>
            <p className="text-sm text-gray-500">Sidebar collapse state is saved in your browser.</p>
          </div>
        )}
      </div>

      {/* Add team member modal */}
      <Modal open={inviteOpen} onClose={() => !saving && setInviteOpen(false)} title="Add team member" maxWidth="max-w-md">
        <p className="text-sm text-gray-600 mb-4">Add someone by their email or phone number. If they already have an account, they’ll be linked to this account. If not, you’ll set a name and password for the new user.</p>
        <form onSubmit={handleAddMemberSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={inviteForm.email}
              onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
              className="input w-full"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={inviteForm.phone}
              onChange={(e) => setInviteForm((f) => ({ ...f, phone: e.target.value }))}
              className="input w-full"
              placeholder="250788123456"
            />
          </div>
          <p className="text-xs text-gray-500">Provide at least one of email or phone.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={inviteForm.name}
              onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))}
              className="input w-full"
              placeholder="Full name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={inviteForm.password}
              onChange={(e) => setInviteForm((f) => ({ ...f, password: e.target.value }))}
              className="input w-full"
              placeholder="Min 6 characters (required only for new users)"
              minLength={6}
            />
            <p className="text-xs text-gray-500 mt-1">Required only when the person doesn’t have an account yet.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={inviteForm.profileKey}
              onChange={(e) => setInviteForm((f) => ({ ...f, profileKey: e.target.value as TeamProfileKey }))}
              className="input w-full"
            >
              {TEAM_PROFILE_OPTIONS.map((profileKey) => (
                <option key={profileKey} value={profileKey}>
                  {TEAM_ROLE_PROFILES[profileKey].label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {TEAM_ROLE_PROFILES[inviteForm.profileKey].description}
            </p>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={() => setInviteOpen(false)} className="btn btn-secondary" disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><Icon icon={faSpinner} spin size="sm" className="mr-2" />Adding...</> : 'Add'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit role modal */}
      <Modal open={!!editEmployee} onClose={() => !saving && setEditEmployee(null)} title="Edit role" maxWidth="max-w-md">
        {editEmployee && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{editEmployee.user?.name}</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={editProfileKey}
                onChange={(e) => setEditProfileKey(e.target.value as TeamProfileKey)}
                className="input w-full"
              >
                {TEAM_PROFILE_OPTIONS.map((profileKey) => (
                  <option key={profileKey} value={profileKey}>{TEAM_ROLE_PROFILES[profileKey].label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {TEAM_ROLE_PROFILES[editProfileKey].description}
              </p>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setEditEmployee(null)} className="btn btn-secondary" disabled={saving}>Cancel</button>
              <button type="button" onClick={handleEditSubmit} className="btn btn-primary" disabled={saving}>
                {saving ? <><Icon icon={faSpinner} spin size="sm" className="mr-2" />Saving...</> : 'Save'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Deactivate confirm */}
      <ConfirmDialog
        open={!!deactivateEmployee}
        onClose={() => setDeactivateEmployee(null)}
        onConfirm={handleDeactivateConfirm}
        title="Deactivate access"
        message={deactivateEmployee ? `Deactivate ${deactivateEmployee.user?.name ?? 'this user'}'s access to this account? They will no longer be able to sign in for this account.` : ''}
        confirmText="Deactivate"
        cancelText="Cancel"
        type="danger"
        loading={saving}
      />
    </div>
  );
}
