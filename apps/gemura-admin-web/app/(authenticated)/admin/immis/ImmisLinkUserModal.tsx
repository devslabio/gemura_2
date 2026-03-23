'use client';

import { useState, useEffect, useCallback } from 'react';
import Modal from '@/app/components/Modal';
import { adminApi } from '@/lib/api/admin';
import type { ImmisMember } from '@/lib/api/immis';
import { useToastStore } from '@/store/toast';

export default function ImmisLinkUserModal({
  open,
  onClose,
  member,
  accountId,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  member: ImmisMember | null;
  accountId: string | undefined;
  onSuccess: () => void;
}) {
  const showToast = useToastStore((s) => s.show);

  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<Array<{ id: string; name: string; phone: string; email: string }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!accountId || !open) return;
    setLoadingUsers(true);
    try {
      const res = await adminApi.getUsers(1, 50, search || undefined, accountId);
      if (res.code === 200 && res.data?.users) {
        setUsers(
          res.data.users.map((u) => ({
            id: u.id,
            name: u.name,
            phone: u.phone || '',
            email: u.email || '',
          })),
        );
      } else {
        setUsers([]);
      }
    } catch {
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, [accountId, open, search]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedId(null);
      setUsers([]);
      return;
    }
    const t = setTimeout(() => void loadUsers(), 300);
    return () => clearTimeout(t);
  }, [open, loadUsers]);

  const handleSubmit = async () => {
    if (!member || !accountId || !selectedId) return;
    setSubmitting(true);
    try {
      const res = await adminApi.linkUserImmis(selectedId, member.id, accountId);
      if (res.code === 200) {
        showToast('User linked to this IMMIS member.', 'success');
        onSuccess();
        onClose();
      } else {
        showToast((res as { message?: string }).message || 'Link failed', 'error');
      }
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (e as { message?: string })?.message ||
        'Link failed';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!member) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Link IMMIS member: ${member.representative_name}`} maxWidth="max-w-lg">
      <p className="text-sm text-gray-600 mb-3">Choose a Gemura user on this account. They must already belong to the account (e.g. via Team).</p>

      <label className="text-sm font-medium text-gray-700">Search users</label>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Name, phone, email…"
        className="input w-full mt-1 mb-3 text-sm"
      />

      <div className="border border-gray-200 rounded max-h-56 overflow-y-auto">
        {loadingUsers ? (
          <div className="p-4 text-sm text-gray-500 text-center">Loading…</div>
        ) : users.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 text-center">No users found. Try another search.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {users.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(u.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${selectedId === u.id ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-200' : ''}`}
                >
                  <div className="font-medium text-gray-900">{u.name}</div>
                  <div className="text-xs text-gray-500">
                    {u.phone}
                    {u.email ? ` · ${u.email}` : ''}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" disabled={!selectedId || submitting || !accountId} onClick={() => void handleSubmit()}>
          {submitting ? 'Linking…' : 'Link user'}
        </button>
      </div>
    </Modal>
  );
}

