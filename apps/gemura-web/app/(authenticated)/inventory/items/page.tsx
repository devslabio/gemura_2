'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { inventoryApi, InventoryItem } from '@/lib/api/inventory';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import { usePermission } from '@/hooks/usePermission';
import DataTableWithPagination from '@/app/components/DataTableWithPagination';
import type { TableColumn } from '@/app/components/DataTable';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';
import FilterBar, { FilterBarGroup, FilterBarActions, FilterBarExport } from '@/app/components/FilterBar';
import Modal from '@/app/components/Modal';
import BulkImportModal from '@/app/components/BulkImportModal';
import StatCard from '@/app/components/StatCard';
import CreateInventoryForm from '../CreateInventoryForm';
import Icon, { faPlus, faEye, faCheckCircle, faDollarSign, faBox, faTriangleExclamation, faCircleXmark, faFile } from '@/app/components/Icon';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'out_of_stock', label: 'Out of Stock' },
];

export default function InventoryItemsPage() {
  const searchParams = useSearchParams();
  const { currentAccount } = useAuthStore();
  const { hasPermission, isAdmin } = usePermission();
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [error, setError] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || '');
  const [lowStockFilter, setLowStockFilter] = useState<boolean>(false);
  const [stats, setStats] = useState<{ total_items: number; active_items: number; out_of_stock_items: number; low_stock_items: number; listed_in_marketplace?: number } | null>(null);
  const canManageInventory = hasPermission('manage_inventory') || isAdmin();

  const loadInventory = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [listRes, statsRes] = await Promise.all([
        inventoryApi.getInventory(currentAccount?.account_id, statusFilter || undefined, lowStockFilter),
        currentAccount?.account_id ? inventoryApi.getInventoryStats(currentAccount.account_id).catch(() => null) : Promise.resolve(null),
      ]);
      if (listRes.code === 200) {
        setInventory(listRes.data || []);
      } else {
        setError(listRes.message || 'Failed to load inventory');
      }
      if (statsRes?.code === 200 && statsRes.data) {
        setStats(statsRes.data);
      } else {
        setStats(null);
      }
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as { message?: string })?.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [currentAccount?.account_id, statusFilter, lowStockFilter]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-RW', {
      style: 'currency',
      currency: 'RWF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const isLowStock = (item: InventoryItem) => {
    if (item.min_stock_level !== null && item.min_stock_level !== undefined) {
      return item.stock_quantity <= item.min_stock_level;
    }
    return item.stock_quantity <= 0;
  };

  const columns: TableColumn<InventoryItem>[] = [
    {
      key: 'name',
      label: 'Product Name',
      sortable: true,
      render: (value, row) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          {row.description && (
            <div className="text-xs text-gray-500">{row.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'price',
      label: 'Price',
      sortable: true,
      render: (value) => (
        <div className="flex items-center text-gray-900">
          <Icon icon={faDollarSign} size="sm" className="mr-1 text-gray-400" />
          <span>{formatCurrency(Number(value))}</span>
        </div>
      ),
    },
    {
      key: 'stock_quantity',
      label: 'Stock',
      sortable: true,
      render: (value, row) => {
        const isLow = isLowStock(row);
        return (
          <div className="flex items-center">
            <Icon icon={faBox} size="sm" className={`mr-2 ${isLow ? 'text-red-500' : 'text-gray-400'}`} />
            <span className={isLow ? 'text-red-600 font-semibold' : 'text-gray-900'}>
              {Number(value)}
            </span>
            {isLow && (
              <span className="ml-2 text-red-500" title="Low Stock">⚠️</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => {
        const statusColors: Record<string, string> = {
          active: 'bg-green-100 text-green-700',
          inactive: 'bg-gray-100 text-gray-700',
          out_of_stock: 'bg-red-100 text-red-700',
        };
        return (
          <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[value as string] || 'bg-gray-100 text-gray-700'}`}>
            {String(value).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </span>
        );
      },
    },
    {
      key: 'is_listed_in_marketplace',
      label: 'Marketplace',
      sortable: true,
      render: (value) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          value ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
        }`}>
          {value ? 'Listed' : 'Not Listed'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <Link
          href={`/inventory/${row.id}`}
          className="p-1.5 text-gray-600 hover:text-[var(--primary)] transition-colors inline-flex"
          title="View details"
        >
          <Icon icon={faEye} size="sm" />
        </Link>
      ),
    },
  ];

  if (loading) {
    return <ListPageSkeleton title="Inventory · Items" filterFields={2} tableRows={10} tableCols={6} />;
  }

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Items</h1>
          <p className="text-sm text-gray-500 mt-0.5">Inventory · Items</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => canManageInventory && setBulkImportOpen(true)} className="btn btn-secondary" disabled={!canManageInventory}>
            <Icon icon={faFile} size="sm" className="mr-2" />
            Bulk import
          </button>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); inventoryApi.downloadTemplate().catch(() => {}); }}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-4 text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors"
          >
            Download template
          </a>
          <button type="button" onClick={() => canManageInventory && setCreateModalOpen(true)} className="btn btn-primary" disabled={!canManageInventory}>
            <Icon icon={faPlus} size="sm" className="mr-2" />
            Add Item
          </button>
        </div>
      </div>

      <BulkImportModal
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        title="Inventory"
        columns={[
          { key: 'name', label: 'Name', required: true },
          { key: 'description', label: 'Description' },
          { key: 'price', label: 'Price', required: true },
          { key: 'stock_quantity', label: 'Stock quantity' },
          { key: 'min_stock_level', label: 'Min stock level' },
        ]}
        onDownloadTemplate={() => inventoryApi.downloadTemplate()}
        onBulkCreate={(rows) => {
          const data: import('@/lib/api/inventory').CreateInventoryData[] = rows.map((row) => ({
            name: row.name != null ? String(row.name) : undefined,
            description: row.description != null ? String(row.description) : undefined,
            price: Number(row.price) || 0,
            stock_quantity: row.stock_quantity != null ? Number(row.stock_quantity) : undefined,
            min_stock_level: row.min_stock_level != null ? Number(row.min_stock_level) : undefined,
          }));
          return inventoryApi.bulkCreate(data).then((r) => r.data);
        }}
        mapRow={(row) => ({
          name: row.name || undefined,
          description: row.description || undefined,
          price: Number(row.price) || 0,
          stock_quantity: row.stock_quantity ? Number(row.stock_quantity) : undefined,
          min_stock_level: row.min_stock_level ? Number(row.min_stock_level) : undefined,
        })}
        onSuccess={loadInventory}
      />

      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Add inventory item" maxWidth="max-w-xl">
        <CreateInventoryForm
          onSuccess={() => { setCreateModalOpen(false); loadInventory(); }}
          onCancel={() => setCreateModalOpen(false)}
        />
      </Modal>

      {/* Stats cards */}
      {stats && currentAccount && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Items"
            value={stats.total_items}
            subtitle="Products"
            icon={faBox}
            href="/inventory/items"
            iconBgColor="#f3f4f6"
            iconColor="#6b7280"
          />
          <StatCard
            label="Active"
            value={stats.active_items}
            subtitle="In stock"
            icon={faCheckCircle}
            href="/inventory/items?status=active"
            iconBgColor="#dcfce7"
            iconColor="#059669"
          />
          <StatCard
            label="Low Stock"
            value={stats.low_stock_items}
            subtitle="Below minimum"
            icon={faTriangleExclamation}
            href="/inventory/items"
            iconBgColor="#fffbeb"
            iconColor="#d97706"
          />
          <StatCard
            label="Out of Stock"
            value={stats.out_of_stock_items}
            subtitle="Zero quantity"
            icon={faCircleXmark}
            href="/inventory/items?status=out_of_stock"
            iconBgColor="#fef2f2"
            iconColor="#b91c1c"
          />
        </div>
      )}

      {/* Filters */}
      <FilterBar alignItems="center">
        <FilterBarGroup label="Status">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input h-9 min-h-[2.25rem] !py-1.5 !px-3 text-sm w-full text-gray-900"
          >
            {STATUS_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FilterBarGroup>
        <FilterBarGroup label="Stock">
          <label className="flex items-center h-9 min-h-[2.25rem] cursor-pointer">
            <input
              type="checkbox"
              checked={lowStockFilter}
              onChange={(e) => setLowStockFilter(e.target.checked)}
              className="mr-2 h-4 w-4 text-[var(--primary)] focus:ring-[var(--primary)] border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">Low stock only</span>
          </label>
        </FilterBarGroup>
        <FilterBarActions
          onClear={() => {
            setStatusFilter('');
            setLowStockFilter(false);
          }}
        />
        <FilterBarExport<InventoryItem>
          data={inventory}
          exportFilename="inventory"
          exportColumns={[
            { key: 'name', label: 'Name' },
            { key: 'description', label: 'Description', getValue: (r) => r.description ?? '' },
            { key: 'price', label: 'Price', getValue: (r) => String(r.price ?? '') },
            { key: 'stock_quantity', label: 'Stock', getValue: (r) => String(r.stock_quantity ?? '') },
            { key: 'status', label: 'Status' },
          ]}
          disabled={loading}
        />
      </FilterBar>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <DataTableWithPagination<InventoryItem>
        data={inventory}
        columns={columns}
        loading={loading}
        emptyMessage={currentAccount ? 'No inventory items for this account' : 'Select an account to view inventory'}
        itemLabel="items"
      />
    </div>
  );
}
