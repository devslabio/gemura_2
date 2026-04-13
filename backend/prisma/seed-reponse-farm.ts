import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Allow overriding via env if needed
const ACCOUNT_CODE = process.env.SEED_REPONSE_ACCOUNT_CODE ?? 'A_REPONSE_001';
const FARM_CODE = process.env.SEED_REPONSE_FARM_CODE ?? 'FARM-0100';
const USER_CODE = process.env.SEED_REPONSE_USER_CODE ?? 'USER_REPONSE_001';

async function main() {
  console.log('🌾 Seeding account, user and farm for Reponse Iradukunda...\n');

  const hashedPassword = await bcrypt.hash('Pass123', 10);

  // 1. Create account for Reponse
  const account = await prisma.account.upsert({
    where: { code: ACCOUNT_CODE },
    update: {},
    create: {
      code: ACCOUNT_CODE,
      name: 'Reponse Iradukunda Account',
      type: 'tenant',
      status: 'active',
    },
  });
  console.log(`✅ Account: ${account.name} (${account.code})`);

  // 2. Create user for Reponse
  const user = await prisma.user.upsert({
    where: { code: USER_CODE },
    update: {
      default_account_id: account.id,
      password_hash: hashedPassword,
    },
    create: {
      code: USER_CODE,
      name: 'Reponse Iradukunda',
      // Local phone 0783349295 → international format 250783349295
      phone: '250783349295',
      email: 'reponse.iradukunda+seed@gemura.local',
      password_hash: hashedPassword,
      account_type: 'farmer',
      status: 'active',
      default_account_id: account.id,
    },
  });
  console.log(`✅ User: ${user.name} (${user.code}) - ${user.phone}`);

  // 3. Link user to account
  await prisma.userAccount.upsert({
    where: {
      user_id_account_id: { user_id: user.id, account_id: account.id },
    },
    update: {},
    create: {
      user_id: user.id,
      account_id: account.id,
      role: 'owner',
      permissions: { can_manage: true, can_view: true, can_edit: true },
      status: 'active',
    },
  });
  console.log('✅ Linked user to account (owner role)');

  // 4. Wallet for Reponse account
  const walletCode = 'W_REPONSE_001';
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

  // 5. Create a farm for Reponse
  const now = new Date();
  const farm = await prisma.farm.upsert({
    where: { code: FARM_CODE },
    update: {
      name: "Reponse Iradukunda's Farm",
      description: 'Farm for Reponse Iradukunda',
      status: 'active',
      updated_at: now,
    },
    create: {
      account_id: account.id,
      code: FARM_CODE,
      name: "Reponse Iradukunda's Farm",
      description: 'Farm for Reponse Iradukunda',
      status: 'active',
      created_at: now,
      updated_at: now,
      created_by: user.id,
    },
  });
  console.log(`✅ Farm: ${farm.name} (${farm.code})`);

  console.log('\n🎉 Reponse Iradukunda account and farm seed completed.');
  console.log('   Login phone: 250783349295');
  console.log('   Password:    Pass123');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding Reponse account/farm:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

