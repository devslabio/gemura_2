'use client';

import { useCallback, useEffect, useState } from 'react';
import { mccOperationsApi, type MccShiftRow, type MccStaffOption } from '@/lib/api/mcc-operations';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import { useCrudPermissions } from '@/hooks/useCrudPermissions';
import { useClientPagination } from '@/hooks/useClientPagination';
import Modal from '@/app/components/Modal';
import Pagination from '@/app/components/Pagination';
import Icon, { faPlus } from '@/app/components/Icon';
import FilterBar, { FilterBarGroup, FilterBarActions, FilterBarApply, FilterBarExport } from '@/app/components/FilterBar';

const FILTER_INPUT =
  'input h-9 min-h-[2.25rem] !py-1.5 !px-3 text-sm w-full min-w-0 sm:max-w-[11rem] text-gray-900';

const INPUT_FULL =
  'input h-9 min-h-[2.25rem] !py-1.5 !px-3 text-sm w-full text-gray-900';

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function defaultShiftsFrom() {
  const x = new Date();
  x.setUTCDate(x.getUTCDate() - 7);
  return isoDate(x);
}

export default function OperationsShiftsPage() {
  const { currentAccount, user } = useAuthStore();
  const { mccShiftMutations: canManage } = useCrudPermissions();
  const toast = useToastStore();
  const accountId = currentAccount?.account_id ?? '';
  const role = (currentAccount?.role ?? '').toLowerCase();
  const canManageOthers = ['manager', 'system_admin', 'admin', 'owner'].includes(role);

  const [rows, setRows] = useState<MccShiftRow[]>([]);
  const [staff, setStaff] = useState<MccStaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [from, setFrom] = useState(defaultShiftsFrom);
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [shiftNotes, setShiftNotes] = useState('');

  const {
    page: shiftPage,
    setPage: setShiftPage,
    paginatedItems: paginatedShifts,
    totalPages: shiftTotalPages,
    totalItems: shiftTotalItems,
    startIndex: shiftStartIndex,
    pageSize: shiftPageSize,
  } = useClientPagination(rows, { resetKey: `${from}-${to}` });

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const [sh, st] = await Promise.all([
        mccOperationsApi.listShifts(accountId, from, to),
        mccOperationsApi.staffOptions(accountId),
      ]);
      setRows(sh.data ?? []);
      setStaff(st.data ?? []);
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [accountId, from, to, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (user?.id && !targetUserId) setTargetUserId(user.id);
  }, [user?.id, targetUserId]);

  const startShift = async () => {
    if (!accountId) return;
    setSaving(true);
    try {
      await mccOperationsApi.startShift({
        account_id: accountId,
        user_id: canManageOthers && targetUserId ? targetUserId : undefined,
        notes: shiftNotes.trim() || undefined,
      });
      toast.success('Shift started.');
      setModalOpen(false);
      setShiftNotes('');
      await load();
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not start shift');
    } finally {
      setSaving(false);
    }
  };

  const endShift = async (id: string) => {
    try {
      await mccOperationsApi.endShift(id, accountId);
      toast.success('Shift ended.');
      await load();
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not end shift');
    }
  };

  const handleClearFilters = () => {
    setFrom(defaultShiftsFrom());
    setTo(isoDate(new Date()));
  };

  return (
    <div className="space-y-4 w-full min-w-0">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Staff shifts</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
          {canManage && (
            <button type="button" onClick={() => setModalOpen(true)} className="btn btn-primary">
              <Icon icon={faPlus} size="sm" className="mr-2" />
              Start shift
            </button>
          )}
        </div>
      </div>

      <FilterBar>
        <FilterBarGroup label="Date From">
          <input
            type="date"
            value={from}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setFrom(e.target.value)}
            className={INPUT_FULL}
          />
        </FilterBarGroup>
        <FilterBarGroup label="Date To">
          <input
            type="date"
            value={to}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setTo(e.target.value)}
            className={INPUT_FULL}
          />
        </FilterBarGroup>
        <FilterBarActions onClear={handleClearFilters} />
        <FilterBarApply onApply={() => void load()} />
        <FilterBarExport<MccShiftRow>
          data={rows}
          exportFilename="mcc-shifts"
          exportColumns={[
            {
              key: 'user',
              label: 'Staff',
              getValue: (r) => r.user?.name || r.user?.phone || r.user_id,
            },
            { key: 'role_label_snapshot', label: 'Role snapshot', getValue: (r) => r.role_label_snapshot || '' },
            {
              key: 'started_at',
              label: 'Started',
              getValue: (r) => new Date(r.started_at).toLocaleString(),
            },
            {
              key: 'ended_at',
              label: 'Ended',
              getValue: (r) => (r.ended_at ? new Date(r.ended_at).toLocaleString() : ''),
            },
            { key: 'open', label: 'Open', getValue: (r) => (r.open ? 'Yes' : 'No') },
          ]}
          disabled={loading || !accountId || rows.length === 0}
        />
      </FilterBar>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="card-body">
            <p className="text-gray-500 text-sm">Loading…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="card-body">
            <p className="text-gray-500 text-sm">No shifts in this window.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600 bg-gray-50/80">
                  <th className="py-2.5 px-2 sm:px-4 font-medium w-10 text-right tabular-nums">#</th>
                  <th className="py-2.5 px-4 font-medium">Staff</th>
                  <th className="py-2.5 px-4 font-medium">Role snapshot</th>
                  <th className="py-2.5 px-4 font-medium">Started</th>
                  <th className="py-2.5 px-4 font-medium">Ended</th>
                  <th className="py-2.5 px-4 font-medium w-[1%] whitespace-nowrap"> </th>
                </tr>
              </thead>
              <tbody>
                {paginatedShifts.map((r, i) => (
                  <tr key={r.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2.5 px-2 sm:px-4 text-right tabular-nums text-gray-500">{shiftStartIndex + i + 1}</td>
                    <td className="py-2.5 px-4 text-gray-900">{r.user?.name || r.user?.phone || r.user_id}</td>
                    <td className="py-2.5 px-4 text-gray-700">{r.role_label_snapshot || '—'}</td>
                    <td className="py-2.5 px-4 whitespace-nowrap text-gray-900">{new Date(r.started_at).toLocaleString()}</td>
                    <td className="py-2.5 px-4 whitespace-nowrap text-gray-700">
                      {r.ended_at ? new Date(r.ended_at).toLocaleString() : '—'}
                    </td>
                    <td className="py-2.5 px-4">
                      {r.open && canManage && (
                        <button type="button" onClick={() => endShift(r.id)} className="btn btn-secondary btn-sm">
                          End shift
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && rows.length > 0 && (
        <Pagination
          currentPage={shiftPage}
          totalPages={shiftTotalPages}
          totalItems={shiftTotalItems}
          pageSize={shiftPageSize}
          itemLabel="shifts"
          onPageChange={setShiftPage}
        />
      )}

      <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title="Start shift" maxWidth="max-w-md">
        <div className="space-y-4">
          {canManageOthers && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className={`${FILTER_INPUT} max-w-none w-full`}
              >
                {staff.map((s) => (
                  <option key={s.user_id} value={s.user_id}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={shiftNotes}
              onChange={(e) => setShiftNotes(e.target.value)}
              rows={2}
              className="input w-full min-h-[4rem] py-2 px-3 text-sm text-gray-900"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button type="button" disabled={saving} onClick={() => setModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="button" disabled={saving} onClick={startShift} className="btn btn-primary">
              {saving ? 'Saving…' : 'Start'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
