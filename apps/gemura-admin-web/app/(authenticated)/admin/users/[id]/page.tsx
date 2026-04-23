'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { PermissionService } from '@/lib/services/permission.service';
import { adminApi } from '@/lib/api/admin';
import { useAuthStore } from '@/store/auth';
import Icon, { faUser, faEnvelope, faPhone, faBuilding, faUserShield, faEdit, faTrash, faArrowLeft, faCalendar } from '@/app/components/Icon';
import { useToastStore } from '@/store/toast';
import { DetailPageSkeleton } from '@/app/components/SkeletonLoader';

export default function UserDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  const { currentAccount } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (!PermissionService.canManageUsers() && !PermissionService.isAdmin()) {
      router.push('/admin/users');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    adminApi
      .getUserById(userId, currentAccount?.account_id)
      .then((response) => {
        if (!cancelled) {
          if (response.code === 200 && response.data) setUser(response.data);
          else setError('Failed to load user data');
        }
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.response?.data?.message || err?.message || 'Failed to load user.');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [router, userId, currentAccount?.account_id]);

  const handleDelete = async () => {
    if (!user) return;
    if (!confirm(`Are you sure you want to delete "${user.name}"?`)) return;
    try {
      await adminApi.deleteUser(userId, currentAccount?.account_id);
      useToastStore.getState().success('User deleted successfully.');
      router.push('/admin/users');
    } catch (err: any) {
      useToastStore.getState().error(err?.response?.data?.message || 'Failed to delete user.');
    }
  };

  const getPermissions = () => {
    if (!user?.permissions) return [];
    let permissions = user.permissions;
    if (typeof permissions === 'string') {
      try {
        permissions = JSON.parse(permissions);
      } catch {
        return [];
      }
    }
    if (Array.isArray(permissions)) return permissions;
    if (typeof permissions === 'object') return Object.keys(permissions).filter((key) => permissions[key] === true);
    return [];
  };

  if (loading) return <DetailPageSkeleton />;

  if (error && !user) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  const permissions = getPermissions();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/users" className="text-sm text-gray-600 hover:text-[var(--primary)] mb-2 inline-flex items-center">
            <Icon icon={faArrowLeft} size="sm" className="mr-2" />
            Back to Users
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{user?.name || 'User Details'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/users/${userId}/edit`} className="btn btn-primary">
            <Icon icon={faEdit} size="sm" className="mr-2" />
            Edit User
          </Link>
          <button type="button" onClick={handleDelete} className="btn border border-red-300 text-red-700 bg-white hover:bg-red-50">
            <Icon icon={faTrash} size="sm" className="mr-2" />
            Delete
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-sm p-4 text-sm text-red-600">{error}</div>}

      {user && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-500 mb-1">Full Name</label><div className="flex items-center"><Icon icon={faUser} size="sm" className="mr-2 text-gray-400" />{user.name || 'N/A'}</div></div>
                <div><label className="block text-sm text-gray-500 mb-1">Email</label><div className="flex items-center"><Icon icon={faEnvelope} size="sm" className="mr-2 text-gray-400" />{user.email || 'N/A'}</div></div>
                <div><label className="block text-sm text-gray-500 mb-1">Phone</label><div className="flex items-center"><Icon icon={faPhone} size="sm" className="mr-2 text-gray-400" />{user.phone || 'N/A'}</div></div>
                <div><label className="block text-sm text-gray-500 mb-1">Status</label><span className={`inline-flex px-2 py-1 text-xs rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{user.status || 'N/A'}</span></div>
              </div>
            </div>

            {user.mcc_onboarding && (
              <div className="bg-white border border-gray-200 rounded-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">MCC onboarding (linked)</h2>
                <p className="text-sm text-gray-600 mb-3">
                  Data from the public onboarding wizard for this user&apos;s approved submission.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Business</span>
                    <div className="font-medium">{user.mcc_onboarding.business_name}</div>
                    {user.mcc_onboarding.common_name && (
                      <div className="text-gray-600 text-xs">{user.mcc_onboarding.common_name}</div>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-500">Submission</span>
                    <div className="font-mono text-xs">{user.mcc_onboarding.submission_code}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Manager</span>
                    <div>
                      {user.mcc_onboarding.manager_first_name} {user.mcc_onboarding.manager_last_name}
                    </div>
                    <div className="font-mono text-xs">{user.mcc_onboarding.manager_phone}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Review / wizard</span>
                    <div>
                      {user.mcc_onboarding.review_status} · {user.mcc_onboarding.final_decision} (
                      {user.mcc_onboarding.pass_count})
                    </div>
                  </div>
                </div>
                <Link
                  href={`/admin/onboarding/${user.mcc_onboarding.id}`}
                  className="inline-block mt-4 text-sm text-primary font-medium hover:underline"
                >
                  Open full submission
                </Link>
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Settings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-500 mb-1">Account Type</label><div className="flex items-center"><Icon icon={faBuilding} size="sm" className="mr-2 text-gray-400" />{user.account_type || 'N/A'}</div></div>
                <div><label className="block text-sm text-gray-500 mb-1">Role</label><div className="flex items-center"><Icon icon={faUserShield} size="sm" className="mr-2 text-gray-400" />{user.role || 'N/A'}</div></div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Permissions</h2>
              {permissions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {permissions.map((permission: string) => (
                    <span key={permission} className="inline-flex px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                      {permission.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No specific permissions assigned</p>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Meta</h2>
            <div className="space-y-3">
              <div><label className="block text-sm text-gray-500 mb-1">User ID</label><p className="text-sm font-mono">{user.id}</p></div>
              <div><label className="block text-sm text-gray-500 mb-1">Created At</label><div className="flex items-center text-sm"><Icon icon={faCalendar} size="sm" className="mr-2 text-gray-400" />{user.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}</div></div>
              {user.last_login && <div><label className="block text-sm text-gray-500 mb-1">Last Login</label><div className="flex items-center text-sm"><Icon icon={faCalendar} size="sm" className="mr-2 text-gray-400" />{new Date(user.last_login).toLocaleString()}</div></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

