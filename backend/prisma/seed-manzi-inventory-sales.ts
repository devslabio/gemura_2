import { Prisma, PrismaClient } from '@prisma/client';
import { postCashRevenue } from './manzi-ledger';

const prisma = new PrismaClient();

const BUYER_ACCOUNT = process.env.MANZI_ACCOUNT_CODE ?? 'A_MFZ';
const ACTING_USER = process.env.MANZI_USER_CODE ?? 'U_MFZ';
const SEED_NOTE = '[seed-manzi-inv]';
const PRODUCT_PREFIX = '[seed-manzi] ';

const START_YEAR = parseInt(process.env.MANZI_HISTORY_START_YEAR ?? '2022', 10);
const START_MONTH = parseInt(process.env.MANZI_HISTORY_START_MONTH ?? '0', 10);
/** Paid inventory sales per calendar month (spread across the month). */
const SALES_PER_MONTH = parseInt(process.env.MANZI_INV_SALES_PER_MONTH ?? '5', 10);

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
    yield { y, m, dim: daysInMonth(y, m), monthSeq };
    monthSeq += 1;
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
}

/** Stock sized for ~5 sales/month since Jan 2022 (~60 months × 5 × qty). */
const CATALOG: { name: string; unit: string; price: number; stock: number }[] = [
  { name: `${PRODUCT_PREFIX}Maize Bran`, unit: 'kg', price: 600, stock: 12000 },
  { name: `${PRODUCT_PREFIX}Salt Block 5kg`, unit: 'pcs', price: 3500, stock: 2500 },
  { name: `${PRODUCT_PREFIX}Ivermectin`, unit: 'dose', price: 2500, stock: 5000 },
  { name: `${PRODUCT_PREFIX}Milk Can 50L`, unit: 'pcs', price: 45000, stock: 400 },
  { name: `${PRODUCT_PREFIX}Molasses`, unit: 'L', price: 1200, stock: 4000 },
];

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
  });
  const outbound = await prisma.supplierCustomer.findMany({
    where: { supplier_account_id: manzi.id, relationship_status: 'active' },
  });
  if (inbound.length === 0 || outbound.length === 0) {
    throw new Error('Need dummy suppliers and customers on Manzi first.');
  }

  const supplierBuyerIds = inbound.map((r) => r.supplier_account_id);
  const customerBuyerIds = outbound.map((r) => r.customer_account_id);

  const wallet = await prisma.wallet.findFirst({
    where: { account_id: manzi.id, is_default: true },
  });
  if (!wallet) throw new Error('Manzi has no default wallet.');

  const existingSeedSales = await prisma.inventorySale.findMany({
    where: { notes: SEED_NOTE },
    select: { amount_paid: true },
  });
  const previousPaid = existingSeedSales.reduce((s, r) => s + Number(r.amount_paid), 0);

  await prisma.accountingTransaction.deleteMany({
    where: { description: { startsWith: `${SEED_NOTE} ` } },
  });
  await prisma.inventorySale.deleteMany({ where: { notes: SEED_NOTE } });
  await prisma.product.deleteMany({
    where: { account_id: manzi.id, name: { startsWith: PRODUCT_PREFIX } },
  });

  const products = await Promise.all(
    CATALOG.map((row) =>
      prisma.product.create({
        data: {
          name: row.name,
          description: `Dummy stock — ${row.unit}`,
          price: row.price,
          stock_quantity: row.stock,
          min_stock_level: 5,
          status: 'active',
          account_id: manzi.id,
          created_by: actor.id,
          updated_by: actor.id,
        },
      }),
    ),
  );

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  let newPaidTotal = 0;
  let saleIndex = 0;
  let monthCount = 0;

  for (const { y, m, dim, monthSeq } of eachMonth(START_YEAR, START_MONTH, end)) {
    monthCount++;
    for (let k = 0; k < SALES_PER_MONTH; k++) {
      const useCustomer = saleIndex % 2 === 0;
      const buyerAccountId = useCustomer
        ? customerBuyerIds[saleIndex % customerBuyerIds.length]!
        : supplierBuyerIds[saleIndex % supplierBuyerIds.length]!;
      const buyerType = useCustomer ? 'customer' : 'supplier';
      const product = products[saleIndex % products.length]!;
      const qty = 1 + (saleIndex % 4);
      const unitPrice = Number(product.price);
      const total = qty * unitPrice;

      const day = 1 + ((k * 5 + monthSeq * 3) % dim);
      const saleDate = new Date(y, m, day, 10 + (k % 4), (saleIndex * 7) % 55, 0);

      const sale = await prisma.inventorySale.create({
        data: {
          product_id: product.id,
          buyer_type: buyerType,
          buyer_account_id: buyerAccountId,
          quantity: qty,
          unit_price: unitPrice,
          total_amount: total,
          amount_paid: total,
          payment_status: 'paid',
          sale_date: saleDate,
          notes: SEED_NOTE,
          created_by: actor.id,
        },
      });

      const current = await prisma.product.findUnique({ where: { id: product.id } });
      if (current) {
        const nextStock = current.stock_quantity - qty;
        await prisma.product.update({
          where: { id: product.id },
          data: {
            stock_quantity: Math.max(0, nextStock),
            status: nextStock <= 0 ? 'out_of_stock' : 'active',
            updated_by: actor.id,
          },
        });
      }

      const buyerAcc = await prisma.account.findUnique({ where: { id: buyerAccountId } });
      await prisma.inventoryMovement.create({
        data: {
          product_id: product.id,
          movement_type: 'sale_out',
          quantity: qty,
          reference_type: 'inventory_sale',
          reference_id: sale.id,
          description: `Sale to ${buyerAcc?.name ?? buyerAccountId}`,
          unit_price: unitPrice,
          created_by: actor.id,
        },
      });

      await postCashRevenue(
        prisma,
        manzi,
        actor.id,
        total,
        saleDate,
        `${SEED_NOTE} ${product.name} (${qty} × ${unitPrice} RWF)`,
      );

      newPaidTotal += total;
      saleIndex++;
    }
  }

  const walletNow = await prisma.wallet.findUnique({ where: { id: wallet.id } });
  const bal = Number(walletNow?.balance ?? 0);
  const nextWallet = Math.max(0, bal - previousPaid + newPaidTotal);
  await prisma.wallet.update({
    where: { id: wallet.id },
    data: { balance: new Prisma.Decimal(nextWallet) },
  });

  console.log(
    `Inventory: ${products.length} products, ${saleIndex} paid sales over ${monthCount} months, ~${Math.round(newPaidTotal)} RWF (${BUYER_ACCOUNT}).`,
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
