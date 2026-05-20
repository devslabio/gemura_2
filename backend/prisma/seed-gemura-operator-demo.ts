/**
 * Create or update a Gemura platform operator demo user (read-only operator dashboard).
 * Idempotent: upserts by phone; updates password, email, and membership on re-run.
 *
 * Usage (inside API container or locally with DATABASE_URL):
 *   npx tsx prisma/seed-gemura-operator-demo.ts
 *   PLATFORM_ACCOUNT_CODE=ACC_MAIN_001 npx tsx prisma/seed-gemura-operator-demo.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { composeUserFullName, splitIntoFirstLast } from './user-name-shared';

const prisma = new PrismaClient();

const PASSWORD = process.env.SEED_OPERATOR_PASSWORD || 'Pass123!';

const OPERATOR_DEMO = {
  email: 'operator@gemura.rw',
  phone: '250788409035',
  code: 'U_ROLE_OPR',
  displayName: 'Demo Platform Operator',
} as const;

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

function userNameFields(display: string) {
  const { first_name, last_name } = splitIntoFirstLast(display);
  const name = composeUserFullName(first_name, last_name) || display.trim();
  return { first_name, last_name, name };
}

async function resolvePlatformAccountId(): Promise<{ id: string; code: string | null; name: string }> {
  const envCode = process.env.PLATFORM_ACCOUNT_CODE?.trim();
  if (envCode) {
    const acc = await prisma.account.findFirst({
      where: { code: envCode, status: 'active' },
      select: { id: true, code: true, name: true },
    });
    if (acc) return acc;
    throw new Error(`PLATFORM_ACCOUNT_CODE=${envCode} not found or inactive`);
  }

  const main = await prisma.account.findFirst({
    where: { code: 'ACC_MAIN_001', status: 'active' },
    select: { id: true, code: true, name: true },
  });
  if (main) return main;

  throw new Error('No active ACC_MAIN_001 account. Set PLATFORM_ACCOUNT_CODE.');
}

async function resolveOperatorPlatformRoleId(): Promise<string | null> {
  const role = await prisma.platformRole.findFirst({
    where: { slug: 'operator' },
    select: { id: true },
  });
  return role?.id ?? null;
}

async function main() {
  console.log('👤 Gemura platform operator demo user seed');
  const hashedPassword = await bcrypt.hash(PASSWORD, 10);
  const platformAccount = await resolvePlatformAccountId();
  const platformRoleId = await resolveOperatorPlatformRoleId();

  console.log(`   Platform account: ${platformAccount.code ?? platformAccount.id} — ${platformAccount.name}`);
  if (!platformRoleId) {
    console.log(
      '   ⚠️  platform_roles.slug=operator not found — restart API once (ensureCatalogFromConfig) or run full prisma seed',
    );
  }

  const phone = normalizePhone(OPERATOR_DEMO.phone);
  const email = OPERATOR_DEMO.email.toLowerCase();
  const names = userNameFields(OPERATOR_DEMO.displayName);

  const user = await prisma.user.upsert({
    where: { phone },
    update: {
      ...names,
      code: OPERATOR_DEMO.code,
      email,
      password_hash: hashedPassword,
      account_type: 'mcc',
      status: 'active',
      default_account_id: platformAccount.id,
    },
    create: {
      code: OPERATOR_DEMO.code,
      ...names,
      phone,
      email,
      password_hash: hashedPassword,
      account_type: 'mcc',
      status: 'active',
      default_account_id: platformAccount.id,
      token: `token_${phone}_${Date.now()}`,
    },
  });

  await prisma.userAccount.upsert({
    where: {
      user_id_account_id: { user_id: user.id, account_id: platformAccount.id },
    },
    update: {
      role: 'operator',
      status: 'active',
      ...(platformRoleId ? { platform_role_id: platformRoleId } : {}),
    },
    create: {
      user_id: user.id,
      account_id: platformAccount.id,
      role: 'operator',
      ...(platformRoleId ? { platform_role_id: platformRoleId } : {}),
      status: 'active',
    },
  });

  console.log('\n✅ Platform operator demo ready');
  console.log(`   Email:    ${email}`);
  console.log(`   Phone:    ${phone}  (or 0788409035 locally)`);
  console.log(`   Password: ${PASSWORD}`);
  console.log(`   Account:  ${platformAccount.code ?? platformAccount.id}`);
  console.log('   Login:    http://localhost:3015/auth/login → /admin/operator');
}

main()
  .catch((e) => {
    console.error('❌ seed-gemura-operator-demo failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
