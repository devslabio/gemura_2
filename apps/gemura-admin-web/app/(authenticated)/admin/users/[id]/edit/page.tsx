'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { PermissionService } from '@/lib/services/permission.service';
import { fullNameFromParts, splitFullName } from '@/lib/utils/name';
import { adminApi, type RoleItem, type UpdateUserData } from '@/lib/api/admin';
import { selectPlatformRolesForAssignment } from '@/lib/utils/platform-roles-picker';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import Icon, { faLock, faCheckCircle, faTimes, faSpinner } from '@/app/components/Icon';
import { DetailPageSkeleton } from '@/app/components/SkeletonLoader';

const ACCOUNT_TYPES = ['mcc', 'agent', 'collector', 'veterinarian', 'supplier', 'customer', 'farmer', 'owner'];
const STATUS_OPTIONS = ['active', 'inactive'];

function slugKey(s: string) {
  return s.trim().toLowerCase();
}

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  const { currentAccount } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [catalogRoles, setCatalogRoles] = useState<RoleItem[]>([]);

  type FormShape = Omit<UpdateUserData, 'role'> & {
    confirmPassword: string;
    firstName: string;
    lastName: string;
    platform_role_id: string;
  };

  const [formData, setFormData] = useState<FormShape>({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    account_type: 'mcc',
    status: 'active',
    platform_role_id: '',
    firstName: '',
    lastName: '',
  });

  const selectableRoles = useMemo(
    () => selectPlatformRolesForAssignment(catalogRoles, formData.platform_role_id || null),
    [catalogRoles, formData.platform_role_id],
  );

  const loadUser = useCallback(async () => {
    const aid = currentAccount?.account_id;
    if (!aid) {
      setLoading(false);
      setError('No tenant account selected.');
      return;
    }
    try {
      setLoading(true);
      setError('');

      const [rolesRes, userRes] = await Promise.all([adminApi.getRoles(aid), adminApi.getUserById(userId, aid)]);
      let rolesList: RoleItem[] = [];
      if (rolesRes.code === 200 && rolesRes.data?.roles?.length) {
        rolesList = rolesRes.data.roles;
        setCatalogRoles(rolesList);
      } else setCatalogRoles([]);

      if (userRes.code === 200 && userRes.data) {
        const u = userRes.data;
        let pid = typeof u.platform_role_id === 'string' ? u.platform_role_id : '';
        if (!pid && rolesList.length && typeof u.role === 'string') {
          const slug = u.role.replace(/^owner$/i, 'system_admin');
          const hit = rolesList.find((r) => r.code === slug || r.code === slugKey(slug));
          pid = hit?.id ?? '';
        }
        const { firstName, lastName } = splitFullName(u.name || '');
        setFormData({
          name: u.name || '',
          email: u.email || '',
          phone: u.phone || '',
          password: '',
          confirmPassword: '',
          account_type: u.account_type || 'mcc',
          status: u.status || 'active',
          platform_role_id: pid,
          firstName,
          lastName,
        });
      } else {
        setError('Failed to load user data');
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        'Failed to load user.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [currentAccount?.account_id, userId]);

  useEffect(() => {
    if (!PermissionService.canManageUsers() && !PermissionService.isAdmin()) {
      router.push('/admin/users');
      return;
    }
    void loadUser();
  }, [router, loadUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.firstName?.trim() || !formData.lastName?.trim())
      return setError('First and last names are required');
    if (formData.password && formData.password !== formData.confirmPassword)
      return setError('Passwords do not match');
    if (!formData.platform_role_id) return setError('Select a platform role.');

    setSaving(true);
    try {
      const { firstName, lastName, confirmPassword: _cp, platform_role_id, ...rest } = formData;
      const updateData: UpdateUserData = {
        ...rest,
        name: fullNameFromParts(firstName, lastName),
        platform_role_id,
      };
      if (!updateData.password) delete updateData.password;

      const response = await adminApi.updateUser(userId, updateData, currentAccount?.account_id);
      if (response.code === 200) {
        useToastStore.getState().success('User updated successfully!');
        router.push(`/admin/users/${userId}`);
      } else {
        setError(response.message || 'Failed to update user');
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        'Failed to update user.';
      setError(msg);
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
            {ACCOUNT_TYPES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Platform role</label>
            <select value={formData.platform_role_id} onChange={(e) => setFormData((p) => ({ ...p, platform_role_id: e.target.value }))} className="input" required disabled={!selectableRoles.length}>
              <option value="">{catalogRoles.length ? 'Select role…' : 'Loading roles…'}</option>
              {selectableRoles.map((r) => (
                <option key={r.id} value={r.id!}>
                  {r.name} ({r.code})
                </option>
              ))}
            </select>
          </div>
          <select name="status" value={formData.status} onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))} className="input">
            {STATUS_OPTIONS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>

        <p className="text-sm text-gray-600">
          Permissions are defined on the{' '}
          <Link href="/admin/roles" className="text-[var(--primary)] font-medium hover:underline">
            Roles
          </Link>{' '}
          page and follow the selected platform role. Per-user permission checkboxes have been removed.
        </p>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <Link href={`/admin/users/${userId}`} className="btn btn-secondary" tabIndex={-1}>
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? (
              <>
                <Icon icon={faSpinner} size="sm" spin className="mr-2" />
                Saving…
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
