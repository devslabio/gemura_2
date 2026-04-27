import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { BaseAnalyticsService, AnalyticsContext } from './base-analytics.service';

export interface InventorySummary {
  total_products: number;
  total_stock_quantity: number;
  total_stock_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_sales_quantity: number;
  total_sales_value: number;
  unique_categories: number;
}

export interface InventoryBreakdown {
  date: string;
  sales_quantity: number;
  sales_value: number;
  stock_in: number;
  stock_out: number;
}

export interface ProductPerformance {
  product_id: string;
  product_name: string;
  category_name: string;
  current_stock: number;
  stock_value: number;
  sales_quantity: number;
  sales_value: number;
  unit_price: number;
  status: string;
}

export interface LowStockItem {
  product_id: string;
  product_name: string;
  category_name: string;
  current_stock: number;
  reorder_level: number;
  unit_price: number;
  days_since_last_restock: number | null;
}

@Injectable()
export class InventoryAnalyticsService extends BaseAnalyticsService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Get inventory summary
   */
  async getSummary(context: AnalyticsContext): Promise<InventorySummary> {
    const accountFilter = this.buildAccountFilter(context, 'account_id');

    const [products, salesData, categories] = await Promise.all([
      this.prisma.product.aggregate({
        where: accountFilter,
        _count: {
          id: true,
        },
        _sum: {
          stock_quantity: true,
        },
      }),
      this.prisma.inventorySale.aggregate({
        where: {
          product: accountFilter,
          created_at: {
            gte: context.startDate,
            lte: context.endDate,
          },
        },
        _sum: {
          quantity: true,
          total_amount: true,
        },
      }),
      this.prisma.product.findMany({
        where: accountFilter,
        select: {
          inventory_item: {
            select: {
              category_id: true,
            },
          },
        },
        distinct: ['inventory_item_id'],
      }),
    ]);

    // Get stock value and status counts
    const [stockValue, statusCounts] = await Promise.all([
      context.accountIds.length > 0
        ? this.prisma.$queryRaw<{ total_value: number }[]>`
            SELECT COALESCE(SUM(stock_quantity * price), 0) as total_value
            FROM products
            WHERE account_id = ANY(${context.accountIds}::uuid[])
          `
        : this.prisma.$queryRaw<{ total_value: number }[]>`
            SELECT COALESCE(SUM(stock_quantity * price), 0) as total_value
            FROM products
          `,
      this.prisma.product.groupBy({
        by: ['status'],
        where: accountFilter,
        _count: {
          id: true,
        },
      }),
    ]);

    const statusMap = new Map(statusCounts.map((s) => [s.status, s._count.id]));
    const uniqueCategories = new Set(categories.map((c) => c.inventory_item?.category_id).filter(Boolean));

    // Count low stock (assuming threshold of 10 for now)
    const lowStockCount = await this.prisma.product.count({
      where: {
        ...accountFilter,
        stock_quantity: {
          gt: 0,
          lte: 10,
        },
      },
    });

    return {
      total_products: products._count.id || 0,
      total_stock_quantity: this.formatDecimal(products._sum.stock_quantity),
      total_stock_value: this.formatDecimal(stockValue[0]?.total_value || 0),
      low_stock_count: lowStockCount,
      out_of_stock_count: statusMap.get('out_of_stock') || 0,
      total_sales_quantity: this.formatDecimal(salesData._sum.quantity),
      total_sales_value: this.formatDecimal(salesData._sum.total_amount),
      unique_categories: uniqueCategories.size,
    };
  }

  /**
   * Get inventory breakdown by time period
   */
  async getBreakdown(context: AnalyticsContext): Promise<InventoryBreakdown[]> {
    // Sales data - use qualified column name is2.created_at to avoid ambiguity
    const salesDateGroupExpr = this.getDateGroupExpression('is2.created_at', context.groupBy);
    const salesQuery = `
      SELECT 
        ${salesDateGroupExpr} as period_date,
        COALESCE(SUM(is2.quantity), 0) as sales_quantity,
        COALESCE(SUM(is2.total_amount), 0) as sales_value
      FROM inventory_sales is2
      JOIN products p ON p.id = is2.product_id
      WHERE p.account_id = ANY($1::uuid[])
        AND is2.created_at >= $2
        AND is2.created_at <= $3
      GROUP BY ${salesDateGroupExpr}
      ORDER BY period_date ASC
    `;

    const salesQueryAllAccounts = `
      SELECT 
        ${salesDateGroupExpr} as period_date,
        COALESCE(SUM(is2.quantity), 0) as sales_quantity,
        COALESCE(SUM(is2.total_amount), 0) as sales_value
      FROM inventory_sales is2
      JOIN products p ON p.id = is2.product_id
      WHERE is2.created_at >= $1
        AND is2.created_at <= $2
      GROUP BY ${salesDateGroupExpr}
      ORDER BY period_date ASC
    `;

    // Stock movements - use qualified column name im.created_at to avoid ambiguity
    const movementsDateGroupExpr = this.getDateGroupExpression('im.created_at', context.groupBy);
    const movementsQuery = `
      SELECT 
        ${movementsDateGroupExpr} as period_date,
        COALESCE(SUM(CASE WHEN movement_type IN ('purchase_in', 'adjustment_in', 'transfer_in') THEN quantity ELSE 0 END), 0) as stock_in,
        COALESCE(SUM(CASE WHEN movement_type IN ('sale_out', 'adjustment_out', 'transfer_out') THEN quantity ELSE 0 END), 0) as stock_out
      FROM inventory_movements im
      JOIN products p ON p.id = im.product_id
      WHERE p.account_id = ANY($1::uuid[])
        AND im.created_at >= $2
        AND im.created_at <= $3
      GROUP BY ${movementsDateGroupExpr}
      ORDER BY period_date ASC
    `;

    const movementsQueryAllAccounts = `
      SELECT 
        ${movementsDateGroupExpr} as period_date,
        COALESCE(SUM(CASE WHEN movement_type IN ('purchase_in', 'adjustment_in', 'transfer_in') THEN quantity ELSE 0 END), 0) as stock_in,
        COALESCE(SUM(CASE WHEN movement_type IN ('sale_out', 'adjustment_out', 'transfer_out') THEN quantity ELSE 0 END), 0) as stock_out
      FROM inventory_movements im
      JOIN products p ON p.id = im.product_id
      WHERE im.created_at >= $1
        AND im.created_at <= $2
      GROUP BY ${movementsDateGroupExpr}
      ORDER BY period_date ASC
    `;

    const [salesResults, movementsResults] =
      context.accountIds.length > 0
        ? await Promise.all([
            this.prisma.$queryRawUnsafe<any[]>(
              salesQuery,
              context.accountIds,
              context.startDate,
              context.endDate,
            ),
            this.prisma.$queryRawUnsafe<any[]>(
              movementsQuery,
              context.accountIds,
              context.startDate,
              context.endDate,
            ),
          ])
        : await Promise.all([
            this.prisma.$queryRawUnsafe<any[]>(
              salesQueryAllAccounts,
              context.startDate,
              context.endDate,
            ),
            this.prisma.$queryRawUnsafe<any[]>(
              movementsQueryAllAccounts,
              context.startDate,
              context.endDate,
            ),
          ]);

    // Merge results
    const resultMap = new Map<string, InventoryBreakdown>();

    for (const row of salesResults) {
      const dateKey = row.period_date instanceof Date 
        ? row.period_date.toISOString().split('T')[0] 
        : String(row.period_date);
      resultMap.set(dateKey, {
        date: dateKey,
        sales_quantity: this.formatDecimal(row.sales_quantity),
        sales_value: this.formatDecimal(row.sales_value),
        stock_in: 0,
        stock_out: 0,
      });
    }

    for (const row of movementsResults) {
      const dateKey = row.period_date instanceof Date 
        ? row.period_date.toISOString().split('T')[0] 
        : String(row.period_date);
      const existing = resultMap.get(dateKey);
      if (existing) {
        existing.stock_in = this.formatDecimal(row.stock_in);
        existing.stock_out = this.formatDecimal(row.stock_out);
      } else {
        resultMap.set(dateKey, {
          date: dateKey,
          sales_quantity: 0,
          sales_value: 0,
          stock_in: this.formatDecimal(row.stock_in),
          stock_out: this.formatDecimal(row.stock_out),
        });
      }
    }

    return Array.from(resultMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get top performing products
   */
  async getTopProducts(context: AnalyticsContext): Promise<ProductPerformance[]> {
    const accountFilter = this.buildAccountFilter(context, 'account_id');

    const products = await this.prisma.product.findMany({
      where: accountFilter,
      include: {
        inventory_item: {
          include: {
            category: true,
          },
        },
        sales: {
          where: {
            created_at: {
              gte: context.startDate,
              lte: context.endDate,
            },
          },
        },
      },
      orderBy: {
        stock_quantity: 'desc',
      },
      take: context.limit,
      skip: (context.page - 1) * context.limit,
    });

    return products.map((p) => {
      const salesQuantity = p.sales.reduce((sum, s) => sum + this.formatDecimal(s.quantity), 0);
      const salesValue = p.sales.reduce((sum, s) => sum + this.formatDecimal(s.total_amount), 0);

      return {
        product_id: p.id,
        product_name: p.name,
        category_name: p.inventory_item?.category?.name || 'Uncategorized',
        current_stock: this.formatDecimal(p.stock_quantity),
        stock_value: this.formatDecimal(p.stock_quantity) * this.formatDecimal(p.price),
        sales_quantity: salesQuantity,
        sales_value: salesValue,
        unit_price: this.formatDecimal(p.price),
        status: p.status,
      };
    });
  }

  /**
   * Get low stock items
   */
  async getLowStockItems(context: AnalyticsContext): Promise<LowStockItem[]> {
    const accountFilter = this.buildAccountFilter(context, 'account_id');

    const products = await this.prisma.product.findMany({
      where: {
        ...accountFilter,
        stock_quantity: {
          lte: 10,
        },
      },
      include: {
        inventory_item: {
          include: {
            category: true,
          },
        },
      },
      orderBy: {
        stock_quantity: 'asc',
      },
      take: context.limit,
      skip: (context.page - 1) * context.limit,
    });

    // Get last restock dates
    const productIds = products.map((p) => p.id);
    const lastRestocks = await this.prisma.inventoryMovement.findMany({
      where: {
        product_id: { in: productIds },
        movement_type: { in: ['purchase_in', 'adjustment_in', 'transfer_in'] },
      },
      orderBy: {
        created_at: 'desc',
      },
      distinct: ['product_id'],
      select: {
        product_id: true,
        created_at: true,
      },
    });

    const restockMap = new Map(lastRestocks.map((r) => [r.product_id, r.created_at]));

    return products.map((p) => {
      const lastRestock = restockMap.get(p.id);
      const daysSinceRestock = lastRestock 
        ? Math.floor((Date.now() - lastRestock.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        product_id: p.id,
        product_name: p.name,
        category_name: p.inventory_item?.category?.name || 'Uncategorized',
        current_stock: this.formatDecimal(p.stock_quantity),
        reorder_level: 10,
        unit_price: this.formatDecimal(p.price),
        days_since_last_restock: daysSinceRestock,
      };
    });
  }

  /**
   * Get total count for pagination
   */
  async getTotalCount(context: AnalyticsContext): Promise<number> {
    const accountFilter = this.buildAccountFilter(context, 'account_id');
    return this.prisma.product.count({ where: accountFilter });
  }
}
