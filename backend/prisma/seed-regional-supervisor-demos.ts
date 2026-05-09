import { LocationType, PrismaClient } from '@prisma/client';

/** District codes from `seed-locations.ts` (Rwanda sample hierarchy). */
export const REGIONAL_SUPERVISOR_DEMO_DISTRICTS = [
  {
    phone: '250788409050',
    code: 'U_RS_DEMO_1',
    name: 'Demo Supervisor Kigali',
    email: 'supervisor.kigali@gemura.rw',
    districtCodes: ['01-01', '01-02', '01-03'] as const,
  },
  {
    phone: '250788409051',
    code: 'U_RS_DEMO_2',
    name: 'Demo Supervisor South & West',
    email: 'supervisor.southwest@gemura.rw',
    districtCodes: ['02-01', '02-02', '03-01'] as const,
  },
  {
    phone: '250788409052',
    code: 'U_RS_DEMO_3',
    name: 'Demo Supervisor Western & North',
    email: 'supervisor.westnorth@gemura.rw',
    districtCodes: ['03-02', '04-01', '04-02'] as const,
  },
  {
    phone: '250788409053',
    code: 'U_RS_DEMO_4',
    name: 'Demo Supervisor East (+ shared Huye)',
    email: 'supervisor.east@gemura.rw',
    districtCodes: ['05-01', '05-02', '02-01'] as const,
  },
] as const;

type UserNameFields = (display: string) => { first_name: string; last_name: string; name: string };

/**
 * Idempotent: upserts users + memberships + replaces regional_supervisor_districts per user.
 * Requires locations seeded (`npx ts-node prisma/seed-locations.ts`).
 */
export async function seedRegionalSupervisorDemos(
  prisma: PrismaClient,
  mainAccount: { id: string; code: string | null },
  hashedPassword: string,
  userNameFields: UserNameFields,
  demoPasswordLabel: string,
): Promise<void> {
  console.log('👥 Creating regional_supervisor demo users (multi-district scope)...');
  for (const row of REGIONAL_SUPERVISOR_DEMO_DISTRICTS) {
    const u = await prisma.user.upsert({
      where: { phone: row.phone },
      update: {
        ...userNameFields(row.name),
        code: row.code,
        email: row.email,
        password_hash: hashedPassword,
        default_account_id: mainAccount.id,
        account_type: 'mcc',
        status: 'active',
      },
      create: {
        code: row.code,
        ...userNameFields(row.name),
        phone: row.phone,
        email: row.email,
        password_hash: hashedPassword,
        account_type: 'mcc',
        status: 'active',
        default_account_id: mainAccount.id,
        token: `token_${row.phone}_${Date.now()}`,
      },
    });
    await prisma.userAccount.upsert({
      where: {
        user_id_account_id: { user_id: u.id, account_id: mainAccount.id },
      },
      update: {
        role: 'regional_supervisor',
        status: 'active',
      },
      create: {
        user_id: u.id,
        account_id: mainAccount.id,
        role: 'regional_supervisor',
        permissions: {},
        status: 'active',
      },
    });
    const districts = await prisma.location.findMany({
      where: {
        code: { in: [...row.districtCodes] },
        location_type: LocationType.DISTRICT,
      },
      select: { id: true, code: true },
    });
    if (districts.length !== row.districtCodes.length) {
      console.warn(
        `⚠️  ${row.code}: expected ${row.districtCodes.length} districts, found ${districts.length}. Run: npx ts-node prisma/seed-locations.ts`,
      );
    }
    await prisma.regionalSupervisorDistrict.deleteMany({ where: { user_id: u.id } });
    if (districts.length > 0) {
      await prisma.regionalSupervisorDistrict.createMany({
        data: districts.map((d) => ({
          user_id: u.id,
          district_location_id: d.id,
        })),
        skipDuplicates: true,
      });
    }
    console.log(`   ✅ ${row.name}: ${districts.map((d) => d.code).join(', ')}`);
  }
  console.log(`✅ Regional supervisor demos on ${mainAccount.code ?? mainAccount.id} (password: ${demoPasswordLabel})`);
}
