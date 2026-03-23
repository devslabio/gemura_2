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

const ROLES = ['owner', 'admin', 'manager', 'accountant', 'collector', 'viewer', 'agent', 'supplier', 'customer'];
const ACCOUNT_TYPES = ['mcc', 'agent', 'collector', 'veterinarian', 'supplier', 'customer', 'farmer', 'owner'];
const STATUS_OPTIONS = ['active', 'inactive'];

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  const { currentAccount } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [permissionList, setPermissionList] = useState<{ code: string; name: string }[]>([]);
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

  useEffect(() => {
    if (!currentAccount?.account_id) return;
    adminApi.getPermissions(currentAccount.account_id).then((res) => {
      if (res.code === 200 && res.data?.permissions?.length) {
        setPermissionList(res.data.permissions.map((p) => ({ code: p.code, name: p.name })));
      }
    });
  }, [currentAccount?.account_id]);

  useEffect(() => {
    if (!PermissionService.canManageUsers() && !PermissionService.isAdmin()) {
      router.push('/admin/users');
      return;
    }
    loadUser();
  }, [router, userId]);

  const loadUser = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await adminApi.getUserById(userId, currentAccount?.account_id);
      if (response.code === 200 && response.data) {
        const user = response.data;
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
      setError(err?.response?.data?.message || err?.message || 'Failed to load user.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.firstName?.trim() || !formData.lastName?.trim()) return setError('First and last names are required');
    if (formData.password && formData.password !== formData.confirmPassword) return setError('Passwords do not match');

    setSaving(true);
    try {
      const { firstName, lastName, confirmPassword, ...rest } = formData;
      const updateData: UpdateUserData = { ...rest, name: fullNameFromParts(firstName, lastName) };
      if (!updateData.password) delete updateData.password;
      const response = await adminApi.updateUser(userId, updateData, currentAccount?.account_id);
      if (response.code === 200) {
        useToastStore.getState().success('User updated successfully!');
        router.push(`/admin/users/${userId}`);
      } else {
        setError(response.message || 'Failed to update user');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to update user.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <DetailPageSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Edit User</h1>
        <Link href={`/admin/users/${userId}`} className="btn btn-secondary">
          <Icon icon={faTimes} size="sm" className="mr-2" />
          Cancel
        </Link>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-sm p-4 text-sm text-red-600">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-sm p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input name="firstName" value={formData.firstName} onChange={(e) => setFormData((p) => ({ ...p, firstName: e.target.value }))} className="input" placeholder="First name" />
          <input name="lastName" value={formData.lastName} onChange={(e) => setFormData((p) => ({ ...p, lastName: e.target.value }))} className="input" placeholder="Last name" />
          <input name="email" type="email" value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} className="input" placeholder="Email" />
          <input name="phone" value={formData.phone} onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))} className="input" placeholder="Phone" />
          <div className="relative">
            <input name="password" type={showPassword ? 'text' : 'password'} value={formData.password} onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))} className="input pr-10" placeholder="New password (optional)" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-0 top-0 bottom-0 w-10 text-gray-500">
              <Icon icon={showPassword ? faTimes : faLock} size="sm" />
            </button>
          </div>
          <input name="confirmPassword" type={showPassword ? 'text' : 'password'} value={formData.confirmPassword} onChange={(e) => setFormData((p) => ({ ...p, confirmPassword: e.target.value }))} className="input" placeholder="Confirm password" />
          <select name="account_type" value={formData.account_type} onChange={(e) => setFormData((p) => ({ ...p, account_type: e.target.value }))} className="input">
            {ACCOUNT_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <select name="role" value={formData.role} onChange={(e) => setFormData((p) => ({ ...p, role: e.target.value }))} className="input">
            {ROLES.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <select name="status" value={formData.status} onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))} className="input">
            {STATUS_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>

        {permissionList.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Permissions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {permissionList.map((permission) => (
                <label key={permission.code} className="flex items-center p-3 border border-gray-200 rounded-sm hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.permissions?.[permission.code] || false}
                    onChange={() => setFormData((prev) => ({ ...prev, permissions: { ...prev.permissions, [permission.code]: !prev.permissions?.[permission.code] } }))}
                    className="mr-3 h-4 w-4"
                  />
                  <span className="text-sm">{permission.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <Link href={`/admin/users/${userId}`} className="btn btn-secondary" tabIndex={-1}>Cancel</Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <><Icon icon={faSpinner} size="sm" spin className="mr-2" />Saving...</> : <><Icon icon={faCheckCircle} size="sm" className="mr-2" />Update User</>}
          </button>
        </div>
      </form>
    </div>
  );
}

