import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { User, Prisma } from '@prisma/client';
import { saleAtBoundsUtcInclusive } from '../../common/utils/sale-at-bounds.util';
import { PrismaService } from '../../prisma/prisma.service';
import { isPlatformSuperAdminRole } from '../admin/roles-permissions.config';

export type GetOverviewOpts = {
  aggregateAllAccounts?: boolean;
  membershipAccountId?: string;
};

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  /** Gemura Admin aggregate milk KPIs across all tenants (requires manage_users or platform admin). */
  private async assertPlatformOverviewAllowed(user: User, membershipAccountId: string): Promise<void> {
    const ua = await this.prisma.userAccount.findFirst({
      where: { user_id: user.id, account_id: membershipAccountId, status: 'active' },
    });
    if (!ua) {
      throw new ForbiddenException({
        code: 403,
        status: 'error',
        message: 'No active membership for aggregate overview.',
      });
    }
    if (isPlatformSuperAdminRole(ua.role)) return;

    let permissions: Record<string, boolean> | null = null;
    if (ua.permissions) {
      try {
        permissions =
          typeof ua.permissions === 'string' ? JSON.parse(ua.permissions as string) : (ua.permissions as Record<string, boolean>);
      } catch {
        permissions = null;
      }
    }
    if (permissions?.manage_users === true) return;

    throw new ForbiddenException({
      code: 403,
      status: 'error',
      message: 'Aggregate milk overview requires manage_users or platform admin.',
    });
  }

  async getOverview(
    user: User,
    accountIdParam?: string,
    dateFromStr?: string,
    dateToStr?: string,
    tzOffsetEastMinutes?: number,
    opts?: GetOverviewOpts,
  ) {
    let accountId: string | null = null;

    if (opts?.aggregateAllAccounts === true) {
      if (!opts.membershipAccountId) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Membership context required for aggregate overview.',
        });
      }
      await this.assertPlatformOverviewAllowed(user, opts.membershipAccountId);
      accountId = null;
    } else if (accountIdParam) {
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

    const milkScopeIncoming = (): Prisma.MilkSaleWhereInput =>
      accountId !== null ? { customer_account_id: accountId } : {};

    const milkScopeMovement = (): Prisma.MilkSaleWhereInput =>
      accountId !== null
        ? {
            OR: [{ supplier_account_id: accountId }, { customer_account_id: accountId }],
            status: { not: 'deleted' },
          }
        : { status: { not: 'deleted' } };

    const collectionsAgg = await this.prisma.milkSale.aggregate({
      where: baseWhere({
        ...milkScopeIncoming(),
        status: { not: 'deleted' },
      }),
      _sum: {
        quantity: true,
      },
      _count: true,
    });

    const collectionsWithValue = await this.prisma.milkSale.findMany({
      where: baseWhere({
        ...milkScopeIncoming(),
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

    const rejectionsWithValue = await this.prisma.milkSale.findMany({
      where: baseWhere({
        ...milkScopeIncoming(),
        status: 'rejected',
      }),
      select: {
        quantity: true,
        unit_price: true,
      },
    });
    let rejectionsTotalLiters = rejectionsWithValue.reduce((sum, sale) => sum + Number(sale.quantity), 0);
    let rejectionsTotalValue = rejectionsWithValue.reduce(
      (sum, sale) => sum + Number(sale.quantity) * Number(sale.unit_price),
      0,
    );
    let rejectionsTransactionsCount = rejectionsWithValue.length;

    // MCC intake rejections on supplier transfers (incl. partial accept → rejected_liters)
    if (accountId !== null) {
      const supplierUserLinks = await this.prisma.userAccount.findMany({
        where: { account_id: accountId, status: 'active' },
        select: { user_id: true },
      });
      const supplierUserIds = supplierUserLinks.map((l) => l.user_id);
      if (supplierUserIds.length > 0) {
        const processedAtFilter: Prisma.DateTimeFilter | undefined = saleAtFilter
          ? (saleAtFilter as Prisma.DateTimeFilter)
          : undefined;
        const intakeTransfers = await this.prisma.supplierTransfer.findMany({
          where: {
            supplier_user_id: { in: supplierUserIds },
            status: { in: ['rejected', 'partially_accepted'] },
            ...(processedAtFilter ? { processed_at: processedAtFilter } : { processed_at: { not: null } }),
          },
          select: {
            rejected_liters: true,
            total_liters: true,
            status: true,
          },
        });

        const priceRow = await this.prisma.supplierCustomer.findFirst({
          where: { supplier_account_id: accountId, relationship_status: 'active' },
          select: { price_per_liter: true },
          orderBy: { updated_at: 'desc' },
        });
        const defaultUnitPrice = priceRow ? Number(priceRow.price_per_liter) : 0;

        for (const tr of intakeTransfers) {
          const liters =
            tr.status === 'rejected'
              ? Number(tr.rejected_liters ?? tr.total_liters)
              : Number(tr.rejected_liters ?? 0);
          if (liters > 0) {
            rejectionsTotalLiters += liters;
            rejectionsTotalValue += liters * defaultUnitPrice;
            rejectionsTransactionsCount += 1;
          }
        }
      }
    }

    let salesTotalQuantity = 0;
    let salesTotalValue = 0;
    let salesTransactionsCount = 0;

    if (accountId !== null) {
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
      salesTotalValue = salesWithValue.reduce((sum, sale) => sum + Number(sale.quantity) * Number(sale.unit_price), 0);
      salesTotalQuantity = salesWithValue.reduce((sum, sale) => sum + Number(sale.quantity), 0);
      salesTransactionsCount = salesWithValue.length;
    } else {
      salesTotalQuantity = Number(collectionsAgg._sum.quantity) || 0;
      salesTotalValue = collectionsTotalValue;
      salesTransactionsCount = collectionsAgg._count || 0;
    }

    const suppliersCount = await this.prisma.supplierCustomer.groupBy({
      by: ['relationship_status'],
      where: accountId !== null ? { customer_account_id: accountId } : {},
      _count: true,
    });

    const activeSuppliers = suppliersCount.find((s) => s.relationship_status === 'active')?._count || 0;
    const inactiveSuppliers = suppliersCount.find((s) => s.relationship_status === 'inactive')?._count || 0;

    const customersCount = await this.prisma.supplierCustomer.groupBy({
      by: ['relationship_status'],
      where: accountId !== null ? { supplier_account_id: accountId } : {},
      _count: true,
    });

    const activeCustomers = customersCount.find((c) => c.relationship_status === 'active')?._count || 0;
    const inactiveCustomers = customersCount.find((c) => c.relationship_status === 'inactive')?._count || 0;

    const allTransactions = await this.prisma.milkSale.findMany({
      where: baseWhere(milkScopeMovement()),
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

    const breakdownMap = new Map<
      string,
      {
        sales_quantity: number;
        sales_value: number;
        collection_quantity: number;
        collection_value: number;
      }
    >();

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
      if (accountId !== null) {
        if (transaction.supplier_account_id === accountId) {
          dayData.sales_quantity += quantity;
          dayData.sales_value += value;
        }
        if (transaction.customer_account_id === accountId) {
          dayData.collection_quantity += quantity;
          dayData.collection_value += value;
        }
      } else {
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

    const recentTransactions = await this.prisma.milkSale.findMany({
      where: baseWhere(milkScopeMovement()),
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
      const isSale = accountId !== null && transaction.supplier_account_id === accountId;
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

    const firstTransaction = await this.prisma.milkSale.findFirst({
      where: baseWhere(milkScopeMovement()),
      orderBy: {
        sale_at: 'asc',
      },
      select: {
        sale_at: true,
      },
    });

    const lastTransaction = await this.prisma.milkSale.findFirst({
      where: baseWhere(milkScopeMovement()),
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
          rejections: {
            liters: rejectionsTotalLiters,
            value: rejectionsTotalValue,
            transactions: rejectionsTransactionsCount,
          },
          sales: {
            liters: salesTotalQuantity,
            value: salesTotalValue,
            transactions: salesTransactionsCount,
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
