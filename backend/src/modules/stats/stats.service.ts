import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { User, Prisma } from '@prisma/client';

/** YYYY-MM-DD calendar bounds in a fixed offset east of UTC (see GetOverviewDto.tz_offset_minutes). Uses 24h spans (no DST). */
function saleAtBoundsUtcInclusive(dateFromStr: string, dateToStr: string, tzOffsetEastMinutes?: number): { gte: Date; lte: Date } {
  const dayBounds = (dateStr: string): { start: Date; end: Date } => {
    const [y, mo, d] = dateStr.split('-').map(Number);
    if (tzOffsetEastMinutes === undefined) {
      return {
        start: new Date(`${dateStr}T00:00:00.000Z`),
        end: new Date(`${dateStr}T23:59:59.999Z`),
      };
    }
    const startMs = Date.UTC(y, mo - 1, d, 0, 0, 0, 0) - tzOffsetEastMinutes * 60 * 1000;
    const endMs = startMs + 86400000 - 1;
    return { start: new Date(startMs), end: new Date(endMs) };
  };
  const from = dayBounds(dateFromStr);
  const to = dayBounds(dateToStr);
  return { gte: from.start, lte: to.end };
}

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  async getOverview(user: User, accountIdParam?: string, dateFromStr?: string, dateToStr?: string, tzOffsetEastMinutes?: number) {
    let accountId: string;

    if (accountIdParam) {
      const hasAccess = await this.prisma.userAccount.findFirst({
        where: {
          user_id: user.id,
          account_id: accountIdParam,
          status: 'active',
        },
        include: { account: true },
      });
      if (!hasAccess?.account || hasAccess.account.status !== 'active') {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Account not found or access denied.',
        });
      }
      accountId = accountIdParam;
    } else {
      if (!user.default_account_id) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'No valid default account found.',
        });
      }
      accountId = user.default_account_id;
    }

    const saleAtFilter: Prisma.MilkSaleWhereInput['sale_at'] =
      dateFromStr && dateToStr ? saleAtBoundsUtcInclusive(dateFromStr, dateToStr, tzOffsetEastMinutes) : undefined;

    const baseWhere = (extra: Prisma.MilkSaleWhereInput): Prisma.MilkSaleWhereInput => ({
      ...extra,
      ...(saleAtFilter && { sale_at: saleAtFilter }),
    });

    // Get collections data (customer perspective)
    const collectionsAgg = await this.prisma.milkSale.aggregate({
      where: baseWhere({
        customer_account_id: accountId,
        status: { not: 'deleted' },
      }),
      _sum: {
        quantity: true,
      },
      _count: true,
    });

    // Calculate total value (quantity * unit_price)
    const collectionsWithValue = await this.prisma.milkSale.findMany({
      where: baseWhere({
        customer_account_id: accountId,
        status: { not: 'deleted' },
      }),
      select: {
        quantity: true,
        unit_price: true,
      },
    });
    const collectionsTotalValue = collectionsWithValue.reduce(
      (sum, sale) => sum + Number(sale.quantity) * Number(sale.unit_price),
      0,
    );

    // Get sales data (supplier perspective)
    const salesWithValue = await this.prisma.milkSale.findMany({
      where: baseWhere({
        supplier_account_id: accountId,
        status: { not: 'deleted' },
      }),
      select: {
        quantity: true,
        unit_price: true,
      },
    });
    const salesTotalValue = salesWithValue.reduce(
      (sum, sale) => sum + Number(sale.quantity) * Number(sale.unit_price),
      0,
    );
    const salesTotalQuantity = salesWithValue.reduce(
      (sum, sale) => sum + Number(sale.quantity),
      0,
    );

    // Get suppliers count (active and inactive)
    const suppliersCount = await this.prisma.supplierCustomer.groupBy({
      by: ['relationship_status'],
      where: {
        customer_account_id: accountId,
      },
      _count: true,
    });

    const activeSuppliers = suppliersCount.find((s) => s.relationship_status === 'active')?._count || 0;
    const inactiveSuppliers = suppliersCount.find((s) => s.relationship_status === 'inactive')?._count || 0;

    // Get customers count (active and inactive)
    const customersCount = await this.prisma.supplierCustomer.groupBy({
      by: ['relationship_status'],
      where: {
        supplier_account_id: accountId,
      },
      _count: true,
    });

    const activeCustomers = customersCount.find((c) => c.relationship_status === 'active')?._count || 0;
    const inactiveCustomers = customersCount.find((c) => c.relationship_status === 'inactive')?._count || 0;

    // Generate daily breakdown - get all transactions and group by date
    const allTransactions = await this.prisma.milkSale.findMany({
      where: baseWhere({
        OR: [
          { supplier_account_id: accountId },
          { customer_account_id: accountId },
        ],
        status: { not: 'deleted' },
      }),
      select: {
        sale_at: true,
        quantity: true,
        unit_price: true,
        supplier_account_id: true,
        customer_account_id: true,
      },
      orderBy: {
        sale_at: 'asc',
      },
    });

    // Group by date
    const breakdownMap = new Map<string, {
      sales_quantity: number;
      sales_value: number;
      collection_quantity: number;
      collection_value: number;
    }>();

    allTransactions.forEach((transaction) => {
      const date = transaction.sale_at.toISOString().split('T')[0];
      const quantity = Number(transaction.quantity);
      const unitPrice = Number(transaction.unit_price);
      const value = quantity * unitPrice;

      if (!breakdownMap.has(date)) {
        breakdownMap.set(date, {
          sales_quantity: 0,
          sales_value: 0,
          collection_quantity: 0,
          collection_value: 0,
        });
      }

      const dayData = breakdownMap.get(date)!;
      if (transaction.supplier_account_id === accountId) {
        dayData.sales_quantity += quantity;
        dayData.sales_value += value;
      }
      if (transaction.customer_account_id === accountId) {
        dayData.collection_quantity += quantity;
        dayData.collection_value += value;
      }
    });

    const breakdown = Array.from(breakdownMap.entries())
      .map(([dateStr, data]) => {
        const date = new Date(dateStr);
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return {
          label: dayNames[date.getDay()],
          date: dateStr,
          collection: {
            liters: data.collection_quantity,
            value: data.collection_value,
          },
          sales: {
            liters: data.sales_quantity,
            value: data.sales_value,
          },
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get recent transactions (last 10)
    const recentTransactions = await this.prisma.milkSale.findMany({
      where: baseWhere({
        OR: [
          { supplier_account_id: accountId },
          { customer_account_id: accountId },
        ],
        status: { not: 'deleted' },
      }),
      include: {
        supplier_account: {
          select: {
            code: true,
            name: true,
            type: true,
            status: true,
          },
        },
        customer_account: {
          select: {
            code: true,
            name: true,
            type: true,
            status: true,
          },
        },
      },
      orderBy: {
        sale_at: 'desc',
      },
      take: 10,
    });

    const formattedTransactions = recentTransactions.map((transaction) => {
      const isSale = transaction.supplier_account_id === accountId;
      return {
        id: transaction.id,
        quantity: Number(transaction.quantity),
        unit_price: Number(transaction.unit_price),
        total_amount: Number(transaction.quantity) * Number(transaction.unit_price),
        status: transaction.status,
        transaction_at: transaction.sale_at.toISOString(),
        notes: transaction.notes || null,
        created_at: transaction.created_at.toISOString(),
        type: isSale ? 'sale' : 'collection',
        supplier_account: transaction.supplier_account
          ? {
              code: transaction.supplier_account.code,
              name: transaction.supplier_account.name,
              type: transaction.supplier_account.type,
              status: transaction.supplier_account.status,
            }
          : null,
        customer_account: transaction.customer_account
          ? {
              code: transaction.customer_account.code,
              name: transaction.customer_account.name,
              type: transaction.customer_account.type,
              status: transaction.customer_account.status,
            }
          : null,
      };
    });

    // Get date range (requested range or actual data range)
    const firstTransaction = await this.prisma.milkSale.findFirst({
      where: baseWhere({
        OR: [
          { supplier_account_id: accountId },
          { customer_account_id: accountId },
        ],
        status: { not: 'deleted' },
      }),
      orderBy: {
        sale_at: 'asc',
      },
      select: {
        sale_at: true,
      },
    });

    const lastTransaction = await this.prisma.milkSale.findFirst({
      where: baseWhere({
        OR: [
          { supplier_account_id: accountId },
          { customer_account_id: accountId },
        ],
        status: { not: 'deleted' },
      }),
      orderBy: {
        sale_at: 'desc',
      },
      select: {
        sale_at: true,
      },
    });

    const dateFrom =
      dateFromStr ??
      (firstTransaction ? firstTransaction.sale_at.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    const dateTo =
      dateToStr ??
      (lastTransaction ? lastTransaction.sale_at.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);

    return {
      code: 200,
      status: 'success',
      message: 'Overview data fetched successfully.',
      data: {
        summary: {
          collection: {
            liters: Number(collectionsAgg._sum.quantity) || 0,
            value: collectionsTotalValue,
            transactions: collectionsAgg._count || 0,
          },
          sales: {
            liters: salesTotalQuantity,
            value: salesTotalValue,
            transactions: salesWithValue.length,
          },
          suppliers: {
            active: activeSuppliers,
            inactive: inactiveSuppliers,
          },
          customers: {
            active: activeCustomers,
            inactive: inactiveCustomers,
          },
        },
        breakdown_type: 'daily',
        chart_period: 'last_7_days',
        breakdown,
        recent_transactions: formattedTransactions,
        date_range: {
          from: dateFrom,
          to: dateTo,
        },
      },
    };
  }

  async getStats(user: User) {
    return this.getOverview(user);
  }
}

