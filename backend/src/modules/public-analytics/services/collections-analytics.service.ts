import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { BaseAnalyticsService, AnalyticsContext } from './base-analytics.service';

export interface CollectionsSummary {
  total_volume: number;
  total_value: number;
  transaction_count: number;
  unique_suppliers: number;
  average_price_per_liter: number;
  average_volume_per_transaction: number;
  accepted_count: number;
  rejected_count: number;
  pending_count: number;
  acceptance_rate: number;
}

export interface CollectionsBreakdown {
  date: string;
  volume: number;
  value: number;
  count: number;
  unique_suppliers: number;
  average_price: number;
}

export interface CollectionsGrowth {
  volume_change_percent: number;
  value_change_percent: number;
  transaction_change_percent: number;
  period: string;
}

export interface SupplierPerformance {
  supplier_id: string;
  supplier_code: string;
  supplier_name: string;
  total_volume: number;
  total_value: number;
  transaction_count: number;
  average_price: number;
  acceptance_rate: number;
}

@Injectable()
export class CollectionsAnalyticsService extends BaseAnalyticsService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Get collections summary for the specified period
   */
  async getSummary(context: AnalyticsContext): Promise<CollectionsSummary> {
    const accountFilter = this.buildAccountFilter(context, 'customer_account_id');

    const whereClause = {
      ...accountFilter,
      sale_at: {
        gte: context.startDate,
        lte: context.endDate,
      },
      status: { not: 'deleted' as const },
    };

    // Get aggregate data
    const [aggregates, statusCounts, uniqueSuppliers] = await Promise.all([
      this.prisma.milkSale.aggregate({
        where: whereClause,
        _sum: {
          quantity: true,
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
          supplier_account_id: true,
        },
        distinct: ['supplier_account_id'],
      }),
    ]);

    // Calculate total value using raw query for better precision
    const totalValueResult =
      context.accountIds.length > 0
        ? await this.prisma.$queryRaw<{ total_value: number }[]>`
            SELECT COALESCE(SUM(quantity * unit_price), 0) as total_value
            FROM milk_sales
            WHERE customer_account_id = ANY(${context.accountIds}::uuid[])
              AND sale_at >= ${context.startDate}
              AND sale_at <= ${context.endDate}
              AND status != 'deleted'
          `
        : await this.prisma.$queryRaw<{ total_value: number }[]>`
            SELECT COALESCE(SUM(quantity * unit_price), 0) as total_value
            FROM milk_sales
            WHERE sale_at >= ${context.startDate}
              AND sale_at <= ${context.endDate}
              AND status != 'deleted'
          `;

    const statusMap = new Map(statusCounts.map((s) => [s.status, s._count.id]));
    const acceptedCount = statusMap.get('accepted') || 0;
    const rejectedCount = statusMap.get('rejected') || 0;
    const pendingCount = statusMap.get('pending') || 0;
    const totalCount = aggregates._count.id || 0;

    return {
      total_volume: this.formatDecimal(aggregates._sum.quantity),
      total_value: this.formatDecimal(totalValueResult[0]?.total_value || 0),
      transaction_count: totalCount,
      unique_suppliers: uniqueSuppliers.length,
      average_price_per_liter: this.formatDecimal(aggregates._avg.unit_price),
      average_volume_per_transaction: this.formatDecimal(aggregates._avg.quantity),
      accepted_count: acceptedCount,
      rejected_count: rejectedCount,
      pending_count: pendingCount,
      acceptance_rate: totalCount > 0 ? Number(((acceptedCount / totalCount) * 100).toFixed(2)) : 0,
    };
  }

  /**
   * Get collections breakdown by time period
   */
  async getBreakdown(context: AnalyticsContext): Promise<CollectionsBreakdown[]> {
    const dateGroupExpr = this.getDateGroupExpression('sale_at', context.groupBy);

    const accountCondition =
      context.accountIds.length > 0
        ? `customer_account_id = ANY($1::uuid[])`
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
        COUNT(DISTINCT supplier_account_id) as unique_suppliers,
        COALESCE(AVG(unit_price), 0) as average_price
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
      unique_suppliers: Number(row.unique_suppliers),
      average_price: this.formatDecimal(row.average_price),
    }));
  }

  /**
   * Get growth metrics compared to previous period
   */
  async getGrowth(context: AnalyticsContext): Promise<CollectionsGrowth> {
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
      period: 'period_over_period',
    };
  }

  /**
   * Get supplier performance rankings
   */
  async getSupplierPerformance(context: AnalyticsContext): Promise<SupplierPerformance[]> {
    const accountFilter = this.buildAccountFilter(context, 'customer_account_id');

    const collections = await this.prisma.milkSale.groupBy({
      by: ['supplier_account_id'],
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

    // Get accepted counts for each supplier
    const supplierIds = collections.map((c) => c.supplier_account_id);
    const [suppliers, acceptedCounts] = await Promise.all([
      this.prisma.account.findMany({
        where: { id: { in: supplierIds } },
        select: { id: true, code: true, name: true },
      }),
      this.prisma.milkSale.groupBy({
        by: ['supplier_account_id'],
        where: {
          ...accountFilter,
          supplier_account_id: { in: supplierIds },
          sale_at: {
            gte: context.startDate,
            lte: context.endDate,
          },
          status: 'accepted',
        },
        _count: {
          id: true,
        },
      }),
    ]);

    const supplierMap = new Map(suppliers.map((s) => [s.id, s]));
    const acceptedMap = new Map(acceptedCounts.map((a) => [a.supplier_account_id, a._count.id]));

    return collections.map((c) => {
      const supplier = supplierMap.get(c.supplier_account_id);
      const totalCount = c._count.id || 0;
      const acceptedCount = acceptedMap.get(c.supplier_account_id) || 0;
      const totalVolume = this.formatDecimal(c._sum.quantity);
      const avgPrice = this.formatDecimal(c._avg.unit_price);

      return {
        supplier_id: c.supplier_account_id,
        supplier_code: supplier?.code || '',
        supplier_name: supplier?.name || 'Unknown',
        total_volume: totalVolume,
        total_value: totalVolume * avgPrice,
        transaction_count: totalCount,
        average_price: avgPrice,
        acceptance_rate: totalCount > 0 ? Number(((acceptedCount / totalCount) * 100).toFixed(2)) : 0,
      };
    });
  }

  /**
   * Get raw collections data for export
   */
  async getRawData(context: AnalyticsContext): Promise<any[]> {
    const accountFilter = this.buildAccountFilter(context, 'customer_account_id');

    const collections = await this.prisma.milkSale.findMany({
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

    return collections.map((c) => ({
      id: c.id,
      date: c.sale_at,
      quantity: this.formatDecimal(c.quantity),
      unit_price: this.formatDecimal(c.unit_price),
      total_value: this.formatDecimal(c.quantity) * this.formatDecimal(c.unit_price),
      status: c.status,
      payment_status: c.payment_status,
      amount_paid: this.formatDecimal(c.amount_paid),
      supplier_id: c.supplier_account_id,
      supplier_code: c.supplier_account.code,
      supplier_name: c.supplier_account.name,
      customer_id: c.customer_account_id,
      customer_code: c.customer_account.code,
      customer_name: c.customer_account.name,
      notes: c.notes,
      created_at: c.created_at,
    }));
  }

  /**
   * Get total count for pagination
   */
  async getTotalCount(context: AnalyticsContext): Promise<number> {
    const accountFilter = this.buildAccountFilter(context, 'customer_account_id');

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
