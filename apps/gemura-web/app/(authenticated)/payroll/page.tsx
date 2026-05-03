'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { payrollApi, GeneratePayrollResult } from '@/lib/api/payroll';
import { suppliersApi, Supplier } from '@/lib/api/suppliers';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import Icon, { faClipboardList, faCalendar, faCheckCircle, faClock, faSpinner } from '@/app/components/Icon';
import { SkeletonBar } from '@/app/components/SkeletonLoader';

export default function PayrollPage() {
  const { currentAccount } = useAuthStore();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [periodStart, setPeriodStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [periodEnd, setPeriodEnd] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [runName, setRunName] = useState('');
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GeneratePayrollResult | null>(null);

  /** Suggested run name from date range (e.g. "1 Jan – 31 Jan 2025") */
  const suggestedRunName = (() => {
    if (!periodStart || !periodEnd) return '';
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${fmt(start)} – ${fmt(end)}`;
  })();

  // Prefill run name with suggestion; update when date range changes (user can still edit)
  useEffect(() => {
    setRunName(suggestedRunName);
  }, [suggestedRunName]);

  const loadSuppliers = useCallback(async () => {
    try {
      setLoadingSuppliers(true);
      const res = await suppliersApi.getAllSuppliers(currentAccount?.account_id);
      if (res.code === 200 && res.data) setSuppliers(res.data);
      else setSuppliers([]);
    } catch {
      setSuppliers([]);
    } finally {
      setLoadingSuppliers(false);
    }
  }, [currentAccount?.account_id]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const toggleSupplier = (code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
    setResult(null);
  };

  const selectAll = () => {
    if (selectedCodes.size === suppliers.length) {
      setSelectedCodes(new Set());
    } else {
      setSelectedCodes(new Set(suppliers.map((s) => s.account.code)));
    }
    setResult(null);
  };

  const handleGenerate = async () => {
    if (!currentAccount?.account_id) {
      useToastStore.getState().error('Please select an account first');
      return;
    }
    if (selectedCodes.size === 0) {
      useToastStore.getState().error('Please select at least one supplier');
      return;
    }
    setGenerating(true);
    setResult(null);
    try {
      const res = await payrollApi.generatePayroll({
        supplier_account_codes: Array.from(selectedCodes),
        period_start: periodStart,
        period_end: periodEnd,
        run_name: runName.trim() || suggestedRunName || undefined,
        account_id: currentAccount?.account_id,
      });
      if (res.code === 200 && res.data) {
        setResult(res.data);
        useToastStore.getState().success(`Payroll generated for ${res.data.suppliers_processed} supplier(s)`);
      } else {
        useToastStore.getState().error(res.message || 'Failed to generate payroll');
      }
    } catch (err: any) {
      useToastStore.getState().error(err?.response?.data?.message || err?.message || 'Failed to generate payroll');
    } finally {
      setGenerating(false);
    }
  };

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF', minimumFractionDigits: 0 }).format(amount);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
        <Link href="/payroll/history" className="btn btn-secondary">
          <Icon icon={faClock} size="sm" className="mr-2" />
          View History
        </Link>
      </div>

      {!currentAccount && (
        <div className="bg-amber-50 border border-amber-200 rounded-sm p-4">
          <p className="text-sm text-amber-800">Select an account to generate payroll.</p>
        </div>
      )}

      {/* Date range + Run name (same row) */}
      <div className="bg-white border border-gray-200 rounded-sm p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Date Range</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
            <input
              type="date"
              value={periodStart}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => {
                setPeriodStart(e.target.value);
                setResult(null);
              }}
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
            <input
              type="date"
              value={periodEnd}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => {
                setPeriodEnd(e.target.value);
                setResult(null);
              }}
              className="input w-full"
            />
          </div>
          <div>
            <label htmlFor="payroll-run-name" className="block text-sm font-medium text-gray-700 mb-1">
              Run name
            </label>
            <input
              id="payroll-run-name"
              type="text"
              value={runName}
              onChange={(e) => setRunName(e.target.value)}
              placeholder="e.g. January 2025"
              className="input w-full"
              aria-label="Payroll run name"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Run name is prefilled from the date range; you can change it to any name you like.
        </p>
      </div>

      {/* Suppliers */}
      <div className="bg-white border border-gray-200 rounded-sm p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Select Suppliers</h2>
        {loadingSuppliers ? (
          <div className="border border-gray-200 rounded-sm max-h-64 overflow-hidden">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 last:border-0">
                <div className="w-4 h-4 rounded border border-gray-200 skeleton-shimmer bg-gray-200" />
                <SkeletonBar className="h-4 flex-1 max-w-[200px]" />
                <SkeletonBar className="h-3 w-12" />
              </div>
            ))}
          </div>
        ) : suppliers.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">No suppliers available for this account.</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-600">
                {selectedCodes.size} of {suppliers.length} selected
              </span>
              <button type="button" onClick={selectAll} className="text-sm font-medium text-[var(--primary)] hover:underline">
                {selectedCodes.size === suppliers.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="border border-gray-200 rounded-sm max-h-64 overflow-y-auto">
              {suppliers.map((s) => (
                <label
                  key={s.relationship_id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedCodes.has(s.account.code)}
                    onChange={() => toggleSupplier(s.account.code)}
                    className="rounded border-gray-300 text-[var(--primary)]"
                  />
                  <div>
                    <span className="font-medium text-gray-900">{s.name}</span>
                    <span className="text-xs text-gray-500 ml-2">({s.account.code})</span>
                  </div>
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating || selectedCodes.size === 0 || !currentAccount}
        className="btn btn-primary"
      >
        {generating ? (
          <>
            <Icon icon={faSpinner} size="sm" spin className="mr-2" />
            Generating...
          </>
        ) : (
          <>
            <Icon icon={faClipboardList} size="sm" className="mr-2" />
            Generate Payroll
          </>
        )}
      </button>

      {/* Result */}
      {result && (
        <div className="bg-white border border-green-200 rounded-sm p-5 border-l-4 border-l-green-500">
          <div className="flex items-center gap-2 mb-4">
            <Icon icon={faCheckCircle} className="text-green-600" size="sm" />
            <h2 className="text-lg font-semibold text-green-800">Payroll Generated</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Period</p>
              <p className="text-sm font-semibold text-gray-900">
                {new Date(result.period_start).toLocaleDateString()} – {new Date(result.period_end).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Suppliers Processed</p>
              <p className="text-sm font-semibold text-gray-900">{result.suppliers_processed}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Amount</p>
              <p className="text-sm font-semibold text-[var(--primary)]">{formatAmount(result.total_amount)}</p>
            </div>
          </div>
          {result.payslips && result.payslips.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Payslips</h3>
              <div className="space-y-2">
                {result.payslips.map((p, i) => (
                  <div key={p.id || i} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-sm">
                    <span className="font-medium text-gray-900">{p.supplier ?? p.supplier_code ?? 'Unknown'}</span>
                    <span className="text-sm text-gray-600">
                      {p.milk_sales_count ?? 0} collections · {formatAmount(p.net_amount ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="mt-4 pt-3 border-t border-gray-200">
            <Link href="/payroll/history" className="text-sm font-medium text-[var(--primary)] hover:underline">
              View in History →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
