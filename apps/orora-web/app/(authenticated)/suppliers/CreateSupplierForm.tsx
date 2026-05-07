'use client';

import { useEffect, useState } from 'react';
import { suppliersApi, CreateSupplierData } from '@/lib/api/suppliers';
import { employeesApi, type RoleOption } from '@/lib/api/employees';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import Icon, { faCheckCircle, faSpinner } from '@/app/components/Icon';

interface CreateSupplierFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function CreateSupplierForm({ onSuccess, onCancel }: CreateSupplierFormProps) {
  const currentAccount = useAuthStore((s) => s.currentAccount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [staffRoles, setStaffRoles] = useState<RoleOption[]>([]);
  const [staffRolesLoading, setStaffRolesLoading] = useState(false);
  const [staffRolesError, setStaffRolesError] = useState('');
  const [formData, setFormData] = useState<Omit<CreateSupplierData, 'first_name' | 'last_name'> & { firstName: string; lastName: string }>({
    firstName: '',
    lastName: '',
    phone: '',
    price_per_liter: 0,
    email: '',
    nid: '',
    address: '',
    add_as_cooperative_member: false,
    grant_mcc_staff_access: false,
    mcc_staff_role: '',
  });
  const [nidTouched, setNidTouched] = useState(false);

  useEffect(() => {
    if (!formData.grant_mcc_staff_access) return;
    const accountId = currentAccount?.account_id;
    if (!accountId) {
      setStaffRolesError('Select an account to load staff roles.');
      return;
    }
    let cancelled = false;
    setStaffRolesLoading(true);
    setStaffRolesError('');
    employeesApi
      .getRoles(accountId)
      .then((res) => {
        if (!cancelled && res.data?.roles?.length) setStaffRoles(res.data.roles);
        else if (!cancelled) setStaffRoles([]);
      })
      .catch(() => {
        if (!cancelled) setStaffRolesError('Could not load roles. You may lack permission or the API is unavailable.');
      })
      .finally(() => {
        if (!cancelled) setStaffRolesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [formData.grant_mcc_staff_access, currentAccount?.account_id]);

  const nidValue = formData.nid ?? '';
  const nidClean = nidValue.replace(/\D/g, '');
  const nidValid = nidClean.length === 16 && /^1[0-9]{15}$/.test(nidClean);
  const nidInvalid = nidTouched && nidValue.length > 0 && !nidValid;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'nid') {
      const digitsOnly = value.replace(/\D/g, '');
      setFormData(prev => ({ ...prev, [name]: digitsOnly }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: name === 'price_per_liter' ? parseFloat(value) || 0 : value,
      }));
    }
    setError('');
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
    if (!formData.phone.trim()) {
      setError('Phone number is required');
      return false;
    }
    if (!/^250[0-9]{9}$/.test(formData.phone.replace(/\D/g, ''))) {
      setError('Phone must be Rwandan format (250XXXXXXXXX)');
      return false;
    }
    if (!formData.price_per_liter || formData.price_per_liter <= 0) {
      setError('Price per liter must be greater than 0');
      return false;
    }
    if (!formData.nid || !formData.nid.trim()) {
      setError('National ID is required');
      return false;
    }
    if (!/^1[0-9]{15}$/.test(formData.nid)) {
      setError('National ID must be 16 digits and start with 1');
      return false;
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Invalid email format');
      return false;
    }
    if (formData.grant_mcc_staff_access) {
      if (!currentAccount?.account_id) {
        setError('Switch to your MCC account before granting staff access.');
        return false;
      }
      if (!formData.mcc_staff_role?.trim()) {
        setError('Choose a staff role when adding this supplier as MCC staff.');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateForm()) return;
    setLoading(true);
    try {
      const normalizedPhone = formData.phone.replace(/\D/g, '');
      const finalData: CreateSupplierData = {
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        phone: normalizedPhone,
        price_per_liter: formData.price_per_liter,
        email: formData.email || undefined,
        nid: formData.nid,
        address: formData.address || undefined,
        ...(formData.add_as_cooperative_member ? { add_as_cooperative_member: true } : {}),
        ...(formData.grant_mcc_staff_access && formData.mcc_staff_role?.trim()
          ? { grant_mcc_staff_access: true, mcc_staff_role: formData.mcc_staff_role.trim() }
          : {}),
      };
      const response = await suppliersApi.createSupplier(finalData);
      if (response.code === 200 || response.code === 201) {
        const aff = response.data?.mcc_affiliation;
        useToastStore.getState().success('Supplier created successfully!');
        if (aff?.mcc_staff === 'skipped_already_linked') {
          useToastStore.getState().info(
            'This user already had access on this MCC — a duplicate staff link was not created.',
          );
        }
        onSuccess();
      } else {
        setError(response.message || 'Failed to create supplier');
      }
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as { message?: string })?.message || 'Failed to create supplier.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-600">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="supplier-firstName" className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
          <input id="supplier-firstName" name="firstName" type="text" required value={formData.firstName} onChange={handleChange} className="input w-full" placeholder="First name" disabled={loading} />
        </div>
        <div>
          <label htmlFor="supplier-lastName" className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
          <input id="supplier-lastName" name="lastName" type="text" required value={formData.lastName} onChange={handleChange} className="input w-full" placeholder="Last name" disabled={loading} />
        </div>
        <div>
          <label htmlFor="supplier-phone" className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-red-500">*</span></label>
          <input id="supplier-phone" name="phone" type="tel" required value={formData.phone} onChange={handleChange} className="input w-full" placeholder="250788123456" disabled={loading} />
        </div>
        <div>
          <label htmlFor="supplier-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input id="supplier-email" name="email" type="email" value={formData.email} onChange={handleChange} className="input w-full" placeholder="email@example.com" disabled={loading} />
        </div>
        <div className="sm:col-span-2 space-y-2 rounded-lg border border-gray-200 bg-gray-50/80 p-4">
          <label className="flex items-center gap-3 cursor-pointer text-sm font-medium text-gray-800">
            <input
              type="checkbox"
              checked={!!formData.add_as_cooperative_member}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, add_as_cooperative_member: e.target.checked }));
                setError('');
              }}
              disabled={loading}
              className="rounded border-gray-300 shrink-0"
            />
            Cooperative member
          </label>
          <label className="flex items-center gap-3 cursor-pointer text-sm font-medium text-gray-800">
            <input
              type="checkbox"
              checked={!!formData.grant_mcc_staff_access}
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  grant_mcc_staff_access: e.target.checked,
                  mcc_staff_role: e.target.checked ? prev.mcc_staff_role : '',
                }));
                setError('');
              }}
              disabled={loading}
              className="rounded border-gray-300 shrink-0"
            />
            MCC staff access
          </label>
          {formData.grant_mcc_staff_access && (
            <div className="pt-1 sm:pl-8">
              <label htmlFor="supplier-staff-role" className="block text-sm font-medium text-gray-700 mb-1">
                Staff role <span className="text-red-500">*</span>
              </label>
              <select
                id="supplier-staff-role"
                value={formData.mcc_staff_role || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, mcc_staff_role: e.target.value }))}
                className="input w-full max-w-lg"
                disabled={loading || staffRolesLoading}
              >
                <option value="">{staffRolesLoading ? 'Loading roles…' : '— Select role —'}</option>
                {staffRoles.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </select>
              {staffRolesError && <p className="mt-1 text-sm text-amber-700">{staffRolesError}</p>}
            </div>
          )}
        </div>
        <div>
          <label htmlFor="supplier-price" className="block text-sm font-medium text-gray-700 mb-1">Price per liter (RWF) <span className="text-red-500">*</span></label>
          <input id="supplier-price" name="price_per_liter" type="number" step="0.01" min="0" required value={formData.price_per_liter} onChange={handleChange} className="input w-full" disabled={loading} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="supplier-nid" className="block text-sm font-medium text-gray-700 mb-1">National ID <span className="text-red-500">*</span></label>
          <input
            id="supplier-nid"
            name="nid"
            type="text"
            inputMode="numeric"
            value={formData.nid}
            onChange={handleChange}
            onBlur={() => setNidTouched(true)}
            className={`input w-full ${nidInvalid ? 'border-red-500 ring-1 ring-red-500' : ''}`}
            placeholder="National ID"
            maxLength={16}
            disabled={loading}
            required
            aria-invalid={nidInvalid}
            aria-describedby={nidInvalid ? 'supplier-nid-error' : undefined}
          />
          {nidInvalid && (
            <p id="supplier-nid-error" className="mt-1 text-sm text-red-600">
              National ID must be 16 digits and start with 1.
            </p>
          )}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="supplier-address" className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <input id="supplier-address" name="address" type="text" value={formData.address} onChange={handleChange} className="input w-full" placeholder="Optional" disabled={loading} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
        <button type="button" onClick={onCancel} className="btn btn-secondary">
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <><Icon icon={faSpinner} size="sm" spin className="mr-2" />Creating...</> : <><Icon icon={faCheckCircle} size="sm" className="mr-2" />Create Supplier</>}
        </button>
      </div>
    </form>
  );
}
