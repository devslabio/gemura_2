import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const BUYER_ACCOUNT = process.env.MANZI_ACCOUNT_CODE ?? 'A_MFZ';
const ACTING_USER = process.env.MANZI_USER_CODE ?? 'U_MFZ';
const SEED_RUN_PREFIX = '[seed-manzi-payroll]';
const MILK_SEED_NOTES = '[seed-manzi-milk]';

/** How many past full calendar months get a completed + paid payroll run (default 18 ≈ 3× former 6). */
const PAYROLL_MONTHS = parseInt(process.env.MANZI_PAYROLL_SEED_MONTHS ?? '18', 10);

type EmployeeRow = {
  name: string;
  phone: string;
  code: string;
  role: 'manager' | 'admin' | 'collector' | 'viewer' | 'agent' | 'accountant';
};

const EMPLOYEES: EmployeeRow[] = [
  { name: 'Divine Uwimana', phone: '250788302001', code: 'U_MFZ_MGR', role: 'manager' },
  { name: 'Eric Habimana', phone: '250788302002', code: 'U_MFZ_ADM', role: 'admin' },
  { name: 'Sandrine Mukamana', phone: '250788302003', code: 'U_MFZ_COL', role: 'collector' },
  { name: 'Pacifique Ndayishimiye', phone: '250788302004', code: 'U_MFZ_VWR', role: 'viewer' },
  { name: 'Joseph Niyonsaba', phone: '250788302005', code: 'U_MFZ_AGT', role: 'agent' },
  { name: 'Audrey Ntambara', phone: '250788302016', code: 'U_MFZ_ACT', role: 'accountant' },
  { name: 'Claudette Mukamana', phone: '250788302006', code: 'U_MFZ_E06', role: 'manager' },
  { name: 'Denis Nkurunziza', phone: '250788302007', code: 'U_MFZ_E07', role: 'collector' },
  { name: 'Evelyne Uwimana', phone: '250788302008', code: 'U_MFZ_E08', role: 'manager' },
  { name: 'Francois Ndayisaba', phone: '250788302009', code: 'U_MFZ_E09', role: 'viewer' },
  { name: 'Gloria Ishimwe', phone: '250788302010', code: 'U_MFZ_E10', role: 'agent' },
  { name: 'Hilaire Ntwari', phone: '250788302011', code: 'U_MFZ_E11', role: 'admin' },
  { name: 'Ingrid Mukeshimana', phone: '250788302012', code: 'U_MFZ_E12', role: 'collector' },
  { name: 'Jules Bizimana', phone: '250788302013', code: 'U_MFZ_E13', role: 'manager' },
  { name: 'Kelly Uwera', phone: '250788302014', code: 'U_MFZ_E14', role: 'viewer' },
  { name: 'Leon Mugisha', phone: '250788302015', code: 'U_MFZ_E15', role: 'agent' },
];

function lastNFullMonthsDesc(n: number): { y: number; m: number; label: string; start: Date; end: Date }[] {
  const now = new Date();
  const out: { y: number; m: number; label: string; start: Date; end: Date }[] = [];
  for (let i = 1; i <= n; i++) {
    const anchor = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    const label = `${y}-${String(m + 1).padStart(2, '0')}`;
    const start = new Date(y, m, 1, 0, 0, 0, 0);
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
    out.push({ y, m, label, start, end });
  }
  return out.reverse();
}

async function main() {
  const [manzi, actor] = await Promise.all([
    prisma.account.findUnique({ where: { code: BUYER_ACCOUNT } }),
    prisma.user.findFirst({ where: { code: ACTING_USER } }),
  ]);
  if (!manzi || !actor) {
    throw new Error(`Need ${BUYER_ACCOUNT} + ${ACTING_USER} (run seed:kwezi-test-manzi first).`);
  }

  const inbound = await prisma.supplierCustomer.findMany({
    where: { customer_account_id: manzi.id, relationship_status: 'active' },
    select: { supplier_account_id: true },
  });
  if (inbound.length === 0) {
    throw new Error('No milk suppliers linked to Manzi. Run seed:manzi-dummy-suppliers first.');
  }

  const pwd = await bcrypt.hash('Pass123!', 10);
  const tokenBase = `emp_${Date.now()}`;

  for (let i = 0; i < EMPLOYEES.length; i++) {
    const row = EMPLOYEES[i]!;
    const codeTaken = await prisma.user.findUnique({ where: { code: row.code } });

    if (codeTaken && codeTaken.phone !== row.phone) {
      throw new Error(`User code ${row.code} is taken by another phone; adjust seed codes.`);
    }

    const user = await prisma.user.upsert({
      where: { phone: row.phone },
      update: {
        name: row.name,
        code: row.code,
        password_hash: pwd,
        status: 'active',
        account_type: 'mcc',
        default_account_id: manzi.id,
        token: `${tokenBase}_${i}`,
      },
      create: {
        name: row.name,
        phone: row.phone,
        code: row.code,
        email: `employee.${row.code.toLowerCase().replace(/[^a-z0-9]/g, '')}@gemura.local`,
        password_hash: pwd,
        status: 'active',
        account_type: 'mcc',
        default_account_id: manzi.id,
        token: `${tokenBase}_${i}`,
      },
    });

    await prisma.userAccount.upsert({
      where: { user_id_account_id: { user_id: user.id, account_id: manzi.id } },
      update: {
        role: row.role,
        status: 'active',
        permissions: { seed: 'manzi-employee' },
        created_by: actor.id,
      },
      create: {
        user_id: user.id,
        account_id: manzi.id,
        role: row.role,
        status: 'active',
        permissions: { seed: 'manzi-employee' },
        created_by: actor.id,
      },
    });
  }

  for (const rel of inbound) {
    await prisma.payrollSupplier.upsert({
      where: { supplier_account_id: rel.supplier_account_id },
      update: { is_active: true, payment_terms_days: 15 },
      create: {
        supplier_account_id: rel.supplier_account_id,
        payment_terms_days: 15,
        is_active: true,
      },
    });
  }

  await prisma.payrollRun.deleteMany({
    where: {
      account_id: manzi.id,
      run_name: { startsWith: SEED_RUN_PREFIX },
    },
  });

  const months = lastNFullMonthsDesc(Math.max(1, Math.min(PAYROLL_MONTHS, 24)));

  for (const { start, end } of months) {
    await prisma.milkSale.updateMany({
      where: {
        customer_account_id: manzi.id,
        notes: MILK_SEED_NOTES,
        sale_at: { gte: start, lte: end },
      },
      data: { payment_status: 'unpaid', amount_paid: 0 },
    });
  }

  const payrollSuppliers = await prisma.payrollSupplier.findMany({
    where: {
      is_active: true,
      supplier_account_id: { in: inbound.map((r) => r.supplier_account_id) },
    },
  });

  let runs = 0;
  let payslips = 0;

  for (const { label, start, end } of months) {
    const run = await prisma.payrollRun.create({
      data: {
        account_id: manzi.id,
        period_id: null,
        run_name: `${SEED_RUN_PREFIX} ${label}`,
        run_date: end,
        period_start: start,
        period_end: end,
        payment_terms_days: 15,
        total_amount: 0,
        status: 'draft',
        created_by: actor.id,
      },
    });
    runs++;

    let runTotal = 0;

    for (const ps of payrollSuppliers) {
      const milkSales = await prisma.milkSale.findMany({
        where: {
          supplier_account_id: ps.supplier_account_id,
          customer_account_id: manzi.id,
          sale_at: { gte: start, lte: end },
          status: { not: 'deleted' },
          payment_status: { not: 'paid' },
        },
      });

      const gross =
        milkSales.reduce((s, ms) => s + Number(ms.quantity) * Number(ms.unit_price), 0);

      const payslip = await prisma.payrollPayslip.create({
        data: {
          run_id: run.id,
          supplier_account_id: ps.supplier_account_id,
          payroll_supplier_id: ps.id,
          gross_amount: gross,
          total_deductions: 0,
          net_amount: gross,
          milk_sales_count: milkSales.length,
          period_start: start,
          period_end: end,
          status: 'paid',
          payment_date: end,
          paid_by: actor.id,
        },
      });
      payslips++;

      for (const ms of milkSales) {
        const totalAmount = Number(ms.quantity) * Number(ms.unit_price);
        await prisma.milkSale.update({
          where: { id: ms.id },
          data: { amount_paid: totalAmount, payment_status: 'paid' },
        });
      }

      runTotal += gross;
    }

    await prisma.payrollRun.update({
      where: { id: run.id },
      data: { total_amount: runTotal, status: 'completed' },
    });
  }

  console.log(
    `Employees: ${EMPLOYEES.length} on ${BUYER_ACCOUNT} (Pass123!, phones 250788302001–016 incl. accountant). ` +
      `Payroll: ${inbound.length} milk suppliers on payroll; ` +
      `${runs} runs, ${payslips} payslips (${months.length} full months, seed milk in range settled as paid).`,
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
