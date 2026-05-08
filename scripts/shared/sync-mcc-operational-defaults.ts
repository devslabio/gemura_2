import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function asInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/,/g, '').trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function asDecimal(value: unknown): Prisma.Decimal | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Prisma.Decimal(value);
  }
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/,/g, '').trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? new Prisma.Decimal(parsed) : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item));
}

function pick(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] != null) return source[key];
  }
  return null;
}

async function syncOne(submission: {
  id: string;
  submission_code: string;
  linked_account_id: string;
  section_payload: Prisma.JsonValue;
}) {
  const accountId = submission.linked_account_id;
  const payload = asRecord(submission.section_payload);
  const section2 = asRecord(payload.section2);
  const section3 = asRecord(payload.section3);
  const section6 = asRecord(payload.section6);

  const tankRowsRaw = Array.isArray(section2.coolingTanks)
    ? section2.coolingTanks
    : Array.isArray(section2.tankRows)
      ? section2.tankRows
      : [];

  const tankRows = tankRowsRaw
    .map((entry) => {
      const row = asRecord(entry);
      const tankNumber = asString(pick(row, ['tankNumber', 'tankNo']));
      const capacityLitres = asDecimal(pick(row, ['capacityLitres', 'capacity']));
      const yearOrAge = asString(pick(row, ['yearOrAge', 'year']));
      const condition = asString(row.condition);
      if (!tankNumber && !capacityLitres && !yearOrAge && !condition) return null;
      return {
        tank_number: tankNumber,
        capacity_litres: capacityLitres,
        year_or_age: yearOrAge,
        condition,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const powerSupplySources = asStringArray(
    pick(section2, ['powerSupplySelections', 'powerSupplyOptions']),
  );
  const hasGrid = powerSupplySources.some((source) => /grid|electricity/i.test(source));
  const hasGenerator = powerSupplySources.some((source) => /generator/i.test(source));
  const hasSolar = powerSupplySources.some((source) => /solar/i.test(source));

  const expectedDailyDeliveries =
    asInt(section3.expectedDailyDeliveries) ??
    asInt(section3.expectedDeliveriesPerDay) ??
    asInt(section3.expectedDeliveries);

  const profileData = {
    expected_daily_deliveries: expectedDailyDeliveries,
    daily_milk_volume_litres: asDecimal(pick(section2, ['dailyMilkVolume'])),
    max_milk_one_day_litres: asDecimal(pick(section2, ['maxMilkInOneDay', 'maxMilkOneDay'])),
    tank_capacity_sufficiency: asString(section2.tankCapacitySufficiency),
    insufficient_capacity_plan: asString(section2.insufficientPlan),
    power_supply_sources: powerSupplySources as Prisma.InputJsonValue,
    generator_capacity_kva: asDecimal(pick(section2, ['generatorCapacityKva', 'generatorCapacity'])),
    mobile_connectivity: asString(section2.mobileConnectivity),
    total_farmers_supplying: asInt(section3.totalFarmersSupplying),
    new_farmers_last_3_months: asInt(section3.newFarmersLast3Months),
    milk_transporters_count: asInt(section3.milkTransportersCount),
    average_distance_km: asDecimal(pick(section3, ['averageDistanceKm', 'averageDistance'])),
    furthest_farm_km: asDecimal(pick(section3, ['furthestFarmKm', 'furthestFarmDistanceKm'])),
    evening_milk_pattern: asString(section3.eveningMilkPattern),
    own_milk_transport_type: asString(pick(section3, ['ownMilkTransportType', 'ownTransportType'])),
    record_system: asString(section6.recordSystem),
    avg_days_delivery_to_payment: asInt(section6.avgDaysDeliveryToPayment),
    average_annual_revenue_rwf: asDecimal(pick(section6, ['averageAnnualRevenueRwf', 'averageAnnualRevenue'])),
    main_buyer_name: asString(section6.mainBuyerName),
    formal_supply_agreement_details: asString(
      pick(section6, ['formalSupplyAgreementDetails', 'formalSupplyAgreement']),
    ),
    source_submission_id: submission.id,
    source_submission_code: submission.submission_code,
  };

  await prisma.$transaction(async (tx) => {
    await tx.mccOperationalProfile.upsert({
      where: { account_id: accountId },
      create: {
        account_id: accountId,
        ...profileData,
      },
      update: {
        ...profileData,
        captured_at: new Date(),
      },
    });

    await tx.mccCoolingTankProfile.deleteMany({ where: { account_id: accountId } });
    if (tankRows.length) {
      await tx.mccCoolingTankProfile.createMany({
        data: tankRows.map((row) => ({
          account_id: accountId,
          tank_number: row.tank_number,
          capacity_litres: row.capacity_litres,
          year_or_age: row.year_or_age,
          condition: row.condition,
        })),
      });
    }

    await tx.mccFacilitySnapshot.upsert({
      where: { account_id: accountId },
      create: {
        account_id: accountId,
        power_status: hasGrid ? 'grid' : hasSolar ? 'solar' : hasGenerator ? 'generator' : null,
        generator_status: hasGenerator ? 'available' : null,
        observed_at: new Date(),
        source: 'onboarding',
      },
      update: {
        power_status: hasGrid ? 'grid' : hasSolar ? 'solar' : hasGenerator ? 'generator' : null,
        generator_status: hasGenerator ? 'available' : null,
        observed_at: new Date(),
        source: 'onboarding',
      },
    });
  });
}

async function main() {
  const submissions = await prisma.mccOnboardingSubmission.findMany({
    where: {
      review_status: 'approved',
      linked_account_id: { not: null },
    },
    select: {
      id: true,
      submission_code: true,
      linked_account_id: true,
      section_payload: true,
      reviewed_at: true,
      created_at: true,
    },
    orderBy: [{ reviewed_at: 'desc' }, { created_at: 'desc' }],
  });

  const latestByAccount = new Map<string, (typeof submissions)[number]>();
  for (const row of submissions) {
    if (!row.linked_account_id) continue;
    if (!latestByAccount.has(row.linked_account_id)) {
      latestByAccount.set(row.linked_account_id, row);
    }
  }

  const targets = [...latestByAccount.values()].filter(
    (row): row is typeof row & { linked_account_id: string } => Boolean(row.linked_account_id),
  );

  let success = 0;
  let failed = 0;
  for (const submission of targets) {
    try {
      await syncOne({
        id: submission.id,
        submission_code: submission.submission_code,
        linked_account_id: submission.linked_account_id,
        section_payload: submission.section_payload,
      });
      success += 1;
      // eslint-disable-next-line no-console
      console.log(`Synced account ${submission.linked_account_id} from submission ${submission.submission_code}`);
    } catch (error) {
      failed += 1;
      // eslint-disable-next-line no-console
      console.error(
        `Failed account ${submission.linked_account_id} from submission ${submission.submission_code}:`,
        error,
      );
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Done. Accounts processed: ${targets.length}, success: ${success}, failed: ${failed}`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Fatal sync error:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
