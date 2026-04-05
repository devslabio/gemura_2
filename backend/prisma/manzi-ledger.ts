import { Prisma, PrismaClient } from '@prisma/client';

export type ManziAccount = {
  id: string;
  code: string | null;
  name: string;
};

function prefix(manzi: ManziAccount) {
  return manzi.code || manzi.id.substring(0, 8).toUpperCase();
}

async function ensureChart(
  prisma: PrismaClient,
  code: string,
  name: string,
  account_type: 'Asset' | 'Revenue' | 'Expense' | 'Liability',
) {
  let row = await prisma.chartOfAccount.findFirst({
    where: { code, account_type, is_active: true },
  });
  if (!row) {
    row = await prisma.chartOfAccount.create({
      data: { code, name, account_type, is_active: true },
    });
  }
  return row;
}

/** Paid sale: CR Revenue, DR Cash (same as TransactionsService revenue). */
export async function postCashRevenue(
  prisma: PrismaClient,
  manzi: ManziAccount,
  actorId: string,
  amount: number,
  transactionDate: Date,
  description: string,
) {
  const p = prefix(manzi);
  const cash = await ensureChart(prisma, `CASH-${p}`, `Cash - ${manzi.name}`, 'Asset');
  const rev = await ensureChart(
    prisma,
    `REV-${p}`,
    `General Revenue - ${manzi.name}`,
    'Revenue',
  );
  const amt = new Prisma.Decimal(amount);
  await prisma.accountingTransaction.create({
    data: {
      transaction_date: transactionDate,
      description,
      total_amount: amt,
      created_by: actorId,
      entries: {
        create: [
          {
            account_id: rev.id,
            credit_amount: amt,
            debit_amount: null,
            description,
          },
          {
            account_id: cash.id,
            debit_amount: amt,
            credit_amount: null,
            description,
          },
        ],
      },
    },
  });
}

/** Unpaid milk sale: DR AR, CR Revenue (same as SalesService.createAccountsReceivableEntry). */
export async function postArRevenue(
  prisma: PrismaClient,
  manzi: ManziAccount,
  actorId: string,
  amount: number,
  transactionDate: Date,
  description: string,
) {
  const p = prefix(manzi);
  const ar = await ensureChart(
    prisma,
    `AR-${p}`,
    `Accounts Receivable - ${manzi.name}`,
    'Asset',
  );
  const rev = await ensureChart(
    prisma,
    `REV-${p}`,
    `General Revenue - ${manzi.name}`,
    'Revenue',
  );
  const amt = new Prisma.Decimal(amount);
  await prisma.accountingTransaction.create({
    data: {
      transaction_date: transactionDate,
      description,
      total_amount: amt,
      created_by: actorId,
      entries: {
        create: [
          {
            account_id: ar.id,
            debit_amount: amt,
            credit_amount: null,
            description: `AR: ${description}`,
          },
          {
            account_id: rev.id,
            credit_amount: amt,
            debit_amount: null,
            description,
          },
        ],
      },
    },
  });
}

/** DR Loans Receivable, CR Cash (loan disbursement). */
export async function postLoanDisbursement(
  prisma: PrismaClient,
  manzi: ManziAccount,
  actorId: string,
  amount: number,
  transactionDate: Date,
  description: string,
) {
  const p = prefix(manzi);
  const cash = await ensureChart(prisma, `CASH-${p}`, `Cash - ${manzi.name}`, 'Asset');
  const lr = await ensureChart(
    prisma,
    `LOANS-REC-${p}`,
    `Loans Receivable - ${manzi.name}`,
    'Asset',
  );
  const amt = new Prisma.Decimal(amount);
  await prisma.accountingTransaction.create({
    data: {
      transaction_date: transactionDate,
      description,
      total_amount: amt,
      created_by: actorId,
      entries: {
        create: [
          {
            account_id: lr.id,
            debit_amount: amt,
            credit_amount: null,
            description: `Loans receivable: ${description}`,
          },
          {
            account_id: cash.id,
            credit_amount: amt,
            debit_amount: null,
            description: `Cash disbursed: ${description}`,
          },
        ],
      },
    },
  });
}

/** DR Cash, CR Loans Receivable (repayment). */
export async function postLoanRepayment(
  prisma: PrismaClient,
  manzi: ManziAccount,
  actorId: string,
  amount: number,
  transactionDate: Date,
  description: string,
) {
  const p = prefix(manzi);
  const cash = await ensureChart(prisma, `CASH-${p}`, `Cash - ${manzi.name}`, 'Asset');
  const lr = await ensureChart(
    prisma,
    `LOANS-REC-${p}`,
    `Loans Receivable - ${manzi.name}`,
    'Asset',
  );
  const amt = new Prisma.Decimal(amount);
  await prisma.accountingTransaction.create({
    data: {
      transaction_date: transactionDate,
      description,
      total_amount: amt,
      created_by: actorId,
      entries: {
        create: [
          {
            account_id: cash.id,
            debit_amount: amt,
            credit_amount: null,
            description: `Cash received: ${description}`,
          },
          {
            account_id: lr.id,
            credit_amount: amt,
            debit_amount: null,
            description: `Loans receivable reduced: ${description}`,
          },
        ],
      },
    },
  });
}
