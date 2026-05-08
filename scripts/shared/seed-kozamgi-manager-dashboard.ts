import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SEED_PREFIX = 'seed:kozamgi-manager-demo';

function utcAt(daysAgo: number, hourUTC: number, minuteUTC: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hourUTC, minuteUTC, 0, 0);
  return d;
}

function manifestRef(day: Date, suffix: string): string {
  const y = day.getUTCFullYear();
  const m = String(day.getUTCMonth() + 1).padStart(2, '0');
  const da = String(day.getUTCDate()).padStart(2, '0');
  return `KOZ-MAN-${y}${m}${da}-${suffix}`;
}

async function main() {
  const account = await prisma.account.findUnique({
    where: { code: 'A_16C846' },
    select: { id: true, code: true, name: true },
  });
  if (!account) throw new Error('KOZAMGI account (A_16C846) not found.');

  const manager = await prisma.user.findFirst({
    where: { phone: '250788409022' },
    select: { id: true, name: true },
  });
  const vet = await prisma.user.findFirst({
    where: { phone: '250788409028' },
    select: { id: true },
  });
  const laborer = await prisma.user.findFirst({
    where: { phone: '250788409029' },
    select: { id: true },
  });
  const collector = await prisma.user.findFirst({
    where: { phone: '250788409024' },
    select: { id: true },
  });
  const agent = await prisma.user.findFirst({
    where: { phone: '250788409026' },
    select: { id: true },
  });
  if (!manager) throw new Error('Demo manager not found.');

  const supplierLinks = await prisma.supplierCustomer.findMany({
    where: {
      customer_account_id: account.id,
      relationship_status: 'active',
    },
    select: {
      supplier_account_id: true,
      price_per_liter: true,
      supplier_account: { select: { id: true, code: true, name: true } },
    },
    orderBy: { created_at: 'asc' },
    take: 12,
  });
  if (supplierLinks.length < 6) {
    throw new Error('KOZAMGI needs at least 6 active suppliers for realistic seeding.');
  }

  const farmerAccounts = supplierLinks.slice(0, 5).map((s) => s.supplier_account);
  const priceBySupplier = new Map(
    supplierLinks.map((s) => [s.supplier_account_id, Number(s.price_per_liter || 390)]),
  );

  const umucundaHub = await prisma.account.upsert({
    where: { code: 'A_SEED_UMU_KOZAMGI' },
    update: { name: 'Umucunda hub — KOZAMGI route', status: 'active' },
    create: {
      code: 'A_SEED_UMU_KOZAMGI',
      name: 'Umucunda hub — KOZAMGI route',
      type: 'tenant',
      status: 'active',
    },
  });
  await prisma.supplierCustomer.upsert({
    where: {
      supplier_account_id_customer_account_id: {
        supplier_account_id: umucundaHub.id,
        customer_account_id: account.id,
      },
    },
    update: { relationship_status: 'active', price_per_liter: 395 },
    create: {
      supplier_account_id: umucundaHub.id,
      customer_account_id: account.id,
      price_per_liter: 395,
      relationship_status: 'active',
    },
  });

  // Cleanup prior seeded rows for idempotent reruns.
  await prisma.mccStaffShift.deleteMany({
    where: { mcc_account_id: account.id, notes: { startsWith: SEED_PREFIX } },
  });
  const oldGates = await prisma.mccGateDelivery.findMany({
    where: { mcc_account_id: account.id, notes: { startsWith: SEED_PREFIX } },
    select: { id: true },
  });
  if (oldGates.length) {
    const ids = oldGates.map((g) => g.id);
    await prisma.mccMilkTestResult.deleteMany({ where: { mcc_gate_delivery_id: { in: ids } } });
    await prisma.mccMilkManifest.deleteMany({ where: { gate_delivery_id: { in: ids } } });
    await prisma.mccGateDelivery.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.milkSale.deleteMany({
    where: { customer_account_id: account.id, notes: { startsWith: SEED_PREFIX } },
  });

  // Seed milk collections (last 14 days with realistic variance).
  const collectionRows: Array<{
    daysAgo: number;
    supplierId: string;
    quantity: number;
    status: 'accepted' | 'pending' | 'rejected';
    recordedBy: string;
  }> = [];
  const recorders = [manager.id, collector?.id || manager.id, agent?.id || manager.id];
  for (let i = 0; i < 14; i += 1) {
    const supplier = farmerAccounts[i % farmerAccounts.length];
    const base = 145 + ((i * 17) % 70);
    collectionRows.push({
      daysAgo: i,
      supplierId: supplier.id,
      quantity: Number((base + (i % 3) * 12.5).toFixed(1)),
      status: i % 9 === 0 ? 'rejected' : i % 5 === 0 ? 'pending' : 'accepted',
      recordedBy: recorders[i % recorders.length],
    });
    if (i % 2 === 0) {
      const supplier2 = farmerAccounts[(i + 1) % farmerAccounts.length];
      collectionRows.push({
        daysAgo: i,
        supplierId: supplier2.id,
        quantity: Number((90 + ((i * 11) % 45)).toFixed(1)),
        status: 'accepted',
        recordedBy: recorders[(i + 1) % recorders.length],
      });
    }
  }

  for (const row of collectionRows) {
    await prisma.milkSale.create({
      data: {
        supplier_account_id: row.supplierId,
        customer_account_id: account.id,
        quantity: row.quantity,
        unit_price: priceBySupplier.get(row.supplierId) ?? 390,
        status: row.status,
        sale_at: utcAt(row.daysAgo, 7 + (row.daysAgo % 4), 10 + (row.daysAgo % 5) * 7),
        recorded_by: row.recordedBy,
        notes: `${SEED_PREFIX}|collection|d-${row.daysAgo}`,
      },
    });
  }

  // Gate + manifests flow for recent 6 days
  const t0 = utcAt(0, 5, 45);
  const t1 = utcAt(1, 6, 5);
  const t2 = utcAt(2, 6, 25);
  const t3 = utcAt(3, 5, 55);
  const t4 = utcAt(4, 6, 15);
  const t5 = utcAt(5, 6, 35);

  // 1) Today direct accepted
  const gDirect = await prisma.mccGateDelivery.create({
    data: {
      mcc_account_id: account.id,
      source_type: 'direct',
      source_account_id: farmerAccounts[0].id,
      gate_volume_litres: 214.4,
      arrived_at: t0,
      recorded_by_user_id: manager.id,
      notes: `${SEED_PREFIX}|gate|direct-today`,
    },
  });
  await prisma.mccMilkTestResult.create({
    data: {
      mcc_gate_delivery_id: gDirect.id,
      manifest_line_id: null,
      outcome: 'accepted',
      tested_by_user_id: vet?.id ?? manager.id,
      tested_at: new Date(t0.getTime() + 12 * 60 * 1000),
    },
  });

  // 2) Yesterday umucunda submitted manifest
  const gSubmitted = await prisma.mccGateDelivery.create({
    data: {
      mcc_account_id: account.id,
      source_type: 'umucunda_a',
      source_account_id: umucundaHub.id,
      gate_volume_litres: 356.8,
      arrived_at: t1,
      recorded_by_user_id: manager.id,
      notes: `${SEED_PREFIX}|gate|umu-submitted`,
    },
  });
  const mSubmitted = await prisma.mccMilkManifest.create({
    data: {
      gate_delivery_id: gSubmitted.id,
      mcc_account_id: account.id,
      umucunda_supplier_account_id: umucundaHub.id,
      manifest_ref: manifestRef(t1, 'A01'),
      status: 'submitted',
      submitted_at: new Date(t1.getTime() + 20 * 60 * 1000),
      route_metadata: { label: 'KOZ route A', vehicle: 'Truck KZ-12' } as object,
    },
  });
  await prisma.mccManifestLine.createMany({
    data: [
      {
        manifest_id: mSubmitted.id,
        farmer_supplier_account_id: farmerAccounts[1].id,
        declared_litres: 180.2,
        container_id: 'KOZ-A-001',
      },
      {
        manifest_id: mSubmitted.id,
        farmer_supplier_account_id: farmerAccounts[2].id,
        declared_litres: 176.6,
        container_id: 'KOZ-A-002',
      },
    ],
  });

  // 3) Two days ago umucunda no manifest yet
  await prisma.mccGateDelivery.create({
    data: {
      mcc_account_id: account.id,
      source_type: 'umucunda_b',
      source_account_id: umucundaHub.id,
      gate_volume_litres: 289.1,
      arrived_at: t2,
      recorded_by_user_id: manager.id,
      notes: `${SEED_PREFIX}|gate|umu-no-manifest`,
    },
  });

  // 4) Three days ago accepted manifest
  const gAccepted = await prisma.mccGateDelivery.create({
    data: {
      mcc_account_id: account.id,
      source_type: 'umucunda_a',
      source_account_id: umucundaHub.id,
      gate_volume_litres: 301.3,
      arrived_at: t3,
      recorded_by_user_id: manager.id,
      notes: `${SEED_PREFIX}|gate|umu-accepted`,
    },
  });
  const mAccepted = await prisma.mccMilkManifest.create({
    data: {
      gate_delivery_id: gAccepted.id,
      mcc_account_id: account.id,
      umucunda_supplier_account_id: umucundaHub.id,
      manifest_ref: manifestRef(t3, 'B02'),
      status: 'accepted',
      submitted_at: new Date(t3.getTime() + 25 * 60 * 1000),
      accepted_at: new Date(t3.getTime() + 95 * 60 * 1000),
      route_metadata: { label: 'KOZ route B' } as object,
    },
  });
  await prisma.mccManifestLine.createMany({
    data: [
      {
        manifest_id: mAccepted.id,
        farmer_supplier_account_id: farmerAccounts[3].id,
        declared_litres: 152.0,
        container_id: 'KOZ-B-003',
      },
      {
        manifest_id: mAccepted.id,
        farmer_supplier_account_id: farmerAccounts[4].id,
        declared_litres: 149.3,
        container_id: 'KOZ-B-004',
      },
    ],
  });

  // 5) Four days ago draft manifest
  const gDraft = await prisma.mccGateDelivery.create({
    data: {
      mcc_account_id: account.id,
      source_type: 'umucunda_a',
      source_account_id: umucundaHub.id,
      gate_volume_litres: 244.0,
      arrived_at: t4,
      recorded_by_user_id: manager.id,
      notes: `${SEED_PREFIX}|gate|umu-draft`,
    },
  });
  const mDraft = await prisma.mccMilkManifest.create({
    data: {
      gate_delivery_id: gDraft.id,
      mcc_account_id: account.id,
      umucunda_supplier_account_id: umucundaHub.id,
      manifest_ref: manifestRef(t4, 'C03'),
      status: 'draft',
      route_metadata: { label: 'KOZ route C' } as object,
    },
  });
  await prisma.mccManifestLine.createMany({
    data: [
      {
        manifest_id: mDraft.id,
        farmer_supplier_account_id: farmerAccounts[0].id,
        declared_litres: 122.0,
        container_id: 'KOZ-C-005',
      },
      {
        manifest_id: mDraft.id,
        farmer_supplier_account_id: farmerAccounts[2].id,
        declared_litres: 122.0,
        container_id: 'KOZ-C-006',
      },
    ],
  });

  // 6) Five days ago rejected test
  const gRejected = await prisma.mccGateDelivery.create({
    data: {
      mcc_account_id: account.id,
      source_type: 'umucunda_a',
      source_account_id: umucundaHub.id,
      gate_volume_litres: 188.5,
      arrived_at: t5,
      recorded_by_user_id: manager.id,
      notes: `${SEED_PREFIX}|gate|umu-rejected-test`,
    },
  });
  const mRejected = await prisma.mccMilkManifest.create({
    data: {
      gate_delivery_id: gRejected.id,
      mcc_account_id: account.id,
      umucunda_supplier_account_id: umucundaHub.id,
      manifest_ref: manifestRef(t5, 'D04'),
      status: 'submitted',
      submitted_at: new Date(t5.getTime() + 20 * 60 * 1000),
      route_metadata: { label: 'KOZ route D' } as object,
    },
  });
  const rejectedLine = await prisma.mccManifestLine.create({
    data: {
      manifest_id: mRejected.id,
      farmer_supplier_account_id: farmerAccounts[1].id,
      declared_litres: 188.5,
      container_id: 'KOZ-D-007',
    },
  });
  await prisma.mccMilkTestResult.create({
    data: {
      mcc_gate_delivery_id: gRejected.id,
      manifest_line_id: rejectedLine.id,
      outcome: 'rejected',
      rejection_cause: 'Alcohol strip positive; batch quarantined for traceability check.',
      source_resolution_status: 'unresolved',
      tested_by_user_id: vet?.id ?? manager.id,
      tested_at: new Date(t5.getTime() + 32 * 60 * 1000),
    },
  });

  // Staff shifts (2 closed + 1 open)
  if (laborer) {
    const s = utcAt(1, 5, 30);
    await prisma.mccStaffShift.create({
      data: {
        mcc_account_id: account.id,
        user_id: laborer.id,
        started_at: s,
        ended_at: new Date(s.getTime() + 8 * 3600 * 1000),
        role_label_snapshot: 'casual_laborer',
        notes: `${SEED_PREFIX}|shift|laborer-closed`,
      },
    });
  }
  if (collector) {
    const s = utcAt(2, 5, 45);
    await prisma.mccStaffShift.create({
      data: {
        mcc_account_id: account.id,
        user_id: collector.id,
        started_at: s,
        ended_at: new Date(s.getTime() + 7.5 * 3600 * 1000),
        role_label_snapshot: 'collector',
        notes: `${SEED_PREFIX}|shift|collector-closed`,
      },
    });
  }
  await prisma.mccStaffShift.create({
    data: {
      mcc_account_id: account.id,
      user_id: agent?.id ?? manager.id,
      started_at: utcAt(0, 4, 55),
      ended_at: null,
      role_label_snapshot: agent ? 'agent' : 'manager',
      notes: `${SEED_PREFIX}|shift|open-current`,
    },
  });

  // Align expected deliveries to active suppliers (as requested earlier).
  const activeSuppliers = await prisma.supplierCustomer.count({
    where: { customer_account_id: account.id, relationship_status: 'active' },
  });
  await prisma.mccOperationalProfile.upsert({
    where: { account_id: account.id },
    create: { account_id: account.id, expected_daily_deliveries: activeSuppliers },
    update: { expected_daily_deliveries: activeSuppliers },
  });

  console.log(`✅ KOZAMGI dashboard seed complete for ${account.code} (${account.name})`);
  console.log(`   Collections seeded: ${collectionRows.length}`);
  console.log('   Gate seeded: 6 deliveries (direct + Umucunda manifest states + rejected test)');
  console.log('   Shifts seeded: 3 (2 closed + 1 open)');
  console.log(`   expected_daily_deliveries set to active supplier count: ${activeSuppliers}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
