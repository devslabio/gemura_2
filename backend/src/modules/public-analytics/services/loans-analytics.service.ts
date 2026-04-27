import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { BaseAnalyticsService, AnalyticsContext } from './base-analytics.service';

export interface LoansSummary {
  total_loans: number;
  active_loans: number;
  completed_loans: number;
  defaulted_loans: number;
  total_principal: number;
  total_disbursed: number;
  total_repaid: number;
  outstanding_balance: number;
  repayment_rate: number;
  average_loan_amount: number;
}

export interface LoansBreakdown {
  date: string;
  new_loans: number;
  disbursed_amount: number;
  repaid_amount: number;
  completed_loans: number;
}

export interface LoansGrowth {
  loan_count_change_percent: number;
  disbursement_change_percent: number;
  repayment_change_percent: number;
  period: string;
}

export interface LoanDetail {
  loan_id: string;
  borrower_id: string;
  borrower_code: string;
  borrower_name: string;
  borrower_type: string;
  principal: number;
  amount_repaid: number;
  outstanding: number;
  status: string;
  disbursed_at: string | null;
  due_date: string | null;
  repayment_count: number;
  last_repayment_date: string | null;
}

export interface BorrowerPerformance {
  borrower_id: string;
  borrower_code: string;
  borrower_name: string;
  total_loans: number;
  total_principal: number;
  total_repaid: number;
  outstanding: number;
  completed_loans: number;
  active_loans: number;
  repayment_rate: number;
}

@Injectable()
export class LoansAnalyticsService extends BaseAnalyticsService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Get loans summary for the specified period
   */
  async getSummary(context: AnalyticsContext): Promise<LoansSummary> {
    const accountFilter = this.buildAccountFilter(context, 'lender_account_id');

    const [loanStats, statusCounts, repaymentStats] = await Promise.all([
      this.prisma.loan.aggregate({
        where: accountFilter,
        _count: {
          id: true,
        },
        _sum: {
          principal: true,
          amount_repaid: true,
        },
        _avg: {
          principal: true,
        },
      }),
      this.prisma.loan.groupBy({
        by: ['status'],
        where: accountFilter,
        _count: {
          id: true,
        },
      }),
      this.prisma.loanRepayment.aggregate({
        where: {
          loan: accountFilter,
          repayment_date: {
            gte: context.startDate,
            lte: context.endDate,
          },
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

    // Get disbursed amount in period
    const disbursedInPeriod = await this.prisma.loan.aggregate({
      where: {
        ...accountFilter,
        disbursement_date: {
          gte: context.startDate,
          lte: context.endDate,
        },
      },
      _sum: {
        principal: true,
      },
    });

    const statusMap = new Map(statusCounts.map((s) => [s.status, s._count.id]));
    const totalPrincipal = this.formatDecimal(loanStats._sum.principal);
    const totalRepaid = this.formatDecimal(loanStats._sum.amount_repaid);
    const outstanding = totalPrincipal - totalRepaid;

    return {
      total_loans: loanStats._count.id || 0,
      active_loans: statusMap.get('active') || 0,
      completed_loans: statusMap.get('completed') || statusMap.get('repaid') || 0,
      defaulted_loans: statusMap.get('defaulted') || 0,
      total_principal: totalPrincipal,
      total_disbursed: this.formatDecimal(disbursedInPeriod._sum.principal),
      total_repaid: totalRepaid,
      outstanding_balance: outstanding,
      repayment_rate: totalPrincipal > 0 ? Number(((totalRepaid / totalPrincipal) * 100).toFixed(2)) : 0,
      average_loan_amount: this.formatDecimal(loanStats._avg.principal),
    };
  }

  /**
   * Get loans breakdown by time period
   */
  async getBreakdown(context: AnalyticsContext): Promise<LoansBreakdown[]> {
    const disbursedDateGroupExpr = this.getDateGroupExpression('disbursement_date', context.groupBy);
    const repaymentDateGroupExpr = this.getDateGroupExpression('repayment_date', context.groupBy);

    // Loans disbursed per period
    const loansQuery = `
      SELECT 
        ${disbursedDateGroupExpr} as period_date,
        COUNT(*) as new_loans,
        COALESCE(SUM(principal), 0) as disbursed_amount
      FROM loans
      WHERE lender_account_id = ANY($1::uuid[])
        AND disbursement_date >= $2
        AND disbursement_date <= $3
      GROUP BY ${disbursedDateGroupExpr}
      ORDER BY period_date ASC
    `;

    const loansQueryAllAccounts = `
      SELECT 
        ${disbursedDateGroupExpr} as period_date,
        COUNT(*) as new_loans,
        COALESCE(SUM(principal), 0) as disbursed_amount
      FROM loans
      WHERE disbursement_date >= $1
        AND disbursement_date <= $2
      GROUP BY ${disbursedDateGroupExpr}
      ORDER BY period_date ASC
    `;

    // Repayments per period
    const repaymentsQuery = `
      SELECT 
        ${repaymentDateGroupExpr} as period_date,
        COALESCE(SUM(lr.amount), 0) as repaid_amount
      FROM loan_repayments lr
      JOIN loans l ON l.id = lr.loan_id
      WHERE l.lender_account_id = ANY($1::uuid[])
        AND lr.repayment_date >= $2
        AND lr.repayment_date <= $3
      GROUP BY ${repaymentDateGroupExpr}
      ORDER BY period_date ASC
    `;

    const repaymentsQueryAllAccounts = `
      SELECT 
        ${repaymentDateGroupExpr} as period_date,
        COALESCE(SUM(lr.amount), 0) as repaid_amount
      FROM loan_repayments lr
      JOIN loans l ON l.id = lr.loan_id
      WHERE lr.repayment_date >= $1
        AND lr.repayment_date <= $2
      GROUP BY ${repaymentDateGroupExpr}
      ORDER BY period_date ASC
    `;

    const [loansResults, repaymentsResults] =
      context.accountIds.length > 0
        ? await Promise.all([
            this.prisma.$queryRawUnsafe<any[]>(
              loansQuery,
              context.accountIds,
              context.startDate,
              context.endDate,
            ),
            this.prisma.$queryRawUnsafe<any[]>(
              repaymentsQuery,
              context.accountIds,
              context.startDate,
              context.endDate,
            ),
          ])
        : await Promise.all([
            this.prisma.$queryRawUnsafe<any[]>(
              loansQueryAllAccounts,
              context.startDate,
              context.endDate,
            ),
            this.prisma.$queryRawUnsafe<any[]>(
              repaymentsQueryAllAccounts,
              context.startDate,
              context.endDate,
            ),
          ]);

    // Merge results
    const resultMap = new Map<string, LoansBreakdown>();

    for (const row of loansResults) {
      const dateKey = row.period_date instanceof Date 
        ? row.period_date.toISOString().split('T')[0] 
        : String(row.period_date);
      resultMap.set(dateKey, {
        date: dateKey,
        new_loans: Number(row.new_loans),
        disbursed_amount: this.formatDecimal(row.disbursed_amount),
        repaid_amount: 0,
        completed_loans: 0,
      });
    }

    for (const row of repaymentsResults) {
      const dateKey = row.period_date instanceof Date 
        ? row.period_date.toISOString().split('T')[0] 
        : String(row.period_date);
      const existing = resultMap.get(dateKey);
      if (existing) {
        existing.repaid_amount = this.formatDecimal(row.repaid_amount);
      } else {
        resultMap.set(dateKey, {
          date: dateKey,
          new_loans: 0,
          disbursed_amount: 0,
          repaid_amount: this.formatDecimal(row.repaid_amount),
          completed_loans: 0,
        });
      }
    }

    return Array.from(resultMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get growth metrics compared to previous period
   */
  async getGrowth(context: AnalyticsContext): Promise<LoansGrowth> {
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
      loan_count_change_percent: this.calculatePercentageChange(
        currentSummary.total_loans,
        previousSummary.total_loans,
      ),
      disbursement_change_percent: this.calculatePercentageChange(
        currentSummary.total_disbursed,
        previousSummary.total_disbursed,
      ),
      repayment_change_percent: this.calculatePercentageChange(
        currentSummary.total_repaid,
        previousSummary.total_repaid,
      ),
      period: 'period_over_period',
    };
  }

  /**
   * Get loan details list
   */
  async getLoanList(context: AnalyticsContext): Promise<LoanDetail[]> {
    const accountFilter = this.buildAccountFilter(context, 'lender_account_id');

    const loans = await this.prisma.loan.findMany({
      where: accountFilter,
      include: {
        borrower_account: {
          select: { id: true, code: true, name: true },
        },
        repayments: {
          orderBy: { repayment_date: 'desc' },
          take: 1,
        },
        _count: {
          select: { repayments: true },
        },
      },
      orderBy: { created_at: 'desc' },
      take: context.limit,
      skip: (context.page - 1) * context.limit,
    });

    return loans.map((loan) => ({
      loan_id: loan.id,
      borrower_id: loan.borrower_account_id || '',
      borrower_code: loan.borrower_account?.code || '',
      borrower_name: loan.borrower_account?.name || 'Unknown',
      borrower_type: loan.borrower_type,
      principal: this.formatDecimal(loan.principal),
      amount_repaid: this.formatDecimal(loan.amount_repaid),
      outstanding: this.formatDecimal(loan.principal) - this.formatDecimal(loan.amount_repaid),
      status: loan.status,
      disbursed_at: loan.disbursement_date?.toISOString().split('T')[0] || null,
      due_date: loan.due_date?.toISOString().split('T')[0] || null,
      repayment_count: loan._count.repayments,
      last_repayment_date: loan.repayments[0]?.repayment_date?.toISOString().split('T')[0] || null,
    }));
  }

  /**
   * Get borrower performance rankings
   */
  async getBorrowerPerformance(context: AnalyticsContext): Promise<BorrowerPerformance[]> {
    const accountFilter = this.buildAccountFilter(context, 'lender_account_id');

    const loans = await this.prisma.loan.groupBy({
      by: ['borrower_account_id'],
      where: {
        ...accountFilter,
        borrower_account_id: { not: null },
      },
      _count: {
        id: true,
      },
      _sum: {
        principal: true,
        amount_repaid: true,
      },
      orderBy: {
        _sum: {
          principal: 'desc',
        },
      },
      take: context.limit,
      skip: (context.page - 1) * context.limit,
    });

    const borrowerIds = loans.map((l) => l.borrower_account_id!).filter(Boolean);

    // Get borrower details and status breakdown
    const [borrowers, statusBreakdown] = await Promise.all([
      this.prisma.account.findMany({
        where: { id: { in: borrowerIds } },
        select: { id: true, code: true, name: true },
      }),
      this.prisma.loan.groupBy({
        by: ['borrower_account_id', 'status'],
        where: {
          ...accountFilter,
          borrower_account_id: { in: borrowerIds },
        },
        _count: {
          id: true,
        },
      }),
    ]);

    const borrowerMap = new Map(borrowers.map((b) => [b.id, b]));
    
    // Build status map per borrower
    const statusMapByBorrower = new Map<string, { active: number; completed: number }>();
    for (const s of statusBreakdown) {
      if (!s.borrower_account_id) continue;
      const existing = statusMapByBorrower.get(s.borrower_account_id) || { active: 0, completed: 0 };
      if (s.status === 'active') {
        existing.active += s._count.id;
      } else if (s.status === 'completed' || s.status === 'repaid') {
        existing.completed += s._count.id;
      }
      statusMapByBorrower.set(s.borrower_account_id, existing);
    }

    return loans.map((l) => {
      const borrower = borrowerMap.get(l.borrower_account_id!);
      const statusData = statusMapByBorrower.get(l.borrower_account_id!) || { active: 0, completed: 0 };
      const totalPrincipal = this.formatDecimal(l._sum.principal);
      const totalRepaid = this.formatDecimal(l._sum.amount_repaid);

      return {
        borrower_id: l.borrower_account_id || '',
        borrower_code: borrower?.code || '',
        borrower_name: borrower?.name || 'Unknown',
        total_loans: l._count.id,
        total_principal: totalPrincipal,
        total_repaid: totalRepaid,
        outstanding: totalPrincipal - totalRepaid,
        completed_loans: statusData.completed,
        active_loans: statusData.active,
        repayment_rate: totalPrincipal > 0 ? Number(((totalRepaid / totalPrincipal) * 100).toFixed(2)) : 0,
      };
    });
  }

  /**
   * Get total count for pagination
   */
  async getTotalCount(context: AnalyticsContext): Promise<number> {
    const accountFilter = this.buildAccountFilter(context, 'lender_account_id');
    return this.prisma.loan.count({ where: accountFilter });
  }
}
