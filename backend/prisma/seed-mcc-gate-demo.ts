/**
 * Realistic demo data for MCC Operations (gate, manifests, shifts, milk tests) + manager overview.
 * Run: cd backend && npm run seed:mcc-gate-demo
 *
 * Idempotent: removes prior rows whose `notes` start with `seed:mcc-gate-demo` on this MCC
 * (gate deliveries + staff shifts), then recreates a small scripted week so date filters
 * (e.g. last 7–14 days) show the full flow.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** All seeded gate rows and shift rows use notes starting with this prefix (includes legacy v1). */
const SEED_NOTES_PREFIX = 'seed:mcc-gate-demo';

function note(scenario: string) {
  return `${SEED_NOTES_PREFIX}|${scenario}`;
}

/** UTC morning-ish timestamps so “today” in UTC still catches recent rows when testing. */
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
  return `MAN-${y}${m}${da}-${suffix}`;
}

async function main() {
  const mainAccount = await prisma.account.findUnique({ where: { code: 'ACC_MAIN_001' } });
  if (!mainAccount) {
    console.error('❌ Main MCC account ACC_MAIN_001 not found. Run prisma:seed first.');
    process.exit(1);
  }

  const manager = await prisma.user.findFirst({
    where: { OR: [{ email: 'manager@gemura.rw' }, { code: 'U_ROLE_MGR' }] },
  });
  const vet = await prisma.user.findFirst({
    where: { OR: [{ email: 'veterinary.officer@gemura.rw' }, { code: 'U_ROLE_VET' }] },
  });
  const laborer = await prisma.user.findFirst({
    where: { OR: [{ email: 'casual.laborer@gemura.rw' }, { code: 'U_ROLE_LBR' }] },
  });
  const recorder = manager ?? (await prisma.user.findFirst({ where: { code: 'USER_MAIN_001' } }));
  if (!recorder) {
    console.error('❌ No manager or main user to set as recorded_by.');
    process.exit(1);
  }

  const farmerDemo = await prisma.account.findUnique({ where: { code: 'A_SUP_001' } });
  if (!farmerDemo) {
    console.error('❌ Supplier account A_SUP_001 not found. Run prisma:seed first.');
    process.exit(1);
  }
  const farmerJean = farmerDemo;
  const farmerMarie = farmerDemo;
  const farmerPierre = farmerDemo;

  const umucundaHub = await prisma.account.upsert({
    where: { code: 'A_SEED_UMU_GATE' },
    update: {
      name: 'Umucunda hub — Nyabihu / Musanze route',
      status: 'active',
    },
    create: {
      code: 'A_SEED_UMU_GATE',
      name: 'Umucunda hub — Nyabihu / Musanze route',
      type: 'tenant',
      status: 'active',
    },
  });

  await prisma.supplierCustomer.upsert({
    where: {
      supplier_account_id_customer_account_id: {
        supplier_account_id: umucundaHub.id,
        customer_account_id: mainAccount.id,
      },
    },
    update: { relationship_status: 'active', price_per_liter: 400 },
    create: {
      supplier_account_id: umucundaHub.id,
      customer_account_id: mainAccount.id,
      price_per_liter: 400,
      relationship_status: 'active',
    },
  });

  await prisma.mccStaffShift.deleteMany({
    where: {
      mcc_account_id: mainAccount.id,
      notes: { startsWith: SEED_NOTES_PREFIX },
    },
  });

  const oldGates = await prisma.mccGateDelivery.findMany({
    where: {
      mcc_account_id: mainAccount.id,
      notes: { startsWith: SEED_NOTES_PREFIX },
    },
    select: { id: true },
  });
  const oldIds = oldGates.map((g) => g.id);
  if (oldIds.length) {
    await prisma.mccMilkTestResult.deleteMany({ where: { mcc_gate_delivery_id: { in: oldIds } } });
    await prisma.mccMilkManifest.deleteMany({ where: { gate_delivery_id: { in: oldIds } } });
    await prisma.mccGateDelivery.deleteMany({ where: { id: { in: oldIds } } });
    console.log(`🧹 Removed ${oldIds.length} previous demo gate row(s) + linked manifests/tests.`);
  }

  const t0 = utcAt(0, 5, 40);
  const t1 = utcAt(1, 6, 5);
  const t2 = utcAt(2, 6, 20);
  const t3 = utcAt(3, 5, 55);
  const t4 = utcAt(4, 6, 10);
  const t5 = utcAt(5, 6, 35);

  // --- 1) Today: direct farmer drop (no Umucunda manifest). Gate test passed. ---
  const gDirect = await prisma.mccGateDelivery.create({
    data: {
      mcc_account_id: mainAccount.id,
      source_type: 'direct',
      source_account_id: farmerJean.id,
      gate_volume_litres: 168.25,
      arrived_at: t0,
      recorded_by_user_id: recorder.id,
      notes: note('01 Direct morning — Jean Baptiste Uwimana (solo can)'),
    },
  });
  await prisma.mccMilkTestResult.create({
    data: {
      mcc_gate_delivery_id: gDirect.id,
      manifest_line_id: null,
      outcome: 'accepted',
      tested_by_user_id: vet?.id ?? recorder.id,
      tested_at: new Date(t0.getTime() + 12 * 60 * 1000),
    },
  });

  // --- 2) Yesterday: Umucunda A — manifest submitted (awaiting “Accept” in ops UI). ---
  const gSubmitted = await prisma.mccGateDelivery.create({
    data: {
      mcc_account_id: mainAccount.id,
      source_type: 'umucunda_a',
      source_account_id: umucundaHub.id,
      gate_volume_litres: 318.5,
      arrived_at: t1,
      recorded_by_user_id: recorder.id,
      notes: note('02 Umucunda A — Musanze morning batch (manifest submitted)'),
    },
  });
  const manSubmitted = await prisma.mccMilkManifest.create({
    data: {
      gate_delivery_id: gSubmitted.id,
      mcc_account_id: mainAccount.id,
      umucunda_supplier_account_id: umucundaHub.id,
      manifest_ref: manifestRef(t1, 'A01'),
      status: 'submitted',
      submitted_at: new Date(t1.getTime() + 25 * 60 * 1000),
      route_metadata: {
        route_name: 'Musanze morning',
        vehicle: 'Moto-tricycle #12',
        driver: 'Théoneste',
      } as object,
    },
  });
  await prisma.mccManifestLine.createMany({
    data: [
      {
        manifest_id: manSubmitted.id,
        farmer_supplier_account_id: farmerJean.id,
        declared_litres: 172.0,
        container_id: 'CAN-MUS-101',
      },
      {
        manifest_id: manSubmitted.id,
        farmer_supplier_account_id: farmerMarie.id,
        declared_litres: 146.5,
        container_id: 'CAN-MUS-102',
      },
    ],
  });
  await prisma.mccMilkTestResult.create({
    data: {
      mcc_gate_delivery_id: gSubmitted.id,
      manifest_line_id: null,
      outcome: 'accepted',
      tested_by_user_id: vet?.id ?? recorder.id,
      tested_at: new Date(t1.getTime() + 40 * 60 * 1000),
    },
  });

  // --- 3) 2 days ago: Umucunda B — no manifest yet (use “New manifest” in UI). ---
  await prisma.mccGateDelivery.create({
    data: {
      mcc_account_id: mainAccount.id,
      source_type: 'umucunda_b',
      source_account_id: umucundaHub.id,
      gate_volume_litres: 241.0,
      arrived_at: t2,
      recorded_by_user_id: recorder.id,
      notes: note('03 Umucunda B — Rubavu loop (no manifest yet → create draft in app)'),
    },
  });

  // --- 4) 3 days ago: Umucunda A — manifest accepted (happy path closed). ---
  const gAccepted = await prisma.mccGateDelivery.create({
    data: {
      mcc_account_id: mainAccount.id,
      source_type: 'umucunda_a',
      source_account_id: umucundaHub.id,
      gate_volume_litres: 285.75,
      arrived_at: t3,
      recorded_by_user_id: recorder.id,
      notes: note('04 Umucunda A — Nyabihu cooperative batch (manifest accepted)'),
    },
  });
  const manAccepted = await prisma.mccMilkManifest.create({
    data: {
      gate_delivery_id: gAccepted.id,
      mcc_account_id: mainAccount.id,
      umucunda_supplier_account_id: umucundaHub.id,
      manifest_ref: manifestRef(t3, 'B02'),
      status: 'accepted',
      submitted_at: new Date(t3.getTime() + 20 * 60 * 1000),
      accepted_at: new Date(t3.getTime() + 2 * 3600 * 1000),
      route_metadata: { route_name: 'Nyabihu cooperative', collection_point: 'Kinigi' } as object,
    },
  });
  await prisma.mccManifestLine.createMany({
    data: [
      {
        manifest_id: manAccepted.id,
        farmer_supplier_account_id: farmerMarie.id,
        declared_litres: 148.25,
        container_id: 'CAN-NYA-201',
      },
      {
        manifest_id: manAccepted.id,
        farmer_supplier_account_id: farmerPierre.id,
        declared_litres: 137.5,
        container_id: 'CAN-NYA-202',
      },
    ],
  });
  await prisma.mccMilkTestResult.create({
    data: {
      mcc_gate_delivery_id: gAccepted.id,
      manifest_line_id: null,
      outcome: 'accepted',
      tested_by_user_id: vet?.id ?? recorder.id,
      tested_at: new Date(t3.getTime() + 35 * 60 * 1000),
    },
  });

  // --- 5) 4 days ago: Umucunda A — draft manifest (edit lines / submit in UI). ---
  const gDraft = await prisma.mccGateDelivery.create({
    data: {
      mcc_account_id: mainAccount.id,
      source_type: 'umucunda_a',
      source_account_id: umucundaHub.id,
      gate_volume_litres: 255.0,
      arrived_at: t4,
      recorded_by_user_id: recorder.id,
      notes: note('05 Umucunda A — Gicumbi afternoon (manifest still draft)'),
    },
  });
  const manDraft = await prisma.mccMilkManifest.create({
    data: {
      gate_delivery_id: gDraft.id,
      mcc_account_id: mainAccount.id,
      umucunda_supplier_account_id: umucundaHub.id,
      manifest_ref: manifestRef(t4, 'C03'),
      status: 'draft',
      route_metadata: { route_name: 'Gicumbi afternoon', note: 'Clerk still reconciling cans' } as object,
    },
  });
  await prisma.mccManifestLine.createMany({
    data: [
      {
        manifest_id: manDraft.id,
        farmer_supplier_account_id: farmerJean.id,
        declared_litres: 130.0,
        container_id: 'CAN-GIC-301',
      },
      {
        manifest_id: manDraft.id,
        farmer_supplier_account_id: farmerMarie.id,
        declared_litres: 125.0,
        container_id: 'CAN-GIC-302',
      },
    ],
  });

  // --- 6) 5 days ago: gate test failed — traceability “Resolved / secondary / frozen”. ---
  const gRejectedTest = await prisma.mccGateDelivery.create({
    data: {
      mcc_account_id: mainAccount.id,
      source_type: 'umucunda_a',
      source_account_id: umucundaHub.id,
      gate_volume_litres: 198.0,
      arrived_at: t5,
      recorded_by_user_id: recorder.id,
      notes: note('06 Umucunda A — vet strip failed (rejected milk at gate)'),
    },
  });
  const manRej = await prisma.mccMilkManifest.create({
    data: {
      gate_delivery_id: gRejectedTest.id,
      mcc_account_id: mainAccount.id,
      umucunda_supplier_account_id: umucundaHub.id,
      manifest_ref: manifestRef(t5, 'D04'),
      status: 'submitted',
      submitted_at: new Date(t5.getTime() + 15 * 60 * 1000),
      route_metadata: { route_name: 'Rubavu border route' } as object,
    },
  });
  const lineRej = await prisma.mccManifestLine.create({
    data: {
      manifest_id: manRej.id,
      farmer_supplier_account_id: farmerPierre.id,
      declared_litres: 198.0,
      container_id: 'CAN-RUB-401',
    },
  });
  await prisma.mccMilkTestResult.create({
    data: {
      mcc_gate_delivery_id: gRejectedTest.id,
      manifest_line_id: lineRej.id,
      outcome: 'rejected',
      rejection_cause: 'Alcohol rapid test positive — batch quarantined pending supervisor decision.',
      source_resolution_status: 'unresolved',
      tested_by_user_id: vet?.id ?? recorder.id,
      tested_at: new Date(t5.getTime() + 30 * 60 * 1000),
    },
  });

  // --- 7) 2 days ago (later slot): pending lab-style check (optional flow in UI). ---
  const gPending = await prisma.mccGateDelivery.create({
    data: {
      mcc_account_id: mainAccount.id,
      source_type: 'direct',
      source_account_id: farmerMarie.id,
      gate_volume_litres: 92.5,
      arrived_at: utcAt(2, 14, 10),
      recorded_by_user_id: laborer?.id ?? recorder.id,
      notes: note('07 Direct afternoon — Marie Mukamana (test pending)'),
    },
  });
  await prisma.mccMilkTestResult.create({
    data: {
      mcc_gate_delivery_id: gPending.id,
      manifest_line_id: null,
      outcome: 'pending',
      tested_by_user_id: vet?.id ?? recorder.id,
      tested_at: utcAt(2, 14, 25),
    },
  });

  // --- Staff shifts (Shifts page): one closed, one open. ---
  const yesterday = utcAt(1, 5, 30);
  const yEnd = new Date(yesterday.getTime() + 8 * 3600 * 1000);
  if (manager) {
    await prisma.mccStaffShift.create({
      data: {
        mcc_account_id: mainAccount.id,
        user_id: manager.id,
        started_at: yesterday,
        ended_at: yEnd,
        role_label_snapshot: 'manager',
        notes: note('shift|closed-manager'),
      },
    });
  }
  if (laborer) {
    const d2 = utcAt(2, 5, 45);
    await prisma.mccStaffShift.create({
      data: {
        mcc_account_id: mainAccount.id,
        user_id: laborer.id,
        started_at: d2,
        ended_at: new Date(d2.getTime() + 7 * 3600 * 1000),
        role_label_snapshot: 'casual_laborer',
        notes: note('shift|closed-laborer'),
      },
    });
  }
  await prisma.mccStaffShift.create({
    data: {
      mcc_account_id: mainAccount.id,
      user_id: recorder.id,
      started_at: utcAt(0, 4, 50),
      ended_at: null,
      role_label_snapshot: 'manager',
      notes: note('shift|open-current'),
    },
  });

  const umucundaDemoUsers = await prisma.user.findMany({
    where: { OR: [{ email: 'umucunda.a@gemura.rw' }, { email: 'umucunda.b@gemura.rw' }] },
    select: { id: true },
  });
  for (const u of umucundaDemoUsers) {
    await prisma.userAccount.updateMany({
      where: { user_id: u.id, account_id: mainAccount.id },
      data: { linked_umucunda_supplier_account_id: umucundaHub.id },
    });
  }
  if (umucundaDemoUsers.length) {
    console.log(`   Linked demo Umucunda users → hub supplier ${umucundaHub.code} (scoped gate/manifest APIs).`);
  }

  console.log('✅ MCC operations demo seed complete.');
  console.log(`   MCC: ${mainAccount.code} — ${mainAccount.name}`);
  console.log('   Gate: direct + Umucunda A/B across last 6 days (draft / submitted / accepted / no manifest / rejected test / pending).');
  console.log('   Manifest refs look like MAN-YYYYMMDD-…; farmer lines use Jean / Marie / Pierre supplier accounts.');
  console.log('   Shifts: two closed + one open (end shift in UI).');
  console.log('   Tip: In Gemura web → Operations, set date range to last 14 days to see the full story.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
