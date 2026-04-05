import { Prisma, PrismaClient } from '@prisma/client';
import { postLoanDisbursement, postLoanRepayment } from './manzi-ledger';

const prisma = new PrismaClient();

const BUYER_ACCOUNT = process.env.MANZI_ACCOUNT_CODE ?? 'A_MFZ';
const ACTING_USER = process.env.MANZI_USER_CODE ?? 'U_MFZ';
const LOAN_TAG = '[seed-manzi-loan]';
const CHARGE_PREFIX = '[seed-manzi] ';

/** Charges active from Jan 2022 (aligns with long history seeds). */
const CHARGES_FROM = new Date(2022, 0, 1, 0, 0, 0, 0);

function cal(y: number, month: number, day: number) {
  return new Date(y, month - 1, day, 12, 0, 0, 0);
}

async function main() {
  const [manzi, actor] = await Promise.all([
    prisma.account.findUnique({ where: { code: BUYER_ACCOUNT } }),
    prisma.user.findFirst({ where: { code: ACTING_USER } }),
  ]);
  if (!manzi || !actor) {
    throw new Error(`Need ${BUYER_ACCOUNT} + ${ACTING_USER}.`);
  }

  const inbound = await prisma.supplierCustomer.findMany({
    where: { customer_account_id: manzi.id, relationship_status: 'active' },
  });
  const outbound = await prisma.supplierCustomer.findMany({
    where: { supplier_account_id: manzi.id, relationship_status: 'active' },
  });
  if (inbound.length < 5 || outbound.length < 3) {
    throw new Error('Need dummy suppliers and customers first.');
  }

  await prisma.accountingTransaction.deleteMany({
    where: { description: { startsWith: LOAN_TAG } },
  });
  await prisma.loan.deleteMany({
    where: { lender_account_id: manzi.id, notes: { startsWith: LOAN_TAG } },
  });
  await prisma.charge.deleteMany({
    where: { customer_account_id: manzi.id, name: { startsWith: CHARGE_PREFIX } },
  });

  await prisma.charge.create({
    data: {
      customer_account_id: manzi.id,
      name: `${CHARGE_PREFIX}Transport recovery`,
      description: 'Fixed per payroll transport share',
      kind: 'recurring',
      amount_type: 'fixed',
      amount: new Prisma.Decimal(500),
      recurrence: 'per_payroll',
      apply_to_all_suppliers: true,
      effective_from: CHARGES_FROM,
      is_active: true,
      created_by: actor.id,
    },
  });

  await prisma.charge.create({
    data: {
      customer_account_id: manzi.id,
      name: `${CHARGE_PREFIX}Cooling surcharge`,
      description: 'Monthly cooling / handling',
      kind: 'recurring',
      amount_type: 'fixed',
      amount: new Prisma.Decimal(2500),
      recurrence: 'monthly',
      apply_to_all_suppliers: true,
      effective_from: CHARGES_FROM,
      is_active: true,
      created_by: actor.id,
    },
  });

  await prisma.charge.create({
    data: {
      customer_account_id: manzi.id,
      name: `${CHARGE_PREFIX}Quality pool (percentage)`,
      description: 'Pct of payroll for quality bonus fund',
      kind: 'recurring',
      amount_type: 'percentage',
      amount: new Prisma.Decimal(2.5),
      recurrence: 'per_payroll',
      apply_to_all_suppliers: true,
      effective_from: CHARGES_FROM,
      is_active: true,
      created_by: actor.id,
    },
  });

  const extraCharges: { name: string; desc: string; kind: string; amountType: string; amount: number; recurrence: string | null }[] = [
    { name: 'Equipment lease share', desc: 'Shared equipment fee per payroll', kind: 'recurring', amountType: 'fixed', amount: 1200, recurrence: 'per_payroll' },
    { name: 'Cold chain top-up', desc: 'Monthly cold storage', kind: 'recurring', amountType: 'fixed', amount: 1800, recurrence: 'monthly' },
    { name: 'Lab test pool (pct)', desc: 'Milk testing fund', kind: 'recurring', amountType: 'percentage', amount: 1.25, recurrence: 'per_payroll' },
    { name: 'Cooperative dues', desc: 'Fixed cooperative contribution', kind: 'recurring', amountType: 'fixed', amount: 3500, recurrence: 'monthly' },
    { name: 'Security / night watch', desc: 'Site security share', kind: 'recurring', amountType: 'fixed', amount: 800, recurrence: 'per_payroll' },
    { name: 'Fuel adjustment', desc: 'Transport fuel pass-through', kind: 'recurring', amountType: 'fixed', amount: 2200, recurrence: 'monthly' },
    { name: 'Training levy', desc: 'Staff training fund', kind: 'recurring', amountType: 'percentage', amount: 0.75, recurrence: 'per_payroll' },
    { name: 'Weighbridge service', desc: 'Weighing fee per period', kind: 'recurring', amountType: 'fixed', amount: 650, recurrence: 'per_payroll' },
  ];
  for (const ec of extraCharges) {
    await prisma.charge.create({
      data: {
        customer_account_id: manzi.id,
        name: `${CHARGE_PREFIX}${ec.name}`,
        description: ec.desc,
        kind: ec.kind as 'recurring',
        amount_type: ec.amountType as 'fixed' | 'percentage',
        amount: new Prisma.Decimal(ec.amount),
        recurrence: ec.recurrence,
        apply_to_all_suppliers: true,
        effective_from: CHARGES_FROM,
        is_active: true,
        created_by: actor.id,
      },
    });
  }

  const selective = await prisma.charge.create({
    data: {
      customer_account_id: manzi.id,
      name: `${CHARGE_PREFIX}Registration kit (one-time)`,
      description: 'Applied only to selected suppliers',
      kind: 'one_time',
      amount_type: 'fixed',
      amount: new Prisma.Decimal(5000),
      recurrence: null,
      apply_to_all_suppliers: false,
      effective_from: CHARGES_FROM,
      is_active: true,
      created_by: actor.id,
    },
  });
  await prisma.chargeSupplier.createMany({
    data: inbound.slice(0, Math.min(18, inbound.length)).map((r) => ({
      charge_id: selective.id,
      supplier_account_id: r.supplier_account_id,
    })),
    skipDuplicates: true,
  });

  const s0 = inbound[0]!.supplier_account_id;
  const s1 = inbound[4]!.supplier_account_id;
  const s2 = inbound[8]!.supplier_account_id;
  const c0 = outbound[2]!.customer_account_id;

  const disb0 = cal(2022, 3, 18);
  const loan0 = await prisma.loan.create({
    data: {
      lender_account_id: manzi.id,
      borrower_type: 'supplier',
      borrower_account_id: s0,
      principal: new Prisma.Decimal(420000),
      amount_repaid: new Prisma.Decimal(80000),
      disbursement_date: disb0,
      due_date: cal(2024, 3, 18),
      notes: `${LOAN_TAG} Working capital — supplier (2022)`,
      created_by: actor.id,
    },
  });
  await postLoanDisbursement(
    prisma,
    manzi,
    actor.id,
    420000,
    disb0,
    `${LOAN_TAG} disburse ${loan0.id.slice(0, 8)}`,
  );
  const rep0 = cal(2022, 9, 5);
  await prisma.loanRepayment.create({
    data: {
      loan_id: loan0.id,
      amount: new Prisma.Decimal(80000),
      repayment_date: rep0,
      source: 'direct',
      notes: LOAN_TAG,
    },
  });
  await postLoanRepayment(
    prisma,
    manzi,
    actor.id,
    80000,
    rep0,
    `${LOAN_TAG} repayment ${loan0.id.slice(0, 8)}`,
  );

  const disb1 = cal(2023, 8, 7);
  const loan1 = await prisma.loan.create({
    data: {
      lender_account_id: manzi.id,
      borrower_type: 'supplier',
      borrower_account_id: s1,
      principal: new Prisma.Decimal(175000),
      amount_repaid: new Prisma.Decimal(0),
      disbursement_date: disb1,
      due_date: cal(2025, 8, 7),
      notes: `${LOAN_TAG} Input credit — supplier (2023)`,
      created_by: actor.id,
    },
  });
  await postLoanDisbursement(
    prisma,
    manzi,
    actor.id,
    175000,
    disb1,
    `${LOAN_TAG} disburse ${loan1.id.slice(0, 8)}`,
  );

  const disb2 = cal(2024, 11, 12);
  const loan2 = await prisma.loan.create({
    data: {
      lender_account_id: manzi.id,
      borrower_type: 'customer',
      borrower_account_id: c0,
      principal: new Prisma.Decimal(90000),
      amount_repaid: new Prisma.Decimal(0),
      disbursement_date: disb2,
      due_date: cal(2025, 11, 12),
      notes: `${LOAN_TAG} Trade advance — customer (2024)`,
      created_by: actor.id,
    },
  });
  await postLoanDisbursement(
    prisma,
    manzi,
    actor.id,
    90000,
    disb2,
    `${LOAN_TAG} disburse ${loan2.id.slice(0, 8)}`,
  );

  const disb3 = cal(2025, 4, 22);
  const loan3 = await prisma.loan.create({
    data: {
      lender_account_id: manzi.id,
      borrower_type: 'supplier',
      borrower_account_id: s2,
      principal: new Prisma.Decimal(250000),
      amount_repaid: new Prisma.Decimal(0),
      disbursement_date: disb3,
      due_date: cal(2027, 4, 22),
      notes: `${LOAN_TAG} Season input — supplier (2025)`,
      created_by: actor.id,
    },
  });
  await postLoanDisbursement(
    prisma,
    manzi,
    actor.id,
    250000,
    disb3,
    `${LOAN_TAG} disburse ${loan3.id.slice(0, 8)}`,
  );

  const disb4 = cal(2026, 1, 15);
  const loan4 = await prisma.loan.create({
    data: {
      lender_account_id: manzi.id,
      borrower_type: 'supplier',
      borrower_account_id: s1,
      principal: new Prisma.Decimal(60000),
      amount_repaid: new Prisma.Decimal(0),
      disbursement_date: disb4,
      due_date: cal(2026, 7, 15),
      notes: `${LOAN_TAG} Short bridge — supplier (2026)`,
      created_by: actor.id,
    },
  });
  await postLoanDisbursement(
    prisma,
    manzi,
    actor.id,
    60000,
    disb4,
    `${LOAN_TAG} disburse ${loan4.id.slice(0, 8)}`,
  );

  const ib = (i: number) =>
    inbound[Math.min(i, Math.max(0, inbound.length - 1))]!.supplier_account_id;
  const ob = (i: number) =>
    outbound[Math.min(i, Math.max(0, outbound.length - 1))]!.customer_account_id;

  type LoanSeed = {
    borrower: 'supplier' | 'customer';
    accountId: string;
    principal: number;
    disb: Date;
    due: Date;
    note: string;
  };
  const extraLoans: LoanSeed[] = [
    { borrower: 'supplier', accountId: ib(1), principal: 95000, disb: cal(2022, 7, 1), due: cal(2024, 7, 1), note: 'Season top-up — supplier (2022)' },
    { borrower: 'supplier', accountId: ib(5), principal: 120000, disb: cal(2023, 2, 15), due: cal(2025, 2, 15), note: 'Input bundle — supplier (2023)' },
    { borrower: 'customer', accountId: ob(1), principal: 45000, disb: cal(2023, 5, 20), due: cal(2024, 5, 20), note: 'Trade credit — customer (2023)' },
    { borrower: 'supplier', accountId: ib(9), principal: 200000, disb: cal(2023, 11, 8), due: cal(2026, 11, 8), note: 'Herd expansion — supplier (2023)' },
    { borrower: 'supplier', accountId: ib(13), principal: 88000, disb: cal(2024, 2, 28), due: cal(2025, 8, 28), note: 'Feed advance — supplier (2024)' },
    { borrower: 'customer', accountId: ob(6), principal: 72000, disb: cal(2024, 6, 11), due: cal(2025, 6, 11), note: 'Stocking loan — customer (2024)' },
    { borrower: 'supplier', accountId: ib(17), principal: 155000, disb: cal(2024, 10, 3), due: cal(2026, 10, 3), note: 'Equipment share — supplier (2024)' },
    { borrower: 'supplier', accountId: ib(21), principal: 64000, disb: cal(2025, 1, 9), due: cal(2025, 7, 9), note: 'Bridge — supplier (2025)' },
    { borrower: 'customer', accountId: ob(10), principal: 33000, disb: cal(2025, 8, 19), due: cal(2026, 2, 19), note: 'Retail float — customer (2025)' },
    { borrower: 'supplier', accountId: ib(29), principal: 110000, disb: cal(2025, 11, 30), due: cal(2027, 5, 30), note: 'Dry season input — supplier (2025)' },
  ];
  for (const el of extraLoans) {
    const row = await prisma.loan.create({
      data: {
        lender_account_id: manzi.id,
        borrower_type: el.borrower,
        borrower_account_id: el.accountId,
        principal: new Prisma.Decimal(el.principal),
        amount_repaid: new Prisma.Decimal(0),
        disbursement_date: el.disb,
        due_date: el.due,
        notes: `${LOAN_TAG} ${el.note}`,
        created_by: actor.id,
      },
    });
    await postLoanDisbursement(
      prisma,
      manzi,
      actor.id,
      el.principal,
      el.disb,
      `${LOAN_TAG} disburse ${row.id.slice(0, 8)}`,
    );
  }

  console.log(
    `Charges: 12 (effective ${CHARGES_FROM.toISOString().slice(0, 10)}). Loans: 15 across 2022–2027 (1 partial repayment). ${BUYER_ACCOUNT}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
