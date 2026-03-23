'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { usePermission } from '@/hooks/usePermission';
import { adminApi } from '@/lib/api/admin';
import { immisApi, type ImmisMember } from '@/lib/api/immis';
import DataTableWithPagination from '@/app/components/DataTableWithPagination';
import FilterBar, { FilterBarActions, FilterBarExport, FilterBarGroup, FilterBarSearch } from '@/app/components/FilterBar';
import type { TableColumn } from '@/app/components/DataTable';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';
import Icon, { faArrowsRotate, faIdCard, faPhone, faEnvelope, faEye } from '@/app/components/Icon';
import ImmisMemberDetailModal from './ImmisMemberDetailModal';
import ImmisLinkUserModal from './ImmisLinkUserModal';
import ConfirmDialog from '@/app/components/ConfirmDialog';
import { useToastStore } from '@/store/toast';

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'COMPANY', label: 'Company' },
];

export default function ImmisPage() {
  const showToast = useToastStore((s) => s.show);
  const router = useRouter();
  const { canManageUsers, isAdmin, currentAccount } = usePermission();

  useEffect(() => {
    if (!canManageUsers() && !isAdmin()) router.push('/dashboard');
  }, [router, currentAccount?.account_id]);

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<ImmisMember[]>([]);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailMember, setDetailMember] = useState<ImmisMember | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [linkMap, setLinkMap] = useState<Record<number, { user_id: string; name: string; phone: string | null }>>({});

  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkModalMember, setLinkModalMember] = useState<ImmisMember | null>(null);

  const [unlinkConfirm, setUnlinkConfirm] = useState<{ memberId: number; userName: string } | null>(null);
  const [unlinkLoading, setUnlinkLoading] = useState(false);

  const fetchLinks = useCallback(async (list: ImmisMember[]) => {
    if (!list.length) {
      setLinkMap({});
      return;
    }
    try {
      const res = await immisApi.getMemberLinks(list.map((m) => m.id));
      if (res.status === 200 && res.data) {
        const norm: Record<number, { user_id: string; name: string; phone: string | null }> = {};
        for (const [k, v] of Object.entries(res.data)) {
          norm[Number(k)] = v;
        }
        setLinkMap(norm);
      }
    } catch {
      setLinkMap({});
    }
  }, []);

  const openMemberDetail = useCallback(async (row: ImmisMember) => {
    setDetailMember(row);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await immisApi.getMember(String(row.id));
      if (res.status === 200 && res.data) setDetailMember(res.data);
    } catch {
      // keep list row data
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadMembers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await immisApi.listMembers({ page: 0, limit: 100 });
      if (res.status === 200 && res.data) {
        const rows = res.data.members?.rows ?? [];
        setMembers(rows);
        void fetchLinks(rows);
      } else {
        setError(res.message || 'Failed to load IMMIS members');
        setMembers([]);
        setLinkMap({});
      }
    } catch (e: unknown) {
      const message =
        (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ??
        (e as { message?: string })?.message ??
        'Failed to load IMMIS members';
      setError(message);
      setMembers([]);
      setLinkMap({});
    } finally {
      setLoading(false);
    }
  }, [fetchLinks]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const openUnlinkConfirm = useCallback(
    (memberId: number) => {
      const link = linkMap[memberId];
      if (link) setUnlinkConfirm({ memberId, userName: link.name });
    },
    [linkMap],
  );

  const handleUnlinkImmis = useCallback(
    async (memberId: number) => {
      const link = linkMap[memberId];
      if (!link || !currentAccount?.account_id) return;
      setUnlinkLoading(true);
      try {
        const res = await adminApi.linkUserImmis(link.user_id, null, currentAccount.account_id);
        if (res.code === 200) {
          showToast('Link removed.', 'success');
          setUnlinkConfirm(null);
          void fetchLinks(members);
        } else {
          showToast((res as { message?: string }).message || 'Failed to unlink', 'error');
        }
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ??
          (e as { message?: string })?.message ??
          'Failed to unlink';
        showToast(msg, 'error');
      } finally {
        setUnlinkLoading(false);
      }
    },
    [linkMap, currentAccount?.account_id, members, fetchLinks, showToast],
  );

  const handleUnlinkConfirm = useCallback(() => {
    if (unlinkConfirm) void handleUnlinkImmis(unlinkConfirm.memberId);
  }, [unlinkConfirm, handleUnlinkImmis]);

  const filteredMembers = useMemo(() => {
    let list = members;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (m) =>
          String(m.id).includes(q) ||
          (m.representative_name && m.representative_name.toLowerCase().includes(q)) ||
          (m.document_number && m.document_number.toLowerCase().includes(q)) ||
          (m.rca_number && m.rca_number.toLowerCase().includes(q)) ||
          (m.phone && m.phone.includes(q)) ||
          (m.email && m.email.toLowerCase().includes(q)) ||
          (m.cluster && m.cluster.toLowerCase().includes(q)) ||
          (linkMap[m.id]?.name && linkMap[m.id]!.name.toLowerCase().includes(q)),
      );
    }
    if (typeFilter) list = list.filter((m) => m.type === typeFilter);
    return list;
  }, [members, search, typeFilter, linkMap]);

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('');
  };

  const canLink = canManageUsers() && !!currentAccount?.account_id;

  const columns: TableColumn<ImmisMember>[] = useMemo(
    () => [
      {
        key: 'representative_name',
        label: 'Name',
        sortable: true,
        render: (value, row) => (
          <div>
            <div className="font-medium text-gray-900">{value}</div>
            <div className="text-xs text-gray-500">{row.representative_title}</div>
          </div>
        ),
      },
      {
        key: 'type',
        label: 'Type',
        sortable: true,
        render: (value) => (
          <span className={`px-2 py-1 rounded text-xs font-medium ${value === 'INDIVIDUAL' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
            {value}
          </span>
        ),
      },
      {
        key: 'document_number',
        label: 'Document',
        sortable: true,
        render: (value, row) => (
          <div className="flex items-start">
            <Icon icon={faIdCard} size="sm" className="mr-2 text-gray-400 mt-0.5" />
            <div>
              <div className="text-xs text-gray-500">{row.document_type}</div>
              <div className="font-mono text-xs text-gray-900">{value}</div>
            </div>
          </div>
        ),
      },
      {
        key: 'rca_number',
        label: 'RCA #',
        sortable: true,
        render: (value) => <span className="font-mono text-xs text-gray-900">{value}</span>,
      },
      {
        key: 'cluster',
        label: 'Cluster',
        sortable: true,
        render: (value) => <span className="text-sm text-gray-700">{value}</span>,
      },
      {
        key: 'phone',
        label: 'Contact',
        sortable: true,
        render: (value, row) => (
          <div className="space-y-1">
            {value && (
              <div className="flex items-center text-gray-900 text-sm">
                <Icon icon={faPhone} size="sm" className="mr-2 text-gray-400" />
                <span>{value}</span>
              </div>
            )}
            {row.email && (
              <div className="flex items-center text-gray-600 text-xs">
                <Icon icon={faEnvelope} size="sm" className="mr-2 text-gray-400" />
                <span>{row.email}</span>
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'organization',
        label: 'Organization',
        sortable: true,
        render: (value) => <span className="text-sm text-gray-700">{value ? (value.abbreviation || value.name) : '—'}</span>,
      },
      {
        key: 'location',
        label: 'Location',
        sortable: true,
        render: (value) => (
          <div className="text-xs text-gray-700">
            {value ? (
              <>
                <div className="font-medium">{value.name}</div>
                <div className="text-gray-500">{value.type}</div>
              </>
            ) : (
              '—'
            )}
          </div>
        ),
      },
      {
        key: 'gemura_user',
        label: 'Gemura user',
        sortable: false,
        render: (_value, row) => {
          const link = linkMap[row.id];
          return <span className="text-sm text-gray-900">{link ? link.name : '—'}</span>;
        },
      },
      {
        key: 'actions',
        label: '',
        render: (_value, row) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void openMemberDetail(row);
            }}
            className="p-1.5 text-gray-600 hover:text-[var(--primary)] transition-colors inline-flex"
            title="View full details"
          >
            <Icon icon={faEye} size="sm" />
          </button>
        ),
      },
    ],
    [linkMap, openMemberDetail],
  );

  if (loading && members.length === 0) {
    return <ListPageSkeleton title="IMMIS Members" filterFields={2} tableRows={10} tableCols={9} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">IMMIS Members</h1>
          <p className="mt-1 text-sm text-gray-600 max-w-2xl">
            View member records from IMMIS. Link or unlink Gemura users from the member details modal (admins).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void loadMembers()} className="btn btn-secondary inline-flex items-center gap-2" disabled={loading}>
            <Icon icon={faArrowsRotate} spin={loading} size="sm" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <FilterBar>
        <FilterBarSearch value={search} onChange={setSearch} placeholder="Search by member id, name, document, RCA, phone, Gemura user…" />
        <FilterBarGroup label="Type">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input h-9 min-h-[2.25rem] !py-1.5 !px-3 text-sm w-full text-gray-900">
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FilterBarGroup>
        <FilterBarActions onClear={clearFilters} />
        <FilterBarExport<ImmisMember>
          data={filteredMembers}
          exportFilename="immis-members"
          exportColumns={[
            { key: 'id', label: 'Member ID' },
            { key: 'representative_name', label: 'Name' },
            { key: 'type', label: 'Type' },
            { key: 'document_type', label: 'Document Type' },
            { key: 'document_number', label: 'Document Number' },
            { key: 'rca_number', label: 'RCA Number' },
            { key: 'cluster', label: 'Cluster' },
            { key: 'phone', label: 'Phone' },
            { key: 'email', label: 'Email' },
            {
              key: 'gemura',
              label: 'Linked Gemura user',
              getValue: (r) => linkMap[r.id]?.name ?? '',
            },
            {
              key: 'organization',
              label: 'Organization',
              getValue: (r) => (r.organization ? r.organization.abbreviation || r.organization.name : ''),
            },
            {
              key: 'location',
              label: 'Location',
              getValue: (r) => (r.location ? `${r.location.name} (${r.location.type})` : ''),
            },
          ]}
          disabled={loading}
        />
      </FilterBar>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <ImmisMemberDetailModal
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailMember(null);
        }}
        member={detailMember}
        loading={detailLoading}
        linkedUser={detailMember ? linkMap[detailMember.id] : null}
        canLink={canLink}
        onLinkUser={() => {
          if (detailMember) {
            setLinkModalMember(detailMember);
            setLinkModalOpen(true);
          }
        }}
        onUnlink={() => {
          if (detailMember) openUnlinkConfirm(detailMember.id);
        }}
      />

      <ImmisLinkUserModal
        open={linkModalOpen}
        onClose={() => {
          setLinkModalOpen(false);
          setLinkModalMember(null);
        }}
        member={linkModalMember}
        accountId={currentAccount?.account_id}
        onSuccess={() => void fetchLinks(members)}
      />

      <ConfirmDialog
        open={!!unlinkConfirm}
        onClose={() => setUnlinkConfirm(null)}
        onConfirm={handleUnlinkConfirm}
        title="Remove IMMIS link"
        message={
          unlinkConfirm
            ? `${unlinkConfirm.userName} will be unlinked from this IMMIS member. An admin can link them again from the member details.`
            : ''
        }
        confirmText="Unlink"
        cancelText="Cancel"
        type="warning"
        loading={unlinkLoading}
      />

      <DataTableWithPagination<ImmisMember>
        data={filteredMembers}
        columns={columns}
        loading={loading}
        emptyMessage={filteredMembers.length === 0 && members.length > 0 ? 'No members match the filters' : 'No IMMIS members available'}
        itemLabel="members"
        showRowNumbers
        onRowClick={(row) => void openMemberDetail(row)}
      />
    </div>
  );
}

