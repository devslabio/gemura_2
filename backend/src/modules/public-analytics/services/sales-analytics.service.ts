import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { BaseAnalyticsService, AnalyticsContext } from './base-analytics.service';

export interface SalesSummary {
  total_volume: number;
  total_value: number;
  transaction_count: number;
  unique_customers: number;
  average_price_per_liter: number;
  average_volume_per_transaction: number;
  accepted_count: number;
  rejected_count: number;
  pending_count: number;
  acceptance_rate: number;
  paid_value: number;
  unpaid_value: number;
  payment_collection_rate: number;
}

export interface SalesBreakdown {
  date: string;
  volume: number;
  value: number;
  count: number;
  unique_customers: number;
  average_price: number;
  paid_value: number;
  unpaid_value: number;
}

export interface SalesGrowth {
  volume_change_percent: number;
  value_change_percent: number;
  transaction_change_percent: number;
  customer_change_percent: number;
  period: string;
}

export interface CustomerPerformance {
  customer_id: string;
  customer_code: string;
  customer_name: string;
  total_volume: number;
  total_value: number;
  transaction_count: number;
  average_price: number;
  paid_value: number;
  unpaid_value: number;
  payment_rate: number;
}

@Injectable()
export class SalesAnalyticsService extends BaseAnalyticsService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Get sales summary for the specified period
   * Sales are where the account is the supplier (selling to customers)
   */
  async getSummary(context: AnalyticsContext): Promise<SalesSummary> {
    const accountFilter = this.buildAccountFilter(context, 'supplier_account_id');

    const whereClause = {
      ...accountFilter,
      sale_at: {
        gte: context.startDate,
        lte: context.endDate,
      },
      status: { not: 'deleted' as const },
    };

    // Get aggregate data
    const [aggregates, statusCounts, uniqueCustomers, paymentData] = await Promise.all([
      this.prisma.milkSale.aggregate({
        where: whereClause,
        _sum: {
          quantity: true,
          amount_paid: true,
        },
        _count: {
          id: true,
        },
        _avg: {
          unit_price: true,
          quantity: true,
        },
      }),
      this.prisma.milkSale.groupBy({
        by: ['status'],
        where: whereClause,
        _count: {
          id: true,
        },
      }),
      this.prisma.milkSale.findMany({
        where: whereClause,
        select: {
          customer_account_id: true,
        },
        distinct: ['customer_account_id'],
      }),
      context.accountIds.length > 0
        ? this.prisma.$queryRaw<{ total_value: number; paid_value: number }[]>`
            SELECT 
              COALESCE(SUM(quantity * unit_price), 0) as total_value,
              COALESCE(SUM(amount_paid), 0) as paid_value
            FROM milk_sales
            WHERE supplier_account_id = ANY(${context.accountIds}::uuid[])
              AND sale_at >= ${context.startDate}
              AND sale_at <= ${context.endDate}
              AND status != 'deleted'
          `
        : this.prisma.$queryRaw<{ total_value: number; paid_value: number }[]>`
            SELECT 
              COALESCE(SUM(quantity * unit_price), 0) as total_value,
              COALESCE(SUM(amount_paid), 0) as paid_value
            FROM milk_sales
            WHERE sale_at >= ${context.startDate}
              AND sale_at <= ${context.endDate}
              AND status != 'deleted'
          `,
    ]);

    const statusMap = new Map(statusCounts.map((s) => [s.status, s._count.id]));
    const acceptedCount = statusMap.get('accepted') || 0;
    const rejectedCount = statusMap.get('rejected') || 0;
    const pendingCount = statusMap.get('pending') || 0;
    const totalCount = aggregates._count.id || 0;

    const totalValue = this.formatDecimal(paymentData[0]?.total_value || 0);
    const paidValue = this.formatDecimal(paymentData[0]?.paid_value || 0);
    const unpaidValue = totalValue - paidValue;

    return {
      total_volume: this.formatDecimal(aggregates._sum.quantity),
      total_value: totalValue,
      transaction_count: totalCount,
      unique_customers: uniqueCustomers.length,
      average_price_per_liter: this.formatDecimal(aggregates._avg.unit_price),
      average_volume_per_transaction: this.formatDecimal(aggregates._avg.quantity),
      accepted_count: acceptedCount,
      rejected_count: rejectedCount,
      pending_count: pendingCount,
      acceptance_rate: totalCount > 0 ? Number(((acceptedCount / totalCount) * 100).toFixed(2)) : 0,
      paid_value: paidValue,
      unpaid_value: unpaidValue,
      payment_collection_rate: totalValue > 0 ? Number(((paidValue / totalValue) * 100).toFixed(2)) : 0,
    };
  }

  /**
   * Get sales breakdown by time period
   */
  async getBreakdown(context: AnalyticsContext): Promise<SalesBreakdown[]> {
    const dateGroupExpr = this.getDateGroupExpression('sale_at', context.groupBy);

    const accountCondition =
      context.accountIds.length > 0
        ? `supplier_account_id = ANY($1::uuid[])`
        : '1=1';

    const params =
      context.accountIds.length > 0
        ? [context.accountIds, context.startDate, context.endDate]
        : [context.startDate, context.endDate];

    const query = `
      SELECT 
        ${dateGroupExpr} as period_date,
        COALESCE(SUM(quantity), 0) as total_volume,
        COALESCE(SUM(quantity * unit_price), 0) as total_value,
        COUNT(*) as transaction_count,
        COUNT(DISTINCT customer_account_id) as unique_customers,
        COALESCE(AVG(unit_price), 0) as average_price,
        COALESCE(SUM(amount_paid), 0) as paid_value,
        COALESCE(SUM(quantity * unit_price) - SUM(amount_paid), 0) as unpaid_value
      FROM milk_sales
      WHERE ${accountCondition}
        AND sale_at >= $${context.accountIds.length > 0 ? 2 : 1}
        AND sale_at <= $${context.accountIds.length > 0 ? 3 : 2}
        AND status != 'deleted'
      GROUP BY ${dateGroupExpr}
      ORDER BY period_date ASC
    `;

    const results = await this.prisma.$queryRawUnsafe<any[]>(query, ...params);

    return results.map((row) => ({
      date: row.period_date instanceof Date ? row.period_date.toISOString().split('T')[0] : String(row.period_date),
      volume: this.formatDecimal(row.total_volume),
      value: this.formatDecimal(row.total_value),
      count: Number(row.transaction_count),
      unique_customers: Number(row.unique_customers),
      average_price: this.formatDecimal(row.average_price),
      paid_value: this.formatDecimal(row.paid_value),
      unpaid_value: this.formatDecimal(row.unpaid_value),
    }));
  }

  /**
   * Get growth metrics compared to previous period
   */
  async getGrowth(context: AnalyticsContext): Promise<SalesGrowth> {
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
      volume_change_percent: this.calculatePercentageChange(
        currentSummary.total_volume,
        previousSummary.total_volume,
      ),
      value_change_percent: this.calculatePercentageChange(
        currentSummary.total_value,
        previousSummary.total_value,
      ),
      transaction_change_percent: this.calculatePercentageChange(
        currentSummary.transaction_count,
        previousSummary.transaction_count,
      ),
      customer_change_percent: this.calculatePercentageChange(
        currentSummary.unique_customers,
        previousSummary.unique_customers,
      ),
      period: 'period_over_period',
    };
  }

  /**
   * Get customer performance rankings
   */
  async getCustomerPerformance(context: AnalyticsContext): Promise<CustomerPerformance[]> {
    const accountFilter = this.buildAccountFilter(context, 'supplier_account_id');

    const sales = await this.prisma.milkSale.groupBy({
      by: ['customer_account_id'],
      where: {
        ...accountFilter,
        sale_at: {
          gte: context.startDate,
          lte: context.endDate,
        },
        status: { not: 'deleted' },
      },
      _sum: {
        quantity: true,
        amount_paid: true,
      },
      _count: {
        id: true,
      },
      _avg: {
        unit_price: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: context.limit,
      skip: (context.page - 1) * context.limit,
    });

    const customerIds = sales.map((s) => s.customer_account_id);
    const customers = await this.prisma.account.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, code: true, name: true },
    });

    // Get total values per customer
    const totalValues =
      context.accountIds.length > 0
        ? await this.prisma.$queryRaw<{ customer_account_id: string; total_value: number }[]>`
            SELECT 
              customer_account_id,
              COALESCE(SUM(quantity * unit_price), 0) as total_value
            FROM milk_sales
            WHERE supplier_account_id = ANY(${context.accountIds}::uuid[])
              AND customer_account_id = ANY(${customerIds}::uuid[])
              AND sale_at >= ${context.startDate}
              AND sale_at <= ${context.endDate}
              AND status != 'deleted'
            GROUP BY customer_account_id
          `
        : await this.prisma.$queryRaw<{ customer_account_id: string; total_value: number }[]>`
            SELECT 
              customer_account_id,
              COALESCE(SUM(quantity * unit_price), 0) as total_value
            FROM milk_sales
            WHERE customer_account_id = ANY(${customerIds}::uuid[])
              AND sale_at >= ${context.startDate}
              AND sale_at <= ${context.endDate}
              AND status != 'deleted'
            GROUP BY customer_account_id
          `;

    const customerMap = new Map(customers.map((c) => [c.id, c]));
    const totalValueMap = new Map(totalValues.map((t) => [t.customer_account_id, this.formatDecimal(t.total_value)]));

    return sales.map((s) => {
      const customer = customerMap.get(s.customer_account_id);
      const totalValue = totalValueMap.get(s.customer_account_id) || 0;
      const paidValue = this.formatDecimal(s._sum.amount_paid);
      const unpaidValue = totalValue - paidValue;

      return {
        customer_id: s.customer_account_id,
        customer_code: customer?.code || '',
        customer_name: customer?.name || 'Unknown',
        total_volume: this.formatDecimal(s._sum.quantity),
        total_value: totalValue,
        transaction_count: s._count.id || 0,
        average_price: this.formatDecimal(s._avg.unit_price),
        paid_value: paidValue,
        unpaid_value: unpaidValue,
        payment_rate: totalValue > 0 ? Number(((paidValue / totalValue) * 100).toFixed(2)) : 0,
      };
    });
  }

  /**
   * Get raw sales data for export
   */
  async getRawData(context: AnalyticsContext): Promise<any[]> {
    const accountFilter = this.buildAccountFilter(context, 'supplier_account_id');

    const sales = await this.prisma.milkSale.findMany({
      where: {
        ...accountFilter,
        sale_at: {
          gte: context.startDate,
          lte: context.endDate,
        },
        status: { not: 'deleted' },
      },
      include: {
        supplier_account: {
          select: { id: true, code: true, name: true },
        },
        customer_account: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: { sale_at: 'desc' },
      take: context.limit,
      skip: (context.page - 1) * context.limit,
    });

    return sales.map((s) => ({
      id: s.id,
      date: s.sale_at,
      quantity: this.formatDecimal(s.quantity),
      unit_price: this.formatDecimal(s.unit_price),
      total_value: this.formatDecimal(s.quantity) * this.formatDecimal(s.unit_price),
      status: s.status,
      payment_status: s.payment_status,
      amount_paid: this.formatDecimal(s.amount_paid),
      supplier_id: s.supplier_account_id,
      supplier_code: s.supplier_account.code,
      supplier_name: s.supplier_account.name,
      customer_id: s.customer_account_id,
      customer_code: s.customer_account.code,
      customer_name: s.customer_account.name,
      notes: s.notes,
      created_at: s.created_at,
    }));
  }

  /**
   * Get total count for pagination
   */
  async getTotalCount(context: AnalyticsContext): Promise<number> {
    const accountFilter = this.buildAccountFilter(context, 'supplier_account_id');

    return this.prisma.milkSale.count({
      where: {
        ...accountFilter,
        sale_at: {
          gte: context.startDate,
          lte: context.endDate,
        },
        status: { not: 'deleted' },
      },
    });
  }
}
