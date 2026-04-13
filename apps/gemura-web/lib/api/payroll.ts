import { apiClient } from './client';

export interface GeneratePayrollParams {
  supplier_account_codes: string[];
  period_start: string; // YYYY-MM-DD
  period_end: string;   // YYYY-MM-DD
  payment_terms_days?: number;
  run_name?: string;    // Optional custom name for the payroll run
  account_id?: string;  // Account to generate for (defaults to user's default if not set)
}

export interface GeneratePayrollResult {
  run_id: string;
  period_start: string;
  period_end: string;
  suppliers_processed: number;
  total_amount: number;
  payslips: Array<{
    id?: string;
    supplier?: string;
    supplier_code?: string;
    milk_sales_count?: number;
    total_liters?: number;
    bank_name?: string;
    bank_account_number?: string;
    net_amount?: number;
    gross_amount?: number;
    deductions?: number;
    status?: string;
  }>;
}

export interface PayrollRun {
  id: string;
  period_name?: string;
  run_date: string;
  period_start: string | null;
  period_end: string | null;
  payment_terms_days?: number | null;
  total_amount: number;
  status: string;
  payslips_count: number;
  payslips: Array<{
    id: string;
    supplier?: string;
    supplier_code?: string;
    milk_sales_count?: number;
    total_liters?: number;
    bank_name?: string;
    bank_account_number?: string;
    gross_amount?: number;
    total_deductions?: number;
    net_amount?: number;
    status?: string;
  }>;
}

export interface PayslipDetail {
  id: string;
  supplier: string;
  supplier_code?: string;
  gross_amount: number;
  total_deductions: number;
  net_amount: number;
  milk_sales_count: number;
  total_liters?: number;
  bank_name?: string;
  bank_account_number?: string;
  period_start: string;
  period_end: string;
  status: string;
  earnings: Array<{
    id: string;
    date: string;
    quantity: number;
    unit_price: number;
    amount: number;
    notes?: string;
  }>;
  deductions: Array<{
    id: string;
    type: string;
    amount: number;
    reason: string;
  }>;
}

export interface PayrollRunsResponse {
  code: number;
  status: string;
  message: string;
  data: PayrollRun[];
}

export interface GeneratePayrollResponse {
  code: number;
  status: string;
  message: string;
  data: GeneratePayrollResult;
}

export const payrollApi = {
  generatePayroll: async (params: GeneratePayrollParams): Promise<GeneratePayrollResponse> => {
    return apiClient.post('/payroll/runs/generate', {
      supplier_account_codes: params.supplier_account_codes,
      period_start: params.period_start,
      period_end: params.period_end,
      ...(params.payment_terms_days != null && { payment_terms_days: params.payment_terms_days }),
      ...(params.run_name != null && params.run_name.trim() !== '' && { run_name: params.run_name.trim() }),
      ...(params.account_id != null && params.account_id !== '' && { account_id: params.account_id }),
    });
  },

  getPayrollRuns: async (params?: { period_id?: string; account_id?: string }): Promise<PayrollRunsResponse> => {
    const search = new URLSearchParams();
    if (params?.period_id) search.append('period_id', params.period_id);
    if (params?.account_id) search.append('account_id', params.account_id);
    const q = search.toString();
    return apiClient.get(`/payroll/runs${q ? `?${q}` : ''}`);
  },

  getPayslipDetail: async (
    runId: string,
    payslipId: string,
    accountId?: string
  ): Promise<{ code: number; data: PayslipDetail }> => {
    const params = accountId ? `?account_id=${encodeURIComponent(accountId)}` : '';
    return apiClient.get(`/payroll/runs/${runId}/payslips/${payslipId}${params}`);
  },

  markPayrollAsPaid: async (
    runId: string,
    options?: { payment_date?: string; payslip_id?: string }
  ): Promise<{ code: number; status: string; message: string; data?: unknown }> => {
    return apiClient.post(`/payroll/runs/${runId}/mark-paid`, {
      ...(options?.payment_date && { payment_date: options.payment_date }),
      ...(options?.payslip_id && { payslip_id: options.payslip_id }),
    });
  },

  /** Export payroll run as Excel or PDF. Triggers browser download. */
  exportPayroll: async (runId: string, format: 'excel' | 'pdf'): Promise<void> => {
    const blob = await apiClient.get<Blob>(`/payroll/runs/${runId}/export?format=${format}`, {
      responseType: 'blob',
    });
    const ext = format === 'pdf' ? 'pdf' : 'xlsx';
    const filename = `payroll_${runId.slice(0, 8)}_${Date.now()}.${ext}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
