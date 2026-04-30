'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  accountingApi,
  IncomeStatement,
  AccountingTransaction,
  ReceivablesSummary,
  PayablesSummary,
  ExpenseCategoryAccount,
} from '@/lib/api/accounting';
import { useToastStore } from '@/store/toast';
import Icon, {
  faCalendar,
  faPlus,
  faSpinner,
  faChartLine,
  faReceipt,
  faArrowDown,
  faArrowUp,
  faArrowsRotate,
  faTriangleExclamation,
} from '@/app/components/Icon';
import Modal from '@/app/components/Modal';
import DatePicker from '@/app/components/DatePicker';
import { FinancePageSkeleton } from '@/app/components/SkeletonLoader';

function toYYYYMMDD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDate(str: string): string {
  try {
    return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return str;
  }
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF', minimumFractionDigits: 0 }).format(amount);
}

export default function FinancePage() {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toYYYYMMDD(d);
  });
  const [toDate, setToDate] = useState(() => toYYYYMMDD(new Date()));
  const [loading, setLoading] = useState(true);
  const [income, setIncome] = useState<IncomeStatement | null>(null);
  const [transactions, setTransactions] = useState<AccountingTransaction[]>([]);
  const [receivables, setReceivables] = useState<ReceivablesSummary | null>(null);
  const [payables, setPayables] = useState<PayablesSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [recordType, setRecordType] = useState<'revenue' | 'expense'>('revenue');
  const [recordAmount, setRecordAmount] = useState('');
  const [recordDescription, setRecordDescription] = useState('');
  const [recordDate, setRecordDate] = useState(() => toYYYYMMDD(new Date()));
  const [recordCategoryAccountId, setRecordCategoryAccountId] = useState('');
  const [expenseCategoryAccounts, setExpenseCategoryAccounts] = useState<ExpenseCategoryAccount[]>([]);
  const [recordSubmitting, setRecordSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [incRes, txRes, recRes, payRes] = await Promise.all([
        accountingApi.getIncomeStatement(fromDate, toDate),
        accountingApi.getTransactions({ date_from: fromDate, date_to: toDate, limit: 50 }),
        accountingApi.getReceivables({ date_from: fromDate, date_to: toDate }),
        accountingApi.getPayables({ date_from: fromDate, date_to: toDate }),
      ]);
      setIncome(incRes);
      setTransactions(txRes);
      setReceivables(recRes);
      setPayables(payRes);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (e as Error)?.message ?? 'Failed to load finance data';
      setError(msg);
      setIncome(null);
      setTransactions([]);
      setReceivables(null);
      setPayables(null);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    accountingApi
      .getExpenseAccounts(true)
      .then((accounts) => setExpenseCategoryAccounts(accounts))
      .catch(() => setExpenseCategoryAccounts([]));
  }, []);

  const handleRecordSubmit = async () => {
    const amount = Number(recordAmount);
    if (!recordDescription.trim() || Number.isNaN(amount) || amount <= 0) {
      useToastStore.getState().error('Enter a valid amount and description');
      return;
    }
    setRecordSubmitting(true);
    try {
      await accountingApi.createTransaction({
        type: recordType,
        amount,
        description: recordDescription.trim(),
        transaction_date: recordDate,
        account_id: recordType === 'expense' && recordCategoryAccountId ? recordCategoryAccountId : undefined,
      });
      useToastStore.getState().success(`${recordType === 'revenue' ? 'Revenue' : 'Expense'} recorded`);
      setShowRecordModal(false);
      setRecordAmount('');
      setRecordDescription('');
      setRecordCategoryAccountId('');
      setRecordDate(toYYYYMMDD(new Date()));
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (e as Error)?.message ?? 'Failed to record';
      useToastStore.getState().error(msg);
    } finally {
      setRecordSubmitting(false);
    }
  };

  const totalReceivables = receivables?.total_receivables ?? 0;
  const totalPayables = payables?.total_payables ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700">
            <Icon icon={faCalendar} size="sm" />
            <span>
              {formatDate(fromDate)} – {formatDate(toDate)}
            </span>
          </div>
          <div className="input-group-inline">
            <span className="input-group-addon">From</span>
            <DatePicker
              value={fromDate}
              onChange={setFromDate}
              max={new Date().toISOString().slice(0, 10)}
              placeholder="From"
              className="min-w-[140px]"
              id="finance-from-date"
            />
          </div>
          <div className="input-group-inline">
            <span className="input-group-addon">To</span>
            <DatePicker
              value={toDate}
              onChange={setToDate}
              max={new Date().toISOString().slice(0, 10)}
              placeholder="To"
              className="min-w-[140px]"
              id="finance-to-date"
            />
          </div>
          <button type="button" onClick={() => load()} className="btn btn-secondary" disabled={loading}>
            <Icon icon={loading ? faSpinner : faArrowsRotate} size="sm" className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button type="button" onClick={() => setShowRecordModal(true)} className="btn btn-primary">
            <Icon icon={faPlus} size="sm" className="mr-2" />
            Record Transaction
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 p-3 text-red-800">
          <Icon icon={faTriangleExclamation} size="sm" />
          <span>{error}</span>
          <button type="button" onClick={() => load()} className="ml-2 text-sm underline">
            Retry
          </button>
        </div>
      )}

      {loading && !income && !receivables && !payables ? (
        <FinancePageSkeleton />
      ) : (
        <>
          {/* All summary cards in one row, consistent styling */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Link
              href="/finance/receivables"
              className="rounded-sm border border-gray-200 border-l-4 border-l-emerald-500 bg-white p-4 transition hover:border-emerald-400"
            >
              <div className="flex items-center gap-2">
                <div className="rounded bg-emerald-100 p-2">
                  <Icon icon={faArrowDown} className="text-emerald-600" size="sm" />
                </div>
                <span className="text-sm font-medium text-gray-500">Receivables</span>
              </div>
              <p className="mt-2 text-xl font-bold text-gray-900">{formatAmount(totalReceivables)}</p>
            </Link>
            <Link
              href="/finance/payables"
              className="rounded-sm border border-gray-200 border-l-4 border-l-red-500 bg-white p-4 transition hover:border-red-400"
            >
              <div className="flex items-center gap-2">
                <div className="rounded bg-red-100 p-2">
                  <Icon icon={faArrowUp} className="text-red-600" size="sm" />
                </div>
                <span className="text-sm font-medium text-gray-500">Payables</span>
              </div>
              <p className="mt-2 text-xl font-bold text-gray-900">{formatAmount(totalPayables)}</p>
            </Link>
            <div className="rounded-sm border border-gray-200 border-l-4 border-l-emerald-500 bg-white p-4">
              <div className="flex items-center gap-2">
                <div className="rounded bg-emerald-100 p-2">
                  <Icon icon={faChartLine} className="text-emerald-600" size="sm" />
                </div>
                <span className="text-sm font-medium text-gray-500">Revenue</span>
              </div>
              <p className="mt-2 text-xl font-bold text-gray-900">{formatAmount(income?.revenue ?? 0)}</p>
            </div>
            <div className="rounded-sm border border-gray-200 border-l-4 border-l-red-500 bg-white p-4">
              <div className="flex items-center gap-2">
                <div className="rounded bg-red-100 p-2">
                  <Icon icon={faChartLine} className="text-red-600" size="sm" />
                </div>
                <span className="text-sm font-medium text-gray-500">Expenses</span>
              </div>
              <p className="mt-2 text-xl font-bold text-gray-900">{formatAmount(income?.expenses ?? 0)}</p>
            </div>
            <div
              className={`rounded-sm border border-gray-200 border-l-4 bg-white p-4 ${
                (income?.net_income ?? 0) >= 0 ? 'border-l-[var(--primary)]' : 'border-l-red-500'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`rounded p-2 ${
                    (income?.net_income ?? 0) >= 0 ? 'bg-[var(--primary)]/10' : 'bg-red-100'
                  }`}
                >
                  <Icon
                    icon={faChartLine}
                    className={(income?.net_income ?? 0) >= 0 ? 'text-[var(--primary)]' : 'text-red-600'}
                    size="sm"
                  />
                </div>
                <span className="text-sm font-medium text-gray-500">Net Income</span>
              </div>
              <p
                className={`mt-2 text-xl font-bold ${
                  (income?.net_income ?? 0) >= 0 ? 'text-[var(--primary)]' : 'text-red-600'
                }`}
              >
                {formatAmount(income?.net_income ?? 0)}
              </p>
            </div>
          </div>

          {/* Financial breakdown (only when we have income data) */}
          {income && (
            <div className="space-y-4">
              <div className="rounded-sm border border-gray-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-gray-700">Financial Breakdown</h3>
                <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                  <div className="flex justify-between text-sm">
                    <span>Total Revenue</span>
                    <span className="font-medium text-emerald-600">{formatAmount(income.revenue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Total Expenses</span>
                    <span className="font-medium text-red-600">{formatAmount(income.expenses)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-100 pt-2 text-sm font-semibold">
                    <span>Net Income</span>
                    <span className={income.net_income >= 0 ? 'text-[var(--primary)]' : 'text-red-600'}>
                      {formatAmount(income.net_income)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recent transactions – single container with header and list */}
          <div className="rounded-sm border border-gray-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-gray-900">Recent Transactions</h2>
              <Link href="/finance/transactions" className="text-sm font-medium text-[var(--primary)] hover:underline">
                View All
              </Link>
            </div>
            {transactions.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Icon icon={faReceipt} size="lg" className="mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No transactions in this period. Record a revenue or expense above.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {transactions.slice(0, 10).map((tx) => {
                  const isRevenue = tx.type === 'revenue';
                  return (
                    <li
                      key={tx.id}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`shrink-0 rounded p-1.5 ${isRevenue ? 'bg-emerald-100' : 'bg-red-100'}`}
                        >
                          <Icon
                            icon={faChartLine}
                            className={isRevenue ? 'text-emerald-600' : 'text-red-600'}
                            size="sm"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{tx.description}</p>
                          <p className="text-xs text-gray-500">{formatDate(tx.transaction_date)}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 pl-3">
                        <p className={`text-sm font-semibold ${isRevenue ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatAmount(tx.amount)}
                        </p>
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                            isRevenue ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {isRevenue ? 'Revenue' : 'Expense'}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}

      {/* Record transaction modal */}
      <Modal
        open={showRecordModal}
        onClose={() => !recordSubmitting && setShowRecordModal(false)}
        title="Record Transaction"
        maxWidth="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowRecordModal(false)} className="btn btn-secondary" disabled={recordSubmitting}>
              Cancel
            </button>
            <button type="button" onClick={handleRecordSubmit} className="btn btn-primary" disabled={recordSubmitting}>
              {recordSubmitting ? <Icon icon={faSpinner} spin size="sm" className="mr-2" /> : null}
              Record
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => setRecordType('revenue')}
                className={`flex-1 rounded border px-3 py-2 text-sm font-medium ${
                  recordType === 'revenue' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                Revenue
              </button>
              <button
                type="button"
                onClick={() => setRecordType('expense')}
                className={`flex-1 rounded border px-3 py-2 text-sm font-medium ${
                  recordType === 'expense' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                Expense
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Amount (RWF)</label>
            <input
              type="number"
              min="1"
              value={recordAmount}
              onChange={(e) => setRecordAmount(e.target.value)}
              className="input mt-1 w-full"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <input
              type="text"
              value={recordDescription}
              onChange={(e) => setRecordDescription(e.target.value)}
              className="input mt-1 w-full"
              placeholder="e.g. Milk sales"
            />
          </div>
          {recordType === 'expense' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Expense Category</label>
              <select
                value={recordCategoryAccountId}
                onChange={(e) => setRecordCategoryAccountId(e.target.value)}
                className="input mt-1 w-full"
              >
                <option value="">Select category (recommended)</option>
                {expenseCategoryAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Choose a category for more accurate automatic milk cost analytics.
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">Date</label>
            <DatePicker
              value={recordDate}
              onChange={setRecordDate}
              max={new Date().toISOString().slice(0, 10)}
              placeholder="Select date"
              className="mt-1 w-full"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
