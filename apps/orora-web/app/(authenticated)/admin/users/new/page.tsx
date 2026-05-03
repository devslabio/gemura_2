'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePermission } from '@/hooks/usePermission';
import { fullNameFromParts } from '@/lib/utils/name';
import { adminApi, CreateUserData } from '@/lib/api/admin';
import { useToastStore } from '@/store/toast';
import { useAuthStore } from '@/store/auth';
import Icon, { faUser, faEnvelope, faPhone, faLock, faBuilding, faUserShield, faCheckCircle, faTimes } from '@/app/components/Icon';
import Select from '@/app/components/Select';

// Available roles and account types
const ROLES = [
  { value: 'system_admin', label: 'System admin' },
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
  { value: 'system_admin', label: 'System admin' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

// Fallback if permissions API fails
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
  { code: 'mcc_view_operations', name: 'View MCC operations' },
  { code: 'mcc_manage_operations', name: 'Manage MCC operations' },
  { code: 'mcc_accept_manifests', name: 'Accept MCC manifests' },
];

export default function CreateUserPage() {
  const router = useRouter();
  const { canManageUsers, isAdmin } = usePermission();
  const { currentAccount } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [permissionList, setPermissionList] = useState<{ code: string; name: string }[]>(PERMISSIONS_FALLBACK);
  const [formData, setFormData] = useState<CreateUserData & { confirmPassword: string; firstName: string; lastName: string }>({
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

  // Load permissions list from API (single source of truth)
  useEffect(() => {
    if (!currentAccount?.account_id) return;
    adminApi.getPermissions(currentAccount.account_id).then((res) => {
      if (res.code === 200 && res.data?.permissions?.length) {
        setPermissionList(res.data.permissions.map((p) => ({ code: p.code, name: p.name })));
      }
    }).catch(() => {});
  }, [currentAccount?.account_id]);

  // Check permission on mount (run once; canManageUsers/isAdmin are stable in behavior)
  useEffect(() => {
    if (!canManageUsers() && !isAdmin()) {
      router.push('/admin/users');
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!formData.firstName.trim()) {
      setError('First name is required');
      return false;
    }
    if (!formData.lastName.trim()) {
      setError('Last name is required');
      return false;
    }

    if (!formData.email && !formData.phone) {
      setError('Either email or phone is required');
      return false;
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Invalid email format');
      return false;
    }

    if (!formData.password) {
      setError('Password is required');
      return false;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const { confirmPassword, firstName, lastName, ...rest } = formData;
      const userData: CreateUserData = {
        ...rest,
        name: fullNameFromParts(firstName, lastName),
      };
      const response = await adminApi.createUser(userData, currentAccount?.account_id);

      if (response.code === 201 || response.code === 200) {
        useToastStore.getState().success('User created successfully!');
        router.push('/admin/users');
      } else {
        setError(response.message || 'Failed to create user');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to create user. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create User</h1>
        </div>
        <Link href="/admin/users" className="btn btn-secondary">
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
                  className="input w-full !pl-12 pr-4 text-sm placeholder:text-gray-500 rounded-sm"
                  placeholder="First name"
                  disabled={loading}
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
                className="input w-full text-sm placeholder:text-gray-500 rounded-sm"
                placeholder="Last name"
                disabled={loading}
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
                  className="input w-full !pl-12 pr-4 text-sm placeholder:text-gray-500 rounded-sm"
                  placeholder="Enter email address"
                  disabled={loading}
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
                  className="input w-full !pl-12 pr-4 text-sm placeholder:text-gray-500 rounded-sm"
                  placeholder="250788123456"
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Password */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Password</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none text-gray-400">
                  <Icon icon={faLock} size="sm" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="input w-full !pl-12 !pr-12 text-sm placeholder:text-gray-500 rounded-sm"
                  placeholder="Enter password (min 6 characters)"
                  disabled={loading}
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
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none text-gray-400">
                  <Icon icon={faLock} size="sm" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="input w-full !pl-12 pr-4 text-sm placeholder:text-gray-500 rounded-sm"
                  placeholder="Confirm password"
                  disabled={loading}
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
              <Select
                id="account_type"
                name="account_type"
                value={formData.account_type}
                onChange={(v) => setFormData((prev) => ({ ...prev, account_type: v }))}
                options={ACCOUNT_TYPES}
                placeholder="Select account type"
                disabled={loading}
                className="w-full"
              />
            </div>

            {/* Role */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                <Icon icon={faUserShield} size="sm" className="inline mr-2" />
                Role
              </label>
              <Select
                id="role"
                name="role"
                value={formData.role}
                onChange={(v) => setFormData((prev) => ({ ...prev, role: v }))}
                options={ROLES}
                placeholder="Select role"
                disabled={loading}
                className="w-full"
              />
            </div>

            {/* Status */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <Select
                id="status"
                name="status"
                value={formData.status}
                onChange={(v) => setFormData((prev) => ({ ...prev, status: v }))}
                options={STATUS_OPTIONS}
                placeholder="Select status"
                disabled={loading}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Permissions */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Permissions</h2>
          <p className="text-sm text-gray-600 mb-3">Optional overrides. The selected role already has default permissions; check any extras for this user.</p>
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
                  disabled={loading}
                />
                <span className="text-sm text-gray-700">{permission.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <Link href="/admin/users" className="btn btn-secondary" tabIndex={-1}>
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Creating...
              </>
            ) : (
              <>
                <Icon icon={faCheckCircle} size="sm" className="mr-2" />
                Create User
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
