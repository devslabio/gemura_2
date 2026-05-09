/**
 * Add / refresh 4 demo regional supervisors on ACC_MAIN_001 without running the full seed.
 * Prerequisites: locations (`npx ts-node prisma/seed-locations.ts`), main seed account exists.
 */
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { composeUserFullName, splitIntoFirstLast } from './user-name-shared';
import { seedRegionalSupervisorDemos } from './seed-regional-supervisor-demos';

const prisma = new PrismaClient();
const SEED_DEMO_PASSWORD = 'Pass123!';

function userNameFields(display: string) {
  const { first_name, last_name } = splitIntoFirstLast(display);
  const name = composeUserFullName(first_name, last_name) || display.trim();
  return { first_name, last_name, name };
}

async function main() {
  const mainAccount = await prisma.account.findFirst({ where: { code: 'ACC_MAIN_001' } });
  if (!mainAccount) {
    console.error('❌ Account ACC_MAIN_001 not found. Run npm run seed first.');
    process.exit(1);
  }
  const hashedPassword = await bcrypt.hash(SEED_DEMO_PASSWORD, 10);
  await seedRegionalSupervisorDemos(prisma, mainAccount, hashedPassword, userNameFields, SEED_DEMO_PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
