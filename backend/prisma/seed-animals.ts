/**
 * Seed realistic animal data: 10+ cattle with Rwandan names,
 * weight history, health records, milk production, breeding, and calving.
 * Uses account Gahengeri (A_33FDF4) and farm Gahengeri's farm (FARM-0002).
 * Run: npx ts-node prisma/seed-animals.ts
 * Requires: account and farm to exist; breeds from migrations.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ACCOUNT_CODE = process.env.SEED_ACCOUNT_CODE ?? 'A_33FDF4';
const FARM_CODE = process.env.SEED_FARM_CODE ?? 'FARM-0002';

const RWANDAN_COW_NAMES = [
  'Mutoni',
  'Uwera',
  'Mukamana',
  'Ingabire',
  'Keza',
  'Nyirahabine',
  'Murekatete',
  'Beline',
  'Uwimana',
  'Irakoze',
  'Nyiramana',
  'Kazungu',
];
const RWANDAN_BULL_NAMES = ['Gahondo', 'Rukundo'];

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function randomBetween(min: number, max: number, decimals = 1): number {
  const v = min + Math.random() * (max - min);
  return decimals === 0 ? Math.round(v) : Number(v.toFixed(decimals));
}

async function main() {
  console.log('🐄 Seeding animals with realistic Rwandan data...\n');

  const account = await prisma.account.findUnique({ where: { code: ACCOUNT_CODE } });
  if (!account) {
    throw new Error(`Account ${ACCOUNT_CODE} (Gahengeri) not found. Ensure the account exists.`);
  }

  const farm = await prisma.farm.findFirst({
    where: { account_id: account.id, code: FARM_CODE },
  });
  const farmId = farm?.id ?? null;
  if (farm) {
    console.log(`Using account: ${account.name} (${account.code}), farm: ${farm.name} (${farm.code})\n`);
  } else {
    console.log(`Using account: ${account.name} (${account.code}). Farm ${FARM_CODE} not found; animals will have no farm.\n`);
  }

  const user = await prisma.user.findFirst({ where: { default_account_id: account.id } });
  const createdBy = user?.id ?? null;

  // Optional: clear existing Orora-seeded animal data so re-run is idempotent
  const existing = await prisma.animal.findMany({
    where: { account_id: account.id, tag_number: { startsWith: 'OR-' } },
    select: { id: true },
  });
  const existingIds = existing.map((a) => a.id);
  if (existingIds.length > 0) {
    console.log(`Cleaning existing data for ${existingIds.length} OR- animals...`);
    await prisma.animalWeight.deleteMany({ where: { animal_id: { in: existingIds } } });
    await prisma.animalHealth.deleteMany({ where: { animal_id: { in: existingIds } } });
    await prisma.animalBreeding.deleteMany({ where: { animal_id: { in: existingIds } } });
    await prisma.animalCalving.deleteMany({ where: { mother_id: { in: existingIds } } });
    await prisma.animalCalving.updateMany({ where: { calf_id: { in: existingIds } }, data: { calf_id: null } });
    await prisma.milkProduction.deleteMany({ where: { account_id: account.id, animal_id: { in: existingIds } } });
    await prisma.animal.deleteMany({ where: { id: { in: existingIds } } });
    console.log('  ✓ Cleaned.\n');
  }

  const holstein = await prisma.breed.findFirst({ where: { code: 'HOLSTEIN' } });
  const ankole = await prisma.breed.findFirst({ where: { code: 'ANKOLE' } });
  const jersey = await prisma.breed.findFirst({ where: { code: 'JERSEY' } });
  const crossbreed = await prisma.breed.findFirst({ where: { code: 'CROSSBREED' } });
  const breedFallback = holstein ?? ankole ?? jersey ?? crossbreed ?? (await prisma.breed.findFirst());
  if (!breedFallback) {
    throw new Error('No breeds found. Run migrations that seed breeds.');
  }
  const speciesId = breedFallback.species_id;

  const dairyBreed = holstein ?? jersey ?? breedFallback;
  const breeds = { holstein, ankole, jersey, crossbreed, dairy: dairyBreed, fallback: breedFallback };

  // ----- 1. Create bulls (2) -----
  console.log('Creating bulls...');
  const bull1 = await prisma.animal.upsert({
    where: { account_id_tag_number: { account_id: account.id, tag_number: 'OR-BULL-001' } },
    update: {},
    create: {
      account_id: account.id,
      farm_id: farmId,
      species_id: speciesId,
      breed_id: breeds.ankole?.id ?? breedFallback.id,
      tag_number: 'OR-BULL-001',
      name: RWANDAN_BULL_NAMES[0],
      gender: 'male',
      date_of_birth: new Date('2019-05-10'),
      source: 'purchased',
      status: 'active',
      created_by: createdBy,
    },
  });
  const bull2 = await prisma.animal.upsert({
    where: { account_id_tag_number: { account_id: account.id, tag_number: 'OR-BULL-002' } },
    update: {},
    create: {
      account_id: account.id,
      farm_id: farmId,
      species_id: speciesId,
      breed_id: breeds.holstein?.id ?? breedFallback.id,
      tag_number: 'OR-BULL-002',
      name: RWANDAN_BULL_NAMES[1],
      gender: 'male',
      date_of_birth: new Date('2020-02-20'),
      source: 'purchased',
      status: 'active',
      created_by: createdBy,
    },
  });
  const bulls = [bull1, bull2];
  console.log(`  ✓ ${bull1.name}, ${bull2.name}`);

  // ----- 2. Create cows (10) -----
  console.log('Creating cows...');
  const cows: { id: string; tag_number: string; name: string; date_of_birth: Date }[] = [];
  for (let i = 0; i < 10; i++) {
    const tag = `OR-COW-${String(i + 1).padStart(3, '0')}`;
    const name = RWANDAN_COW_NAMES[i];
    const dob = addDays(new Date(), -365 * (3 + Math.floor(Math.random() * 4))); // 3–6 years ago
    const cow = await prisma.animal.upsert({
      where: { account_id_tag_number: { account_id: account.id, tag_number: tag } },
      update: {},
      create: {
        account_id: account.id,
        farm_id: farmId,
        species_id: speciesId,
        breed_id: i % 3 === 0 ? (breeds.ankole?.id ?? breedFallback.id) : breeds.dairy.id,
        tag_number: tag,
        name,
        gender: 'female',
        date_of_birth: dob,
        source: i % 4 === 0 ? 'purchased' : 'born_on_farm',
        status: i % 5 === 0 ? 'lactating' : i % 5 === 1 ? 'pregnant' : 'active',
        created_by: createdBy,
      },
    });
    cows.push({ id: cow.id, tag_number: tag, name, date_of_birth: dob });
  }
  console.log(`  ✓ ${cows.length} cows: ${cows.map((c) => c.name).join(', ')}`);

  const allAnimals = [...bulls.map((b) => ({ id: b.id, gender: b.gender })), ...cows.map((c) => ({ id: c.id, gender: 'female' as const }))];

  // ----- 3. Weight history (3–5 per animal) -----
  console.log('Adding weight history...');
  let weightCount = 0;
  for (const a of allAnimals) {
    const baseKg = a.gender === 'male' ? randomBetween(450, 650) : randomBetween(350, 550);
    const numWeights = 3 + Math.floor(Math.random() * 3);
    for (let w = 0; w < numWeights; w++) {
      const monthsAgo = 2 + w * 4 + Math.floor(Math.random() * 2);
      const recordedAt = addDays(new Date(), -30 * monthsAgo);
      const growth = (numWeights - w) * randomBetween(8, 25);
      await prisma.animalWeight.create({
        data: {
          animal_id: a.id,
          weight_kg: Math.max(100, baseKg - growth + randomBetween(-5, 5)),
          recorded_at: recordedAt,
          notes: w === 0 ? 'Routine weighing' : null,
          created_by: createdBy,
        },
      });
      weightCount++;
    }
  }
  console.log(`  ✓ ${weightCount} weight records`);

  // ----- 4. Health records (vaccination, deworming, treatment) -----
  console.log('Adding health records...');
  const healthEvents: { type: 'vaccination' | 'deworming' | 'treatment' | 'examination'; desc: string; medicine?: string }[] = [
    { type: 'vaccination', desc: 'Lumpy skin disease vaccine', medicine: 'LSD vaccine' },
    { type: 'vaccination', desc: 'Foot-and-mouth disease vaccination', medicine: 'FMD vaccine' },
    { type: 'deworming', desc: 'Routine deworming', medicine: 'Albendazole' },
    { type: 'treatment', desc: 'Mastitis treatment', medicine: 'Antibiotic course' },
    { type: 'examination', desc: 'General health check' },
  ];
  let healthCount = 0;
  for (const a of allAnimals) {
    const n = 2 + Math.floor(Math.random() * 2);
    for (let h = 0; h < n; h++) {
      const ev = healthEvents[h % healthEvents.length];
      const eventDate = addDays(new Date(), -60 - h * 90);
      await prisma.animalHealth.create({
        data: {
          animal_id: a.id,
          event_type: ev.type,
          event_date: eventDate,
          description: ev.desc,
          medicine_name: ev.medicine ?? null,
          next_due_date: ev.type === 'vaccination' ? addDays(eventDate, 365) : null,
          cost: randomBetween(2000, 15000, 0),
          created_by: createdBy,
        },
      });
      healthCount++;
    }
  }
  console.log(`  ✓ ${healthCount} health records`);

  // ----- 5. Milk production (females, last 60 days) -----
  console.log('Adding milk production...');
  let productionCount = 0;
  for (const cow of cows) {
    const numDays = 30 + Math.floor(Math.random() * 30);
    for (let d = 0; d < numDays; d++) {
      const prodDate = addDays(new Date(), -d);
      const litres = randomBetween(8, 22, 2);
      await prisma.milkProduction.create({
        data: {
          account_id: account.id,
          farm_id: farmId,
          animal_id: cow.id,
          production_date: prodDate,
          quantity_litres: litres,
          notes: d % 7 === 0 ? 'Morning + evening milking' : null,
          created_by: createdBy,
        },
      });
      productionCount++;
    }
  }
  console.log(`  ✓ ${productionCount} milk production records`);

  // ----- 6. Breeding records (for 5 cows) -----
  console.log('Adding breeding records...');
  for (let i = 0; i < 5; i++) {
    const cow = cows[i];
    const breedingDate = addDays(new Date(), -180 - i * 60);
    const useBull = bulls[i % 2];
    await prisma.animalBreeding.create({
      data: {
        animal_id: cow.id,
        breeding_date: breedingDate,
        method: i % 2 === 0 ? 'natural' : 'artificial_insemination',
        bull_animal_id: useBull.id,
        bull_name: i % 2 === 0 ? useBull.name : null,
        semen_code: i % 2 === 1 ? `SEM-${2024}-${100 + i}` : null,
        expected_calving_date: addDays(breedingDate, 280),
        outcome: 'pregnant',
        notes: 'Successful breeding.',
        created_by: createdBy,
      },
    });
  }
  console.log('  ✓ 5 breeding records');

  // ----- 7. Calving records (for 3 cows; create 2 calves and link) -----
  console.log('Adding calving records...');
  const calvingMothers = [cows[0], cows[1], cows[2]];
  const calfNames = ['Inyana', 'Turiho'];
  for (let i = 0; i < calvingMothers.length; i++) {
    const mother = calvingMothers[i];
    const calvingDate = addDays(new Date(), -250 - i * 100);
    const outcome = i < 2 ? 'live' : 'live';
    const gender: 'male' | 'female' = i === 0 ? 'female' : 'male';
    let calfId: string | null = null;

    if (i < 2) {
      const calfTag = `OR-CALF-00${i + 1}`;
      const calf = await prisma.animal.upsert({
        where: { account_id_tag_number: { account_id: account.id, tag_number: calfTag } },
        update: { mother_id: mother.id, farm_id: farmId },
        create: {
          account_id: account.id,
          farm_id: farmId,
          species_id: speciesId,
          breed_id: breeds.dairy.id,
          tag_number: calfTag,
          name: calfNames[i],
          gender,
          date_of_birth: calvingDate,
          source: 'born_on_farm',
          status: 'active',
          mother_id: mother.id,
          created_by: createdBy,
        },
      });
      calfId = calf.id;
    }

    await prisma.animalCalving.create({
      data: {
        mother_id: mother.id,
        calving_date: calvingDate,
        calf_id: calfId,
        outcome: outcome as 'live',
        gender: calfId ? gender : null,
        weight_kg: outcome === 'live' ? randomBetween(28, 42, 2) : null,
        notes: outcome === 'live' ? 'Healthy calf.' : null,
        created_by: createdBy,
      },
    });
  }
  console.log('  ✓ 3 calving records (2 with new calves linked)');

  console.log('\n🎉 Animal seed completed successfully!\n');
  console.log('Summary:');
  console.log('  • Bulls: 2');
  console.log('  • Cows: 10');
  console.log('  • Weight records: ' + weightCount);
  console.log('  • Health records: ' + healthCount);
  console.log('  • Milk production records: ' + productionCount);
  console.log('  • Breeding records: 5');
  console.log('  • Calving records: 3 (2 calves created)\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
