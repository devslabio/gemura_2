/**
 * Idempotent: grants demo regional supervisors access to tenant accounts that appear in milk_sales.
 * Run after demo users exist (`npm run seed:regional-supervisors`).
 */
import { PrismaClient } from '@prisma/client';
import { REGIONAL_SUPERVISOR_DEMO_DISTRICTS } from './seed-regional-supervisor-demos';

const prisma = new PrismaClient();
/** Cap rows per run so the script stays safe on large DBs. */
const MAX_DISTINCT_ACCOUNTS = 25;

async function main() {
  const phones = REGIONAL_SUPERVISOR_DEMO_DISTRICTS.map((r) => r.phone);
  const users = await prisma.user.findMany({
    where: { phone: { in: [...phones] } },
    select: { id: true, phone: true, code: true },
  });
  if (users.length === 0) {
    console.error('No demo regional supervisor users found. Run: npm run seed:regional-supervisors');
    process.exit(1);
  }

  const salesRows = await prisma.milkSale.findMany({
    select: { supplier_account_id: true, customer_account_id: true },
  });
  const idSet = new Set<string>();
  for (const r of salesRows) {
    idSet.add(r.supplier_account_id);
    idSet.add(r.customer_account_id);
  }
  const cappedIds = [...idSet].sort().slice(0, MAX_DISTINCT_ACCOUNTS);
  const activeAccounts = await prisma.account.findMany({
    where: { id: { in: cappedIds }, status: 'active' },
    select: { id: true, code: true, name: true },
    orderBy: { id: 'asc' },
  });

  if (activeAccounts.length === 0) {
    console.warn('No active accounts with milk sales found. Nothing to assign.');
    return;
  }

  let upserts = 0;
  for (const u of users) {
    for (const acc of activeAccounts) {
      await prisma.userAccount.upsert({
        where: { user_id_account_id: { user_id: u.id, account_id: acc.id } },
        update: { role: 'regional_supervisor', status: 'active' },
        create: {
          user_id: u.id,
          account_id: acc.id,
          role: 'regional_supervisor',
          permissions: {},
          status: 'active',
        },
      });
      upserts++;
    }
  }
  console.log(
    `✅ Assigned ${users.length} demo supervisors to ${activeAccounts.length} milk-sale accounts (${upserts} user_account rows).`,
  );
  for (const acc of activeAccounts.slice(0, 5)) {
    console.log(`   · ${acc.code ?? acc.id} ${acc.name}`);
  }
  if (activeAccounts.length > 5) {
    console.log(`   · … and ${activeAccounts.length - 5} more`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
