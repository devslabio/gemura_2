'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { payrollApi, PayrollRun, PayslipDetail } from '@/lib/api/payroll';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import Icon, { faArrowLeft, faSpinner, faCheckCircle, faCalendar, faUsers, faFileAlt, faClipboardList, faArrowsRotate, faDownload } from '@/app/components/Icon';
import { exportToCsv } from '@/lib/utils/export-csv';
import Modal from '@/app/components/Modal';
import ConfirmDialog from '@/app/components/ConfirmDialog';
import { ListPageSkeleton } from '@/app/components/SkeletonLoader';

export default function PayrollHistoryPage() {
  const { currentAccount } = useAuthStore();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [detailRun, setDetailRun] = useState<PayrollRun | null>(null);
  const [runIdToConfirm, setRunIdToConfirm] = useState<string | null>(null);
  const [payslipDetail, setPayslipDetail] = useState<PayslipDetail | null>(null);
  const [payslipDetailLoading, setPayslipDetailLoading] = useState(false);
  const [payslipRowExtras, setPayslipRowExtras] = useState<Record<string, {
    loading: boolean;
    totalLiters?: number;
    bankName?: string;
    bankAccountNumber?: string;
  }>>({});

  const loadRuns = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await payrollApi.getPayrollRuns({
        account_id: currentAccount?.account_id,
      });
      if (res.code === 200 && res.data) setRuns(res.data);
      else setRuns([]);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load payroll runs');
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [currentAccount?.account_id]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    if (!detailRun?.id) return;

    const payslips = detailRun.payslips || [];
    const missing = payslips.filter((p) => {
      if (!p.id) return false;
      if (payslipRowExtras[p.id]) return false;
      return true;
    });

    if (missing.length === 0) return;

    let cancelled = false;

    // Mark missing rows as loading before making requests.
    setPayslipRowExtras((prev) => {
      const next = { ...prev };
      missing.forEach((p) => {
        if (!p.id) return;
        next[p.id] = { loading: true };
      });
      return next;
    });

    const hydrateRows = async () => {
      await Promise.all(
        missing.map(async (p) => {
          if (!p.id) return;

          const typedTotalLiters = p.total_liters;
          const typedBankName = p.bank_name;
          const typedBankAccountNumber = p.bank_account_number;

          if (typedTotalLiters != null || typedBankName || typedBankAccountNumber) {
            if (!cancelled) {
              setPayslipRowExtras((prev) => ({
                ...prev,
                [p.id]: {
                  loading: false,
                  totalLiters: typedTotalLiters != null ? Number(typedTotalLiters) : undefined,
                  bankName: typedBankName,
                  bankAccountNumber: typedBankAccountNumber,
                },
              }));
            }
            return;
          }

          try {
            const res = await payrollApi.getPayslipDetail(detailRun.id, p.id, currentAccount?.account_id);
            const detail = res?.data as PayslipDetail & {
              bank_account_number?: string;
            };

            const totalLiters = (detail.earnings || []).reduce(
              (sum, earning) => sum + Number(earning.quantity || 0),
              0,
            );

            if (!cancelled) {
              setPayslipRowExtras((prev) => ({
                ...prev,
                [p.id]: {
                  loading: false,
                  totalLiters,
                  bankName: detail.bank_name,
                  bankAccountNumber: detail.bank_account_number,
                },
              }));
            }
          } catch {
            if (!cancelled) {
              setPayslipRowExtras((prev) => ({
                ...prev,
                [p.id]: {
                  loading: false,
                },
              }));
            }
          }
        }),
      );
    };

    hydrateRows();

    return () => {
      cancelled = true;
    };
  }, [detailRun, currentAccount?.account_id]);

  const handleMarkPaid = async (runId: string) => {
    setRunIdToConfirm(runId);
  };

  const handleConfirmMarkPaid = async () => {
    const runId = runIdToConfirm;
    if (!runId) return;
    setMarkingId(runId);
    try {
      await payrollApi.markPayrollAsPaid(runId);
      useToastStore.getState().success('Payroll marked as paid');
      setDetailRun(null);
      loadRuns();
    } catch (err: any) {
      useToastStore.getState().error(err?.response?.data?.message || 'Failed to mark as paid');
    } finally {
      setRunIdToConfirm(null);
      setMarkingId(null);
    }
  };

  const handleExport = async (runId: string, format: 'excel' | 'pdf') => {
    setExportingId(runId);
    try {
      await payrollApi.exportPayroll(runId, format);
      useToastStore.getState().success(`Exported as ${format}`);
    } catch (err: any) {
      useToastStore.getState().error(err?.response?.data?.message || `Export ${format} failed`);
    } finally {
      setExportingId(null);
    }
  };

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF', minimumFractionDigits: 0 }).format(amount);

  const formatDateTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const formatLiters = (liters?: number) => {
    if (liters == null) return '—';
    return `${liters.toLocaleString(undefined, { maximumFractionDigits: 2 })} L`;
  };

  const openPayslipDetail = async (runId: string, payslipId: string) => {
    if (!runId || !payslipId) return;
    setPayslipDetailLoading(true);
    setPayslipDetail(null);
    try {
      const res = await payrollApi.getPayslipDetail(runId, payslipId, currentAccount?.account_id);
      if (res.code === 200 && res.data) setPayslipDetail(res.data);
    } catch (err: any) {
      useToastStore.getState().error(err?.response?.data?.message || 'Failed to load payslip detail');
    } finally {
      setPayslipDetailLoading(false);
    }
  };

  const statusColor = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'completed') return 'bg-green-100 text-green-700';
    if (s === 'draft') return 'bg-amber-100 text-amber-700';
    if (s === 'processing') return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-700';
  };

  const isAllPaid = (run: PayrollRun) => {
    const payslips = run.payslips || [];
    return payslips.length > 0 && payslips.every((p) => (p.status || '').toLowerCase() === 'paid');
  };

  const canMarkPaid = (run: PayrollRun) =>
    (run.status || '').toLowerCase() === 'completed' && !isAllPaid(run) && !markingId;

  const exportPayslipBreakdown = (detail: PayslipDetail) => {
    const rows: Array<{
      section: string;
      date: string;
      quantity: string;
      unit_price: string;
      amount: string;
      notes: string;
      reason: string;
      deduction_amount: string;
    }> = [];
    detail.earnings.forEach((e) => {
      rows.push({
        section: 'Earning',
        date: formatDate(e.date),
        quantity: String(Number(e.quantity).toLocaleString()),
        unit_price: formatAmount(e.unit_price),
        amount: formatAmount(e.amount),
        notes: e.notes ?? '',
        reason: '',
        deduction_amount: '',
      });
    });
    detail.deductions.forEach((d) => {
      rows.push({
        section: 'Deduction',
        date: '',
        quantity: '',
        unit_price: '',
        amount: '',
        notes: '',
        reason: d.reason,
        deduction_amount: formatAmount(d.amount),
      });
    });
    const columns = [
      { key: 'section', label: 'Section' },
      { key: 'date', label: 'Date' },
      { key: 'quantity', label: 'Quantity (L)' },
      { key: 'unit_price', label: 'Unit price' },
      { key: 'amount', label: 'Amount' },
      { key: 'notes', label: 'Notes' },
      { key: 'reason', label: 'Reason / Type' },
      { key: 'deduction_amount', label: 'Deduction amount' },
    ];
    const safeName = (detail.supplier || 'payslip').replace(/[^a-zA-Z0-9-_]/g, '_');
    exportToCsv(rows, columns, `payslip-breakdown-${safeName}`);
  };

  if (loading) {
    return <ListPageSkeleton title="Payroll History" filterFields={0} tableRows={8} tableCols={5} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/payroll" className="text-sm text-gray-600 hover:text-[var(--primary)] mb-2 inline-flex items-center">
            <Icon icon={faArrowLeft} size="sm" className="mr-2" />
            Back to Payroll
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Payroll History</h1>
        </div>
        {runs.length > 0 && (
          <button type="button" onClick={() => loadRuns()} className="btn btn-secondary" disabled={loading}>
            <Icon icon={loading ? faSpinner : faArrowsRotate} size="sm" className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
          <button type="button" onClick={loadRuns} className="mt-2 text-sm font-medium text-red-700 hover:underline">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && runs.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-sm p-12 text-center">
          <Icon icon={faClipboardList} className="text-gray-300 mx-auto mb-4" size="2x" />
          <p className="text-gray-600 font-medium">No payroll runs found</p>
          <p className="text-sm text-gray-500 mt-1">Generate your first payroll from the Payroll page</p>
          <Link href="/payroll" className="btn btn-primary mt-4 inline-flex">
            Go to Payroll
          </Link>
        </div>
      )}

      {runs.length > 0 && (
        <div className="space-y-3">
          {runs.map((run) => (
            <div
              key={run.id}
              role="button"
              tabIndex={0}
              onClick={() => setDetailRun(run)}
              onKeyDown={(e) => e.key === 'Enter' && setDetailRun(run)}
              className="bg-white border border-gray-200 rounded-sm p-4 hover:border-gray-300 transition-colors cursor-pointer"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{run.period_name || 'Payroll Run'}</p>
                  <p className="text-sm text-gray-500">{formatDateTime(run.run_date)}</p>
                  {run.period_start && run.period_end && (
                    <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                      <Icon icon={faCalendar} size="sm" className="text-gray-400" />
                      {formatDate(run.period_start)} – {formatDate(run.period_end)}
                    </p>
                  )}
                  <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                    <Icon icon={faUsers} size="sm" className="text-gray-400" />
                    {run.payslips_count} supplier{run.payslips_count !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor(run.status)}`}>
                    {(run.status || '').toUpperCase()}
                  </span>
                  {isAllPaid(run) && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                      <Icon icon={faCheckCircle} size="xs" />
                      Paid
                    </span>
                  )}
                  <span className="text-lg font-bold text-[var(--primary)]">{formatAmount(run.total_amount)}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleExport(run.id, 'excel')}
                    disabled={!!exportingId}
                    className="inline-flex items-center justify-center gap-1.5 h-9 px-3 text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {exportingId === run.id ? (
                      <Icon icon={faSpinner} size="sm" spin className="mr-1" />
                    ) : (
                      <Icon icon={faFileAlt} size="sm" className="mr-1" />
                    )}
                    Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport(run.id, 'pdf')}
                    disabled={!!exportingId}
                    className="inline-flex items-center justify-center gap-1.5 h-9 px-3 text-sm font-medium text-blue-800 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {exportingId === run.id ? (
                      <Icon icon={faSpinner} size="sm" spin className="mr-1" />
                    ) : (
                      <Icon icon={faFileAlt} size="sm" className="mr-1" />
                    )}
                    PDF
                  </button>
                </div>
                {isAllPaid(run) ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-green-100 text-green-700">
                    <Icon icon={faCheckCircle} size="sm" />
                    Paid
                  </span>
                ) : canMarkPaid(run) ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleMarkPaid(run.id); }}
                    disabled={!!markingId}
                    className="btn btn-primary text-sm inline-flex items-center"
                  >
                    {markingId === run.id ? (
                      <Icon icon={faSpinner} size="sm" spin className="mr-1" />
                    ) : (
                      <Icon icon={faCheckCircle} size="sm" className="mr-1" />
                    )}
                    Mark as Paid
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payroll run detail modal – list of people */}
      <Modal
        open={!!detailRun}
        onClose={() => setDetailRun(null)}
        title={detailRun ? (detailRun.period_name || 'Payroll Details') : 'Payroll Details'}
        maxWidth="max-w-4xl"
        footer={
          detailRun ? (
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={() => { handleExport(detailRun.id, 'excel'); }}
                disabled={!!exportingId}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-4 text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Export Excel
              </button>
              <button
                type="button"
                onClick={() => { handleExport(detailRun.id, 'pdf'); }}
                disabled={!!exportingId}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-4 text-sm font-medium text-blue-800 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Export PDF
              </button>
              {isAllPaid(detailRun) ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium bg-green-100 text-green-700">
                  <Icon icon={faCheckCircle} size="sm" />
                  Paid
                </span>
              ) : canMarkPaid(detailRun) ? (
                <button
                  type="button"
                  onClick={() => handleMarkPaid(detailRun.id)}
                  disabled={!!markingId}
                  className="btn btn-primary text-sm"
                >
                  {markingId === detailRun.id ? (
                    <Icon icon={faSpinner} size="sm" spin className="mr-1" />
                  ) : null}
                  Mark as Paid
                </button>
              ) : null}
            </div>
          ) : null
        }
      >
        {detailRun && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500 font-medium">Status</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${statusColor(detailRun.status || '')}`}>
                    {(detailRun.status || '').toUpperCase()}
                  </span>
                  {isAllPaid(detailRun) && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                      <Icon icon={faCheckCircle} size="xs" />
                      Paid
                    </span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-gray-500 font-medium">Run Date</p>
                <p className="text-gray-900">{detailRun.run_date ? formatDateTime(detailRun.run_date) : '—'}</p>
              </div>
              {detailRun.period_start && detailRun.period_end && (
                <div className="sm:col-span-2">
                  <p className="text-gray-500 font-medium">Period</p>
                  <p className="text-gray-900">{formatDate(detailRun.period_start)} – {formatDate(detailRun.period_end)}</p>
                </div>
              )}
              <div>
                <p className="text-gray-500 font-medium">Total Amount</p>
                <p className="text-gray-900 font-semibold text-[var(--primary)]">{formatAmount(detailRun.total_amount ?? 0)}</p>
              </div>
              {detailRun.payment_terms_days != null && (
                <div>
                  <p className="text-gray-500 font-medium">Payment Terms</p>
                  <p className="text-gray-900">{detailRun.payment_terms_days} days</p>
                </div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Payroll list ({detailRun.payslips?.length ?? 0} people)
              </h3>
              <p className="text-xs text-gray-500 mb-2">
                Total liters are computed from milk collection entries in each payslip.
              </p>
              <div className="border border-gray-200 rounded-sm overflow-hidden">
                <div className="overflow-x-auto max-h-[min(70vh,28rem)] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium text-gray-700">Supplier</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-700">Bank</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-700">Bank Account</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-700">Collections</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-700">Total Liters (L)</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-700">Gross</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-700">Deductions</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-700">Net</th>
                        <th className="text-center py-2 px-3 font-medium text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(detailRun.payslips || []).map((p) => (
                        <tr
                          key={p.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => detailRun?.id && openPayslipDetail(detailRun.id, p.id)}
                          onKeyDown={(e) => e.key === 'Enter' && detailRun?.id && openPayslipDetail(detailRun.id, p.id)}
                          className="hover:bg-gray-50/50 cursor-pointer"
                        >
                          {(() => {
                            const extra = p.id ? payslipRowExtras[p.id] : undefined;
                            const bankName = p.bank_name || extra?.bankName;
                            const bankAccountNumber = p.bank_account_number || extra?.bankAccountNumber;
                            const totalLiters = p.total_liters != null ? Number(p.total_liters) : extra?.totalLiters;

                            return (
                              <>
                                <td className="py-2 px-3 font-medium text-gray-900">{p.supplier ?? p.supplier_code ?? 'Unknown'}</td>
                                <td className="py-2 px-3 text-gray-600">{bankName || '—'}</td>
                                <td className="py-2 px-3 text-gray-600">{bankAccountNumber || '—'}</td>
                                <td className="py-2 px-3 text-right text-gray-600">{p.milk_sales_count ?? 0}</td>
                                <td className="py-2 px-3 text-right text-gray-600">
                                  {extra?.loading ? (
                                    <span className="inline-flex items-center gap-1">
                                      <Icon icon={faSpinner} size="xs" spin className="text-gray-400" />
                                      <span className="text-gray-400">Loading</span>
                                    </span>
                                  ) : (
                                    formatLiters(totalLiters)
                                  )}
                                </td>
                              </>
                            );
                          })()}
                          <td className="py-2 px-3 text-right text-gray-600">{formatAmount(p.gross_amount ?? 0)}</td>
                          <td className="py-2 px-3 text-right text-gray-600">{formatAmount(p.total_deductions ?? 0)}</td>
                          <td className="py-2 px-3 text-right font-medium text-[var(--primary)]">{formatAmount(p.net_amount ?? 0)}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                              (p.status || '').toLowerCase() === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {(p.status || 'generated').toLowerCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Payslip detail modal – earnings (milk collections) and deductions */}
      <Modal
        open={!!payslipDetail || payslipDetailLoading}
        onClose={() => { setPayslipDetail(null); setPayslipDetailLoading(false); }}
        title={payslipDetailLoading ? 'Loading…' : (payslipDetail ? `${payslipDetail.supplier} – Breakdown` : 'Payslip')}
        maxWidth="max-w-4xl"
        footer={
          payslipDetail && !payslipDetailLoading ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => exportPayslipBreakdown(payslipDetail)}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-4 text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors"
              >
                <Icon icon={faDownload} size="sm" className="mr-2" />
                Export CSV
              </button>
            </div>
          ) : null
        }
      >
        {payslipDetailLoading && (
          <div className="flex items-center justify-center py-12">
            <Icon icon={faSpinner} size="2x" spin className="text-gray-400" />
          </div>
        )}
        {payslipDetail && !payslipDetailLoading && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-gray-500 font-medium">Gross</p>
                <p className="text-gray-900 font-medium">{formatAmount(payslipDetail.gross_amount)}</p>
              </div>
              <div>
                <p className="text-gray-500 font-medium">Deductions</p>
                <p className="text-gray-900 font-medium text-red-600">{formatAmount(payslipDetail.total_deductions)}</p>
              </div>
              <div>
                <p className="text-gray-500 font-medium">Net</p>
                <p className="text-gray-900 font-semibold text-[var(--primary)]">{formatAmount(payslipDetail.net_amount)}</p>
              </div>
              <div>
                <p className="text-gray-500 font-medium">Period</p>
                <p className="text-gray-900">{formatDate(payslipDetail.period_start)} – {formatDate(payslipDetail.period_end)}</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Where the amount comes from (milk collections)</h4>
              {payslipDetail.earnings.length === 0 ? (
                <p className="text-sm text-gray-500">No collections in this period.</p>
              ) : (
                <div className="border border-gray-200 rounded-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium text-gray-700">Date</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-700">Quantity (L)</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-700">Unit price</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-700">Amount</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-700">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {payslipDetail.earnings.map((e) => (
                        <tr key={e.id}>
                          <td className="py-2 px-3 text-gray-900">{formatDate(e.date)}</td>
                          <td className="py-2 px-3 text-right text-gray-600">{Number(e.quantity).toLocaleString()}</td>
                          <td className="py-2 px-3 text-right text-gray-600">{formatAmount(e.unit_price)}</td>
                          <td className="py-2 px-3 text-right font-medium text-gray-900">{formatAmount(e.amount)}</td>
                          <td className="py-2 px-3 text-gray-500 text-xs">{e.notes ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Deductions (why amounts were charged)</h4>
              {payslipDetail.deductions.length === 0 ? (
                <p className="text-sm text-gray-500">No deductions.</p>
              ) : (
                <div className="border border-gray-200 rounded-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium text-gray-700">Reason / Type</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-700">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {payslipDetail.deductions.map((d) => (
                        <tr key={d.id}>
                          <td className="py-2 px-3 text-gray-900">{d.reason}</td>
                          <td className="py-2 px-3 text-right font-medium text-red-600">{formatAmount(d.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!runIdToConfirm}
        onClose={() => !markingId && setRunIdToConfirm(null)}
        onConfirm={handleConfirmMarkPaid}
        title="Mark as paid?"
        message="This will create an expense transaction in finance."
        confirmText="Mark as paid"
        cancelText="Cancel"
        type="info"
        showIcon
        loading={markingId === runIdToConfirm}
      />
    </div>
  );
}
