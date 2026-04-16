import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { BaseAnalyticsService, AnalyticsContext } from './base-analytics.service';

export interface FinancialSummary {
  total_revenue: number;
  total_expenses: number;
  net_income: number;
  accounts_receivable: number;
  accounts_payable: number;
  cash_balance: number;
  milk_sales_revenue: number;
  milk_collections_expense: number;
  inventory_sales_revenue: number;
  loan_disbursements: number;
  loan_repayments: number;
  payroll_disbursements: number;
}

export interface FinancialBreakdown {
  date: string;
  revenue: number;
  expenses: number;
  net_income: number;
  receivables: number;
  payables: number;
}

export interface FinancialGrowth {
  revenue_change_percent: number;
  expenses_change_percent: number;
  net_income_change_percent: number;
  period: string;
}

export interface PayablesDetail {
  supplier_id: string;
  supplier_code: string;
  supplier_name: string;
  total_amount_due: number;
  amount_paid: number;
  outstanding_amount: number;
  oldest_unpaid_date: string | null;
  transaction_count: number;
}

export interface ReceivablesDetail {
  customer_id: string;
  customer_code: string;
  customer_name: string;
  total_amount_due: number;
  amount_received: number;
  outstanding_amount: number;
  oldest_unpaid_date: string | null;
  transaction_count: number;
}

@Injectable()
export class FinancialAnalyticsService extends BaseAnalyticsService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Get financial summary for the specified period
   */
  async getSummary(context: AnalyticsContext): Promise<FinancialSummary> {
    // For financial, we need to look at both supplier and customer perspectives
    const collectionsAccountFilter = this.buildAccountFilter(context, 'customer_account_id');
    const salesAccountFilter = this.buildAccountFilter(context, 'supplier_account_id');

    const dateFilter = {
      sale_at: {
        gte: context.startDate,
        lte: context.endDate,
      },
      status: { not: 'deleted' as const },
    };

    // Get milk collections (expense - where account is customer buying from suppliers)
    const [collectionsData, salesData, inventorySalesData, loanData, payrollData] = await Promise.all([
      // Collections expense
      context.accountIds.length > 0
        ? this.prisma.$queryRaw<{ total_value: number; amount_paid: number }[]>`
            SELECT 
              COALESCE(SUM(quantity * unit_price), 0) as total_value,
              COALESCE(SUM(amount_paid), 0) as amount_paid
            FROM milk_sales
            WHERE customer_account_id = ANY(${context.accountIds}::uuid[])
              AND sale_at >= ${context.startDate}
              AND sale_at <= ${context.endDate}
              AND status != 'deleted'
          `
        : this.prisma.$queryRaw<{ total_value: number; amount_paid: number }[]>`
            SELECT 
              COALESCE(SUM(quantity * unit_price), 0) as total_value,
              COALESCE(SUM(amount_paid), 0) as amount_paid
            FROM milk_sales
            WHERE sale_at >= ${context.startDate}
              AND sale_at <= ${context.endDate}
              AND status != 'deleted'
          `,

      // Sales revenue
      context.accountIds.length > 0
        ? this.prisma.$queryRaw<{ total_value: number; amount_paid: number }[]>`
            SELECT 
              COALESCE(SUM(quantity * unit_price), 0) as total_value,
              COALESCE(SUM(amount_paid), 0) as amount_paid
            FROM milk_sales
            WHERE supplier_account_id = ANY(${context.accountIds}::uuid[])
              AND sale_at >= ${context.startDate}
              AND sale_at <= ${context.endDate}
              AND status != 'deleted'
          `
        : this.prisma.$queryRaw<{ total_value: number; amount_paid: number }[]>`
            SELECT 
              COALESCE(SUM(quantity * unit_price), 0) as total_value,
              COALESCE(SUM(amount_paid), 0) as amount_paid
            FROM milk_sales
            WHERE sale_at >= ${context.startDate}
              AND sale_at <= ${context.endDate}
              AND status != 'deleted'
          `,

      // Inventory sales revenue
      this.prisma.inventorySale.aggregate({
        where: {
          product: {
            account_id: context.accountIds.length > 0 ? { in: context.accountIds } : undefined,
          },
          created_at: {
            gte: context.startDate,
            lte: context.endDate,
          },
        },
        _sum: {
          total_amount: true,
        },
      }),

      // Loan data
      this.prisma.loan.aggregate({
        where: {
          lender_account_id: context.accountIds.length > 0 ? { in: context.accountIds } : undefined,
          disbursement_date: {
            gte: context.startDate,
            lte: context.endDate,
          },
        },
        _sum: {
          principal: true,
          amount_repaid: true,
        },
      }),

      // Payroll data
      this.prisma.payrollRun.aggregate({
        where: {
          account_id: context.accountIds.length > 0 ? { in: context.accountIds } : undefined,
          run_date: {
            gte: context.startDate,
            lte: context.endDate,
          },
          status: 'processed',
        },
        _sum: {
          total_amount: true,
        },
      }),
    ]);

    const milkCollectionsExpense = this.formatDecimal(collectionsData[0]?.total_value || 0);
    const milkSalesRevenue = this.formatDecimal(salesData[0]?.total_value || 0);
    const inventorySalesRevenue = this.formatDecimal(inventorySalesData._sum.total_amount);
    const loanDisbursements = this.formatDecimal(loanData._sum.principal);
    const loanRepayments = this.formatDecimal(loanData._sum.amount_repaid);
    const payrollDisbursements = this.formatDecimal(payrollData._sum.total_amount);

    const collectionsAmountPaid = this.formatDecimal(collectionsData[0]?.amount_paid || 0);
    const salesAmountPaid = this.formatDecimal(salesData[0]?.amount_paid || 0);

    const accountsPayable = milkCollectionsExpense - collectionsAmountPaid;
    const accountsReceivable = milkSalesRevenue - salesAmountPaid;

    const totalRevenue = milkSalesRevenue + inventorySalesRevenue + loanRepayments;
    const totalExpenses = milkCollectionsExpense + payrollDisbursements + loanDisbursements;
    const netIncome = totalRevenue - totalExpenses;

    return {
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      net_income: netIncome,
      accounts_receivable: accountsReceivable,
      accounts_payable: accountsPayable,
      cash_balance: salesAmountPaid - collectionsAmountPaid - payrollDisbursements,
      milk_sales_revenue: milkSalesRevenue,
      milk_collections_expense: milkCollectionsExpense,
      inventory_sales_revenue: inventorySalesRevenue,
      loan_disbursements: loanDisbursements,
      loan_repayments: loanRepayments,
      payroll_disbursements: payrollDisbursements,
    };
  }

  /**
   * Get financial breakdown by time period
   */
  async getBreakdown(context: AnalyticsContext): Promise<FinancialBreakdown[]> {
    const dateGroupExpr = this.getDateGroupExpression('sale_at', context.groupBy);

    // Revenue (sales where account is supplier)
    const revenueQuery = `
      SELECT 
        ${dateGroupExpr} as period_date,
        COALESCE(SUM(quantity * unit_price), 0) as total_value,
        COALESCE(SUM(amount_paid), 0) as amount_paid
      FROM milk_sales
      WHERE supplier_account_id = ANY($1::uuid[])
        AND sale_at >= $2
        AND sale_at <= $3
        AND status != 'deleted'
      GROUP BY ${dateGroupExpr}
      ORDER BY period_date ASC
    `;

    const revenueQueryAllAccounts = `
      SELECT 
        ${dateGroupExpr} as period_date,
        COALESCE(SUM(quantity * unit_price), 0) as total_value,
        COALESCE(SUM(amount_paid), 0) as amount_paid
      FROM milk_sales
      WHERE sale_at >= $1
        AND sale_at <= $2
        AND status != 'deleted'
      GROUP BY ${dateGroupExpr}
      ORDER BY period_date ASC
    `;

    // Expenses (collections where account is customer)
    const expenseQuery = `
      SELECT 
        ${dateGroupExpr} as period_date,
        COALESCE(SUM(quantity * unit_price), 0) as total_value,
        COALESCE(SUM(amount_paid), 0) as amount_paid
      FROM milk_sales
      WHERE customer_account_id = ANY($1::uuid[])
        AND sale_at >= $2
        AND sale_at <= $3
        AND status != 'deleted'
      GROUP BY ${dateGroupExpr}
      ORDER BY period_date ASC
    `;

    const expenseQueryAllAccounts = `
      SELECT 
        ${dateGroupExpr} as period_date,
        COALESCE(SUM(quantity * unit_price), 0) as total_value,
        COALESCE(SUM(amount_paid), 0) as amount_paid
      FROM milk_sales
      WHERE sale_at >= $1
        AND sale_at <= $2
        AND status != 'deleted'
      GROUP BY ${dateGroupExpr}
      ORDER BY period_date ASC
    `;

    const [revenueResults, expenseResults] =
      context.accountIds.length > 0
        ? await Promise.all([
            this.prisma.$queryRawUnsafe<any[]>(
              revenueQuery,
              context.accountIds,
              context.startDate,
              context.endDate,
            ),
            this.prisma.$queryRawUnsafe<any[]>(
              expenseQuery,
              context.accountIds,
              context.startDate,
              context.endDate,
            ),
          ])
        : await Promise.all([
            this.prisma.$queryRawUnsafe<any[]>(
              revenueQueryAllAccounts,
              context.startDate,
              context.endDate,
            ),
            this.prisma.$queryRawUnsafe<any[]>(
              expenseQueryAllAccounts,
              context.startDate,
              context.endDate,
            ),
          ]);

    // Merge results
    const resultMap = new Map<string, FinancialBreakdown>();

    for (const row of revenueResults) {
      const dateKey = row.period_date instanceof Date 
        ? row.period_date.toISOString().split('T')[0] 
        : String(row.period_date);
      const revenue = this.formatDecimal(row.total_value);
      const receivables = revenue - this.formatDecimal(row.amount_paid);
      
      resultMap.set(dateKey, {
        date: dateKey,
        revenue,
        expenses: 0,
        net_income: revenue,
        receivables,
        payables: 0,
      });
    }

    for (const row of expenseResults) {
      const dateKey = row.period_date instanceof Date 
        ? row.period_date.toISOString().split('T')[0] 
        : String(row.period_date);
      const expenses = this.formatDecimal(row.total_value);
      const payables = expenses - this.formatDecimal(row.amount_paid);
      
      const existing = resultMap.get(dateKey);
      if (existing) {
        existing.expenses = expenses;
        existing.net_income = existing.revenue - expenses;
        existing.payables = payables;
      } else {
        resultMap.set(dateKey, {
          date: dateKey,
          revenue: 0,
          expenses,
          net_income: -expenses,
          receivables: 0,
          payables,
        });
      }
    }

    return Array.from(resultMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get growth metrics compared to previous period
   */
  async getGrowth(context: AnalyticsContext): Promise<FinancialGrowth> {
    const previousPeriod = this.getPreviousPeriodDates(context.startDate, context.endDate);

    const [currentSummary, previousSummary] = await Promise.all([
      this.getSummary(context),
      this.getSummary({
        ...context,
        startDate: previousPeriod.start,
        endDate: previousPeriod.end,
      }),
    ]);

    return {
      revenue_change_percent: this.calculatePercentageChange(
        currentSummary.total_revenue,
        previousSummary.total_revenue,
      ),
      expenses_change_percent: this.calculatePercentageChange(
        currentSummary.total_expenses,
        previousSummary.total_expenses,
      ),
      net_income_change_percent: this.calculatePercentageChange(
        currentSummary.net_income,
        previousSummary.net_income,
      ),
      period: 'period_over_period',
    };
  }

  /**
   * Get accounts payable details (amounts owed to suppliers)
   */
  async getPayablesDetails(context: AnalyticsContext): Promise<PayablesDetail[]> {
    const payables =
      context.accountIds.length > 0
        ? await this.prisma.$queryRaw<any[]>`
            SELECT 
              ms.supplier_account_id,
              a.code as supplier_code,
              a.name as supplier_name,
              COALESCE(SUM(ms.quantity * ms.unit_price), 0) as total_amount_due,
              COALESCE(SUM(ms.amount_paid), 0) as amount_paid,
              COALESCE(SUM(ms.quantity * ms.unit_price) - SUM(ms.amount_paid), 0) as outstanding_amount,
              MIN(CASE WHEN ms.payment_status != 'paid' THEN ms.sale_at END) as oldest_unpaid_date,
              COUNT(*) as transaction_count
            FROM milk_sales ms
            JOIN accounts a ON a.id = ms.supplier_account_id
            WHERE ms.customer_account_id = ANY(${context.accountIds}::uuid[])
              AND ms.status NOT IN ('deleted', 'cancelled')
            GROUP BY ms.supplier_account_id, a.code, a.name
            HAVING SUM(ms.quantity * ms.unit_price) - SUM(ms.amount_paid) > 0
            ORDER BY outstanding_amount DESC
            LIMIT ${context.limit}
            OFFSET ${(context.page - 1) * context.limit}
          `
        : await this.prisma.$queryRaw<any[]>`
            SELECT 
              ms.supplier_account_id,
              a.code as supplier_code,
              a.name as supplier_name,
              COALESCE(SUM(ms.quantity * ms.unit_price), 0) as total_amount_due,
              COALESCE(SUM(ms.amount_paid), 0) as amount_paid,
              COALESCE(SUM(ms.quantity * ms.unit_price) - SUM(ms.amount_paid), 0) as outstanding_amount,
              MIN(CASE WHEN ms.payment_status != 'paid' THEN ms.sale_at END) as oldest_unpaid_date,
              COUNT(*) as transaction_count
            FROM milk_sales ms
            JOIN accounts a ON a.id = ms.supplier_account_id
            WHERE ms.status NOT IN ('deleted', 'cancelled')
            GROUP BY ms.supplier_account_id, a.code, a.name
            HAVING SUM(ms.quantity * ms.unit_price) - SUM(ms.amount_paid) > 0
            ORDER BY outstanding_amount DESC
            LIMIT ${context.limit}
            OFFSET ${(context.page - 1) * context.limit}
          `;

    return payables.map((p) => ({
      supplier_id: p.supplier_account_id,
      supplier_code: p.supplier_code || '',
      supplier_name: p.supplier_name,
      total_amount_due: this.formatDecimal(p.total_amount_due),
      amount_paid: this.formatDecimal(p.amount_paid),
      outstanding_amount: this.formatDecimal(p.outstanding_amount),
      oldest_unpaid_date: p.oldest_unpaid_date?.toISOString().split('T')[0] || null,
      transaction_count: Number(p.transaction_count),
    }));
  }

  /**
   * Get accounts receivable details (amounts owed by customers)
   */
  async getReceivablesDetails(context: AnalyticsContext): Promise<ReceivablesDetail[]> {
    const receivables =
      context.accountIds.length > 0
        ? await this.prisma.$queryRaw<any[]>`
            SELECT 
              ms.customer_account_id,
              a.code as customer_code,
              a.name as customer_name,
              COALESCE(SUM(ms.quantity * ms.unit_price), 0) as total_amount_due,
              COALESCE(SUM(ms.amount_paid), 0) as amount_received,
              COALESCE(SUM(ms.quantity * ms.unit_price) - SUM(ms.amount_paid), 0) as outstanding_amount,
              MIN(CASE WHEN ms.payment_status != 'paid' THEN ms.sale_at END) as oldest_unpaid_date,
              COUNT(*) as transaction_count
            FROM milk_sales ms
            JOIN accounts a ON a.id = ms.customer_account_id
            WHERE ms.supplier_account_id = ANY(${context.accountIds}::uuid[])
              AND ms.status NOT IN ('deleted', 'cancelled')
            GROUP BY ms.customer_account_id, a.code, a.name
            HAVING SUM(ms.quantity * ms.unit_price) - SUM(ms.amount_paid) > 0
            ORDER BY outstanding_amount DESC
            LIMIT ${context.limit}
            OFFSET ${(context.page - 1) * context.limit}
          `
        : await this.prisma.$queryRaw<any[]>`
            SELECT 
              ms.customer_account_id,
              a.code as customer_code,
              a.name as customer_name,
              COALESCE(SUM(ms.quantity * ms.unit_price), 0) as total_amount_due,
              COALESCE(SUM(ms.amount_paid), 0) as amount_received,
              COALESCE(SUM(ms.quantity * ms.unit_price) - SUM(ms.amount_paid), 0) as outstanding_amount,
              MIN(CASE WHEN ms.payment_status != 'paid' THEN ms.sale_at END) as oldest_unpaid_date,
              COUNT(*) as transaction_count
            FROM milk_sales ms
            JOIN accounts a ON a.id = ms.customer_account_id
            WHERE ms.status NOT IN ('deleted', 'cancelled')
            GROUP BY ms.customer_account_id, a.code, a.name
            HAVING SUM(ms.quantity * ms.unit_price) - SUM(ms.amount_paid) > 0
            ORDER BY outstanding_amount DESC
            LIMIT ${context.limit}
            OFFSET ${(context.page - 1) * context.limit}
          `;

    return receivables.map((r) => ({
      customer_id: r.customer_account_id,
      customer_code: r.customer_code || '',
      customer_name: r.customer_name,
      total_amount_due: this.formatDecimal(r.total_amount_due),
      amount_received: this.formatDecimal(r.amount_received),
      outstanding_amount: this.formatDecimal(r.outstanding_amount),
      oldest_unpaid_date: r.oldest_unpaid_date?.toISOString().split('T')[0] || null,
      transaction_count: Number(r.transaction_count),
    }));
  }
}
