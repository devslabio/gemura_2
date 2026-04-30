import { apiClient } from './client';

/** Income statement (revenue, expenses, net income) for a date range */
export interface IncomeStatement {
  from_date: string;
  to_date: string;
  revenue: number;
  expenses: number;
  net_income: number;
}

/** One point in revenue/expenses over time */
export interface RevenueExpensesOverTimePoint {
  date: string;
  revenue: number;
  expenses: number;
}

/** One category in expense-by-category */
export interface ExpenseByCategoryPoint {
  category_name: string;
  amount: number;
}

/** Single revenue/expense transaction */
export interface AccountingTransaction {
  id: string;
  type: 'revenue' | 'expense';
  amount: number;
  description: string;
  transaction_date: string;
  category_account?: string;
  dairy_share_pct?: number;
  cost_tags?: string[];
}

export interface CreateTransactionData {
  type: 'revenue' | 'expense';
  amount: number;
  description: string;
  transaction_date: string; // YYYY-MM-DD
  account_id?: string;
  dairy_share_pct?: number;
  cost_tags?: string[];
}

export interface ExpenseCategoryAccount {
  id: string;
  code: string;
  name: string;
}

/** Customer/Supplier info in receivables/payables */
export interface CustomerInfo {
  id: string;
  code: string;
  name: string;
}

export interface SupplierInfo {
  id: string;
  code: string;
  name: string;
}

/** One receivable (unpaid/partial milk or inventory sale) */
export interface Receivable {
  sale_id: string;
  source?: string; // 'milk_sale' | 'inventory_sale' | 'loan'
  customer: CustomerInfo;
  sale_date: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  amount_paid: number;
  outstanding: number;
  payment_status: string;
  days_outstanding: number;
  aging_bucket: string;
  notes?: string;
}

export interface AgingSummary {
  current: number;
  days_31_60: number;
  days_61_90: number;
  days_90_plus: number;
}

export interface CustomerReceivables {
  customer: CustomerInfo;
  total_outstanding: number;
  invoice_count: number;
  invoices: Receivable[];
}

export interface ReceivablesSummary {
  total_receivables: number;
  total_invoices: number;
  by_customer: CustomerReceivables[];
  aging_summary: AgingSummary;
  all_receivables: Receivable[];
}

/** One payable (unpaid/partial collection) */
export interface Payable {
  collection_id: string;
  supplier: SupplierInfo;
  collection_date: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  amount_paid: number;
  outstanding: number;
  payment_status: string;
  days_outstanding: number;
  aging_bucket: string;
  notes?: string;
}

export interface SupplierPayables {
  supplier: SupplierInfo;
  total_outstanding: number;
  invoice_count: number;
  invoices: Payable[];
}

export interface PayablesSummary {
  total_payables: number;
  total_invoices: number;
  by_supplier: SupplierPayables[];
  aging_summary: AgingSummary;
  all_payables: Payable[];
}

export interface GetTransactionsParams {
  type?: 'revenue' | 'expense';
  date_from?: string;
  date_to?: string;
  limit?: number;
}

export interface GetReceivablesParams {
  customer_account_id?: string;
  date_from?: string;
  date_to?: string;
  payment_status?: string;
}

export interface GetPayablesParams {
  supplier_account_id?: string;
  date_from?: string;
  date_to?: string;
  payment_status?: string;
}

function unwrap<T>(res: unknown): T {
  const r = res as { code: number; data?: T; message?: string };
  if (r.code === 200 && r.data !== undefined) return r.data as T;
  throw new Error(r.message || 'Request failed');
}

export const accountingApi = {
  getIncomeStatement: async (fromDate: string, toDate: string): Promise<IncomeStatement> => {
    const res = await apiClient.get('/accounting/reports/income-statement', {
      params: { from_date: fromDate, to_date: toDate },
    });
    return unwrap<IncomeStatement>(res);
  },

  getTransactions: async (params?: GetTransactionsParams): Promise<AccountingTransaction[]> => {
    const q: Record<string, string | number> = {};
    if (params?.type) q.type = params.type;
    if (params?.date_from) q.date_from = params.date_from;
    if (params?.date_to) q.date_to = params.date_to;
    if (params?.limit != null) q.limit = params.limit;
    const res = await apiClient.get('/accounting/transactions', { params: q });
    return unwrap<AccountingTransaction[]>(res);
  },

  createTransaction: async (data: CreateTransactionData): Promise<AccountingTransaction> => {
    const res = await apiClient.post('/accounting/transactions', data);
    return unwrap<AccountingTransaction>(res);
  },

  getExpenseAccounts: async (ensureDefaults = true): Promise<ExpenseCategoryAccount[]> => {
    const res = await apiClient.get('/accounting/transactions/expense-accounts/list', {
      params: { ensure_defaults: ensureDefaults ? 'true' : 'false' },
    });
    return unwrap<ExpenseCategoryAccount[]>(res);
  },

  getTransactionById: async (id: string): Promise<AccountingTransaction> => {
    const res = await apiClient.get(`/accounting/transactions/${id}`);
    return unwrap<AccountingTransaction>(res);
  },

  getReceivables: async (params?: GetReceivablesParams): Promise<ReceivablesSummary> => {
    const q: Record<string, string> = {};
    if (params?.customer_account_id) q.customer_account_id = params.customer_account_id;
    if (params?.date_from) q.date_from = params.date_from;
    if (params?.date_to) q.date_to = params.date_to;
    if (params?.payment_status) q.payment_status = params.payment_status;
    const res = await apiClient.get('/accounting/receivables', { params: q });
    return unwrap<ReceivablesSummary>(res);
  },

  getPayables: async (params?: GetPayablesParams): Promise<PayablesSummary> => {
    const q: Record<string, string> = {};
    if (params?.supplier_account_id) q.supplier_account_id = params.supplier_account_id;
    if (params?.date_from) q.date_from = params.date_from;
    if (params?.date_to) q.date_to = params.date_to;
    if (params?.payment_status) q.payment_status = params.payment_status;
    const res = await apiClient.get('/accounting/payables', { params: q });
    return unwrap<PayablesSummary>(res);
  },

  getRevenueExpensesOverTime: async (
    fromDate: string,
    toDate: string
  ): Promise<{ series: RevenueExpensesOverTimePoint[] }> => {
    const res = await apiClient.get('/accounting/reports/revenue-expenses-over-time', {
      params: { from_date: fromDate, to_date: toDate },
    });
    return unwrap<{ series: RevenueExpensesOverTimePoint[] }>(res);
  },

  getExpenseByCategory: async (
    fromDate: string,
    toDate: string
  ): Promise<{ series: ExpenseByCategoryPoint[] }> => {
    const res = await apiClient.get('/accounting/reports/expense-by-category', {
      params: { from_date: fromDate, to_date: toDate },
    });
    return unwrap<{ series: ExpenseByCategoryPoint[] }>(res);
  },

  /** Record payment for an inventory sale receivable. */
  recordInventoryReceivablePayment: async (
    inventorySaleId: string,
    data: { amount: number; payment_date?: string; notes?: string }
  ): Promise<unknown> => {
    const res = await apiClient.post(`/accounting/receivables/inventory/${inventorySaleId}/payment`, data);
    return unwrap(res);
  },
};
