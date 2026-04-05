import { PrismaClient } from '@prisma/client';
import { postArRevenue } from './manzi-ledger';

const prisma = new PrismaClient();

const BUYER_ACCOUNT = process.env.MANZI_ACCOUNT_CODE ?? 'A_MFZ';
const ACTING_USER = process.env.MANZI_USER_CODE ?? 'U_MFZ';
const SEED_NOTE = '[seed-manzi-milk]';

/** First month included (year, 0-based month). Default Jan 2022. */
const START_YEAR = parseInt(process.env.MANZI_HISTORY_START_YEAR ?? '2022', 10);
const START_MONTH = parseInt(process.env.MANZI_HISTORY_START_MONTH ?? '0', 10);

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}

type MonthCursor = { y: number; m: number; dim: number; monthSeq: number };

function* eachMonth(fromY: number, fromM: number, to: Date): Generator<MonthCursor> {
  let y = fromY;
  let m = fromM;
  const endY = to.getFullYear();
  const endM = to.getMonth();
  let monthSeq = 0;
  while (y < endY || (y === endY && m <= endM)) {
    const dim = daysInMonth(y, m);
    yield { y, m, dim, monthSeq };
    monthSeq += 1;
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
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
    where: {
      customer_account_id: manzi.id,
      relationship_status: 'active',
    },
  });
  const outbound = await prisma.supplierCustomer.findMany({
    where: {
      supplier_account_id: manzi.id,
      relationship_status: 'active',
    },
  });

  if (inbound.length === 0 || outbound.length === 0) {
    throw new Error(
      'Missing supplier–customer links on Manzi. Run seed:manzi-dummy-suppliers and seed:manzi-dummy-customers first.',
    );
  }

  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const rangeStart = new Date(START_YEAR, START_MONTH, 1);

  await prisma.accountingTransaction.deleteMany({
    where: { description: { startsWith: `${SEED_NOTE} ` } },
  });
  await prisma.milkSale.deleteMany({
    where: { notes: SEED_NOTE, recorded_by: actor.id },
  });

  const custIds = [...new Set(outbound.map((r) => r.customer_account_id))];
  const custRows = await prisma.account.findMany({
    where: { id: { in: custIds } },
    select: { id: true, name: true },
  });
  const customerNameById = new Map(custRows.map((a) => [a.id, a.name ?? 'customer']));

  let collections = 0;
  let sales = 0;
  let monthCount = 0;

  for (const { y, m, dim, monthSeq } of eachMonth(START_YEAR, START_MONTH, end)) {
    monthCount++;

    for (let i = 0; i < inbound.length; i++) {
      const rel = inbound[i]!;
      const day = 1 + ((i * 17 + monthSeq * 5) % dim);
      const h = 7 + (i % 4);
      const mi = 10 + ((i * 3 + monthSeq) % 50);
      const saleAt = new Date(y, m, day, h, mi, 0);
      const qty =
        22 +
        ((monthSeq * 31 + i * 13) % 180) / 2;
      const unit = Number(rel.price_per_liter);
      const pending = (monthSeq + i) % 11 === 0;
      await prisma.milkSale.create({
        data: {
          supplier_account_id: rel.supplier_account_id,
          customer_account_id: manzi.id,
          quantity: Math.round(qty * 10) / 10,
          unit_price: unit,
          status: pending ? 'pending' : 'accepted',
          sale_at: saleAt,
          notes: SEED_NOTE,
          amount_paid: 0,
          payment_status: 'unpaid',
          recorded_by: actor.id,
          created_by: actor.id,
        },
      });
      collections++;
    }

    for (let j = 0; j < outbound.length; j++) {
      const rel = outbound[j]!;
      const day = 1 + ((j * 13 + monthSeq * 7) % dim);
      const h = (9 + j) % 5 + 7;
      const mi = 15 + ((j * 7 + monthSeq * 11) % 45);
      const saleAt = new Date(y, m, day, h, mi, 0);
      const qty = 18 + ((monthSeq * 29 + j * 11) % 150) / 2;
      const unit = Number(rel.price_per_liter);
      const qtyR = Math.round(qty * 10) / 10;
      const rowPending = (monthSeq + j) % 13 === 0;
      const rowStatus = rowPending ? 'pending' : 'accepted';
      await prisma.milkSale.create({
        data: {
          supplier_account_id: manzi.id,
          customer_account_id: rel.customer_account_id,
          quantity: qtyR,
          unit_price: unit,
          status: rowStatus,
          sale_at: saleAt,
          notes: SEED_NOTE,
          amount_paid: 0,
          payment_status: 'unpaid',
          recorded_by: actor.id,
          created_by: actor.id,
        },
      });
      if (rowStatus === 'accepted') {
        const nm = customerNameById.get(rel.customer_account_id) ?? 'customer';
        await postArRevenue(
          prisma,
          manzi,
          actor.id,
          qtyR * unit,
          saleAt,
          `${SEED_NOTE} Milk to ${nm} — ${qtyR}L @ ${unit} RWF/L`,
        );
      }
      sales++;
    }

    if (monthCount % 12 === 0) {
      console.log(`  … ${y}-${String(m + 1).padStart(2, '0')} (${monthCount} months)`);
    }
  }

  console.log(
    `${collections} collections + ${sales} milk sales | ${monthCount} months (${dayKey(rangeStart)} → ${dayKey(end)}) | ${BUYER_ACCOUNT}`,
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
