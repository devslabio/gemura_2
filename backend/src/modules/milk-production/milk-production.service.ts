import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { User } from '@prisma/client';
import { CreateMilkProductionDto } from './dto/create-milk-production.dto';
import { UpdateMilkProductionDto } from './dto/update-milk-production.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class MilkProductionService {
  constructor(private readonly prisma: PrismaService) {}

  private getAccountId(user: User, accountId?: string): string {
    const id = accountId || user.default_account_id;
    if (!id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found. Please set a default account.',
      });
    }
    return id;
  }

  async create(user: User, dto: CreateMilkProductionDto, accountId?: string) {
    const accId = this.getAccountId(user, accountId);

    if (!dto.animal_id && !dto.farm_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Provide either animal_id or farm_id (or both).',
      });
    }

    let farmId: string | null = dto.farm_id ?? null;

    if (dto.animal_id) {
      const animal = await this.prisma.animal.findFirst({
        where: { id: dto.animal_id, account_id: accId },
      });
      if (!animal) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Animal not found or does not belong to this account.',
        });
      }
      // Use the cow's registered farm for the production record
      farmId = animal.farm_id;
      if (dto.farm_id && animal.farm_id && animal.farm_id !== dto.farm_id) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Animal is assigned to a different farm.',
        });
      }
    }

    if (farmId) {
      const farm = await this.prisma.farm.findFirst({
        where: { id: farmId, account_id: accId },
      });
      if (!farm) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Farm not found or does not belong to this account.',
        });
      }
    }

    const productionDate = new Date(dto.production_date);
    if (isNaN(productionDate.getTime())) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Invalid production_date.',
      });
    }

    const record = await this.prisma.milkProduction.create({
      data: {
        account_id: accId,
        farm_id: farmId,
        animal_id: dto.animal_id || null,
        production_date: productionDate,
        quantity_litres: dto.quantity_litres,
        session: dto.session || null,
        notes: dto.notes || null,
        created_by: user.id,
      },
      include: {
        animal: { select: { id: true, tag_number: true, name: true } },
        farm: { select: { id: true, name: true, code: true } },
      },
    });
    return record;
  }

  async findAll(
    user: User,
    accountId?: string,
    filters?: { animal_id?: string; farm_id?: string; session?: string; from?: string; to?: string },
  ) {
    const accId = this.getAccountId(user, accountId);
    const where: Prisma.MilkProductionWhereInput = { account_id: accId };

    if (filters?.animal_id) where.animal_id = filters.animal_id;
    if (filters?.farm_id) where.farm_id = filters.farm_id;
    if (filters?.session) where.session = filters.session;
    if (filters?.from || filters?.to) {
      where.production_date = {};
      if (filters.from) (where.production_date as Prisma.DateTimeFilter).gte = new Date(filters.from);
      if (filters.to) (where.production_date as Prisma.DateTimeFilter).lte = new Date(filters.to);
    }

    const list = await this.prisma.milkProduction.findMany({
      where,
      include: {
        animal: { select: { id: true, tag_number: true, name: true } },
        farm: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ production_date: 'desc' }, { created_at: 'desc' }],
    });
    return list;
  }

  async findOne(user: User, id: string, accountId?: string) {
    const accId = this.getAccountId(user, accountId);
    const record = await this.prisma.milkProduction.findFirst({
      where: { id, account_id: accId },
      include: {
        animal: { select: { id: true, tag_number: true, name: true, breed: { select: { id: true, name: true } } } },
        farm: { select: { id: true, name: true, code: true } },
      },
    });
    if (!record) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Milk production record not found',
      });
    }
    return record;
  }

  async update(
    user: User,
    id: string,
    dto: UpdateMilkProductionDto,
    accountId?: string,
  ) {
    const accId = this.getAccountId(user, accountId);
    const existing = await this.prisma.milkProduction.findFirst({
      where: { id, account_id: accId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Milk production record not found',
      });
    }

    const data: Prisma.MilkProductionUncheckedUpdateInput = {};
    if (dto.farm_id !== undefined) data.farm_id = dto.farm_id || null;
    if (dto.animal_id !== undefined) data.animal_id = dto.animal_id || null;
    if (dto.production_date !== undefined) data.production_date = new Date(dto.production_date);
    if (dto.quantity_litres !== undefined) data.quantity_litres = dto.quantity_litres;
    if (dto.session !== undefined) data.session = dto.session || null;
    if (dto.notes !== undefined) data.notes = dto.notes || null;

    const updated = await this.prisma.milkProduction.update({
      where: { id },
      data,
      include: {
        animal: { select: { id: true, tag_number: true, name: true } },
        farm: { select: { id: true, name: true, code: true } },
      },
    });
    return updated;
  }

  async remove(user: User, id: string, accountId?: string) {
    const accId = this.getAccountId(user, accountId);
    const existing = await this.prisma.milkProduction.findFirst({
      where: { id, account_id: accId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Milk production record not found',
      });
    }
    await this.prisma.milkProduction.delete({ where: { id } });
    return { id, message: 'Milk production record deleted' };
  }

  async reportProductionVsSold(
    user: User,
    accountId?: string,
    from?: string,
    to?: string,
  ) {
    const accId = this.getAccountId(user, accountId);
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    const productionWhere: Prisma.MilkProductionWhereInput = { account_id: accId };
    if (fromDate || toDate) {
      productionWhere.production_date = {};
      if (fromDate) (productionWhere.production_date as Prisma.DateTimeFilter).gte = fromDate;
      if (toDate) (productionWhere.production_date as Prisma.DateTimeFilter).lte = toDate;
    }

    const [productionRecords, salesRecords] = await Promise.all([
      this.prisma.milkProduction.aggregate({
        where: productionWhere,
        _sum: { quantity_litres: true },
        _count: true,
      }),
      this.prisma.milkSale.findMany({
        where: {
          supplier_account_id: accId,
          ...(fromDate || toDate
            ? {
                sale_at: {
                  ...(fromDate && { gte: fromDate }),
                  ...(toDate && { lte: toDate }),
                },
              }
            : {}),
        },
        select: { quantity: true, animal_id: true },
      }),
    ]);

    const totalSold = salesRecords.reduce((s, r) => s + Number(r.quantity), 0);
    const totalProduction = Number(productionRecords._sum.quantity_litres ?? 0);

    return {
      from: from ?? null,
      to: to ?? null,
      total_production_litres: totalProduction,
      total_sold_litres: totalSold,
      production_record_count: productionRecords._count,
      sale_count: salesRecords.length,
    };
  }

  async reportCostPerLitre(
    user: User,
    accountId?: string,
    from?: string,
    to?: string,
    farmId?: string,
    includeInventoryFeedCosts = true,
    avoidDoubleCounting = true,
  ) {
    const accId = this.getAccountId(user, accountId);
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    if (toDate) toDate.setHours(23, 59, 59, 999);

    const defaultAccount = await this.prisma.account.findUnique({
      where: { id: accId },
      select: { code: true, id: true },
    });
    const accountPrefix = defaultAccount?.code || accId.substring(0, 8).toUpperCase();
    const scopedExpenseAccounts = await this.prisma.chartOfAccount.findMany({
      where: {
        is_active: true,
        account_type: 'Expense',
        code: { startsWith: `EXP-${accountPrefix}` },
      },
      select: { id: true, name: true, code: true },
    });
    const scopedExpenseAccountIds = scopedExpenseAccounts.map((a) => a.id);

    const productionWhere: Prisma.MilkProductionWhereInput = {
      account_id: accId,
      ...(farmId ? { farm_id: farmId } : {}),
      ...(fromDate || toDate
        ? {
            production_date: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    };
    const producingByAnimal = await this.prisma.milkProduction.groupBy({
      by: ['animal_id'],
      where: {
        ...productionWhere,
        animal_id: { not: null },
      },
      _sum: { quantity_litres: true },
    });
    const producingAnimalIds = producingByAnimal
      .filter((r) => r.animal_id && Number(r._sum.quantity_litres || 0) > 0)
      .map((r) => r.animal_id as string);

    const producingByAnimalAll = await this.prisma.milkProduction.groupBy({
      by: ['animal_id'],
      where: {
        account_id: accId,
        ...(fromDate || toDate
          ? {
              production_date: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
        animal_id: { not: null },
      },
      _sum: { quantity_litres: true },
    });
    const producingCowsAllFarms = producingByAnimalAll.filter((r) => r.animal_id && Number(r._sum.quantity_litres || 0) > 0).length;
    const producingCows = producingAnimalIds.length;
    const sharedCostFarmFactor = farmId
      ? (producingCowsAllFarms > 0 ? producingCows / producingCowsAllFarms : 0)
      : 1;

    const transactions =
      scopedExpenseAccountIds.length === 0
        ? []
        : await this.prisma.accountingTransaction.findMany({
            where: {
              transaction_date: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
              entries: {
                some: {
                  account_id: { in: scopedExpenseAccountIds },
                  debit_amount: { not: null },
                },
              },
            },
            include: {
              entries: {
                where: { account_id: { in: scopedExpenseAccountIds } },
                include: { account: true },
              },
            },
          });

    const expenseByCategory: Record<string, number> = {};
    let totalExpenseFromAccounting = 0;
    for (const t of transactions) {
      const tags = Array.isArray((t as any).cost_tags)
        ? (t as any).cost_tags.map((v: string) => String(v).toLowerCase())
        : [];
      const txFarmId = (t as any).farm_id as string | null | undefined;
      if (farmId && txFarmId && txFarmId !== farmId) continue;
      if (
        includeInventoryFeedCosts &&
        avoidDoubleCounting &&
        (tags.includes('inventory_feed') || tags.includes('inventory_linked'))
      ) {
        continue;
      }
      const dairySharePct = Number((t as any).dairy_share_pct ?? 100);
      const shareFactor = Math.min(100, Math.max(0, dairySharePct)) / 100;
      const farmFactor = !farmId ? 1 : (txFarmId === farmId ? 1 : sharedCostFarmFactor);
      for (const e of t.entries) {
        const baseAmount = Number(e.debit_amount || 0);
        const amount = baseAmount * shareFactor * farmFactor;
        if (amount <= 0) continue;
        totalExpenseFromAccounting += amount;
        const category = e.account.name || 'Other';
        expenseByCategory[category] = (expenseByCategory[category] || 0) + amount;
      }
    }

    let totalInventoryFeedCost = 0;
    if (includeInventoryFeedCosts) {
      const feedMovements = await this.prisma.inventoryMovement.findMany({
        where: {
          movement_type: { in: ['purchase_in', 'adjustment_in'] },
          // Use movement effective date for period costing.
          movement_date: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
          product: {
            account_id: accId,
            categories: {
              some: {
                category: {
                  OR: [
                    { name: { equals: 'feed', mode: 'insensitive' } },
                    { name: { equals: 'feeds', mode: 'insensitive' } },
                    { name: { equals: 'animal feed', mode: 'insensitive' } },
                    { name: { equals: 'fodder', mode: 'insensitive' } },
                    { name: { equals: 'silage', mode: 'insensitive' } },
                    { name: { equals: 'concentrate', mode: 'insensitive' } },
                  ],
                },
              },
            },
          },
          unit_price: { not: null },
        },
        select: {
          quantity: true,
          unit_price: true,
        },
      });
      totalInventoryFeedCost = feedMovements.reduce((sum, m) => {
        const qty = Number(m.quantity || 0);
        const unit = Number(m.unit_price || 0);
        return sum + qty * unit;
      }, 0) * sharedCostFarmFactor;
      if (totalInventoryFeedCost > 0) {
        expenseByCategory['Feed (Inventory Inflow)'] =
          (expenseByCategory['Feed (Inventory Inflow)'] || 0) + totalInventoryFeedCost;
      }
    }

    const totalExpense = totalExpenseFromAccounting + totalInventoryFeedCost;

    const totalProductionAgg = await this.prisma.milkProduction.aggregate({
      where: productionWhere,
      _sum: { quantity_litres: true },
      _count: true,
    });
    const totalProductionLitres = Number(totalProductionAgg._sum.quantity_litres || 0);

    const totalCows = await this.prisma.animal.count({
      where: {
        account_id: accId,
        status: 'active',
        gender: 'female',
        ...(farmId ? { farm_id: farmId } : {}),
        species: {
          OR: [
            { code: { in: ['cattle', 'cow', 'dairy_cattle'] } },
            { name: { contains: 'cattle', mode: 'insensitive' } },
            { name: { contains: 'cow', mode: 'insensitive' } },
          ],
        },
      },
    });

    const nonProducingCows = Math.max(0, totalCows - producingCows);
    const herdCountForAllocation = totalCows > 0 ? totalCows : Math.max(producingCows, 1);

    const producingCostEstimate = totalExpense * (producingCows / herdCountForAllocation);
    const nonProducingCostEstimate = totalExpense - producingCostEstimate;
    const costPerLitreProducing =
      totalProductionLitres > 0 ? producingCostEstimate / totalProductionLitres : 0;

    const expenseSeries = Object.entries(expenseByCategory)
      .map(([category_name, amount]) => ({ category_name, amount }))
      .sort((a, b) => b.amount - a.amount);

    return {
      from: from ?? null,
      to: to ?? null,
      farm_id: farmId ?? null,
      total_expense: totalExpense,
      total_expense_accounting: totalExpenseFromAccounting,
      total_expense_inventory_feed: totalInventoryFeedCost,
      total_production_litres: totalProductionLitres,
      total_cows: totalCows,
      producing_cows: producingCows,
      non_producing_cows: nonProducingCows,
      producing_cost_estimate: producingCostEstimate,
      non_producing_cost_estimate: nonProducingCostEstimate,
      cost_per_litre_producing_cows: costPerLitreProducing,
      expense_by_category: expenseSeries,
      notes: [
        'Expenses are taken from account-scoped Expense chart accounts (EXP-*).',
        'Each transaction is weighted by dairy_share_pct (defaults to 100%).',
        farmId
          ? 'Farm filter uses direct farm-tagged transaction attribution and allocates shared/untagged costs by producing-cow share.'
          : 'No farm filter applied; values are account-level.',
        includeInventoryFeedCosts
          ? 'Feed inventory inflows are included from purchase_in/adjustment_in movements with feed-like categories.'
          : 'Feed inventory inflows are excluded.',
        includeInventoryFeedCosts && avoidDoubleCounting
          ? 'Transactions tagged inventory_feed/inventory_linked are excluded to avoid double counting.'
          : 'No tag-based double-count prevention applied.',
        'Costs are allocated between producing and non-producing cows by headcount share.',
      ],
    };
  }
}
