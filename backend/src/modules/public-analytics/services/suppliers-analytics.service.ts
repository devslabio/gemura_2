import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { BaseAnalyticsService, AnalyticsContext } from './base-analytics.service';

export interface SuppliersSummary {
  total_suppliers: number;
  active_suppliers: number;
  inactive_suppliers: number;
  new_suppliers_in_period: number;
  average_price_per_liter: number;
  total_supply_volume: number;
  total_supply_value: number;
}

export interface SuppliersBreakdown {
  date: string;
  new_suppliers: number;
  active_suppliers: number;
  total_volume: number;
  total_value: number;
}

export interface SuppliersGrowth {
  supplier_count_change_percent: number;
  new_supplier_change_percent: number;
  volume_change_percent: number;
  period: string;
}

export interface SupplierDetail {
  supplier_id: string;
  supplier_code: string;
  supplier_name: string;
  relationship_status: string;
  price_per_liter: number;
  average_supply_quantity: number;
  total_collections_volume: number;
  total_collections_value: number;
  collection_count: number;
  first_collection_date: string | null;
  last_collection_date: string | null;
  outstanding_payable: number;
}

@Injectable()
export class SuppliersAnalyticsService extends BaseAnalyticsService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Get suppliers summary for the specified period
   */
  async getSummary(context: AnalyticsContext): Promise<SuppliersSummary> {
    const accountFilter = this.buildAccountFilter(context, 'customer_account_id');

    // Get supplier relationship counts
    const [totalSuppliers, activeSuppliers, newSuppliers, supplyData] = await Promise.all([
      this.prisma.supplierCustomer.count({
        where: accountFilter,
      }),
      this.prisma.supplierCustomer.count({
        where: {
          ...accountFilter,
          relationship_status: 'active',
        },
      }),
      this.prisma.supplierCustomer.count({
        where: {
          ...accountFilter,
          created_at: {
            gte: context.startDate,
            lte: context.endDate,
          },
        },
      }),
      this.prisma.milkSale.aggregate({
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
        _avg: {
          unit_price: true,
        },
      }),
    ]);

    // Get total value
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

    return {
      total_suppliers: totalSuppliers,
      active_suppliers: activeSuppliers,
      inactive_suppliers: totalSuppliers - activeSuppliers,
      new_suppliers_in_period: newSuppliers,
      average_price_per_liter: this.formatDecimal(supplyData._avg.unit_price),
      total_supply_volume: this.formatDecimal(supplyData._sum.quantity),
      total_supply_value: this.formatDecimal(totalValueResult[0]?.total_value || 0),
    };
  }

  /**
   * Get suppliers breakdown by time period
   */
  async getBreakdown(context: AnalyticsContext): Promise<SuppliersBreakdown[]> {
    const dateGroupExpr = this.getDateGroupExpression('created_at', context.groupBy);
    const saleDateGroupExpr = this.getDateGroupExpression('sale_at', context.groupBy);

    const accountCondition =
      context.accountIds.length > 0
        ? `customer_account_id = ANY($1::uuid[])`
        : '1=1';

    const params =
      context.accountIds.length > 0
        ? [context.accountIds, context.startDate, context.endDate]
        : [context.startDate, context.endDate];

    // Get new suppliers per period
    const newSuppliersQuery = `
      SELECT 
        ${dateGroupExpr} as period_date,
        COUNT(*) as new_suppliers
      FROM suppliers_customers
      WHERE ${accountCondition}
        AND created_at >= $${context.accountIds.length > 0 ? 2 : 1}
        AND created_at <= $${context.accountIds.length > 0 ? 3 : 2}
      GROUP BY ${dateGroupExpr}
      ORDER BY period_date ASC
    `;

    // Get active suppliers and volume per period
    const activityQuery = `
      SELECT 
        ${saleDateGroupExpr} as period_date,
        COUNT(DISTINCT supplier_account_id) as active_suppliers,
        COALESCE(SUM(quantity), 0) as total_volume,
        COALESCE(SUM(quantity * unit_price), 0) as total_value
      FROM milk_sales
      WHERE ${accountCondition}
        AND sale_at >= $${context.accountIds.length > 0 ? 2 : 1}
        AND sale_at <= $${context.accountIds.length > 0 ? 3 : 2}
        AND status != 'deleted'
      GROUP BY ${saleDateGroupExpr}
      ORDER BY period_date ASC
    `;

    const [newSuppliersResults, activityResults] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(newSuppliersQuery, ...params),
      this.prisma.$queryRawUnsafe<any[]>(activityQuery, ...params),
    ]);

    // Merge results
    const resultMap = new Map<string, SuppliersBreakdown>();

    for (const row of activityResults) {
      const dateKey = row.period_date instanceof Date 
        ? row.period_date.toISOString().split('T')[0] 
        : String(row.period_date);
      resultMap.set(dateKey, {
        date: dateKey,
        new_suppliers: 0,
        active_suppliers: Number(row.active_suppliers),
        total_volume: this.formatDecimal(row.total_volume),
        total_value: this.formatDecimal(row.total_value),
      });
    }

    for (const row of newSuppliersResults) {
      const dateKey = row.period_date instanceof Date 
        ? row.period_date.toISOString().split('T')[0] 
        : String(row.period_date);
      const existing = resultMap.get(dateKey);
      if (existing) {
        existing.new_suppliers = Number(row.new_suppliers);
      } else {
        resultMap.set(dateKey, {
          date: dateKey,
          new_suppliers: Number(row.new_suppliers),
          active_suppliers: 0,
          total_volume: 0,
          total_value: 0,
        });
      }
    }

    return Array.from(resultMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get growth metrics compared to previous period
   */
  async getGrowth(context: AnalyticsContext): Promise<SuppliersGrowth> {
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
      supplier_count_change_percent: this.calculatePercentageChange(
        currentSummary.total_suppliers,
        previousSummary.total_suppliers,
      ),
      new_supplier_change_percent: this.calculatePercentageChange(
        currentSummary.new_suppliers_in_period,
        previousSummary.new_suppliers_in_period,
      ),
      volume_change_percent: this.calculatePercentageChange(
        currentSummary.total_supply_volume,
        previousSummary.total_supply_volume,
      ),
      period: 'period_over_period',
    };
  }

  /**
   * Get detailed supplier list with performance metrics
   */
  async getSupplierList(context: AnalyticsContext): Promise<SupplierDetail[]> {
    const accountFilter = this.buildAccountFilter(context, 'customer_account_id');

    const relationships = await this.prisma.supplierCustomer.findMany({
      where: accountFilter,
      include: {
        supplier_account: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: { created_at: 'desc' },
      take: context.limit,
      skip: (context.page - 1) * context.limit,
    });

    const supplierIds = relationships.map((r) => r.supplier_account_id);

    // Get collection stats for each supplier
    const [collectionStats, outstandingPayables] = await Promise.all([
      this.prisma.milkSale.groupBy({
        by: ['supplier_account_id'],
        where: {
          ...accountFilter,
          supplier_account_id: { in: supplierIds },
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
        _min: {
          sale_at: true,
        },
        _max: {
          sale_at: true,
        },
      }),
      context.accountIds.length > 0
        ? this.prisma.$queryRaw<{ supplier_account_id: string; outstanding: number }[]>`
            SELECT 
              supplier_account_id,
              COALESCE(SUM(quantity * unit_price) - SUM(amount_paid), 0) as outstanding
            FROM milk_sales
            WHERE customer_account_id = ANY(${context.accountIds}::uuid[])
              AND supplier_account_id = ANY(${supplierIds}::uuid[])
              AND status NOT IN ('deleted', 'cancelled')
            GROUP BY supplier_account_id
          `
        : this.prisma.$queryRaw<{ supplier_account_id: string; outstanding: number }[]>`
            SELECT 
              supplier_account_id,
              COALESCE(SUM(quantity * unit_price) - SUM(amount_paid), 0) as outstanding
            FROM milk_sales
            WHERE supplier_account_id = ANY(${supplierIds}::uuid[])
              AND status NOT IN ('deleted', 'cancelled')
            GROUP BY supplier_account_id
          `,
    ]);

    // Get total values
    const totalValues =
      context.accountIds.length > 0
        ? await this.prisma.$queryRaw<{ supplier_account_id: string; total_value: number }[]>`
            SELECT 
              supplier_account_id,
              COALESCE(SUM(quantity * unit_price), 0) as total_value
            FROM milk_sales
            WHERE customer_account_id = ANY(${context.accountIds}::uuid[])
              AND supplier_account_id = ANY(${supplierIds}::uuid[])
              AND sale_at >= ${context.startDate}
              AND sale_at <= ${context.endDate}
              AND status != 'deleted'
            GROUP BY supplier_account_id
          `
        : await this.prisma.$queryRaw<{ supplier_account_id: string; total_value: number }[]>`
            SELECT 
              supplier_account_id,
              COALESCE(SUM(quantity * unit_price), 0) as total_value
            FROM milk_sales
            WHERE supplier_account_id = ANY(${supplierIds}::uuid[])
              AND sale_at >= ${context.startDate}
              AND sale_at <= ${context.endDate}
              AND status != 'deleted'
            GROUP BY supplier_account_id
          `;

    const statsMap = new Map(collectionStats.map((s) => [s.supplier_account_id, s]));
    const outstandingMap = new Map(outstandingPayables.map((o) => [o.supplier_account_id, this.formatDecimal(o.outstanding)]));
    const totalValueMap = new Map(totalValues.map((t) => [t.supplier_account_id, this.formatDecimal(t.total_value)]));

    return relationships.map((r) => {
      const stats = statsMap.get(r.supplier_account_id);
      return {
        supplier_id: r.supplier_account_id,
        supplier_code: r.supplier_account.code || '',
        supplier_name: r.supplier_account.name,
        relationship_status: r.relationship_status,
        price_per_liter: this.formatDecimal(r.price_per_liter),
        average_supply_quantity: this.formatDecimal(r.average_supply_quantity),
        total_collections_volume: this.formatDecimal(stats?._sum.quantity),
        total_collections_value: totalValueMap.get(r.supplier_account_id) || 0,
        collection_count: stats?._count.id || 0,
        first_collection_date: stats?._min.sale_at?.toISOString().split('T')[0] || null,
        last_collection_date: stats?._max.sale_at?.toISOString().split('T')[0] || null,
        outstanding_payable: outstandingMap.get(r.supplier_account_id) || 0,
      };
    });
  }

  /**
   * Get total count for pagination
   */
  async getTotalCount(context: AnalyticsContext): Promise<number> {
    const accountFilter = this.buildAccountFilter(context, 'customer_account_id');
    return this.prisma.supplierCustomer.count({ where: accountFilter });
  }
}
