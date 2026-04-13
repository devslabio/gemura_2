import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      status: 'active',
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      status: true,
      user_accounts: {
        where: {
          status: 'active',
        },
        select: {
          role: true,
          account: {
            select: {
              name: true,
              type: true,
            },
          },
        },
      },
    },
    take: 5,
  });

  console.log('Active users in database:\n');
  users.forEach((user) => {
    console.log(`Name: ${user.name}`);
    console.log(`Phone: ${user.phone}`);
    console.log(`Email: ${user.email || 'N/A'}`);
    console.log(`Accounts: ${user.user_accounts.length}`);
    if (user.user_accounts.length > 0) {
      user.user_accounts.forEach((ua) => {
        console.log(`  - ${ua.account.name} (${ua.account.type}) - Role: ${ua.role}`);
      });
    }
    console.log('---\n');
  });

  console.log('\nNote: Default password for test users is typically "password" or check your seed scripts.');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
