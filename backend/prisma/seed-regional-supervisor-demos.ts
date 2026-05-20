import { LocationType, PrismaClient } from '@prisma/client';

/**
 * One demo regional supervisor per province (Rwanda hierarchy from `seed-locations.ts`).
 * Each user’s scope =
 * districts in `districtCodes`; those districts must belong only to `provinceLabel`’s province.
 */
export const REGIONAL_SUPERVISOR_DEMO_DISTRICTS = [
  {
    phone: '250788409050',
    code: 'U_RS_KIGALI',
    name: 'Regional Supervisor · Kigali City',
    email: 'supervisor.kigali@gemura.rw',
    provinceLabel: 'Kigali City',
    districtCodes: ['01-01', '01-02', '01-03'] as const,
  },
  {
    phone: '250788409051',
    code: 'U_RS_SOUTH',
    name: 'Regional Supervisor · Southern Province',
    email: 'supervisor.south@gemura.rw',
    provinceLabel: 'Southern Province',
    districtCodes: ['02-01', '02-02'] as const,
  },
  {
    phone: '250788409052',
    code: 'U_RS_WEST',
    name: 'Regional Supervisor · Western Province',
    email: 'supervisor.west@gemura.rw',
    provinceLabel: 'Western Province',
    districtCodes: ['03-01', '03-02'] as const,
  },
  {
    phone: '250788409053',
    code: 'U_RS_NORTH',
    name: 'Regional Supervisor · Northern Province',
    email: 'supervisor.north@gemura.rw',
    provinceLabel: 'Northern Province',
    districtCodes: ['04-01', '04-02'] as const,
  },
  {
    phone: '250788409054',
    code: 'U_RS_EAST',
    name: 'Regional Supervisor · Eastern Province',
    email: 'supervisor.east@gemura.rw',
    provinceLabel: 'Eastern Province',
    districtCodes: ['05-01', '05-02'] as const,
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
  console.log('👥 Creating regional_supervisor demo users (one province each: Kigali, South, West, North, East)...');
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
      select: { id: true, code: true, name: true, parent_id: true },
    });
    const province = await prisma.location.findFirst({
      where: { name: row.provinceLabel, location_type: LocationType.PROVINCE },
      select: { id: true, name: true },
    });
    const wrongParent = province
      ? districts.filter((d) => d.parent_id && d.parent_id !== province.id)
      : [];
    if (wrongParent.length) {
      console.warn(
        `⚠️  ${row.code}: districts not under ${row.provinceLabel}: ${wrongParent.map((d) => d.code).join(', ')}`,
      );
    }
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
    console.log(`   ✅ ${row.name}: ${districts.map((d) => `${d.name} (${d.code})`).join(', ')}`);
  }
  console.log(`✅ Regional supervisor demos on ${mainAccount.code ?? mainAccount.id} (password: ${demoPasswordLabel})`);
}
