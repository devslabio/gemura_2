/**
 * Demo farms + mock poultry/pig data for Orora QA (all farm-gate types).
 *
 * Targets the default account of a user found by phone (main seed user by default).
 * Removes prior demo rows for this account (farm codes prefixed MOCK-O-) then recreates.
 *
 * Usage (from backend/, with DATABASE_URL set):
 *   npx ts-node prisma/seed-orora-mock-farms.ts
 *
 * Optional env:
 *   SEED_USER_PHONE=250788606765
 *   SEED_USER_PASSWORD=Pass123   (updates bcrypt hash; omit to skip password update)
 */
import {
  Prisma,
  PrismaClient,
  FarmProductionMode,
  FlockMovementType,
  PigBatchStatus,
  PoultryFlockStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const MOCK_FARM_PREFIX = 'MOCK-O-';

const PHONE = process.env.SEED_USER_PHONE ?? '250788606765';

type FocusDef = { speciesCode: string; modes: FarmProductionMode[] };

const DEMO_FARMS: { code: string; name: string; description: string; focus: FocusDef[] }[] = [
  {
    code: `${MOCK_FARM_PREFIX}dairy-cattle`,
    name: 'Demo · Dairy cattle',
    description: 'Mock farm: cattle with dairy (+ optional breeding). Shows milk nav when selected.',
    focus: [{ speciesCode: 'cattle', modes: ['dairy', 'breeding'] }],
  },
  {
    code: `${MOCK_FARM_PREFIX}dairy-goats`,
    name: 'Demo · Dairy goats',
    description: 'Mock farm: goats with dairy focus (dairy goat scenario).',
    focus: [{ speciesCode: 'goat', modes: ['dairy'] }],
  },
  {
    code: `${MOCK_FARM_PREFIX}beef-cattle`,
    name: 'Demo · Beef cattle',
    description: 'Mock farm: cattle meat production only.',
    focus: [{ speciesCode: 'cattle', modes: ['meat'] }],
  },
  {
    code: `${MOCK_FARM_PREFIX}layers`,
    name: 'Demo · Layers & eggs',
    description: 'Mock farm: poultry with eggs (+ meat). Includes a seed flock with daily & movement rows.',
    focus: [{ speciesCode: 'poultry', modes: ['eggs', 'meat'] }],
  },
  {
    code: `${MOCK_FARM_PREFIX}pigs`,
    name: 'Demo · Pig production',
    description: 'Mock farm: pigs with growth & farrowing seed data.',
    focus: [{ speciesCode: 'pig', modes: ['meat', 'breeding'] }],
  },
  {
    code: `${MOCK_FARM_PREFIX}mixed`,
    name: 'Demo · Mixed species',
    description: 'One farm with cattle, goat, poultry, pig rows — use to test sidebar gates.',
    focus: [
      { speciesCode: 'cattle', modes: ['dairy'] },
      { speciesCode: 'goat', modes: ['meat'] },
      { speciesCode: 'poultry', modes: ['eggs'] },
      { speciesCode: 'pig', modes: ['meat'] },
    ],
  },
];

async function cleanupMockFarms(accountId: string) {
  const farms = await prisma.farm.findMany({
    where: {
      account_id: accountId,
      code: { startsWith: MOCK_FARM_PREFIX },
    },
    select: { id: true },
  });
  const farmIds = farms.map((f) => f.id);
  if (farmIds.length === 0) return;

  const flockIds = (
    await prisma.poultryFlock.findMany({
      where: { farm_id: { in: farmIds } },
      select: { id: true },
    })
  ).map((f) => f.id);

  if (flockIds.length > 0) {
    await prisma.flockMovement.deleteMany({ where: { flock_id: { in: flockIds } } });
    await prisma.flockDailyRecord.deleteMany({ where: { flock_id: { in: flockIds } } });
    await prisma.poultryFlock.deleteMany({ where: { id: { in: flockIds } } });
  }

  const batchIds = (
    await prisma.pigBatch.findMany({
      where: { farm_id: { in: farmIds } },
      select: { id: true },
    })
  ).map((b) => b.id);

  if (batchIds.length > 0) {
    await prisma.pigFarrowing.deleteMany({
      where: { account_id: accountId, pig_batch_id: { in: batchIds } },
    });
  }
  await prisma.pigFarrowing.deleteMany({
    where: { account_id: accountId, farm_id: { in: farmIds } },
  });

  if (batchIds.length > 0) {
    await prisma.pigBatchWeight.deleteMany({ where: { batch_id: { in: batchIds } } });
    await prisma.pigBatch.deleteMany({ where: { id: { in: batchIds } } });
  }

  await prisma.farmSpeciesFocus.deleteMany({ where: { farm_id: { in: farmIds } } });
  await prisma.farm.deleteMany({ where: { id: { in: farmIds } } });

  console.log(`🧹 Removed previous ${farmIds.length} MOCK-O-* demo farm(s) for this account.`);
}

async function main() {
  console.log('🌾 Orora mock farms + poultry/pig demo seed\n');
  console.log(`   Target phone: ${PHONE}`);
  console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '(set)' : 'MISSING — export DATABASE_URL'}\n`);

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required (e.g. load backend/.env in your shell).');
  }

  const hashedPassword = await bcrypt.hash(process.env.SEED_USER_PASSWORD ?? 'Pass123', 10);

  const user = await prisma.user.findUnique({
    where: { phone: PHONE },
    select: { id: true, default_account_id: true, name: true },
  });

  if (!user?.default_account_id) {
    throw new Error(`No user with phone ${PHONE} or missing default_account_id. Run prisma/seed.ts first or fix user.`);
  }

  const accountId = user.default_account_id;

  if (process.env.SEED_SKIP_PASSWORD !== '1') {
    await prisma.user.update({
      where: { id: user.id },
      data: { password_hash: hashedPassword },
    });
    console.log('✅ Password hash updated (Pass123 unless SEED_USER_PASSWORD was set).\n');
  } else {
    console.log('⏭️  SEED_SKIP_PASSWORD=1 — password unchanged.\n');
  }

  const speciesMap = new Map<string, string>();
  for (const code of ['cattle', 'goat', 'poultry', 'pig']) {
    const s = await prisma.species.findUnique({ where: { code } });
    if (!s) throw new Error(`Species "${code}" not found. Apply migrations / species seed.`);
    speciesMap.set(code, s.id);
  }

  const breed = {
    cattle: await prisma.breed.findFirst({ where: { code: 'HOLSTEIN' } }),
    goat: await prisma.breed.findFirst({ where: { code: 'SAANEN_GOAT' } }),
    poultry: await prisma.breed.findFirst({ where: { code: 'POULTRY_LAYER' } }),
    pig: await prisma.breed.findFirst({ where: { code: 'PIG_LARGE_WHITE' } }),
  };
  if (!breed.poultry || !breed.pig) {
    throw new Error('Required breeds POULTRY_LAYER / PIG_LARGE_WHITE not found. Run breed migrations.');
  }

  await cleanupMockFarms(accountId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  let poultryFarmId: string | null = null;
  let pigFarmId: string | null = null;

  for (const def of DEMO_FARMS) {
    const focusRows = def.focus.map((f) => ({
      species_id: speciesMap.get(f.speciesCode)!,
      modes: f.modes,
    }));

    const farm = await prisma.farm.create({
      data: {
        account_id: accountId,
        code: def.code,
        name: def.name,
        description: def.description,
        status: 'active',
        created_by: user.id,
        farm_species_focus: {
          create: focusRows.map((r) => ({
            species_id: r.species_id,
            modes: r.modes,
          })),
        },
      },
    });

    if (def.code === `${MOCK_FARM_PREFIX}layers`) poultryFarmId = farm.id;
    if (def.code === `${MOCK_FARM_PREFIX}pigs`) pigFarmId = farm.id;

    console.log(`✅ Farm ${farm.code} — ${farm.name}`);
  }

  // Poultry flock + records (layers farm)
  if (poultryFarmId) {
    const flock = await prisma.poultryFlock.create({
      data: {
        account_id: accountId,
        farm_id: poultryFarmId,
        breed_id: breed.poultry!.id,
        name: 'Demo flock · Layers house A',
        code: 'MOCK-FLOCK-LAYERS-A',
        started_at: new Date('2025-06-01'),
        opening_head_count: 520,
        current_head_count: 498,
        status: PoultryFlockStatus.active,
        notes: 'Seeded demo flock (eggs + mortality + intake)',
        created_by: user.id,
      },
    });

    await prisma.flockDailyRecord.create({
      data: {
        flock_id: flock.id,
        record_date: yesterday,
        eggs_collected: 412,
        mortality_count: 2,
        notes: 'Demo daily row',
      },
    });

    await prisma.flockMovement.create({
      data: {
        flock_id: flock.id,
        movement_date: weekAgo,
        type: FlockMovementType.intake,
        quantity: 120,
        notes: 'Demo batch intake',
        created_by: user.id,
      },
    });

    console.log(`✅ Poultry flock ${flock.code} + daily + intake movement`);
  }

  // Pig batch + weight + farrowing (pigs farm)
  if (pigFarmId && breed.pig) {
    const batch = await prisma.pigBatch.create({
      data: {
        account_id: accountId,
        farm_id: pigFarmId,
        breed_id: breed.pig.id,
        name: 'Demo batch · Growers 2026-A',
        code: 'MOCK-PIG-GROW-A',
        started_at: new Date('2025-11-15'),
        opening_head_count: 36,
        current_head_count: 44,
        status: PigBatchStatus.active,
        notes: 'Seeded demo batch (weights + farrowing)',
        created_by: user.id,
      },
    });

    await prisma.pigBatchWeight.create({
      data: {
        batch_id: batch.id,
        weighed_date: yesterday,
        avg_weight_kg: new Prisma.Decimal('62.50'),
        min_weight_kg: new Prisma.Decimal('55.00'),
        max_weight_kg: new Prisma.Decimal('71.00'),
        animals_weighed: 40,
        weight_band: '60–80 kg',
        notes: 'Demo weigh day',
      },
    });

    await prisma.pigFarrowing.create({
      data: {
        account_id: accountId,
        farm_id: pigFarmId,
        pig_batch_id: batch.id,
        farrowing_date: weekAgo,
        live_born: 11,
        stillborn: 1,
        mummified: 0,
        notes: 'Demo farrowing (linked to batch)',
        created_by: user.id,
      },
    });

    console.log(`✅ Pig batch ${batch.code} + weight band + farrowing`);
  }

  console.log('\n🎉 Mock seed complete.');
  console.log('   Log in on Orora with phone', PHONE, 'and password Pass123 (unless you overrode SEED_USER_PASSWORD).');
  console.log('   Select each “Demo · …” farm to see milk / poultry / pig nav gates change.\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
