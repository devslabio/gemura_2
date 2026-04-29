import { Injectable } from '@nestjs/common';
import { Account, ApiKey, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { BaseAnalyticsService, AnalyticsContext } from './base-analytics.service';
import { UnifiedAnalyticsQueryDto } from '../dto/unified-analytics-query.dto';

type ApiKeyWithAccount = ApiKey & { account?: Account | null };

@Injectable()
export class UnifiedAnalyticsService extends BaseAnalyticsService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async getEverything(apiKey: ApiKeyWithAccount, query: UnifiedAnalyticsQueryDto) {
    const context = await this.resolveAccountContext(apiKey, query);
    const accountWhere = this.buildAccountWhere(context, query);

    const [accounts, total] = await Promise.all([
      this.prisma.account.findMany({
        where: accountWhere,
        orderBy: { created_at: 'desc' },
        ...(query.limit != null && {
          take: query.limit,
          skip: ((context.page - 1) * query.limit),
        }),
        include: {
          user_accounts: {
            where: query.user_status ? { status: query.user_status as any } : { status: 'active' },
            include: {
              user: {
                select: { name: true, phone: true, email: true, account_type: true },
              },
            },
            take: 1,
            orderBy: { created_at: 'asc' },
          },
          _count: {
            select: { farms: true },
          },
        },
      }),
      this.prisma.account.count({ where: accountWhere }),
    ]);

    const rows = await Promise.all(
      accounts.map((account) => this.buildRow(account, context, query)),
    );

    return { accounts: rows, total, context };
  }

  private async buildRow(
    account: Account & {
      user_accounts: Array<{ user: { name: string; phone: string | null; email: string | null; account_type: string | null } }>;
      _count: { farms: number };
    },
    context: AnalyticsContext,
    query: UnifiedAnalyticsQueryDto,
  ) {
    const primaryUser = account.user_accounts[0]?.user ?? null;

    const dateFilter = { gte: context.startDate, lte: context.endDate };
    const saleStatusFilter: Prisma.MilkSaleWhereInput = query.sale_status
      ? { status: query.sale_status as any }
      : { status: { not: 'deleted' as any } };
    const paymentFilter: Prisma.MilkSaleWhereInput = query.payment_status
      ? { payment_status: query.payment_status }
      : {};
    const relWhere = query.relationship_status
      ? { relationship_status: query.relationship_status as any }
      : {};

    const [suppliers, customers, collections, sales] = await Promise.all([
      this.prisma.supplierCustomer.count({
        where: { customer_account_id: account.id, ...relWhere },
      }),
      this.prisma.supplierCustomer.count({
        where: { supplier_account_id: account.id, ...relWhere },
      }),
      this.prisma.milkSale.count({
        where: {
          customer_account_id: account.id,
          sale_at: dateFilter,
          ...saleStatusFilter,
          ...paymentFilter,
        },
      }),
      this.prisma.milkSale.count({
        where: {
          supplier_account_id: account.id,
          sale_at: dateFilter,
          ...saleStatusFilter,
          ...paymentFilter,
        },
      }),
    ]);

    return {
      name: primaryUser?.name ?? null,
      phone: primaryUser?.phone ?? null,
      email: primaryUser?.email ?? null,
      account_type: primaryUser?.account_type ?? account.type,
      status: account.status,
      created_at: account.created_at,
      suppliers,
      customers,
      collections,
      sales,
      farms: account._count.farms,
    };
  }

  private buildAccountWhere(
    context: AnalyticsContext,
    query: UnifiedAnalyticsQueryDto,
  ): Prisma.AccountWhereInput {
    const where: Prisma.AccountWhereInput = {};

    if (context.accountIds.length > 0) {
      where.id = context.accountIds.length === 1 ? context.accountIds[0] : { in: context.accountIds };
    }

    if (query.account_status) {
      where.status = query.account_status as any;
    }

    if (query.search && query.search.trim()) {
      const search = query.search.trim();
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        {
          user_accounts: {
            some: {
              user: {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { phone: { contains: search, mode: 'insensitive' } },
                  { email: { contains: search, mode: 'insensitive' } },
                ],
              },
            },
          },
        },
      ];
    }

    return where;
  }
}
