'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Icon, { faCog, faUser, faLock, faEnvelope, faPhone, faSpinner, faCheckCircle, faUserShield, faClipboardList } from '@/app/components/Icon';
import { SkeletonBar } from '@/app/components/SkeletonLoader';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import { usePermission } from '@/hooks/usePermission';
import { splitFullName } from '@/lib/utils/name';
import { profileApi, type ProfileMccOnboardingSummary, UpdateProfilePayload } from '@/lib/api/profile';
import { isBusinessAccount, isExternalSupplier, isExternalCustomer } from '@/lib/config/nav.config';
import ExternalAccountProfileSection from './ExternalAccountProfileSection';

const ROLE_DEFINITIONS = [
  {
    name: 'Milk Receptionist',
    permissionGroup: 'Limited Access',
  },
  {
    name: 'Veterinary',
    permissionGroup: 'Limited Access',
  },
  {
    name: 'Accountant',
    permissionGroup: 'General Access',
  },
  {
    name: 'Manager',
    permissionGroup: 'General Access',
  },
];

const PERMISSION_GROUPS = [
  {
    name: 'General Access',
    grantedTo: ['Manager', 'Accountant'],
    tabs: ['All sidebar tabs'],
  },
  {
    name: 'Limited Access',
    grantedTo: ['Milk Receptionist', 'Veterinary'],
    tabs: ['Sales', 'Collections', 'Suppliers', 'Customers', 'Inventory (Add Item enabled)'],
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, setUser, currentAccount } = useAuthStore();
  const showToast = useToastStore((s) => s.show);
  const { canManageUsers } = usePermission();
  const accountType = (currentAccount?.account_type ?? '').toLowerCase();
  const isExternalAccount = isExternalSupplier(accountType) || isExternalCustomer(accountType);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<{ firstName: string; lastName: string; email: string; phone: string }>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  type TabId = 'profile' | 'password' | 'roles_permissions' | 'preferences';
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [mccOnboardings, setMccOnboardings] = useState<ProfileMccOnboardingSummary[]>([]);

  useEffect(() => {
    const role = (currentAccount?.role || '').toLowerCase();
    if (isBusinessAccount(accountType) && (role === 'collector' || role === 'agent')) {
      router.replace('/collections');
    }
  }, [currentAccount?.role, accountType, router]);

  /** Matches backend: employees endpoints require manage_users (or super-admin tier via PermissionService). */
  const canManageEmployees = !!currentAccount?.account_id && canManageUsers();

  const tabs: { id: TabId; label: string; icon: typeof faUser }[] = [
    { id: 'profile', label: 'Profile', icon: faUser },
    { id: 'password', label: 'Password', icon: faLock },
    ...(canManageEmployees ? [{ id: 'roles_permissions' as const, label: 'Roles & Permissions', icon: faUserShield }] : []),
    { id: 'preferences', label: 'Preferences', icon: faCog },
  ];

  useEffect(() => {
    if (isExternalAccount) {
      setLoading(false);
      return;
    }
    profileApi
      .getProfile()
      .then((res) => {
        if (res.code === 200 && res.data?.user) {
          const u = res.data.user;
          const split = splitFullName(u.name || '');
          setProfile({
            firstName: (u.first_name ?? split.firstName).trim(),
            lastName: (u.last_name ?? split.lastName).trim(),
            email: u.email || '',
            phone: u.phone || '',
          });
          setMccOnboardings(res.data.mcc_onboardings ?? []);
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
  }, [user, isExternalAccount]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: UpdateProfilePayload = {
        first_name: profile.firstName.trim() || undefined,
        last_name: profile.lastName.trim() || undefined,
        email: profile.email.trim() || undefined,
        phone: profile.phone.trim() || undefined,
      };
      const res = await profileApi.updateProfile(payload);
      if (res.code === 200 && res.data?.user) {
        const u = res.data.user;
        const parts = (u.name || '').split(/\s+/);
        setUser({
          ...user!,
          firstName: (u.first_name ?? parts[0] ?? '').trim() || parts[0] || '',
          lastName: (u.last_name ?? parts.slice(1).join(' ') ?? '').trim(),
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

  return (
    <div className="space-y-6">
      {/* Page header – resolveIT style */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
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
            {isExternalAccount ? (
              <ExternalAccountProfileSection />
            ) : (
              <>
            {!loading && mccOnboardings.length > 0 && (
              <div className="mb-8 rounded-lg border border-gray-200 bg-gray-50/80 p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 m-0 mb-3">
                  <Icon icon={faClipboardList} size="sm" />
                  MCC gate onboarding (KYC)
                </h3>
                <ul className="space-y-2">
                  {mccOnboardings.map((m) => (
                    <li key={m.id}>
                      <Link
                        href={`/settings/mcc-kyc/${m.id}`}
                        className="block rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm hover:border-(--primary) transition-colors"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium text-gray-900">{m.business_name}</span>
                          <span
                            className={`text-xs font-medium rounded px-2 py-0.5 shrink-0 ${
                              m.review_status === 'approved'
                                ? 'bg-green-100 text-green-800'
                                : m.review_status === 'rejected'
                                  ? 'bg-red-100 text-red-800'
                                  : m.review_status === 'needs_changes'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {m.review_status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 font-mono mt-1">{m.submission_code}</div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 m-0">Profile information</h3>
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
                      className="input w-full pl-11"
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
                      className="input w-full pl-11"
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
              </>
            )}
          </div>
        )}

        {/* Password tab */}
        {activeTab === 'password' && (
          <div className="p-6 sm:p-8">
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 m-0">Change password</h3>
            </div>
            <Link href="/auth/forgot-password" className="btn btn-primary inline-flex items-center gap-2">
              <Icon icon={faLock} size="sm" />
              Change password via email
            </Link>
          </div>
        )}

        {/* Roles & Permissions tab */}
        {activeTab === 'roles_permissions' && canManageEmployees && (
          <div className="p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 m-0">Roles & Permissions</h3>
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

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {ROLE_DEFINITIONS.map((role) => (
                  <div key={role.name} className="border border-gray-200 rounded-sm p-4 bg-gray-50/40">
                    <div className="flex items-center justify-between gap-3">
                      <h5 className="font-semibold text-gray-900">{role.name}</h5>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-medium">
                        {role.permissionGroup}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-sm p-5">
              <h4 className="text-base font-semibold text-gray-900">Permission Groups</h4>

              <div className="mt-4 space-y-4">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.name} className="border border-gray-200 rounded-sm p-4">
                    <h5 className="font-semibold text-gray-900">{group.name}</h5>

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
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
