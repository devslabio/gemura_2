/**
 * Create cooperative memberships on an MCC account for users who belong to supplier accounts
 * already linked via SupplierCustomer (active relationship).
 *
 * Usage:
 *   cd backend && npx tsx prisma/seed-members-from-suppliers.ts
 *   npx tsx prisma/seed-members-from-suppliers.ts ACC_OTHER
 *
 * Idempotent: existing rows are set to active; member_since preserved when already set.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const mccCode = (process.argv[2] || 'ACC_MAIN_001').trim();

async function main() {
  const mcc = await prisma.account.findUnique({ where: { code: mccCode } });
  if (!mcc) {
    console.error(`Account not found: ${mccCode}`);
    process.exit(1);
  }

  const links = await prisma.supplierCustomer.findMany({
    where: {
      customer_account_id: mcc.id,
      relationship_status: 'active',
    },
    select: { supplier_account_id: true },
  });

  const supplierAccountIds = [...new Set(links.map((l) => l.supplier_account_id))];

  let created = 0;
  let reactivated = 0;
  let skippedNoUser = 0;

  for (const supplierAccountId of supplierAccountIds) {
    const userAccounts = await prisma.userAccount.findMany({
      where: {
        account_id: supplierAccountId,
        status: 'active',
      },
      select: { user_id: true },
      distinct: ['user_id'],
    });

    if (userAccounts.length === 0) {
      skippedNoUser++;
      const acc = await prisma.account.findUnique({
        where: { id: supplierAccountId },
        select: { code: true },
      });
      console.warn(`No active UserAccount on supplier ${acc?.code ?? supplierAccountId}`);
      continue;
    }

    for (const { user_id } of userAccounts) {
      const existing = await prisma.accountMembership.findFirst({
        where: { account_id: mcc.id, user_id },
      });
      if (existing) {
        await prisma.accountMembership.update({
          where: { id: existing.id },
          data: {
            status: 'active',
            ...(existing.member_since ? {} : { member_since: new Date() }),
          },
        });
        reactivated++;
      } else {
        await prisma.accountMembership.create({
          data: {
            account_id: mcc.id,
            user_id,
            status: 'active',
            member_since: new Date(),
          },
        });
        created++;
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        mcc_code: mccCode,
        mcc_id: mcc.id,
        supplier_accounts_with_link: supplierAccountIds.length,
        memberships_created: created,
        memberships_already_present_updated: reactivated,
        supplier_accounts_without_users: skippedNoUser,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
