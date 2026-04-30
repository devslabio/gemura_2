import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { User } from '@prisma/client';
import { CreateTransactionDto, TransactionType } from './dto/create-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  private readonly dairyExpenseCategorySeeds = [
    { codeSuffix: 'FEED', name: 'Feed & Fodder' },
    { codeSuffix: 'LABOUR', name: 'Labour' },
    { codeSuffix: 'VET', name: 'Veterinary & Drugs' },
    { codeSuffix: 'BREEDING', name: 'Breeding / AI' },
    { codeSuffix: 'UTILITIES', name: 'Utilities' },
    { codeSuffix: 'WATER', name: 'Water' },
    { codeSuffix: 'ELECTRICITY', name: 'Electricity' },
    { codeSuffix: 'MAINTENANCE', name: 'Maintenance & Tools' },
    { codeSuffix: 'INSURANCE', name: 'Livestock Insurance' },
    { codeSuffix: 'TRANSPORT', name: 'Transport' },
    { codeSuffix: 'OVERHEAD', name: 'General Overheads' },
  ] as const;

  /**
   * Chart of account IDs that scope P&L and the finance transaction list to one farm/tenant ledger
   * (same rules as ReportsService income statement).
   */
  private async getAccountScopedChartIds(defaultAccountId: string): Promise<string[]> {
    const defaultAccount = await this.prisma.account.findUnique({
      where: { id: defaultAccountId },
    });
    if (!defaultAccount) return [];
    const prefix = defaultAccount.code || defaultAccount.id.substring(0, 8).toUpperCase();
    const accountCharts = await this.prisma.chartOfAccount.findMany({
      where: {
        is_active: true,
        OR: [
          { code: { startsWith: `CASH-${prefix}` } },
          { code: { startsWith: `REV-${prefix}` } },
          { code: { startsWith: `EXP-${prefix}` } },
        ],
      },
      select: { id: true },
    });
    return accountCharts.map((c) => c.id);
  }

  private async getDefaultAccount(user: User) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found. Please set a default account first.',
      });
    }
    const defaultAccount = await this.prisma.account.findUnique({
      where: { id: user.default_account_id },
    });
    if (!defaultAccount) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Default account not found.',
      });
    }
    return defaultAccount;
  }

  async ensureDairyExpenseAccounts(user: User) {
    const defaultAccount = await this.getDefaultAccount(user);
    const prefix = defaultAccount.code || defaultAccount.id.substring(0, 8).toUpperCase();
    const createdOrExisting = await Promise.all(
      this.dairyExpenseCategorySeeds.map(async (seed) => {
        const code = `EXP-${prefix}-${seed.codeSuffix}`;
        let account = await this.prisma.chartOfAccount.findFirst({
          where: { code, account_type: 'Expense', is_active: true },
        });
        if (!account) {
          account = await this.prisma.chartOfAccount.create({
            data: {
              code,
              name: `${seed.name} - ${defaultAccount.name}`,
              account_type: 'Expense',
              is_active: true,
            },
          });
        }
        return account;
      }),
    );
    return createdOrExisting;
  }

  async getExpenseAccounts(user: User, ensureDefaults = false) {
    const defaultAccount = await this.getDefaultAccount(user);
    const prefix = defaultAccount.code || defaultAccount.id.substring(0, 8).toUpperCase();
    if (ensureDefaults) {
      await this.ensureDairyExpenseAccounts(user);
    }
    const accounts = await this.prisma.chartOfAccount.findMany({
      where: {
        account_type: 'Expense',
        is_active: true,
        code: { startsWith: `EXP-${prefix}` },
      },
      orderBy: [{ code: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
      },
    });
    return {
      code: 200,
      status: 'success',
      message: 'Expense accounts fetched successfully.',
      data: accounts,
    };
  }

  async createTransaction(user: User, createDto: CreateTransactionDto) {
    const defaultAccount = await this.getDefaultAccount(user);

    // Find or create Cash/Asset account for this account
    const cashAccountCode = `CASH-${defaultAccount.code || defaultAccount.id.substring(0, 8).toUpperCase()}`;
    let cashAccount = await this.prisma.chartOfAccount.findFirst({
      where: {
        code: cashAccountCode,
        account_type: 'Asset',
        is_active: true,
      },
    });

    if (!cashAccount) {
      cashAccount = await this.prisma.chartOfAccount.create({
        data: {
          code: cashAccountCode,
          name: `Cash - ${defaultAccount.name}`,
          account_type: 'Asset',
          is_active: true,
        },
      });
    }

    // Find or get the revenue/expense account
    let categoryAccount: any;
    if (createDto.account_id) {
      // Use provided account
      categoryAccount = await this.prisma.chartOfAccount.findUnique({
        where: { id: createDto.account_id },
      });
      if (!categoryAccount) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Specified account not found.',
        });
      }
      // Validate account type matches transaction type
      if (
        (createDto.type === TransactionType.REVENUE && categoryAccount.account_type !== 'Revenue') ||
        (createDto.type === TransactionType.EXPENSE && categoryAccount.account_type !== 'Expense')
      ) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: `Account type mismatch. Expected ${createDto.type === TransactionType.REVENUE ? 'Revenue' : 'Expense'} account.`,
        });
      }
    } else {
      // Find or create default revenue/expense account
      const accountType = createDto.type === TransactionType.REVENUE ? 'Revenue' : 'Expense';
      const defaultAccountName = createDto.type === TransactionType.REVENUE ? 'General Revenue' : 'General Expense';
      const defaultAccountCode = createDto.type === TransactionType.REVENUE 
        ? `REV-${defaultAccount.code || defaultAccount.id.substring(0, 8).toUpperCase()}`
        : `EXP-${defaultAccount.code || defaultAccount.id.substring(0, 8).toUpperCase()}`;

      categoryAccount = await this.prisma.chartOfAccount.findFirst({
        where: {
          code: defaultAccountCode,
          account_type: accountType,
          is_active: true,
        },
      });

      if (!categoryAccount) {
        categoryAccount = await this.prisma.chartOfAccount.create({
          data: {
            code: defaultAccountCode,
            name: `${defaultAccountName} - ${defaultAccount.name}`,
            account_type: accountType,
            is_active: true,
          },
        });
      }
    }

    // Create journal entry
    // For Revenue: Credit Revenue account, Debit Cash account
    // For Expense: Debit Expense account, Credit Cash account
    const transactionDate = new Date(createDto.transaction_date);
    const amount = Number(createDto.amount);

    const transaction = await this.prisma.accountingTransaction.create({
      data: {
        transaction_date: transactionDate,
        description: createDto.description,
        total_amount: amount,
        created_by: user.id,
        entries: {
          create: [
            // Revenue entry
            ...(createDto.type === TransactionType.REVENUE
              ? [
                  {
                    account_id: categoryAccount.id,
                    credit_amount: amount,
                    debit_amount: null,
                    description: createDto.description,
                  },
                  {
                    account_id: cashAccount.id,
                    debit_amount: amount,
                    credit_amount: null,
                    description: createDto.description,
                  },
                ]
              : [
                  // Expense entry
                  {
                    account_id: categoryAccount.id,
                    debit_amount: amount,
                    credit_amount: null,
                    description: createDto.description,
                  },
                  {
                    account_id: cashAccount.id,
                    credit_amount: amount,
                    debit_amount: null,
                    description: createDto.description,
                  },
                ]),
          ],
        },
      },
      include: {
        entries: {
          include: {
            account: true,
          },
        },
      },
    });

    return {
      code: 200,
      status: 'success',
      message: `${createDto.type === TransactionType.REVENUE ? 'Revenue' : 'Expense'} recorded successfully.`,
      data: {
        id: transaction.id,
        type: createDto.type,
        amount: amount,
        description: createDto.description,
        transaction_date: transaction.transaction_date,
        account: defaultAccount.name,
        category_account: categoryAccount.name,
        cash_account: cashAccount.name,
      },
    };
  }

  async getTransactions(user: User, filters?: { type?: TransactionType; date_from?: string; date_to?: string; limit?: number }) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found.',
      });
    }

    const accountScopedChartIds = await this.getAccountScopedChartIds(user.default_account_id);
    if (accountScopedChartIds.length === 0) {
      return {
        code: 200,
        status: 'success',
        message: 'Transactions fetched successfully.',
        data: [],
      };
    }

    const from = filters?.date_from ? new Date(filters.date_from) : undefined;
    let to: Date | undefined;
    if (filters?.date_to) {
      to = new Date(filters.date_to);
      to.setHours(23, 59, 59, 999);
    }

    // Same ledger scope as income statement: any journal touching this account's CASH/REV/EXP charts.
    // Exclude created_by so all farm activities (sales, payments, other users) appear in the list.
    const transactions = await this.prisma.accountingTransaction.findMany({
      where: {
        entries: {
          some: {
            account_id: { in: accountScopedChartIds },
          },
        },
        ...(from && { transaction_date: { gte: from } }),
        ...(to && { transaction_date: { lte: to } }),
      },
      include: {
        entries: {
          include: {
            account: true,
          },
        },
      },
      orderBy: { transaction_date: 'desc' },
      take: filters?.limit || 50,
    });

    // Filter and format transactions
    const formattedTransactions = transactions
      .map((t) => {
        // Determine if it's revenue or expense based on entries
        const revenueEntry = t.entries.find((e) => e.account.account_type === 'Revenue' && e.credit_amount);
        const expenseEntry = t.entries.find((e) => e.account.account_type === 'Expense' && e.debit_amount);

        // Receivable payment: DR Cash, CR AR (Asset) - money received
        const arPaymentEntry = t.entries.find(
          (e) =>
            e.account.account_type === 'Asset' &&
            e.account.code?.startsWith('AR-') &&
            e.credit_amount,
        );
        // Payable payment: DR AP (Liability), CR Cash - money paid
        const apPaymentEntry = t.entries.find(
          (e) =>
            e.account.account_type === 'Liability' &&
            e.account.code?.startsWith('AP-') &&
            e.debit_amount,
        );

        let type: TransactionType;
        let amount: number;
        let categoryAccount: string;

        if (revenueEntry) {
          type = TransactionType.REVENUE;
          amount = Number(revenueEntry.credit_amount);
          categoryAccount = revenueEntry.account.name;
        } else if (expenseEntry) {
          type = TransactionType.EXPENSE;
          amount = Number(expenseEntry.debit_amount);
          categoryAccount = expenseEntry.account.name;
        } else if (arPaymentEntry) {
          type = TransactionType.REVENUE;
          amount = Number(arPaymentEntry.credit_amount);
          categoryAccount = arPaymentEntry.account.name;
        } else if (apPaymentEntry) {
          type = TransactionType.EXPENSE;
          amount = Number(apPaymentEntry.debit_amount);
          categoryAccount = apPaymentEntry.account.name;
        } else {
          return null;
        }

        // Apply type filter if provided
        if (filters?.type && filters.type !== type) return null;

        return {
          id: t.id,
          type,
          amount,
          description: t.description,
          transaction_date: t.transaction_date,
          category_account: categoryAccount,
        };
      })
      .filter((t) => t !== null);

    return {
      code: 200,
      status: 'success',
      message: 'Transactions fetched successfully.',
      data: formattedTransactions,
    };
  }

  async getTransaction(user: User, transactionId: string) {
    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found.',
      });
    }

    const transaction = await this.prisma.accountingTransaction.findUnique({
      where: { id: transactionId },
      include: {
        entries: {
          include: {
            account: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new BadRequestException({
        code: 404,
        status: 'error',
        message: 'Transaction not found.',
      });
    }

    if (!user.default_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found.',
      });
    }
    const scopedIds = await this.getAccountScopedChartIds(user.default_account_id);
    const touchesLedger = transaction.entries.some((e) => scopedIds.includes(e.account_id));
    if (!touchesLedger) {
      throw new BadRequestException({
        code: 403,
        status: 'error',
        message: 'Access denied.',
      });
    }

    // Determine type
    const revenueEntry = transaction.entries.find((e) => e.account.account_type === 'Revenue' && e.credit_amount);
    const expenseEntry = transaction.entries.find((e) => e.account.account_type === 'Expense' && e.debit_amount);
    const arPaymentEntry = transaction.entries.find(
      (e) =>
        e.account.account_type === 'Asset' &&
        e.account.code?.startsWith('AR-') &&
        e.credit_amount,
    );
    const apPaymentEntry = transaction.entries.find(
      (e) =>
        e.account.account_type === 'Liability' &&
        e.account.code?.startsWith('AP-') &&
        e.debit_amount,
    );

    let type: TransactionType;
    let amount: number;
    let categoryAccount: string;

    if (revenueEntry) {
      type = TransactionType.REVENUE;
      amount = Number(revenueEntry.credit_amount);
      categoryAccount = revenueEntry.account.name;
    } else if (expenseEntry) {
      type = TransactionType.EXPENSE;
      amount = Number(expenseEntry.debit_amount);
      categoryAccount = expenseEntry.account.name;
    } else if (arPaymentEntry) {
      type = TransactionType.REVENUE;
      amount = Number(arPaymentEntry.credit_amount);
      categoryAccount = arPaymentEntry.account.name;
    } else if (apPaymentEntry) {
      type = TransactionType.EXPENSE;
      amount = Number(apPaymentEntry.debit_amount);
      categoryAccount = apPaymentEntry.account.name;
    } else {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Invalid transaction type.',
      });
    }

    return {
      code: 200,
      status: 'success',
      message: 'Transaction fetched successfully.',
      data: {
        id: transaction.id,
        type,
        amount,
        description: transaction.description,
        transaction_date: transaction.transaction_date,
        category_account: categoryAccount,
        cash_account: transaction.entries.find((e) => e.account.account_type === 'Asset')?.account.name,
        entries: transaction.entries.map((e) => ({
          account_name: e.account.name,
          account_type: e.account.account_type,
          debit_amount: e.debit_amount ? Number(e.debit_amount) : null,
          credit_amount: e.credit_amount ? Number(e.credit_amount) : null,
        })),
      },
    };
  }

  /**
   * Get or create Loans Receivable (Asset) and Cash accounts for an account.
   * Used for loan disbursement and repayment journal entries.
   */
  private async getLoansReceivableAndCash(accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Account not found.',
      });
    }
    const prefix = account.code || accountId.substring(0, 8).toUpperCase();
    const cashCode = `CASH-${prefix}`;
    const loansRecCode = `LOANS-REC-${prefix}`;

    let cashAccount = await this.prisma.chartOfAccount.findFirst({
      where: { code: cashCode, account_type: 'Asset', is_active: true },
    });
    if (!cashAccount) {
      cashAccount = await this.prisma.chartOfAccount.create({
        data: {
          code: cashCode,
          name: `Cash - ${account.name}`,
          account_type: 'Asset',
          is_active: true,
        },
      });
    }

    let loansRecAccount = await this.prisma.chartOfAccount.findFirst({
      where: { code: loansRecCode, account_type: 'Asset', is_active: true },
    });
    if (!loansRecAccount) {
      loansRecAccount = await this.prisma.chartOfAccount.create({
        data: {
          code: loansRecCode,
          name: `Loans Receivable - ${account.name}`,
          account_type: 'Asset',
          is_active: true,
        },
      });
    }

    return { cashAccount, loansRecAccount };
  }

  /**
   * Record loan disbursement: DR Loans Receivable, CR Cash.
   * Call when a loan is created (money given out).
   */
  async createLoanDisbursementEntry(
    userId: string,
    lenderAccountId: string,
    amount: number,
    description: string,
    transactionDate: Date,
  ) {
    const { cashAccount, loansRecAccount } = await this.getLoansReceivableAndCash(lenderAccountId);
    await this.prisma.accountingTransaction.create({
      data: {
        transaction_date: transactionDate,
        description,
        total_amount: amount,
        created_by: userId,
        entries: {
          create: [
            {
              account_id: loansRecAccount.id,
              debit_amount: amount,
              credit_amount: null,
              description: `Loans receivable: ${description}`,
            },
            {
              account_id: cashAccount.id,
              credit_amount: amount,
              debit_amount: null,
              description: `Cash disbursed: ${description}`,
            },
          ],
        },
      },
    });
  }

  /**
   * Record loan repayment (cash received): DR Cash, CR Loans Receivable.
   * Call when a direct repayment is recorded (not payroll deduction).
   */
  async createLoanRepaymentEntry(
    userId: string,
    lenderAccountId: string,
    amount: number,
    description: string,
    transactionDate: Date,
  ) {
    const { cashAccount, loansRecAccount } = await this.getLoansReceivableAndCash(lenderAccountId);
    await this.prisma.accountingTransaction.create({
      data: {
        transaction_date: transactionDate,
        description,
        total_amount: amount,
        created_by: userId,
        entries: {
          create: [
            {
              account_id: cashAccount.id,
              debit_amount: amount,
              credit_amount: null,
              description: `Cash received: ${description}`,
            },
            {
              account_id: loansRecAccount.id,
              credit_amount: amount,
              debit_amount: null,
              description: `Loans receivable reduced: ${description}`,
            },
          ],
        },
      },
    });
  }
}
