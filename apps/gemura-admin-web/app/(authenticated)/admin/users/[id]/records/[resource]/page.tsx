'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { PermissionService } from '@/lib/services/permission.service';
import { adminApi, UserBusinessResource } from '@/lib/api/admin';
import { useAuthStore } from '@/store/auth';
import DataTableWithPagination from '@/app/components/DataTableWithPagination';
import type { TableColumn } from '@/app/components/DataTable';
import FilterBar, { FilterBarGroup, FilterBarActions, FilterBarApply, FilterBarExport } from '@/app/components/FilterBar';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';
import Icon, { faArrowLeft } from '@/app/components/Icon';

const RESOURCE_LABELS: Record<UserBusinessResource, string> = {
  collections: 'Collections',
  sales: 'Sales',
  suppliers: 'Suppliers',
  customers: 'Customers',
  farms: 'Farms',
  accounts: 'Accounts',
};

function isUserBusinessResource(s: string): s is UserBusinessResource {
  return (
    s === 'collections' ||
    s === 'sales' ||
    s === 'suppliers' ||
    s === 'customers' ||
    s === 'farms' ||
    s === 'accounts'
  );
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency: 'RWF',
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatCollectionShift(shift?: 'morning' | 'evening') {
  if (shift === 'evening') return 'Evening';
  return 'Morning';
}

function uaAccountId(row: any): string | undefined {
  return row?.account_id ?? row?.account?.id;
}

export default function UserBusinessRecordsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = params.id as string;
  const resourceParam = params.resource as string;
  const { currentAccount } = useAuthStore();

  const resource = isUserBusinessResource(resourceParam) ? resourceParam : null;

  const [targetUser, setTargetUser] = useState<any>(null);
  const [loadUserError, setLoadUserError] = useState('');
  const [operationalAccountId, setOperationalAccountId] = useState<string | null>(() => searchParams.get('operational_account_id'));
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    date_from: searchParams.get('date_from') || '',
    date_to: searchParams.get('date_to') || '',
    supplier_name: searchParams.get('supplier_name') || '',
    customer_account_code: searchParams.get('customer_account_code') || '',
  });

  const userAccountRows = useMemo(() => {
    const raw = targetUser?.user_accounts;
    if (!Array.isArray(raw)) return [];
    return raw.filter((r: any) => r?.status === 'active');
  }, [targetUser]);

  const allowedAccountIdsMemo = useMemo(
    () =>
      new Set(
        userAccountRows.map((r: any) => uaAccountId(r)).filter(Boolean) as string[],
      ),
    [userAccountRows],
  );

  useEffect(() => {
    if (!PermissionService.canManageUsers() && !PermissionService.isAdmin()) {
      router.push('/admin/users');
    }
  }, [router]);

  useEffect(() => {
    if (!userId || !resource) return;
    let cancelled = false;
    setLoadUserError('');
    adminApi
      .getUserById(userId, currentAccount?.account_id)
      .then((response) => {
        if (cancelled) return;
        if (response.code === 200 && response.data) {
          setTargetUser(response.data);
        } else {
          setLoadUserError('Failed to load user');
        }
      })
      .catch((err: any) => {
        if (!cancelled) setLoadUserError(err?.response?.data?.message || err?.message || 'Failed to load user');
      });
    return () => {
      cancelled = true;
    };
  }, [userId, resource, currentAccount?.account_id]);

  const opFromUrl = searchParams.get('operational_account_id');

  useEffect(() => {
    if (!targetUser || resource === 'accounts') return;
    const ids = userAccountRows.map((r: any) => uaAccountId(r)).filter(Boolean) as string[];
    const pick =
      opFromUrl && allowedAccountIdsMemo.has(opFromUrl) ? opFromUrl : ids[0] ?? null;
    if (pick) {
      setOperationalAccountId((prev) => (prev === pick ? prev : pick));
    }
  }, [targetUser, resource, userAccountRows, allowedAccountIdsMemo, opFromUrl]);

  const loadRecords = useCallback(async () => {
    if (!userId || !resource) return;
    if (resource !== 'accounts' && !operationalAccountId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setListError('');
    try {
      const res = await adminApi.getUserBusinessRecords(userId, resource, {
        accountId: currentAccount?.account_id,
        operationalAccountId: resource === 'accounts' ? undefined : operationalAccountId || undefined,
        status: filters.status || undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        supplier_name: filters.supplier_name || undefined,
        customer_account_code: filters.customer_account_code || undefined,
      });
      if (res.code === 200 && Array.isArray(res.data)) setRows(res.data);
      else setListError(res.message || 'Failed to load records');
    } catch (err: any) {
      setRows([]);
      setListError(err?.response?.data?.message || err?.message || 'Failed to load records');
    } finally {
      setLoading(false);
    }
  }, [
    userId,
    resource,
    operationalAccountId,
    currentAccount?.account_id,
    filters.status,
    filters.date_from,
    filters.date_to,
    filters.supplier_name,
    filters.customer_account_code,
  ]);

  useEffect(() => {
    if (!resource) return;
    if (resource === 'accounts' || operationalAccountId) {
      void loadRecords();
    }
  }, [resource, operationalAccountId, loadRecords]);

  const setOperationalAndUrl = (id: string) => {
    setOperationalAccountId(id);
    const q = new URLSearchParams(searchParams.toString());
    q.set('operational_account_id', id);
    router.replace(`/admin/users/${userId}/records/${resource}?${q.toString()}`);
  };

  const handleApplyFilters = () => {
    void loadRecords();
  };

  const handleClearFilters = () => {
    setFilters({ status: '', date_from: '', date_to: '', supplier_name: '', customer_account_code: '' });
  };

  const columns: TableColumn<any>[] = useMemo(() => {
    if (!resource) return [];
    switch (resource) {
      case 'collections':
        return [
          {
            key: 'collection_at',
            label: 'Date',
            render: (_, row) => (row.collection_at ? new Date(row.collection_at).toLocaleString() : '—'),
          },
          {
            key: 'supplier_account',
            label: 'Supplier',
            render: (_, row) => row.supplier_account?.name ?? '—',
          },
          {
            key: 'collection_shift',
            label: 'Shift',
            render: (_, row) => formatCollectionShift(row.collection_shift),
          },
          {
            key: 'quantity',
            label: 'Qty (L)',
            render: (_, row) => `${Number(row.quantity).toFixed(2)}`,
          },
          {
            key: 'unit_price',
            label: 'Unit price',
            render: (_, row) => formatCurrency(Number(row.unit_price)),
          },
          {
            key: 'total_amount',
            label: 'Total',
            render: (_, row) => formatCurrency(Number(row.total_amount)),
          },
          {
            key: 'payment_status',
            label: 'Payment',
            render: (_, row) => (row.payment_status ? String(row.payment_status) : '—'),
          },
          {
            key: 'status',
            label: 'Status',
            render: (_, row) => String(row.status ?? '—'),
          },
          {
            key: 'recorded_by',
            label: 'Recorded by',
            render: (_, row) => row.recorded_by?.name ?? '—',
          },
        ];
      case 'sales':
        return [
          {
            key: 'sale_at',
            label: 'Date',
            render: (_, row) => (row.sale_at ? new Date(row.sale_at).toLocaleString() : '—'),
          },
          {
            key: 'customer_account',
            label: 'Customer',
            render: (_, row) => row.customer_account?.name ?? '—',
          },
          {
            key: 'quantity',
            label: 'Qty (L)',
            render: (_, row) => `${Number(row.quantity).toFixed(2)}`,
          },
          {
            key: 'unit_price',
            label: 'Unit price',
            render: (_, row) => formatCurrency(Number(row.unit_price)),
          },
          {
            key: 'total_amount',
            label: 'Total',
            render: (_, row) => formatCurrency(Number(row.total_amount)),
          },
          {
            key: 'animal',
            label: 'Animal',
            render: (_, row) => row.animal?.tag_number || row.animal?.name || '—',
          },
          { key: 'status', label: 'Status', render: (_, row) => String(row.status ?? '—') },
        ];
      case 'suppliers':
        return [
          { key: 'name', label: 'Name', render: (_, row) => row.name ?? '—' },
          { key: 'phone', label: 'Phone', render: (_, row) => row.phone ?? '—' },
          { key: 'account', label: 'Account', render: (_, row) => row.account?.code ?? '—' },
          {
            key: 'price_per_liter',
            label: 'Price / L',
            render: (_, row) => formatCurrency(Number(row.price_per_liter)),
          },
          {
            key: 'average_supply_quantity',
            label: 'Avg supply (L)',
            render: (_, row) => String(row.average_supply_quantity ?? '—'),
          },
          { key: 'relationship_status', label: 'Status', render: (_, row) => String(row.relationship_status ?? '—') },
        ];
      case 'customers':
        return [
          { key: 'name', label: 'Name', render: (_, row) => row.name ?? '—' },
          { key: 'phone', label: 'Phone', render: (_, row) => row.phone ?? '—' },
          { key: 'account', label: 'Account', render: (_, row) => row.account?.code ?? '—' },
          {
            key: 'price_per_liter',
            label: 'Price / L',
            render: (_, row) => formatCurrency(Number(row.price_per_liter)),
          },
          {
            key: 'average_supply_quantity',
            label: 'Avg (L)',
            render: (_, row) => String(row.average_supply_quantity ?? '—'),
          },
          { key: 'relationship_status', label: 'Status', render: (_, row) => String(row.relationship_status ?? '—') },
        ];
      case 'farms':
        return [
          { key: 'name', label: 'Name', render: (_, row) => row.name ?? '—' },
          { key: 'code', label: 'Code', render: (_, row) => row.code ?? '—' },
          { key: 'location', label: 'Location', render: (_, row) => row.location ?? '—' },
          { key: 'status', label: 'Status', render: (_, row) => String(row.status ?? '—') },
          {
            key: 'description',
            label: 'Description',
            render: (_, row) => (row.description ? String(row.description).slice(0, 80) : '—'),
          },
        ];
      case 'accounts':
        return [
          { key: 'code', label: 'Code', render: (_, row) => row.code ?? '—' },
          { key: 'name', label: 'Name', render: (_, row) => row.name ?? '—' },
          { key: 'account_type', label: 'Type', render: (_, row) => row.account_type ?? '—' },
          { key: 'role', label: 'Role', render: (_, row) => row.role ?? '—' },
          { key: 'relationship_status', label: 'Access', render: (_, row) => String(row.relationship_status ?? '—') },
          { key: 'status', label: 'Account status', render: (_, row) => String(row.status ?? '—') },
        ];
      default:
        return [];
    }
  }, [resource]);

  if (!PermissionService.canManageUsers() && !PermissionService.isAdmin()) {
    return null;
  }

  if (!resource) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600">Unknown record type.</p>
        <Link href={`/admin/users/${userId}`} className="text-sm text-[var(--primary)]">
          Back to user
        </Link>
      </div>
    );
  }

  if (loadUserError && !targetUser) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-sm p-4 text-sm text-red-600">{loadUserError}</div>
        <Link href="/admin/users" className="text-sm text-[var(--primary)]">
          Back to users
        </Link>
      </div>
    );
  }

  if (!targetUser) {
    return <ListPageSkeleton title={RESOURCE_LABELS[resource]} filterFields={3} tableRows={8} tableCols={6} />;
  }

  const showDateFilters = resource === 'collections' || resource === 'sales';
  const showStatusFilter = resource === 'collections' || resource === 'sales';
  const showSupplierName = resource === 'collections';
  const showCustomerCode = resource === 'sales';

  const title = RESOURCE_LABELS[resource];
  const exportName = `${resource}-${userId.slice(0, 8)}`;

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/admin/users/${userId}`}
          className="text-sm text-gray-600 hover:text-[var(--primary)] mb-2 inline-flex items-center"
        >
          <Icon icon={faArrowLeft} size="sm" className="mr-2" />
          Back to {targetUser.name || 'user'}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-600 mt-1">
          Full admin view aligned with app.gemura.rw list data
          {resource !== 'accounts' && operationalAccountId ? (
            <>
              {' '}
              for account{' '}
              <span className="font-mono text-xs">
                {userAccountRows.find((r: any) => uaAccountId(r) === operationalAccountId)?.account?.code ||
                  operationalAccountId}
              </span>
            </>
          ) : null}
        </p>
      </div>

      {resource !== 'accounts' && (
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Operational account (user must belong)</label>
          <select
            className="input text-sm max-w-xl text-gray-900"
            value={operationalAccountId ?? ''}
            onChange={(e) => setOperationalAndUrl(e.target.value)}
          >
            {userAccountRows.length === 0 ? (
              <option value="">No linked accounts</option>
            ) : (
              userAccountRows.map((row: any) => {
                const id = uaAccountId(row);
                if (!id) return null;
                const label = row.account?.name
                  ? `${row.account.name} (${row.account.code ?? id.slice(0, 8)}…)${row.role ? ` · ${row.role}` : ''}`
                  : id;
                return (
                  <option key={id} value={id}>
                    {label}
                  </option>
                );
              })
            )}
          </select>
        </div>
      )}

      <FilterBar>
        {showStatusFilter && (
          <FilterBarGroup label="Status">
            <select
              className="input h-9 text-sm text-gray-900"
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </FilterBarGroup>
        )}
        {showDateFilters && (
          <>
            <FilterBarGroup label="Date from">
              <input
                type="date"
                className="input h-9 text-sm text-gray-900"
                value={filters.date_from}
                onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
              />
            </FilterBarGroup>
            <FilterBarGroup label="Date to">
              <input
                type="date"
                className="input h-9 text-sm text-gray-900"
                value={filters.date_to}
                onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
              />
            </FilterBarGroup>
          </>
        )}
        {showSupplierName && (
          <FilterBarGroup label="Supplier name">
            <input
              type="text"
              className="input h-9 text-sm text-gray-900"
              placeholder="Search supplier…"
              value={filters.supplier_name}
              onChange={(e) => setFilters((f) => ({ ...f, supplier_name: e.target.value }))}
            />
          </FilterBarGroup>
        )}
        {showCustomerCode && (
          <FilterBarGroup label="Customer code">
            <input
              type="text"
              className="input h-9 text-sm text-gray-900"
              placeholder="A_XYZ789"
              value={filters.customer_account_code}
              onChange={(e) => setFilters((f) => ({ ...f, customer_account_code: e.target.value }))}
            />
          </FilterBarGroup>
        )}
        {(showDateFilters || showStatusFilter || showSupplierName || showCustomerCode) && (
          <>
            <FilterBarActions onClear={handleClearFilters} />
            <FilterBarApply onApply={handleApplyFilters} />
          </>
        )}
        <FilterBarExport<any>
          data={rows}
          exportFilename={exportName}
          exportColumns={columns.map((c) => ({
            key: c.key,
            label: c.label,
            getValue: (r) => {
              const cell = c.render?.(null, r, 0);
              if (cell != null && typeof cell !== 'object') return String(cell);
              const v = (r as any)[c.key];
              if (v && typeof v === 'object') return JSON.stringify(v);
              return v != null ? String(v) : '';
            },
          }))}
          disabled={loading}
        />
      </FilterBar>

      {listError && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-4 text-sm text-red-600">{listError}</div>
      )}

      <DataTableWithPagination<any>
        data={rows}
        columns={columns}
        loading={loading}
        emptyMessage={
          resource === 'accounts'
            ? 'No account memberships'
            : userAccountRows.length === 0
              ? 'User has no linked accounts — nothing to scope'
              : `No ${title.toLowerCase()} for this account`
        }
        itemLabel={title.toLowerCase()}
      />
    </div>
  );
}
