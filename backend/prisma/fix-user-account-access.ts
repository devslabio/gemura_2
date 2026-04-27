import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Fixing user-account access: One user = One account\n');

  // Define the correct user-account mappings
  const correctMappings = [
    {
      phone: '250788606765',
      name: 'Hubert',
      shouldHaveAccess: ['A798A0A'], // Hubert's own account only
    },
    {
      phone: '250782638531',
      name: 'MCC Gahengeri',
      shouldHaveAccess: ['A_33FDF4'], // Gahengeri account only
    },
  ];

  for (const mapping of correctMappings) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`USER: ${mapping.name} (${mapping.phone})`);
    console.log('='.repeat(60));

    // Find user
    const user = await prisma.user.findFirst({
      where: { phone: mapping.phone },
      include: {
        user_accounts: {
          include: {
            account: { select: { code: true, name: true, id: true } }
          }
        }
      }
    });

    if (!user) {
      console.log('❌ User not found');
      continue;
    }

    console.log(`Found user: ${user.name} (${user.id})`);
    console.log(`Current access to ${user.user_accounts.length} accounts`);

    // Get accounts they should have
    const correctAccounts = await prisma.account.findMany({
      where: {
        code: { in: mapping.shouldHaveAccess }
      },
      select: { id: true, code: true, name: true }
    });

    if (correctAccounts.length === 0) {
      console.log('❌ No matching accounts found for codes:', mapping.shouldHaveAccess);
      continue;
    }

    const correctAccountIds = correctAccounts.map(a => a.id);

    // Find user_accounts to remove (not in correct list)
    const toRemove = user.user_accounts.filter(
      ua => !correctAccountIds.includes(ua.account_id)
    );

    // Find accounts to add (in correct list but not in current)
    const currentAccountIds = user.user_accounts.map(ua => ua.account_id);
    const toAdd = correctAccounts.filter(
      acc => !currentAccountIds.includes(acc.id)
    );

    console.log('\n📋 Changes needed:');
    console.log(`  Remove access from ${toRemove.length} accounts`);
    console.log(`  Add access to ${toAdd.length} accounts`);

    // Remove incorrect access
    if (toRemove.length > 0) {
      console.log('\n🗑️  Removing access from:');
      for (const ua of toRemove) {
        console.log(`    - ${ua.account.code} (${ua.account.name})`);
        await prisma.userAccount.delete({
          where: { id: ua.id }
        });
      }
    }

    // Add missing access
    if (toAdd.length > 0) {
      console.log('\n➕ Adding access to:');
      for (const acc of toAdd) {
        console.log(`    - ${acc.code} (${acc.name})`);
        await prisma.userAccount.create({
          data: {
            user_id: user.id,
            account_id: acc.id,
            role: 'owner',
            status: 'active'
          }
        });
      }
    }

    // Update default account if needed
    const correctDefaultAccount = correctAccounts[0];
    if (user.default_account_id !== correctDefaultAccount.id) {
      console.log(`\n🔄 Updating default account to: ${correctDefaultAccount.code}`);
      await prisma.user.update({
        where: { id: user.id },
        data: { default_account_id: correctDefaultAccount.id }
      });
    }

    console.log('\n✅ Done for', mapping.name);
  }

  console.log('\n\n✅ All user-account access fixed!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
