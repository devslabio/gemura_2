'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fullNameFromParts } from '@/lib/utils/name';
import { adminApi, CreateUserData } from '@/lib/api/admin';
import { useToastStore } from '@/store/toast';
import { useAuthStore } from '@/store/auth';
import { PermissionService } from '@/lib/services/permission.service';
import Icon, { faUser, faEnvelope, faPhone, faLock, faBuilding, faUserShield, faCheckCircle, faTimes } from '@/app/components/Icon';

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

const PERMISSIONS_FALLBACK = [
  { code: 'manage_users', name: 'Manage Users' },
  { code: 'dashboard.view', name: 'View Dashboard' },
];

export default function CreateUserPage() {
  const router = useRouter();
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

  useEffect(() => {
    if (!currentAccount?.account_id) return;
    adminApi
      .getPermissions(currentAccount.account_id)
      .then((res) => {
        if (res.code === 200 && res.data?.permissions?.length) {
          setPermissionList(res.data.permissions.map((p) => ({ code: p.code, name: p.name })));
        }
      })
      .catch(() => {});
  }, [currentAccount?.account_id]);

  useEffect(() => {
    if (!PermissionService.canManageUsers() && !PermissionService.isAdmin()) {
      router.push('/admin/users');
    }
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handlePermissionToggle = (permissionKey: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permissionKey]: !prev.permissions?.[permissionKey],
      },
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) return setError('First and last name are required'), false;
    if (!formData.email && !formData.phone) return setError('Either email or phone is required'), false;
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return setError('Invalid email format'), false;
    if (!formData.password || formData.password.length < 6) return setError('Password must be at least 6 characters'), false;
    if (formData.password !== formData.confirmPassword) return setError('Passwords do not match'), false;
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateForm()) return;

    setLoading(true);
    try {
      const { confirmPassword, firstName, lastName, ...rest } = formData;
      const userData: CreateUserData = { ...rest, name: fullNameFromParts(firstName, lastName) };
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Create User</h1>
        <Link href="/admin/users" className="btn btn-secondary">
          <Icon icon={faTimes} size="sm" className="mr-2" />
          Cancel
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-sm p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                First Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none text-gray-400">
                  <Icon icon={faUser} size="sm" />
                </div>
                <input id="firstName" name="firstName" type="text" required value={formData.firstName} onChange={handleChange} className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm text-sm" disabled={loading} />
              </div>
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input id="lastName" name="lastName" type="text" required value={formData.lastName} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm text-sm" disabled={loading} />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none text-gray-400">
                  <Icon icon={faEnvelope} size="sm" />
                </div>
                <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm text-sm" disabled={loading} />
              </div>
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none text-gray-400">
                  <Icon icon={faPhone} size="sm" />
                </div>
                <input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm text-sm" disabled={loading} />
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Password</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none text-gray-400">
                  <Icon icon={faLock} size="sm" />
                </div>
                <input id="password" name="password" type={showPassword ? 'text' : 'password'} required value={formData.password} onChange={handleChange} className="w-full pl-12 pr-12 py-2.5 bg-gray-50 border border-gray-200 rounded-sm text-sm" disabled={loading} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center text-gray-400 hover:text-gray-600">
                  <Icon icon={showPassword ? faTimes : faLock} size="sm" />
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none text-gray-400">
                  <Icon icon={faLock} size="sm" />
                </div>
                <input id="confirmPassword" name="confirmPassword" type={showPassword ? 'text' : 'password'} required value={formData.confirmPassword} onChange={handleChange} className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm text-sm" disabled={loading} />
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="account_type" className="block text-sm font-medium text-gray-700 mb-2"><Icon icon={faBuilding} size="sm" className="inline mr-2" />Account Type</label>
              <select id="account_type" name="account_type" value={formData.account_type} onChange={handleChange} className="input w-full" disabled={loading}>
                {ACCOUNT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2"><Icon icon={faUserShield} size="sm" className="inline mr-2" />Role</label>
              <select id="role" name="role" value={formData.role} onChange={handleChange} className="input w-full" disabled={loading}>
                {ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select id="status" name="status" value={formData.status} onChange={handleChange} className="input w-full" disabled={loading}>
                {STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Permissions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {permissionList.map((permission) => (
              <label key={permission.code} className="flex items-center p-3 border border-gray-200 rounded-sm hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.permissions?.[permission.code] || false}
                  onChange={() => handlePermissionToggle(permission.code)}
                  className="mr-3 h-4 w-4"
                  disabled={loading}
                />
                <span className="text-sm text-gray-700">{permission.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <Link href="/admin/users" className="btn btn-secondary" tabIndex={-1}>Cancel</Link>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <Icon icon={faCheckCircle} size="sm" className="mr-2" />
            {loading ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </form>
    </div>
  );
}

