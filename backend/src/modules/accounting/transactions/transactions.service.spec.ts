import { TransactionsService } from './transactions.service';
import { TransactionType } from './dto/create-transaction.dto';

describe('TransactionsService', () => {
  it('applies both date_from and date_to filters together', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      account: { findUnique: jest.fn().mockResolvedValue({ id: 'acc-1', code: 'ACC001' }) },
      chartOfAccount: { findMany: jest.fn().mockResolvedValue([{ id: 'co-1' }]) },
      accountingTransaction: { findMany },
    } as any;

    const service = new TransactionsService(prisma);
    await service.getTransactions({ default_account_id: 'acc-1' } as any, {
      type: TransactionType.EXPENSE,
      date_from: '2026-04-01',
      date_to: '2026-04-30',
      limit: 20,
    });

    expect(findMany).toHaveBeenCalledTimes(1);
    const arg = findMany.mock.calls[0][0];
    const expectedTo = new Date('2026-04-30');
    expectedTo.setHours(23, 59, 59, 999);
    expect(arg.where.transaction_date.gte).toEqual(new Date('2026-04-01'));
    expect(arg.where.transaction_date.lte).toEqual(expectedTo);
  });
});

