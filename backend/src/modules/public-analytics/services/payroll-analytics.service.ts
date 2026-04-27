import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { BaseAnalyticsService, AnalyticsContext } from './base-analytics.service';

export interface PayrollSummary {
  total_runs: number;
  total_disbursements: number;
  total_gross_amount: number;
  total_deductions: number;
  total_net_amount: number;
  unique_suppliers_paid: number;
  average_payment_per_supplier: number;
  processed_runs: number;
  pending_runs: number;
}

export interface PayrollBreakdown {
  date: string;
  run_count: number;
  gross_amount: number;
  deductions: number;
  net_amount: number;
  suppliers_count: number;
}

export interface PayrollGrowth {
  disbursement_change_percent: number;
  supplier_count_change_percent: number;
  average_payment_change_percent: number;
  period: string;
}

export interface PayrollRunDetail {
  run_id: string;
  period_name: string;
  run_date: string;
  status: string;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  supplier_count: number;
  deduction_breakdown: {
    loans: number;
    charges: number;
    inventory: number;
    other: number;
  };
}

export interface SupplierPayrollDetail {
  supplier_id: string;
  supplier_code: string;
  supplier_name: string;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  payslip_count: number;
  loan_deductions: number;
  charge_deductions: number;
  inventory_deductions: number;
}

@Injectable()
export class PayrollAnalyticsService extends BaseAnalyticsService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Get payroll summary for the specified period
   */
  async getSummary(context: AnalyticsContext): Promise<PayrollSummary> {
    const accountFilter = this.buildAccountFilter(context, 'account_id');

    const [runStats, payslipStats, statusCounts] = await Promise.all([
      this.prisma.payrollRun.aggregate({
        where: {
          ...accountFilter,
          run_date: {
            gte: context.startDate,
            lte: context.endDate,
          },
        },
        _count: {
          id: true,
        },
        _sum: {
          total_amount: true,
        },
      }),
      this.prisma.payrollPayslip.aggregate({
        where: {
          run: {
            ...accountFilter,
            run_date: {
              gte: context.startDate,
              lte: context.endDate,
            },
          },
        },
        _sum: {
          gross_amount: true,
          total_deductions: true,
          net_amount: true,
        },
        _count: {
          supplier_account_id: true,
        },
      }),
      this.prisma.payrollRun.groupBy({
        by: ['status'],
        where: {
          ...accountFilter,
          run_date: {
            gte: context.startDate,
            lte: context.endDate,
          },
        },
        _count: {
          id: true,
        },
      }),
    ]);

    // Get unique suppliers
    const uniqueSuppliers = await this.prisma.payrollPayslip.findMany({
      where: {
        run: {
          ...accountFilter,
          run_date: {
            gte: context.startDate,
            lte: context.endDate,
          },
        },
      },
      select: {
        supplier_account_id: true,
      },
      distinct: ['supplier_account_id'],
    });

    const statusMap = new Map(statusCounts.map((s) => [s.status, s._count.id]));
    const totalDisbursements = this.formatDecimal(runStats._sum.total_amount);
    const uniqueSupplierCount = uniqueSuppliers.length;

    return {
      total_runs: runStats._count.id || 0,
      total_disbursements: totalDisbursements,
      total_gross_amount: this.formatDecimal(payslipStats._sum.gross_amount),
      total_deductions: this.formatDecimal(payslipStats._sum.total_deductions),
      total_net_amount: this.formatDecimal(payslipStats._sum.net_amount),
      unique_suppliers_paid: uniqueSupplierCount,
      average_payment_per_supplier: uniqueSupplierCount > 0 
        ? Number((totalDisbursements / uniqueSupplierCount).toFixed(2)) 
        : 0,
      processed_runs: statusMap.get('processed') || 0,
      pending_runs: statusMap.get('pending') || statusMap.get('draft') || 0,
    };
  }

  /**
   * Get payroll breakdown by time period
   */
  async getBreakdown(context: AnalyticsContext): Promise<PayrollBreakdown[]> {
    const dateGroupExpr = this.getDateGroupExpression('pr.run_date', context.groupBy);

    const query = `
      SELECT 
        ${dateGroupExpr} as period_date,
        COUNT(DISTINCT pr.id) as run_count,
        COALESCE(SUM(pp.gross_amount), 0) as gross_amount,
        COALESCE(SUM(pp.total_deductions), 0) as deductions,
        COALESCE(SUM(pp.net_amount), 0) as net_amount,
        COUNT(DISTINCT pp.supplier_account_id) as suppliers_count
      FROM payroll_runs pr
      LEFT JOIN payroll_payslips pp ON pp.run_id = pr.id
      WHERE pr.account_id = ANY($1::uuid[])
        AND pr.run_date >= $2
        AND pr.run_date <= $3
      GROUP BY ${dateGroupExpr}
      ORDER BY period_date ASC
    `;

    const queryAllAccounts = `
      SELECT 
        ${dateGroupExpr} as period_date,
        COUNT(DISTINCT pr.id) as run_count,
        COALESCE(SUM(pp.gross_amount), 0) as gross_amount,
        COALESCE(SUM(pp.total_deductions), 0) as deductions,
        COALESCE(SUM(pp.net_amount), 0) as net_amount,
        COUNT(DISTINCT pp.supplier_account_id) as suppliers_count
      FROM payroll_runs pr
      LEFT JOIN payroll_payslips pp ON pp.run_id = pr.id
      WHERE pr.run_date >= $1
        AND pr.run_date <= $2
      GROUP BY ${dateGroupExpr}
      ORDER BY period_date ASC
    `;

    const results =
      context.accountIds.length > 0
        ? await this.prisma.$queryRawUnsafe<any[]>(
            query,
            context.accountIds,
            context.startDate,
            context.endDate,
          )
        : await this.prisma.$queryRawUnsafe<any[]>(
            queryAllAccounts,
            context.startDate,
            context.endDate,
          );

    return results.map((row) => ({
      date: row.period_date instanceof Date 
        ? row.period_date.toISOString().split('T')[0] 
        : String(row.period_date),
      run_count: Number(row.run_count),
      gross_amount: this.formatDecimal(row.gross_amount),
      deductions: this.formatDecimal(row.deductions),
      net_amount: this.formatDecimal(row.net_amount),
      suppliers_count: Number(row.suppliers_count),
    }));
  }

  /**
   * Get growth metrics compared to previous period
   */
  async getGrowth(context: AnalyticsContext): Promise<PayrollGrowth> {
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
      disbursement_change_percent: this.calculatePercentageChange(
        currentSummary.total_disbursements,
        previousSummary.total_disbursements,
      ),
      supplier_count_change_percent: this.calculatePercentageChange(
        currentSummary.unique_suppliers_paid,
        previousSummary.unique_suppliers_paid,
      ),
      average_payment_change_percent: this.calculatePercentageChange(
        currentSummary.average_payment_per_supplier,
        previousSummary.average_payment_per_supplier,
      ),
      period: 'period_over_period',
    };
  }

  /**
   * Get payroll run details
   */
  async getPayrollRuns(context: AnalyticsContext): Promise<PayrollRunDetail[]> {
    const accountFilter = this.buildAccountFilter(context, 'account_id');

    const runs = await this.prisma.payrollRun.findMany({
      where: {
        ...accountFilter,
        run_date: {
          gte: context.startDate,
          lte: context.endDate,
        },
      },
      include: {
        period: true,
        payslips: {
          include: {
            deductions: true,
          },
        },
      },
      orderBy: {
        run_date: 'desc',
      },
      take: context.limit,
      skip: (context.page - 1) * context.limit,
    });

    return runs.map((run) => {
      let totalGross = 0;
      let totalDeductions = 0;
      let totalNet = 0;
      let loanDeductions = 0;
      let chargeDeductions = 0;
      let inventoryDeductions = 0;
      let otherDeductions = 0;

      for (const payslip of run.payslips) {
        totalGross += this.formatDecimal(payslip.gross_amount);
        totalDeductions += this.formatDecimal(payslip.total_deductions);
        totalNet += this.formatDecimal(payslip.net_amount);

        for (const deduction of payslip.deductions) {
          const amount = this.formatDecimal(deduction.amount);
          if (deduction.deduction_type === 'loan') {
            loanDeductions += amount;
          } else if (deduction.deduction_type === 'charge' || deduction.deduction_type === 'fee') {
            chargeDeductions += amount;
          } else if (deduction.deduction_type === 'inventory' || deduction.deduction_type === 'inventory_debt') {
            inventoryDeductions += amount;
          } else {
            otherDeductions += amount;
          }
        }
      }

      return {
        run_id: run.id,
        period_name: run.period?.period_name || 'Unknown',
        run_date: run.run_date.toISOString().split('T')[0],
        status: run.status,
        total_gross: totalGross,
        total_deductions: totalDeductions,
        total_net: totalNet,
        supplier_count: run.payslips.length,
        deduction_breakdown: {
          loans: loanDeductions,
          charges: chargeDeductions,
          inventory: inventoryDeductions,
          other: otherDeductions,
        },
      };
    });
  }

  /**
   * Get supplier payroll details
   */
  async getSupplierPayrollDetails(context: AnalyticsContext): Promise<SupplierPayrollDetail[]> {
    // Use raw SQL to avoid ambiguous column reference issues with Prisma groupBy + relations
    const payslips =
      context.accountIds.length > 0
        ? await this.prisma.$queryRawUnsafe<any[]>(
            `
      SELECT 
        pp.supplier_account_id,
        COALESCE(SUM(pp.gross_amount), 0) as total_gross,
        COALESCE(SUM(pp.total_deductions), 0) as total_deductions,
        COALESCE(SUM(pp.net_amount), 0) as total_net,
        COUNT(pp.id) as run_count
      FROM payroll_payslips pp
      JOIN payroll_runs pr ON pr.id = pp.run_id
      WHERE pr.account_id = ANY($1::uuid[])
        AND pr.run_date >= $2
        AND pr.run_date <= $3
      GROUP BY pp.supplier_account_id
      ORDER BY total_net DESC
      LIMIT $4 OFFSET $5
    `,
            context.accountIds,
            context.startDate,
            context.endDate,
            context.limit,
            (context.page - 1) * context.limit,
          )
        : await this.prisma.$queryRawUnsafe<any[]>(
            `
      SELECT 
        pp.supplier_account_id,
        COALESCE(SUM(pp.gross_amount), 0) as total_gross,
        COALESCE(SUM(pp.total_deductions), 0) as total_deductions,
        COALESCE(SUM(pp.net_amount), 0) as total_net,
        COUNT(pp.id) as run_count
      FROM payroll_payslips pp
      JOIN payroll_runs pr ON pr.id = pp.run_id
      WHERE pr.run_date >= $1
        AND pr.run_date <= $2
      GROUP BY pp.supplier_account_id
      ORDER BY total_net DESC
      LIMIT $3 OFFSET $4
    `,
            context.startDate,
            context.endDate,
            context.limit,
            (context.page - 1) * context.limit,
          );

    const supplierIds = payslips.map((p) => p.supplier_account_id);

    if (supplierIds.length === 0) {
      return [];
    }

    // Get supplier details
    const suppliers = await this.prisma.account.findMany({
      where: { id: { in: supplierIds } },
      select: { id: true, code: true, name: true },
    });

    const supplierMap = new Map(suppliers.map((s) => [s.id, s]));

    // Get per-supplier deductions
    const supplierDeductions =
      context.accountIds.length > 0
        ? await this.prisma.$queryRaw<any[]>`
            SELECT 
              pp.supplier_account_id,
              pd.deduction_type,
              COALESCE(SUM(pd.amount), 0) as total_amount
            FROM payroll_payslips pp
            JOIN payroll_runs pr ON pr.id = pp.run_id
            LEFT JOIN payroll_deductions pd ON pd.payslip_id = pp.id
            WHERE pr.account_id = ANY(${context.accountIds}::uuid[])
              AND pr.run_date >= ${context.startDate}
              AND pr.run_date <= ${context.endDate}
              AND pp.supplier_account_id = ANY(${supplierIds}::uuid[])
            GROUP BY pp.supplier_account_id, pd.deduction_type
          `
        : await this.prisma.$queryRaw<any[]>`
            SELECT 
              pp.supplier_account_id,
              pd.deduction_type,
              COALESCE(SUM(pd.amount), 0) as total_amount
            FROM payroll_payslips pp
            JOIN payroll_runs pr ON pr.id = pp.run_id
            LEFT JOIN payroll_deductions pd ON pd.payslip_id = pp.id
            WHERE pr.run_date >= ${context.startDate}
              AND pr.run_date <= ${context.endDate}
              AND pp.supplier_account_id = ANY(${supplierIds}::uuid[])
            GROUP BY pp.supplier_account_id, pd.deduction_type
          `;

    // Build deduction map per supplier
    const supplierDeductionMap = new Map<string, { loans: number; charges: number; inventory: number }>();
    for (const d of supplierDeductions) {
      const existing = supplierDeductionMap.get(d.supplier_account_id) || { loans: 0, charges: 0, inventory: 0 };
      const amount = this.formatDecimal(d.total_amount);
      if (d.deduction_type === 'loan') {
        existing.loans += amount;
      } else if (d.deduction_type === 'charge' || d.deduction_type === 'fee') {
        existing.charges += amount;
      } else if (d.deduction_type === 'inventory' || d.deduction_type === 'inventory_debt') {
        existing.inventory += amount;
      }
      supplierDeductionMap.set(d.supplier_account_id, existing);
    }

    return payslips.map((p) => {
      const supplier = supplierMap.get(p.supplier_account_id);
      const deductionBreakdown = supplierDeductionMap.get(p.supplier_account_id) || { loans: 0, charges: 0, inventory: 0 };

      return {
        supplier_id: p.supplier_account_id,
        supplier_code: supplier?.code || '',
        supplier_name: supplier?.name || 'Unknown',
        total_gross: this.formatDecimal(p.total_gross),
        total_deductions: this.formatDecimal(p.total_deductions),
        total_net: this.formatDecimal(p.total_net),
        payslip_count: Number(p.run_count),
        loan_deductions: deductionBreakdown.loans,
        charge_deductions: deductionBreakdown.charges,
        inventory_deductions: deductionBreakdown.inventory,
      };
    });
  }

  /**
   * Get total count for pagination
   */
  async getTotalCount(context: AnalyticsContext): Promise<number> {
    const accountFilter = this.buildAccountFilter(context, 'account_id');
    return this.prisma.payrollRun.count({
      where: {
        ...accountFilter,
        run_date: {
          gte: context.startDate,
          lte: context.endDate,
        },
      },
    });
  }
}
