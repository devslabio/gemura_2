/**
 * Seed Orora account (Gahengeri) and farm(s) so seed-animals can attach animals to a farm.
 * Run after main seed. Run: npx ts-node prisma/seed-farms.ts
 * Then run: npm run seed:animals
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ACCOUNT_CODE = process.env.SEED_ACCOUNT_CODE ?? 'A_33FDF4';
const FARM_CODE = process.env.SEED_FARM_CODE ?? 'FARM-0002';
const USER_CODE = process.env.SEED_GAHENGERI_USER_CODE ?? 'USER_GAHENGERI_001';

async function main() {
  console.log('🌾 Seeding farms and Orora account (Gahengeri)...\n');

  const hashedPassword = await bcrypt.hash('Pass123!', 10);

  // 1. Create Gahengeri account
  const account = await prisma.account.upsert({
    where: { code: ACCOUNT_CODE },
    update: {},
    create: {
      code: ACCOUNT_CODE,
      name: 'Gahengeri',
      type: 'tenant',
      status: 'active',
    },
  });
  console.log(`✅ Account: ${account.name} (${account.code})`);

  // 2. Create user for Gahengeri (for created_by on farm/animals)
  const user = await prisma.user.upsert({
    where: { code: USER_CODE },
    update: {
      default_account_id: account.id,
      password_hash: hashedPassword,
    },
    create: {
      code: USER_CODE,
      name: 'Gahengeri Admin',
      email: 'gahengeri@orora.rw',
      phone: '250788000002',
      password_hash: hashedPassword,
      account_type: 'mcc',
      status: 'active',
      default_account_id: account.id,
    },
  });
  console.log(`✅ User: ${user.name} (${user.code})`);

  // 3. Link user to account
  await prisma.userAccount.upsert({
    where: {
      user_id_account_id: { user_id: user.id, account_id: account.id },
    },
    update: {},
    create: {
      user_id: user.id,
      account_id: account.id,
      role: 'system_admin',
      permissions: { can_manage: true, can_view: true, can_edit: true },
      status: 'active',
    },
  });

  // 4. Wallet for Gahengeri account
  const walletCode = 'W_GAHENGERI_001';
  await prisma.wallet.upsert({
    where: { code: walletCode },
    update: {},
    create: {
      code: walletCode,
      account_id: account.id,
      type: 'regular',
      is_joint: false,
      is_default: true,
      balance: 0,
      currency: 'RWF',
      status: 'active',
    },
  });
  console.log(`✅ Wallet: ${walletCode}`);

  // 5. Optional: link farm to location "Gahengeri" sector (code 5102) if locations are seeded
  let locationId: string | null = null;
  const location = await prisma.location.findUnique({
    where: { code: '5102' },
  });
  if (location) {
    locationId = location.id;
  }

  // 6. Create farm FARM-0002 for Gahengeri
  const now = new Date();
  const farm = await prisma.farm.upsert({
    where: { code: FARM_CODE },
    update: {
      name: "Gahengeri's farm",
      description: 'Gahengeri MCC farm for Orora animal seed data',
      location: locationId ? undefined : 'Gahengeri sector',
      location_id: locationId,
      status: 'active',
      updated_at: now,
    },
    create: {
      account_id: account.id,
      code: FARM_CODE,
      name: "Gahengeri's farm",
      description: 'Gahengeri MCC farm for Orora animal seed data',
      location: locationId ? undefined : 'Gahengeri sector',
      location_id: locationId,
      status: 'active',
      created_at: now,
      updated_at: now,
      created_by: user.id,
    },
  });
  console.log(`✅ Farm: ${farm.name} (${farm.code})`);

  console.log('\n🎉 Farms seed completed. Run npm run seed:animals to seed animals with farm.');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding farms:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
