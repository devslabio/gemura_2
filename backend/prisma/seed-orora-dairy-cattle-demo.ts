/**
 * Demo data for the Orora "MOCK-O-dairy-cattle" farm so the
 * Milk production page (cost-per-litre) shows realistic numbers.
 *
 * What it creates (idempotent on re-run via tag/code prefixes):
 *   - 12 dairy cows on the demo farm: 10 producing + 2 dry/non-producing
 *   - 60 days of daily milk production for the 10 producing cows
 *   - One feed product ("Demo dairy meal") + 2 purchase_in inventory movements
 *     so the "Include inventory feed costs" toggle has data
 *   - Stamps existing accounting transactions on this account that have NO
 *     farm_id with the demo farm id, so the per-farm filter also works
 *
 * Usage (from backend/, .env loaded):
 *   npm run seed:orora-dairy-cattle-demo
 *
 * Optional env:
 *   SEED_USER_PHONE=250788606765   # Account owner phone
 *   SEED_FARM_CODE=MOCK-O-dairy-cattle
 *   SEED_DAYS=60                   # Days of milk production
 *   SEED_PRODUCING_COWS=10         # Cows that have daily production
 *   SEED_DRY_COWS=2                # Active females w/o production (non-producing)
 *   SEED_BACKFILL_TX_FARM=1        # Set to 0 to skip stamping existing tx with farm_id
 */
import {
  Prisma,
  PrismaClient,
  AnimalGender,
  AnimalSource,
  AnimalStatus,
  InventoryMovementType,
  InventoryMovementReferenceType,
  ProductStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

const PHONE = process.env.SEED_USER_PHONE ?? '250788606765';
const FARM_CODE = process.env.SEED_FARM_CODE ?? 'MOCK-O-dairy-cattle';
const DAYS = Number(process.env.SEED_DAYS ?? 60);
const PRODUCING_COWS = Number(process.env.SEED_PRODUCING_COWS ?? 10);
const DRY_COWS = Number(process.env.SEED_DRY_COWS ?? 2);
const BACKFILL_TX_FARM = process.env.SEED_BACKFILL_TX_FARM !== '0';

const COW_TAG_PREFIX = 'OR-DAIRY-DEMO-';
const FEED_PRODUCT_NAME = 'Demo dairy meal (16% CP)';
const FEED_CATEGORY_NAME = 'feed';

const RWANDAN_COW_NAMES = [
  'Mutoni', 'Uwera', 'Mukamana', 'Ingabire', 'Keza',
  'Nyirahabine', 'Murekatete', 'Beline', 'Uwimana', 'Irakoze',
  'Nyiramana', 'Kazungu', 'Umutoni', 'Ineza',
];

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function rand(min: number, max: number, decimals = 1): number {
  const v = min + Math.random() * (max - min);
  return decimals === 0 ? Math.round(v) : Number(v.toFixed(decimals));
}

async function main() {
  console.log('🐄 Orora dairy-cattle demo seed\n');
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required (export it or use backend/.env).');
  }

  const user = await prisma.user.findUnique({
    where: { phone: PHONE },
    select: { id: true, default_account_id: true, name: true },
  });
  if (!user?.default_account_id) {
    throw new Error(`User with phone ${PHONE} not found, or no default_account_id.`);
  }
  const accountId = user.default_account_id;
  const createdBy = user.id;

  const farm = await prisma.farm.findFirst({
    where: { account_id: accountId, code: FARM_CODE },
    select: { id: true, name: true, code: true },
  });
  if (!farm) {
    throw new Error(
      `Farm "${FARM_CODE}" not found for this account. Run \`npm run seed:orora-mock-farms\` first.`,
    );
  }
  console.log(`   Account: ${user.name} (${accountId})`);
  console.log(`   Farm:    ${farm.name} (${farm.code})\n`);

  const cattleSpecies = await prisma.species.findUnique({ where: { code: 'cattle' } });
  if (!cattleSpecies) throw new Error('Species "cattle" missing. Run species migration.');
  const dairyBreed =
    (await prisma.breed.findFirst({ where: { code: 'HOLSTEIN' } })) ??
    (await prisma.breed.findFirst({ where: { code: 'JERSEY' } })) ??
    (await prisma.breed.findFirst({ where: { species_id: cattleSpecies.id } }));
  if (!dairyBreed) throw new Error('No cattle breed found. Run breed migrations.');

  // 1. Cows (idempotent via tag prefix scoped to this account)
  console.log('🐮 Creating cows...');
  const totalCows = PRODUCING_COWS + DRY_COWS;
  const cows: { id: string; tag: string; name: string; producing: boolean }[] = [];
  for (let i = 0; i < totalCows; i++) {
    const tag = `${COW_TAG_PREFIX}${String(i + 1).padStart(3, '0')}`;
    const name = RWANDAN_COW_NAMES[i % RWANDAN_COW_NAMES.length];
    const dob = addDays(new Date(), -365 * (3 + Math.floor(Math.random() * 4)));
    const cow = await prisma.animal.upsert({
      where: { account_id_tag_number: { account_id: accountId, tag_number: tag } },
      update: { farm_id: farm.id, status: AnimalStatus.active, gender: AnimalGender.female },
      create: {
        account_id: accountId,
        farm_id: farm.id,
        species_id: cattleSpecies.id,
        breed_id: dairyBreed.id,
        tag_number: tag,
        name,
        gender: AnimalGender.female,
        date_of_birth: dob,
        source: AnimalSource.born_on_farm,
        status: AnimalStatus.active,
        created_by: createdBy,
      },
    });
    cows.push({ id: cow.id, tag, name, producing: i < PRODUCING_COWS });
  }
  console.log(`   ✓ ${PRODUCING_COWS} producing + ${DRY_COWS} dry cow(s)`);

  // 2. Daily milk production for the producing cows over the last DAYS days
  console.log(`🥛 Creating ${DAYS} days of milk production...`);
  // Wipe previous demo production so re-runs aren't multiplicative.
  const cowIds = cows.map((c) => c.id);
  await prisma.milkProduction.deleteMany({
    where: { account_id: accountId, animal_id: { in: cowIds } },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows: Prisma.MilkProductionCreateManyInput[] = [];
  for (const cow of cows.filter((c) => c.producing)) {
    // Slight per-cow yield curve (8–22 L/day band)
    const baseAm = rand(4, 11);
    const basePm = rand(3, 9);
    for (let d = 0; d < DAYS; d++) {
      const date = addDays(today, -d);
      const am = Math.max(2, baseAm + rand(-1.5, 1.5));
      const pm = Math.max(1.5, basePm + rand(-1.5, 1.5));
      rows.push({
        account_id: accountId,
        farm_id: farm.id,
        animal_id: cow.id,
        production_date: date,
        quantity_litres: new Prisma.Decimal((am + pm).toFixed(2)),
        session: 'combined',
        notes: d === 0 ? 'Latest daily total' : null,
        created_by: createdBy,
      });
    }
  }
  await prisma.milkProduction.createMany({ data: rows });
  const totalLitres = rows.reduce((s, r) => s + Number(r.quantity_litres), 0);
  console.log(`   ✓ ${rows.length} rows · ~${totalLitres.toFixed(0)} L over ${DAYS} days`);

  // 3. Feed product + 2 purchase_in inventory movements (so inventory feed cost > 0)
  console.log('🌾 Ensuring feed product + purchase movements...');
  let feedCategory = await prisma.category.findUnique({ where: { name: FEED_CATEGORY_NAME } });
  if (!feedCategory) {
    feedCategory = await prisma.category.create({
      data: { name: FEED_CATEGORY_NAME, description: 'Animal feed (auto-seeded)' },
    });
    console.log(`   ✓ Created category "${FEED_CATEGORY_NAME}"`);
  }

  let feedProduct = await prisma.product.findFirst({
    where: { account_id: accountId, name: FEED_PRODUCT_NAME },
  });
  if (!feedProduct) {
    feedProduct = await prisma.product.create({
      data: {
        account_id: accountId,
        name: FEED_PRODUCT_NAME,
        description: 'Demo dairy concentrate, 50 kg bag',
        price: new Prisma.Decimal('25000.00'),
        stock_quantity: 0,
        status: ProductStatus.active,
        created_by: createdBy,
      },
    });
    console.log(`   ✓ Created product "${FEED_PRODUCT_NAME}"`);
  }
  await prisma.productCategory.upsert({
    where: { product_id_category_id: { product_id: feedProduct.id, category_id: feedCategory.id } },
    update: {},
    create: { product_id: feedProduct.id, category_id: feedCategory.id },
  });

  // Idempotent purchase movements: delete prior demo movements for this product first.
  await prisma.inventoryMovement.deleteMany({
    where: {
      product_id: feedProduct.id,
      description: { startsWith: '[DEMO] ' },
    },
  });
  const purchases: Prisma.InventoryMovementCreateManyInput[] = [
    {
      product_id: feedProduct.id,
      movement_type: InventoryMovementType.purchase_in,
      quantity: 40,
      movement_date: addDays(today, -45),
      reference_type: InventoryMovementReferenceType.purchase,
      description: '[DEMO] 40 bags @ 25,000 RWF (concentrate restock)',
      unit_price: new Prisma.Decimal('25000.00'),
      created_by: createdBy,
    },
    {
      product_id: feedProduct.id,
      movement_type: InventoryMovementType.purchase_in,
      quantity: 30,
      movement_date: addDays(today, -10),
      reference_type: InventoryMovementReferenceType.purchase,
      description: '[DEMO] 30 bags @ 25,000 RWF (top-up)',
      unit_price: new Prisma.Decimal('25000.00'),
      created_by: createdBy,
    },
  ];
  await prisma.inventoryMovement.createMany({ data: purchases });
  console.log(`   ✓ 2 purchase_in movements (70 bags · 1,750,000 RWF feed cost)`);

  // 4. Stamp existing accounting transactions w/o farm_id with this farm,
  //    so the per-farm filter shows actual numbers too.
  // Chart-of-account is global; we scope to this account via the EXP-<accountCode> prefix
  // (same scoping used by milk-production cost report).
  if (BACKFILL_TX_FARM) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { code: true },
    });
    const accountPrefix = account?.code || accountId.substring(0, 8).toUpperCase();
    const updated = await prisma.accountingTransaction.updateMany({
      where: {
        farm_id: null,
        entries: {
          some: {
            account: { is: { code: { startsWith: `EXP-${accountPrefix}` } } },
          },
        },
      },
      data: { farm_id: farm.id },
    });
    if (updated.count > 0) {
      console.log(`💰 Stamped ${updated.count} accounting transaction(s) with farm_id`);
    } else {
      console.log('💰 No untagged accounting transactions to stamp');
    }
  }

  console.log('\n🎉 Dairy demo seed complete.');
  console.log(`   Open Orora → Production with farm "${farm.name}" or "All farms" selected.\n`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
