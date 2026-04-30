import { MilkProductionService } from './milk-production.service';

describe('MilkProductionService', () => {
  const user = { id: 'u-1', default_account_id: 'acc-1' } as any;

  it('weights accounting expenses by dairy_share_pct', async () => {
    const prisma = {
      account: { findUnique: jest.fn().mockResolvedValue({ id: 'acc-1', code: 'ACC001' }) },
      chartOfAccount: { findMany: jest.fn().mockResolvedValue([{ id: 'exp-1', name: 'Feed', code: 'EXP-ACC001-FEED' }]) },
      accountingTransaction: {
        findMany: jest.fn().mockResolvedValue([
          {
            dairy_share_pct: 50,
            cost_tags: [],
            entries: [{ debit_amount: 1000, account: { name: 'Feed' } }],
          },
        ]),
      },
      inventoryMovement: { findMany: jest.fn().mockResolvedValue([]) },
      milkProduction: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { quantity_litres: 100 }, _count: 1 }),
        groupBy: jest.fn().mockResolvedValue([{ animal_id: 'a-1', _sum: { quantity_litres: 100 } }]),
      },
      animal: { count: jest.fn().mockResolvedValue(2) },
    } as any;

    const service = new MilkProductionService(prisma);
    const report = await service.reportCostPerLitre(user, undefined, '2026-04-01', '2026-04-30');

    expect(report.total_expense_accounting).toBe(500);
    expect(report.total_expense).toBe(500);
    expect(report.cost_per_litre_producing_cows).toBe(2.5);
  });

  it('returns zero cost per litre when no production litres', async () => {
    const prisma = {
      account: { findUnique: jest.fn().mockResolvedValue({ id: 'acc-1', code: 'ACC001' }) },
      chartOfAccount: { findMany: jest.fn().mockResolvedValue([{ id: 'exp-1', name: 'Labour', code: 'EXP-ACC001-LABOUR' }]) },
      accountingTransaction: {
        findMany: jest.fn().mockResolvedValue([
          {
            dairy_share_pct: 100,
            cost_tags: [],
            entries: [{ debit_amount: 900, account: { name: 'Labour' } }],
          },
        ]),
      },
      inventoryMovement: { findMany: jest.fn().mockResolvedValue([]) },
      milkProduction: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { quantity_litres: 0 }, _count: 0 }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      animal: { count: jest.fn().mockResolvedValue(3) },
    } as any;

    const service = new MilkProductionService(prisma);
    const report = await service.reportCostPerLitre(user, undefined, '2026-04-01', '2026-04-30');

    expect(report.total_expense).toBe(900);
    expect(report.total_production_litres).toBe(0);
    expect(report.cost_per_litre_producing_cows).toBe(0);
  });
});

