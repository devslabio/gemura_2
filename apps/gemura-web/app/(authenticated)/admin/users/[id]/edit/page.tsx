'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { PermissionService } from '@/lib/services/permission.service';
import { fullNameFromParts, splitFullName } from '@/lib/utils/name';
import { adminApi, UpdateUserData } from '@/lib/api/admin';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import Icon, { faUser, faEnvelope, faPhone, faLock, faBuilding, faUserShield, faCheckCircle, faTimes, faSpinner } from '@/app/components/Icon';
import { DetailPageSkeleton } from '@/app/components/SkeletonLoader';

// Available roles and account types
const ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'collector', label: 'Collector' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'agent', label: 'Agent' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'customer', label: 'Customer' },
];

const ACCOUNT_TYPES = [
  { value: 'mcc', label: 'MCC' },
  { value: 'agent', label: 'Agent' },
  { value: 'collector', label: 'Collector' },
  { value: 'veterinarian', label: 'Veterinarian' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'customer', label: 'Customer' },
  { value: 'farmer', label: 'Farmer' },
  { value: 'owner', label: 'Owner' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

// Fallback if API fails
const PERMISSIONS_FALLBACK = [
  { code: 'manage_users', name: 'Manage Users' },
  { code: 'dashboard.view', name: 'View Dashboard' },
  { code: 'view_sales', name: 'View Sales' },
  { code: 'create_sales', name: 'Create Sales' },
  { code: 'update_sales', name: 'Update Sales' },
  { code: 'view_collections', name: 'View Collections' },
  { code: 'create_collections', name: 'Create Collections' },
  { code: 'view_suppliers', name: 'View Suppliers' },
  { code: 'create_suppliers', name: 'Create Suppliers' },
  { code: 'view_customers', name: 'View Customers' },
  { code: 'create_customers', name: 'Create Customers' },
  { code: 'view_inventory', name: 'View Inventory' },
  { code: 'manage_inventory', name: 'Manage Inventory' },
  { code: 'view_analytics', name: 'View Analytics' },
];

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  const { currentAccount } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [permissionList, setPermissionList] = useState<{ code: string; name: string }[]>(PERMISSIONS_FALLBACK);
  const [formData, setFormData] = useState<UpdateUserData & { confirmPassword: string; firstName: string; lastName: string }>({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    account_type: 'mcc',
    status: 'active',
    role: 'viewer',
    permissions: {},
    firstName: '',
    lastName: '',
  });

  // Load permissions list for checkboxes (single source of truth from API)
  useEffect(() => {
    if (!currentAccount?.account_id) return;
    adminApi.getPermissions(currentAccount.account_id).then((res) => {
      if (res.code === 200 && res.data?.permissions?.length) {
        setPermissionList(res.data.permissions.map((p) => ({ code: p.code, name: p.name })));
      }
    }).catch(() => {});
  }, [currentAccount?.account_id]);

  // Check permission on mount and load user; only re-run when userId changes
  useEffect(() => {
    if (!PermissionService.canManageUsers() && !PermissionService.isAdmin()) {
      router.push('/admin/users');
      return;
    }
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const loadUser = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await adminApi.getUserById(userId, currentAccount?.account_id);

      if (response.code === 200 && response.data) {
        const user = response.data;
        
        // Parse permissions if it's a string
        let permissions = user.permissions || {};
        if (typeof permissions === 'string') {
          try {
            permissions = JSON.parse(permissions);
          } catch {
            permissions = {};
          }
        }

        const { firstName, lastName } = splitFullName(user.name || '');
        setFormData({
          name: user.name || '',
          email: user.email || '',
          phone: user.phone || '',
          password: '',
          confirmPassword: '',
          account_type: user.account_type || 'mcc',
          status: user.status || 'active',
          role: user.role || 'viewer',
          permissions: permissions || {},
          firstName,
          lastName,
        });
      } else {
        setError('Failed to load user data');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load user. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    setError('');
  };

  const handlePermissionToggle = (permissionKey: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permissionKey]: !prev.permissions?.[permissionKey],
      },
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.firstName?.trim()) {
      setError('First name is required');
      return false;
    }
    if (!formData.lastName?.trim()) {
      setError('Last name is required');
      return false;
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Invalid email format');
      return false;
    }

    // Password is optional for update, but if provided, must be valid
    if (formData.password) {
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        return false;
      }

      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setSaving(true);

    try {
      const { firstName, lastName, confirmPassword, ...rest } = formData;
      const updateData: UpdateUserData = {
        ...rest,
        name: fullNameFromParts(firstName, lastName),
      };
      if (!updateData.password) {
        delete updateData.password;
      }

      const response = await adminApi.updateUser(userId, updateData, currentAccount?.account_id);

      if (response.code === 200) {
        useToastStore.getState().success('User updated successfully!');
        router.push(`/admin/users/${userId}`);
      } else {
        setError(response.message || 'Failed to update user');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to update user. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <DetailPageSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit User</h1>
        </div>
        <Link href={`/admin/users/${userId}`} className="btn btn-secondary">
          <Icon icon={faTimes} size="sm" className="mr-2" />
          Cancel
        </Link>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-sm p-6 space-y-6">
        {/* Basic Information */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* First Name */}
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                First Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none text-gray-400">
                  <Icon icon={faUser} size="sm" />
                </div>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:bg-white focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] text-sm"
                  placeholder="First name"
                  disabled={saving}
                />
              </div>
            </div>

            {/* Last Name */}
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                required
                value={formData.lastName}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:bg-white focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] text-sm"
                placeholder="Last name"
                disabled={saving}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none text-gray-400">
                  <Icon icon={faEnvelope} size="sm" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:bg-white focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] text-sm"
                  placeholder="Enter email address"
                  disabled={saving}
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none text-gray-400">
                  <Icon icon={faPhone} size="sm" />
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:bg-white focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] text-sm"
                  placeholder="250788123456"
                  disabled={saving}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Password (Optional for update) */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Change Password (Optional)</h2>
          <p className="text-sm text-gray-600 mb-4">Leave blank to keep current password</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none text-gray-400">
                  <Icon icon={faLock} size="sm" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-12 pr-12 py-2.5 bg-gray-50 border border-gray-200 rounded-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:bg-white focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] text-sm"
                  placeholder="Enter new password (min 6 characters)"
                  disabled={saving}
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon icon={showPassword ? faTimes : faLock} size="sm" />
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none text-gray-400">
                  <Icon icon={faLock} size="sm" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:bg-white focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] text-sm"
                  placeholder="Confirm new password"
                  disabled={saving}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Account Settings */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Account Type */}
            <div>
              <label htmlFor="account_type" className="block text-sm font-medium text-gray-700 mb-2">
                <Icon icon={faBuilding} size="sm" className="inline mr-2" />
                Account Type
              </label>
              <select
                id="account_type"
                name="account_type"
                value={formData.account_type}
                onChange={handleChange}
                className="input w-full"
                disabled={saving}
              >
                {ACCOUNT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Role */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                <Icon icon={faUserShield} size="sm" className="inline mr-2" />
                Role
              </label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="input w-full"
                disabled={saving}
              >
                {ROLES.map(role => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="input w-full"
                disabled={saving}
              >
                {STATUS_OPTIONS.map(status => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Permissions */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Permissions</h2>
          <p className="text-sm text-gray-600 mb-3">Override default role permissions for this user. Owner and Admin have all permissions.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {permissionList.map((permission) => (
              <label
                key={permission.code}
                className="flex items-center p-3 border border-gray-200 rounded-sm hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={formData.permissions?.[permission.code] || false}
                  onChange={() => handlePermissionToggle(permission.code)}
                  className="mr-3 h-4 w-4 text-[var(--primary)] focus:ring-[var(--primary)] border-gray-300 rounded"
                  disabled={saving}
                />
                <span className="text-sm text-gray-700">{permission.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <Link href={`/admin/users/${userId}`} className="btn btn-secondary" tabIndex={-1}>
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? (
              <>
                <Icon icon={faSpinner} size="sm" spin className="mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Icon icon={faCheckCircle} size="sm" className="mr-2" />
                Update User
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
