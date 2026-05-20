import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountType, LocationType, MccOnboardingReviewStatus, Prisma, User } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ImmisService } from '../immis/immis.service';
import { LocationsService } from '../locations/locations.service';
import * as bcrypt from 'bcryptjs';
import {
  ROLES,
  PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  canonicalPlatformRoleSlug,
  isPlatformSuperAdminRole,
  type RoleCode,
} from './roles-permissions.config';
import { composeUserFullName, splitIntoFirstLast } from '../../common/utils/user-name.util';
import { mccNamesLikelyMatch } from '../mcc-manager/mcc-onboarding-profile.util';
import { saleAtBoundsUtcInclusive, utcCalendarDatesBetweenInclusive } from '../../common/utils/sale-at-bounds.util';
import * as ExcelJS from 'exceljs';
import {
  buildCsvFromRows,
  humanizeMccOnboardingValue,
  MCC_ONBOARDING_CSV_PRIMARY_KEYS,
  resolveMccOnboardingColumnTitle,
} from './mcc-onboarding-csv.util';
import { RbacService } from '../rbac/rbac.service';
import { CreatePlatformRoleDto } from './dto/create-platform-role.dto';
import { UpdatePlatformRoleDto } from './dto/update-platform-role.dto';
import { AssignUserAccountMembershipDto } from './dto/assign-user-account-membership.dto';
import { UpdateOnboardingOperationalConfigDto } from './dto/update-onboarding-operational-config.dto';
import { UpdateAccountOperationalLocationDto } from './dto/update-account-operational-location.dto';
import { SetRegionalSupervisorScopeDto } from './dto/set-regional-supervisor-scope.dto';
import { UpdateAccountRegionalSupervisorDto } from './dto/update-account-regional-supervisor.dto';
import {
  CoolingTankRowDto,
  FacilitySnapshotPatchDto,
  TenantOperationalProfilePatchDto,
  UpdateTenantAccountOperationalMetricsDto,
} from './dto/update-tenant-account-operational-metrics.dto';

export type UserActivityMetric =
  | 'suppliers'
  | 'customers'
  | 'sales'
  | 'collections'
  | 'farms'
  | 'accounts'
  | 'members';

export type UserBusinessResource =
  | 'collections'
  | 'sales'
  | 'suppliers'
  | 'customers'
  | 'farms'
  | 'accounts'
  | 'members';

@Injectable()
export class AdminService {
  private static readonly LOCATION_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  private parseClientLocalDateToUtcBoundary(
    dateOnly: string,
    _tzOffsetMinutes: number,
    endOfDay: boolean,
  ): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = endOfDay ? 23 : 0;
    const minute = endOfDay ? 59 : 0;
    const second = endOfDay ? 59 : 0;
    const ms = endOfDay ? 999 : 0;
    // `reviewed_at` is stored as TIMESTAMP (without timezone) in Postgres.
    // Use local calendar boundaries directly to avoid UTC-shift mismatches.
    const dt = new Date(year, month - 1, day, hour, minute, second, ms);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  private static readonly USER_ACTIVITY_METRICS = [
    'suppliers',
    'customers',
    'sales',
    'collections',
    'farms',
    'accounts',
    'members',
  ] as const;

  private static readonly USER_BUSINESS_RESOURCES: UserBusinessResource[] = [
    'collections',
    'sales',
    'suppliers',
    'customers',
    'farms',
    'accounts',
    'members',
  ];

  private metadataValueFromNotes(notes: string | null | undefined, key: string): string | null {
    if (!notes) return null;
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = notes.match(new RegExp(`\\[${escapedKey}:\\s*([^\\]]+)\\]`, 'i'));
    return match?.[1]?.trim() || null;
  }

  private collectionShiftFromNotes(notes: string | null | undefined): 'morning' | 'evening' {
    const shift = this.metadataValueFromNotes(notes, 'COLLECTION_SHIFT')?.toLowerCase();
    return shift === 'evening' ? 'evening' : 'morning';
  }

  constructor(
    private prisma: PrismaService,
    private immisService: ImmisService,
    private locationsService: LocationsService,
    private rbac: RbacService,
  ) {}

  private normalizeGroupCount(row: { _count?: number | { _all?: number } }): number {
    if (typeof row._count === 'number') return row._count;
    return row._count?._all ?? 0;
  }

  /** Business volumes keyed by account id (tenant/MCC operational context). */
  private async getBusinessMetricsByAccountId(accountIds: string[]): Promise<
    Record<
      string,
      {
        members: number;
        suppliers: number;
        customers: number;
        sales: number;
        collections: number;
        farms: number;
      }
    >
  > {
    const ids = [...new Set(accountIds.filter(Boolean))];
    const emptyStat = () => ({
      members: 0,
      suppliers: 0,
      customers: 0,
      sales: 0,
      collections: 0,
      farms: 0,
    });
    const out: Record<string, ReturnType<typeof emptyStat>> = {};
    for (const id of ids) out[id] = emptyStat();
    if (ids.length === 0) return out;

    const [
      membersByAccount,
      suppliersByCustomerAccount,
      customersBySupplierAccount,
      salesBySupplierAccount,
      collectionsByCustomerAccount,
      farmsByAccount,
    ] = await Promise.all([
      this.prisma.userAccount.groupBy({
        by: ['account_id'],
        where: { account_id: { in: ids }, status: 'active' },
        _count: true,
      }),
      this.prisma.supplierCustomer.groupBy({
        by: ['customer_account_id'],
        where: { customer_account_id: { in: ids }, relationship_status: 'active' },
        _count: true,
      }),
      this.prisma.supplierCustomer.groupBy({
        by: ['supplier_account_id'],
        where: { supplier_account_id: { in: ids }, relationship_status: 'active' },
        _count: true,
      }),
      this.prisma.milkSale.groupBy({
        by: ['supplier_account_id'],
        where: { supplier_account_id: { in: ids }, status: { not: 'deleted' } },
        _count: true,
      }),
      this.prisma.milkSale.groupBy({
        by: ['customer_account_id'],
        where: { customer_account_id: { in: ids }, status: { not: 'deleted' } },
        _count: true,
      }),
      this.prisma.farm.groupBy({
        by: ['account_id'],
        where: { account_id: { in: ids } },
        _count: true,
      }),
    ]);

    const membersByAccountId = new Map(membersByAccount.map((row) => [row.account_id, this.normalizeGroupCount(row)]));
    const suppliersByAccountId = new Map(
      suppliersByCustomerAccount.map((row) => [row.customer_account_id, this.normalizeGroupCount(row)]),
    );
    const customersByAccountId = new Map(
      customersBySupplierAccount.map((row) => [row.supplier_account_id, this.normalizeGroupCount(row)]),
    );
    const salesByAccountId = new Map(
      salesBySupplierAccount.map((row) => [row.supplier_account_id, this.normalizeGroupCount(row)]),
    );
    const collectionsByAccountId = new Map(
      collectionsByCustomerAccount.map((row) => [row.customer_account_id, this.normalizeGroupCount(row)]),
    );
    const farmsByAccountId = new Map(farmsByAccount.map((row) => [row.account_id, this.normalizeGroupCount(row)]));

    for (const id of ids) {
      out[id] = {
        members: membersByAccountId.get(id) ?? 0,
        suppliers: suppliersByAccountId.get(id) ?? 0,
        customers: customersByAccountId.get(id) ?? 0,
        sales: salesByAccountId.get(id) ?? 0,
        collections: collectionsByAccountId.get(id) ?? 0,
        farms: farmsByAccountId.get(id) ?? 0,
      };
    }
    return out;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private asString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  private asInt(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
    if (typeof value !== 'string') return null;
    const cleaned = value.replace(/,/g, '').trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }

  private asDecimal(value: unknown): Prisma.Decimal | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return new Prisma.Decimal(value);
    }
    if (typeof value !== 'string') return null;
    const cleaned = value.replace(/,/g, '').trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? new Prisma.Decimal(parsed) : null;
  }

  private asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => this.asString(item))
      .filter((item): item is string => Boolean(item));
  }

  private async syncMccOperationalDataFromOnboarding(
    tx: Prisma.TransactionClient,
    accountId: string,
    submission: { id: string; submission_code: string; section_payload: Prisma.JsonValue },
  ): Promise<void> {
    const payload = this.asRecord(submission.section_payload);
    const section2 = this.asRecord(payload.section2);
    const section3 = this.asRecord(payload.section3);
    const section6 = this.asRecord(payload.section6);
    const pick = (source: Record<string, unknown>, keys: string[]): unknown => {
      for (const key of keys) {
        if (source[key] != null) return source[key];
      }
      return null;
    };

    const tankRowsRaw = Array.isArray(section2.coolingTanks)
      ? section2.coolingTanks
      : Array.isArray(section2.tankRows)
        ? section2.tankRows
        : [];
    const tankRows = tankRowsRaw
      .map((entry) => {
        const row = this.asRecord(entry);
        const tankNumber = this.asString(pick(row, ['tankNumber', 'tankNo']));
        const capacityLitres = this.asDecimal(pick(row, ['capacityLitres', 'capacity']));
        const yearOrAge = this.asString(pick(row, ['yearOrAge', 'year']));
        const condition = this.asString(row.condition);
        if (!tankNumber && !capacityLitres && !yearOrAge && !condition) return null;
        return {
          tank_number: tankNumber,
          capacity_litres: capacityLitres,
          year_or_age: yearOrAge,
          condition,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    const powerSupplySources = this.asStringArray(
      pick(section2, ['powerSupplySelections', 'powerSupplyOptions']),
    );
    const hasGrid = powerSupplySources.some((source) => /grid|electricity/i.test(source));
    const hasGenerator = powerSupplySources.some((source) => /generator/i.test(source));
    const hasSolar = powerSupplySources.some((source) => /solar/i.test(source));

    const expectedDailyDeliveries =
      this.asInt(section3.expectedDailyDeliveries) ??
      this.asInt(section3.expectedDeliveriesPerDay) ??
      this.asInt(section3.expectedDeliveries);

    const profileData = {
      expected_daily_deliveries: expectedDailyDeliveries,
      daily_milk_volume_litres: this.asDecimal(pick(section2, ['dailyMilkVolume'])),
      max_milk_one_day_litres: this.asDecimal(pick(section2, ['maxMilkInOneDay', 'maxMilkOneDay'])),
      tank_capacity_sufficiency: this.asString(section2.tankCapacitySufficiency),
      insufficient_capacity_plan: this.asString(section2.insufficientPlan),
      power_supply_sources: powerSupplySources as Prisma.InputJsonValue,
      generator_capacity_kva: this.asDecimal(
        pick(section2, ['generatorCapacityKva', 'generatorCapacity']),
      ),
      mobile_connectivity: this.asString(section2.mobileConnectivity),
      total_farmers_supplying: this.asInt(section3.totalFarmersSupplying),
      new_farmers_last_3_months: this.asInt(section3.newFarmersLast3Months),
      milk_transporters_count: this.asInt(section3.milkTransportersCount),
      average_distance_km: this.asDecimal(pick(section3, ['averageDistanceKm', 'averageDistance'])),
      furthest_farm_km: this.asDecimal(pick(section3, ['furthestFarmKm', 'furthestFarmDistanceKm'])),
      evening_milk_pattern: this.asString(section3.eveningMilkPattern),
      own_milk_transport_type: this.asString(
        pick(section3, ['ownMilkTransportType', 'ownTransportType']),
      ),
      record_system: this.asString(section6.recordSystem),
      avg_days_delivery_to_payment: this.asInt(section6.avgDaysDeliveryToPayment),
      average_annual_revenue_rwf: this.asDecimal(
        pick(section6, ['averageAnnualRevenueRwf', 'averageAnnualRevenue']),
      ),
      main_buyer_name: this.asString(section6.mainBuyerName),
      formal_supply_agreement_details: this.asString(
        pick(section6, ['formalSupplyAgreementDetails', 'formalSupplyAgreement']),
      ),
      source_submission_id: submission.id,
      source_submission_code: submission.submission_code,
    };

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
  }

  /**
   * Copies wizard `section_payload` into account operational tables used by the manager dashboard.
   * Safe to call after link (with tenant) or approve; idempotent upsert.
   */
  async applyOnboardingToAccountOperationalProfile(
    targetAccountId: string,
    submission: { id: string; submission_code: string; section_payload: Prisma.JsonValue },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.syncMccOperationalDataFromOnboarding(tx, targetAccountId, submission);
    });
  }

  /**
   * When an MCC was linked/approved but operational profile rows are missing, seed from the latest
   * approved onboarding submission for this tenant (manager dashboard tank capacity, etc.).
   */
  async tryBootstrapOperationalProfileFromLinkedOnboarding(targetAccountId: string): Promise<boolean> {
    const [profile, tankCount] = await Promise.all([
      this.prisma.mccOperationalProfile.findUnique({
        where: { account_id: targetAccountId },
        select: { source_submission_id: true },
      }),
      this.prisma.mccCoolingTankProfile.count({ where: { account_id: targetAccountId } }),
    ]);
    if (profile?.source_submission_id && tankCount > 0) {
      return false;
    }

    const account = await this.prisma.account.findUnique({
      where: { id: targetAccountId },
      select: { name: true, code: true },
    });

    const submission =
      (await this.prisma.mccOnboardingSubmission.findFirst({
        where: {
          linked_account_id: targetAccountId,
          review_status: { not: MccOnboardingReviewStatus.rejected },
        },
        orderBy: [{ reviewed_at: 'desc' }, { created_at: 'desc' }],
        select: {
          id: true,
          submission_code: true,
          section_payload: true,
        },
      })) ??
      (account?.name
        ? await this.prisma.mccOnboardingSubmission.findFirst({
            where: {
              review_status: { not: MccOnboardingReviewStatus.rejected },
              business_name: { equals: account.name, mode: 'insensitive' },
            },
            orderBy: [{ reviewed_at: 'desc' }, { created_at: 'desc' }],
            select: {
              id: true,
              submission_code: true,
              section_payload: true,
            },
          })
        : null);

    if (!submission) {
      return false;
    }

    await this.applyOnboardingToAccountOperationalProfile(targetAccountId, submission);

    if (account) {
      await this.prisma.mccOnboardingSubmission.updateMany({
        where: { id: submission.id, linked_account_id: { not: targetAccountId } },
        data: { linked_account_id: targetAccountId },
      });
    }

    return true;
  }

  private async getUserOperationalStats(userIds: string[]) {
    const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
    const empty = Object.fromEntries(
      uniqueUserIds.map((id) => [
        id,
        {
          accounts: 0,
          members: 0,
          suppliers: 0,
          customers: 0,
          sales: 0,
          collections: 0,
          farms: 0,
        },
      ]),
    );

    if (uniqueUserIds.length === 0) {
      return empty;
    }

    const userAccounts = await this.prisma.userAccount.findMany({
      where: {
        user_id: { in: uniqueUserIds },
        status: 'active',
      },
      select: {
        user_id: true,
        account_id: true,
      },
    });

    const accountIds = [...new Set(userAccounts.map((row) => row.account_id))];
    if (accountIds.length === 0) {
      return empty;
    }

    const metricsByAccount = await this.getBusinessMetricsByAccountId(accountIds);

    const accountIdsByUserId = new Map<string, Set<string>>();
    for (const row of userAccounts) {
      const accountSet = accountIdsByUserId.get(row.user_id) ?? new Set<string>();
      accountSet.add(row.account_id);
      accountIdsByUserId.set(row.user_id, accountSet);
    }

    for (const userId of uniqueUserIds) {
      const accountSet = accountIdsByUserId.get(userId) ?? new Set<string>();
      empty[userId].accounts = accountSet.size;

      for (const linkedAccountId of accountSet) {
        const m = metricsByAccount[linkedAccountId];
        if (!m) continue;
        empty[userId].members += m.members;
        empty[userId].suppliers += m.suppliers;
        empty[userId].customers += m.customers;
        empty[userId].sales += m.sales;
        empty[userId].collections += m.collections;
        empty[userId].farms += m.farms;
      }
    }

    return empty;
  }

  private permissionSetFromPayload(raw: unknown): Set<string> {
    if (!raw) return new Set<string>();
    if (Array.isArray(raw)) {
      return new Set(raw.map((p) => String(p)));
    }
    if (typeof raw === 'object') {
      const entries = Object.entries(raw as Record<string, unknown>)
        .filter(([, v]) => v === true)
        .map(([k]) => k);
      return new Set(entries);
    }
    return new Set<string>();
  }

  private isMissingRelationError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error ?? '');
    return (
      msg.includes('42P01') ||
      (msg.includes('relation "') && msg.includes('does not exist')) ||
      (msg.includes('The table `') && msg.includes('does not exist'))
    );
  }

  private optionalRelationFallback<T>(error: unknown, fallback: T): T {
    if (this.isMissingRelationError(error)) return fallback;
    throw error;
  }

  /** Legacy DBs may store `user_accounts.role` as a PG enum; Prisma can throw on values like `collector`. Read as text. */
  private async legacyMembershipRolesByUserIds(
    accountId: string,
    userIds: string[],
  ): Promise<Map<string, string | null>> {
    if (!userIds.length) return new Map();
    const rows = await this.prisma.$queryRaw<Array<{ user_id: string; role: string | null }>>(
      Prisma.sql`
        SELECT ua.user_id::text AS user_id, ua.role::text AS role
        FROM user_accounts ua
        WHERE ua.account_id::text = ${String(accountId)}
          AND ua.status::text = 'active'
          AND ua.user_id::text IN (${Prisma.join(userIds)})
      `,
    );
    return new Map(rows.map((r) => [r.user_id, r.role]));
  }

  private async hasPlatformRolePermission(platformRoleId: string | null, permissionCode: string): Promise<boolean> {
    if (!platformRoleId) return false;
    const role = await this.prisma.platformRole.findUnique({
      where: { id: platformRoleId },
      include: {
        permission_links: {
          include: { permission: true },
        },
      },
    });
    if (!role) return false;
    return role.permission_links.some((l) => l.permission.code === permissionCode);
  }

  /**
   * Check if user has account access and required permission.
   * Defaults to manage_users to preserve existing admin routes.
   */
  private async checkAdminPermission(
    user: User,
    accountId: string,
    requiredPermission = 'manage_users',
  ): Promise<void> {
    const memberships = await this.prisma.$queryRaw<
      Array<{
        id: string;
        user_id: string;
        account_id: string;
        role: string | null;
        status: string;
        permissions: unknown;
      }>
    >(Prisma.sql`
      SELECT
        ua.id,
        ua.user_id,
        ua.account_id,
        ua.role,
        ua.status,
        ua.permissions
      FROM user_accounts ua
      WHERE ua.user_id::text = ${String(user.id)}
        AND ua.account_id::text = ${String(accountId)}
        AND ua.status = 'active'
      LIMIT 1
    `);
    const userAccount = memberships[0];

    if (!userAccount) {
      throw new ForbiddenException({
        code: 403,
        status: 'error',
        message: 'No active account access found.',
      });
    }

    // System admin and admin have all permissions
    if (isPlatformSuperAdminRole(userAccount.role ?? '')) {
      return;
    }

    let parsedPermissions: unknown = null;
    if (userAccount.permissions) {
      if (typeof userAccount.permissions === 'string') {
        try {
          parsedPermissions = JSON.parse(userAccount.permissions);
        } catch {
          parsedPermissions = null;
        }
      } else {
        parsedPermissions = userAccount.permissions;
      }
    }

    const granted = this.permissionSetFromPayload(parsedPermissions);
    const roleDefaults = ROLE_DEFAULT_PERMISSIONS[(userAccount.role ?? '') as RoleCode] ?? [];
    let hasPermission = granted.has(requiredPermission) || roleDefaults.includes(requiredPermission);

    // Legacy DB compatibility: some deployments don't have platform_role_id yet.

    if (!hasPermission) {
      throw new ForbiddenException({
        code: 403,
        status: 'error',
        message: `Insufficient permissions. ${requiredPermission} permission required.`,
      });
    }
  }

  /**
   * List/detail of platform tenant accounts: `manage_users` (full) or `view_regional_accounts` (district-scoped).
   */
  private async assertPlatformAccountDirectoryAccess(
    user: User,
    accountId: string,
  ): Promise<{ canManageUsers: boolean; scopeDistrictIds: string[] | null }> {
    const ua = await this.prisma.userAccount.findFirst({
      where: { user_id: user.id, account_id: accountId, status: 'active' },
    });
    if (!ua) {
      throw new ForbiddenException({
        code: 403,
        status: 'error',
        message: 'No active account access found.',
      });
    }
    const rbacCtx = { role: ua.role, platform_role_id: ua.platform_role_id, permissions: ua.permissions };
    const canManageUsers = await this.rbac.assertGuardPermission(rbacCtx, 'manage_users');
    const canViewRegional = await this.rbac.assertGuardPermission(rbacCtx, 'view_regional_accounts');
    if (!canManageUsers && !canViewRegional) {
      throw new ForbiddenException({
        code: 403,
        status: 'error',
        message: 'Insufficient permissions for platform accounts directory.',
      });
    }
    if (canManageUsers) {
      return { canManageUsers: true, scopeDistrictIds: null };
    }
    const rows = await this.prisma.regionalSupervisorDistrict.findMany({
      where: { user_id: user.id },
      select: { district_location_id: true },
    });
    const ids = [...new Set(rows.map((r) => r.district_location_id).filter(Boolean))] as string[];
    return { canManageUsers: false, scopeDistrictIds: ids };
  }

  private static readonly USERS_SORT_FIELDS: Record<string, string> = {
    name: 'name',
    email: 'email',
    phone: 'phone',
    status: 'status',
    account_type: 'account_type',
    created_at: 'created_at',
    last_login: 'last_login',
  };

  /**
   * Get all users with pagination, filters, and server-side sorting.
   * sortBy must be one of USERS_SORT_FIELDS; defaults to created_at desc.
   */
  async getUsers(
    user: User,
    accountId: string,
    page: number = 1,
    limit: number = 20,
    search?: string,
    status?: string,
    role?: string,
    accountType?: string,
    sortBy?: string,
    sortDir?: 'asc' | 'desc',
  ) {
    await this.checkAdminPermission(user, accountId);

    const skip = (page - 1) * limit;

    const safeField = sortBy && AdminService.USERS_SORT_FIELDS[sortBy]
      ? AdminService.USERS_SORT_FIELDS[sortBy]
      : 'created_at';
    const safeDir: 'asc' | 'desc' = sortDir === 'asc' ? 'asc' : 'desc';

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status === 'active' || status === 'inactive') {
      where.status = status;
    }

    if (accountType) {
      where.account_type = accountType;
    }

    if (role?.trim()) {
      const roleTrimmed = role.trim();
      const roleMatches = await this.prisma.$queryRaw<Array<{ user_id: string }>>(
        Prisma.sql`
          SELECT ua.user_id::text AS user_id
          FROM user_accounts ua
          WHERE ua.account_id::text = ${String(accountId)}
            AND ua.status::text = 'active'
            AND ua.role::text = ${roleTrimmed}
        `,
      );
      const roleUserIds = roleMatches.map((r) => r.user_id).filter(Boolean);
      if (!roleUserIds.length) {
        return {
          code: 200,
          status: 'success',
          message: 'Users retrieved successfully.',
          data: {
            users: [],
            pagination: {
              page,
              limit,
              total: 0,
              totalPages: 0,
            },
          },
        };
      }
      where.id = { in: [...new Set(roleUserIds)] };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [safeField]: safeDir },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          account_type: true,
          created_at: true,
          last_login: true,
          user_accounts: {
            where: {
              account_id: accountId,
              status: 'active',
            },
            select: {
              role: true,
              permissions: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Users retrieved successfully.',
      data: {
        users: users.map((u) => ({
          ...u,
          role: u.user_accounts[0]?.role || null,
          permissions: u.user_accounts[0]?.permissions || null,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(user: User, accountId: string, userId: string) {
    await this.checkAdminPermission(user, accountId);

    const rawUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        user_accounts: {
          select: {
            id: true,
            user_id: true,
            account_id: true,
            permissions: true,
            status: true,
            created_at: true,
            created_by: true,
            updated_by: true,
            account: {
              select: {
                id: true,
                code: true,
                name: true,
                type: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!rawUser) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'User not found.',
      });
    }

    const roleMeta = await this.prisma.$queryRaw<Array<{ id: string; role: string | null }>>(
      Prisma.sql`
        SELECT ua.id::text AS id, ua.role::text AS role
        FROM user_accounts ua
        WHERE ua.user_id::text = ${String(userId)}
      `,
    );
    const roleByUaId = new Map(roleMeta.map((r) => [r.id, r.role]));

    const enrichedUserAccounts = rawUser.user_accounts.map((row) => ({
      ...row,
      role: roleByUaId.get(row.id) ?? null,
      platform_role_id: null as string | null,
    }));

    const targetUser = { ...rawUser, user_accounts: enrichedUserAccounts };

    const ua =
      targetUser.user_accounts?.find((row) => row.account_id === accountId && row.status === 'active') ?? null;

    let legacyPermissionOverrides: Record<string, boolean> | null = null;
    if (ua?.permissions) {
      try {
        legacyPermissionOverrides =
          typeof ua.permissions === 'string' ? JSON.parse(ua.permissions) : ua.permissions;
      } catch {
        legacyPermissionOverrides = null;
      }
    }

    let platformRoleIdResolved: string | null = ua?.platform_role_id ?? null;
    if (!platformRoleIdResolved && ua?.role) {
      const slug = canonicalPlatformRoleSlug(ua.role);
      const bySlug = await this.prisma.platformRole.findUnique({
        where: { slug },
        select: { id: true },
      });
      platformRoleIdResolved = bySlug?.id ?? null;
    }

    let platform_role_slug: string | null = null;
    let platform_role_name: string | null = null;
    let role_permission_codes: string[] = [];
    if (platformRoleIdResolved) {
      const pr = await this.prisma.platformRole.findUnique({
        where: { id: platformRoleIdResolved },
        select: {
          id: true,
          slug: true,
          name: true,
          permission_links: {
            select: {
              permission: { select: { code: true } },
            },
          },
        },
      });
      if (pr) {
        platform_role_slug = pr.slug;
        platform_role_name = pr.name;
        role_permission_codes = pr.permission_links
          .map((l) => l.permission.code)
          .sort((a, b) => a.localeCompare(b));
      }
    }

    const { user_accounts, ...userRest } = targetUser;

    const mccOnboarding = await this.prisma.mccOnboardingSubmission.findFirst({
      where: { linked_user_id: userId },
      select: {
        id: true,
        submission_code: true,
        business_name: true,
        common_name: true,
        manager_first_name: true,
        manager_last_name: true,
        manager_phone: true,
        manager_id_number: true,
        review_status: true,
        final_decision: true,
        pass_count: true,
        created_at: true,
        linked_account_id: true,
      },
    });

    const stats = (await this.getUserOperationalStats([userId]))[userId];

    const data = {
      ...userRest,
      role: ua?.role ?? null,
      /** Deprecated: legacy JSON overrides on user_accounts; clearance on role reassignment via admin APIs. */
      permissions: legacyPermissionOverrides,
      platform_role_id: platformRoleIdResolved,
      platform_role_slug,
      platform_role_name,
      role_permission_codes,
      user_accounts,
      mcc_onboarding: mccOnboarding,
      stats,
    };

    return {
      code: 200,
      status: 'success',
      message: 'User retrieved successfully.',
      data,
    };
  }

  /** Active tenant/branch accounts for linking users from admin UI. */
  async searchAssignableAccounts(user: User, accountId: string, search?: string, limitRaw?: number) {
    await this.checkAdminPermission(user, accountId);
    const take = Math.min(Math.max(limitRaw ?? 40, 1), 100);
    const q = search?.trim();
    const where: Prisma.AccountWhereInput = {
      status: 'active',
      type: { in: ['tenant', 'branch'] },
      ...(q
        ? {
            OR: [{ name: { contains: q, mode: 'insensitive' } }, { code: { contains: q, mode: 'insensitive' } }],
          }
        : {}),
    };

    const accounts = await this.prisma.account.findMany({
      where,
      select: { id: true, code: true, name: true, type: true },
      orderBy: [{ name: 'asc' }],
      take,
    });

    return {
      code: 200,
      status: 'success',
      message: 'Accounts retrieved.',
      data: { accounts },
    };
  }

  async addUserAccountMembership(
    adminUser: User,
    adminAccountId: string,
    targetUserId: string,
    dto: AssignUserAccountMembershipDto,
  ) {
    await this.checkAdminPermission(adminUser, adminAccountId);

    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'User not found.',
      });
    }

    const acc = await this.prisma.account.findFirst({
      where: {
        id: dto.link_account_id,
        status: 'active',
        type: { in: ['tenant', 'branch'] },
      },
      select: { id: true },
    });
    if (!acc) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Account not found or not eligible for direct user access.',
      });
    }

    await this.rbac.ensureCatalogFromConfig();

    let roleSlug = 'viewer';
    let platformRoleId: string | null = dto.platform_role_id ?? null;
    if (platformRoleId) {
      const pr = await this.prisma.platformRole.findUnique({
        where: { id: platformRoleId },
        select: { id: true, slug: true, is_active: true },
      });
      if (!pr?.is_active) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Invalid or inactive platform role.',
        });
      }
      roleSlug = canonicalPlatformRoleSlug(pr.slug);
    } else {
      platformRoleId = await this.rbac.resolvePlatformRoleIdFromSlug(roleSlug);
    }

    const existing = await this.prisma.userAccount.findUnique({
      where: { user_id_account_id: { user_id: targetUserId, account_id: dto.link_account_id } },
    });

    if (existing?.status === 'active') {
      throw new ConflictException({
        code: 409,
        status: 'error',
        message: 'User already has access to this account.',
      });
    }

    if (existing) {
      await this.prisma.userAccount.update({
        where: { id: existing.id },
        data: {
          status: 'active',
          role: roleSlug,
          platform_role_id: platformRoleId,
          permissions: null,
          updated_by: adminUser.id,
        },
      });
    } else {
      await this.prisma.userAccount.create({
        data: {
          user_id: targetUserId,
          account_id: dto.link_account_id,
          role: roleSlug,
          platform_role_id: platformRoleId,
          permissions: null,
          status: 'active',
          created_by: adminUser.id,
        },
      });
    }

    if (!target.default_account_id) {
      await this.prisma.user.update({
        where: { id: targetUserId },
        data: { default_account_id: dto.link_account_id, updated_by: adminUser.id },
      });
    }

    return {
      code: 200,
      status: 'success',
      message: 'Account access granted.',
      data: null,
    };
  }

  async removeUserAccountMembership(adminUser: User, adminAccountId: string, targetUserId: string, membershipAccountId: string) {
    await this.checkAdminPermission(adminUser, adminAccountId);

    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'User not found.',
      });
    }

    const ua = await this.prisma.userAccount.findUnique({
      where: {
        user_id_account_id: { user_id: targetUserId, account_id: membershipAccountId },
      },
    });

    if (!ua || ua.status !== 'active') {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'No active membership for this account.',
      });
    }

    const activeCount = await this.prisma.userAccount.count({
      where: { user_id: targetUserId, status: 'active' },
    });
    if (activeCount <= 1) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message:
          "Cannot remove the user's only active account access. Grant access to another account first, or deactivate the user.",
      });
    }

    await this.prisma.userAccount.update({
      where: { id: ua.id },
      data: { status: 'inactive', updated_by: adminUser.id },
    });

    if (target.default_account_id === membershipAccountId) {
      const next = await this.prisma.userAccount.findFirst({
        where: { user_id: targetUserId, status: 'active' },
        select: { account_id: true },
      });
      await this.prisma.user.update({
        where: { id: targetUserId },
        data: { default_account_id: next?.account_id ?? null, updated_by: adminUser.id },
      });
    }

    return {
      code: 200,
      status: 'success',
      message: 'Account access removed.',
      data: null,
    };
  }

  async getUserActivity(user: User, accountId: string, userId: string, metric: UserActivityMetric) {
    await this.checkAdminPermission(user, accountId);

    if (!AdminService.USER_ACTIVITY_METRICS.includes(metric)) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Invalid activity metric.',
      });
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        user_accounts: {
          where: { status: 'active' },
          include: {
            account: {
              select: { id: true, code: true, name: true, status: true, type: true },
            },
          },
        },
      },
    });

    if (!targetUser) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'User not found.',
      });
    }

    const linkedAccountIds = [...new Set(targetUser.user_accounts.map((row) => row.account_id))];
    if (linkedAccountIds.length === 0) {
      return {
        code: 200,
        status: 'success',
        message: 'User activity retrieved successfully.',
        data: [],
      };
    }

    if (metric === 'accounts') {
      return {
        code: 200,
        status: 'success',
        message: 'User activity retrieved successfully.',
        data: targetUser.user_accounts.map((ua) => ({
          id: ua.account?.id ?? ua.account_id,
          account_id: ua.account_id,
          code: ua.account?.code ?? null,
          name: ua.account?.name ?? null,
          status: ua.account?.status ?? ua.status,
          account_type: ua.account?.type ?? null,
          role: ua.role,
          relationship_status: ua.status,
        })),
      };
    }

    if (metric === 'members') {
      const rows = await this.prisma.userAccount.findMany({
        where: {
          account_id: { in: linkedAccountIds },
          status: 'active',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              status: true,
            },
          },
          account: {
            select: {
              id: true,
              code: true,
              name: true,
              status: true,
              type: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        take: 1000,
      });
      return {
        code: 200,
        status: 'success',
        message: 'User activity retrieved successfully.',
        data: rows.map((row) => ({
          id: `${row.user_id}:${row.account_id}`,
          user_id: row.user_id,
          account_id: row.account_id,
          name: row.user?.name ?? null,
          email: row.user?.email ?? null,
          phone: row.user?.phone ?? null,
          role: row.role ?? null,
          status: row.user?.status ?? row.status,
          relationship_status: row.status,
          account: row.account
            ? {
                id: row.account.id,
                code: row.account.code,
                name: row.account.name,
                type: row.account.type,
                status: row.account.status,
              }
            : null,
        })),
      };
    }

    if (metric === 'suppliers') {
      const rows = await this.prisma.supplierCustomer.findMany({
        where: {
          customer_account_id: { in: linkedAccountIds },
          relationship_status: 'active',
        },
        include: {
          supplier_account: { select: { id: true, code: true, name: true, status: true } },
        },
        orderBy: { created_at: 'desc' },
      });
      return {
        code: 200,
        status: 'success',
        message: 'User activity retrieved successfully.',
        data: rows.map((row) => ({
          id: row.id,
          relationship_id: row.id,
          account_id: row.supplier_account_id,
          code: row.supplier_account?.code ?? null,
          name: row.supplier_account?.name ?? null,
          status: row.supplier_account?.status ?? row.relationship_status,
          relationship_status: row.relationship_status,
        })),
      };
    }

    if (metric === 'customers') {
      const rows = await this.prisma.supplierCustomer.findMany({
        where: {
          supplier_account_id: { in: linkedAccountIds },
          relationship_status: 'active',
        },
        include: {
          customer_account: { select: { id: true, code: true, name: true, status: true } },
        },
        orderBy: { created_at: 'desc' },
      });
      return {
        code: 200,
        status: 'success',
        message: 'User activity retrieved successfully.',
        data: rows.map((row) => ({
          id: row.id,
          relationship_id: row.id,
          account_id: row.customer_account_id,
          code: row.customer_account?.code ?? null,
          name: row.customer_account?.name ?? null,
          status: row.customer_account?.status ?? row.relationship_status,
          relationship_status: row.relationship_status,
        })),
      };
    }

    if (metric === 'sales') {
      const rows = await this.prisma.milkSale.findMany({
        where: {
          supplier_account_id: { in: linkedAccountIds },
          status: { not: 'deleted' },
        },
        include: {
          supplier_account: { select: { id: true, code: true, name: true, status: true } },
          customer_account: { select: { id: true, code: true, name: true, status: true } },
        },
        orderBy: { sale_at: 'desc' },
        take: 1000,
      });
      return {
        code: 200,
        status: 'success',
        message: 'User activity retrieved successfully.',
        data: rows.map((row) => ({
          id: row.id,
          code: row.supplier_account?.code ?? null,
          name: `${row.supplier_account?.name ?? 'Supplier'} -> ${row.customer_account?.name ?? 'Customer'}`,
          status: row.status,
          quantity: row.quantity,
          unit_price: row.unit_price,
          sale_at: row.sale_at,
        })),
      };
    }

    if (metric === 'collections') {
      const rows = await this.prisma.milkSale.findMany({
        where: {
          customer_account_id: { in: linkedAccountIds },
          status: { not: 'deleted' },
        },
        include: {
          supplier_account: { select: { id: true, code: true, name: true, status: true } },
          customer_account: { select: { id: true, code: true, name: true, status: true } },
        },
        orderBy: { sale_at: 'desc' },
        take: 1000,
      });
      return {
        code: 200,
        status: 'success',
        message: 'User activity retrieved successfully.',
        data: rows.map((row) => ({
          id: row.id,
          code: row.customer_account?.code ?? null,
          name: `${row.supplier_account?.name ?? 'Supplier'} -> ${row.customer_account?.name ?? 'Customer'}`,
          status: row.status,
          quantity: row.quantity,
          unit_price: row.unit_price,
          collection_at: row.sale_at,
        })),
      };
    }

    const rows = await this.prisma.farm.findMany({
      where: {
        account_id: { in: linkedAccountIds },
      },
      orderBy: { created_at: 'desc' },
      take: 1000,
    });

    return {
      code: 200,
      status: 'success',
      message: 'User activity retrieved successfully.',
      data: rows.map((row) => ({
        id: row.id,
        account_id: row.account_id,
        code: row.code,
        name: row.name,
        status: row.status,
      })),
    };
  }

  /**
   * Full business lists for admin, matching gemura-web shapes for an operational account the target user belongs to.
   * `accounts` resource ignores operational_account_id and returns all active memberships for the user.
   */
  async getUserBusinessRecords(
    user: User,
    adminAccountId: string,
    targetUserId: string,
    resourceRaw: string,
    operationalAccountId: string | undefined,
    filters: {
      status?: string;
      date_from?: string;
      date_to?: string;
      supplier_name?: string;
      customer_account_code?: string;
      /** Full-text-ish match on user name, email, phone (members resource only). */
      search?: string;
    },
  ) {
    await this.checkAdminPermission(user, adminAccountId);

    const resource = resourceRaw as UserBusinessResource;
    if (!resourceRaw || !AdminService.USER_BUSINESS_RESOURCES.includes(resource)) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: `Invalid resource. Use one of: ${AdminService.USER_BUSINESS_RESOURCES.join(', ')}.`,
      });
    }

    if (resource === 'accounts') {
      const targetUser = await this.prisma.user.findUnique({
        where: { id: targetUserId },
        include: {
          user_accounts: {
            where: { status: 'active' },
            include: {
              account: { select: { id: true, code: true, name: true, status: true, type: true } },
            },
          },
        },
      });

      if (!targetUser) {
        throw new NotFoundException({
          code: 404,
          status: 'error',
          message: 'User not found.',
        });
      }

      const data = targetUser.user_accounts.map((ua) => ({
        id: ua.account?.id ?? ua.account_id,
        account_id: ua.account_id,
        code: ua.account?.code ?? null,
        name: ua.account?.name ?? null,
        status: ua.account?.status ?? ua.status,
        account_type: ua.account?.type ?? null,
        role: ua.role,
        relationship_status: ua.status,
      }));

      return {
        code: 200,
        status: 'success',
        message: 'User business records retrieved successfully.',
        data,
      };
    }

    if (!operationalAccountId?.trim()) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'operational_account_id is required for this resource.',
      });
    }

    const opAccountId = operationalAccountId.trim();

    const membership = await this.prisma.userAccount.findFirst({
      where: {
        user_id: targetUserId,
        account_id: opAccountId,
        status: 'active',
      },
    });

    if (!membership) {
      throw new ForbiddenException({
        code: 403,
        status: 'error',
        message: 'Target user has no active access to the given operational account.',
      });
    }

    if (resource === 'members') {
      const userWhere: Prisma.UserWhereInput = {};
      if (filters.search?.trim()) {
        const q = filters.search.trim();
        userWhere.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
        ];
      }
      if (filters.status?.trim()) {
        const st = filters.status.trim().toLowerCase();
        if (st === 'active' || st === 'inactive') {
          userWhere.status = st;
        }
      }

      const rows = await this.prisma.userAccount.findMany({
        where: {
          account_id: opAccountId,
          status: 'active',
          ...(Object.keys(userWhere).length > 0 ? { user: userWhere } : {}),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              status: true,
            },
          },
          account: { select: { id: true, code: true, name: true, type: true, status: true } },
        },
        orderBy: { created_at: 'desc' },
      });

      return {
        code: 200,
        status: 'success',
        message: 'User business records retrieved successfully.',
        data: rows.map((row) => ({
          id: `${row.user_id}:${row.account_id}`,
          user_id: row.user_id,
          account_id: row.account_id,
          name: row.user?.name ?? null,
          email: row.user?.email ?? null,
          phone: row.user?.phone ?? null,
          role: row.role ?? null,
          status: row.user?.status ?? row.status,
          relationship_status: row.status,
          account: row.account
            ? {
                id: row.account.id,
                code: row.account.code,
                name: row.account.name,
                type: row.account.type,
                status: row.account.status,
              }
            : null,
        })),
      };
    }

    if (resource === 'collections') {
      const where: Record<string, unknown> = {
        customer_account_id: opAccountId,
        status: { not: 'deleted' },
      };

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.supplier_name?.trim()) {
        where.supplier_account = {
          is: {
            name: {
              contains: filters.supplier_name.trim(),
              mode: 'insensitive',
            },
          },
        };
      }

      if (filters.date_from || filters.date_to) {
        const saleAt: Record<string, Date> = {};
        if (filters.date_from) {
          saleAt.gte = new Date(filters.date_from);
        }
        if (filters.date_to) {
          const dateTo = new Date(filters.date_to);
          dateTo.setHours(23, 59, 59, 999);
          saleAt.lte = dateTo;
        }
        where.sale_at = saleAt;
      }

      const collections = await this.prisma.milkSale.findMany({
        where,
        include: {
          supplier_account: true,
          customer_account: true,
          recorded_by_user: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
        orderBy: { sale_at: 'desc' },
      });

      const data = collections.map((collection) => ({
        id: collection.id,
        quantity: Number(collection.quantity),
        unit_price: Number(collection.unit_price),
        total_amount: Number(collection.quantity) * Number(collection.unit_price),
        status: collection.status,
        sale_at: collection.sale_at,
        collection_at: collection.sale_at,
        collection_shift: this.collectionShiftFromNotes(collection.notes),
        notes: collection.notes,
        payment_status: collection.payment_status,
        created_at: collection.created_at,
        updated_at: collection.updated_at,
        supplier_account: {
          id: collection.supplier_account.id,
          code: collection.supplier_account.code,
          name: collection.supplier_account.name,
          type: collection.supplier_account.type,
          status: collection.supplier_account.status,
        },
        customer_account: {
          id: collection.customer_account.id,
          code: collection.customer_account.code,
          name: collection.customer_account.name,
          type: collection.customer_account.type,
          status: collection.customer_account.status,
        },
        recorded_by: {
          id: collection.recorded_by_user.id,
          name: collection.recorded_by_user.name,
          phone: collection.recorded_by_user.phone,
        },
      }));

      return {
        code: 200,
        status: 'success',
        message: 'User business records retrieved successfully.',
        data,
      };
    }

    if (resource === 'sales') {
      const where: Record<string, unknown> = {
        supplier_account_id: opAccountId,
        status: { not: 'deleted' },
      };

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.customer_account_code?.trim()) {
        const customerAccount = await this.prisma.account.findUnique({
          where: { code: filters.customer_account_code.trim() },
        });
        if (customerAccount) {
          where.customer_account_id = customerAccount.id;
        }
      }

      if (filters.date_from || filters.date_to) {
        const saleAt: Record<string, Date> = {};
        if (filters.date_from) {
          saleAt.gte = new Date(filters.date_from);
        }
        if (filters.date_to) {
          const dateTo = new Date(filters.date_to);
          dateTo.setHours(23, 59, 59, 999);
          saleAt.lte = dateTo;
        }
        where.sale_at = saleAt;
      }

      const sales = await this.prisma.milkSale.findMany({
        where,
        include: {
          supplier_account: true,
          customer_account: true,
          animal: { select: { id: true, tag_number: true, name: true } },
        },
        orderBy: { sale_at: 'desc' },
      });

      const data = sales.map((sale) => ({
        id: sale.id,
        quantity: Number(sale.quantity),
        unit_price: Number(sale.unit_price),
        total_amount: Number(sale.quantity) * Number(sale.unit_price),
        status: sale.status,
        sale_at: sale.sale_at,
        notes: sale.notes,
        created_at: sale.created_at,
        animal_id: sale.animal_id ?? undefined,
        animal: sale.animal
          ? { id: sale.animal.id, tag_number: sale.animal.tag_number, name: sale.animal.name }
          : undefined,
        supplier_account: {
          id: sale.supplier_account.id,
          code: sale.supplier_account.code,
          name: sale.supplier_account.name,
          type: sale.supplier_account.type,
          status: sale.supplier_account.status,
        },
        customer_account: {
          id: sale.customer_account.id,
          code: sale.customer_account.code,
          name: sale.customer_account.name,
          type: sale.customer_account.type,
          status: sale.customer_account.status,
        },
      }));

      return {
        code: 200,
        status: 'success',
        message: 'User business records retrieved successfully.',
        data,
      };
    }

    if (resource === 'suppliers') {
      const relationships = await this.prisma.supplierCustomer.findMany({
        where: {
          customer_account_id: opAccountId,
          relationship_status: 'active',
        },
        include: {
          supplier_account: {
            include: {
              user_accounts: {
                where: { status: 'active' },
                include: {
                  user: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      phone: true,
                      email: true,
                      nid: true,
                      address: true,
                      account_type: true,
                    },
                  },
                },
                take: 1,
              },
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });

      const data = relationships.map((rel) => {
        const supplierUser = rel.supplier_account.user_accounts[0]?.user;
        return {
          relationship_id: rel.id,
          code: supplierUser?.code || '',
          name: supplierUser?.name || rel.supplier_account.name,
          phone: supplierUser?.phone || '',
          email: supplierUser?.email || null,
          nid: supplierUser?.nid || null,
          address: supplierUser?.address || null,
          account: {
            id: rel.supplier_account.id,
            code: rel.supplier_account.code,
            name: rel.supplier_account.name,
          },
          bank_name: rel.supplier_account.bank_name,
          bank_account_number: rel.supplier_account.bank_account_number,
          price_per_liter: Number(rel.price_per_liter),
          average_supply_quantity: Number(rel.average_supply_quantity),
          relationship_status: rel.relationship_status,
          created_at: rel.created_at,
          updated_at: rel.updated_at,
        };
      });

      return {
        code: 200,
        status: 'success',
        message: 'User business records retrieved successfully.',
        data,
      };
    }

    if (resource === 'customers') {
      const relationships = await this.prisma.supplierCustomer.findMany({
        where: {
          supplier_account_id: opAccountId,
          relationship_status: 'active',
        },
        include: {
          customer_account: {
            include: {
              user_accounts: {
                where: { status: 'active' },
                include: {
                  user: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      phone: true,
                      email: true,
                      nid: true,
                      address: true,
                      account_type: true,
                    },
                  },
                },
                take: 1,
              },
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });

      const data = relationships.map((rel) => {
        const customerUser = rel.customer_account.user_accounts[0]?.user;
        return {
          relationship_id: rel.id,
          code: customerUser?.code || '',
          name: customerUser?.name || rel.customer_account.name,
          phone: customerUser?.phone || '',
          email: customerUser?.email || null,
          nid: customerUser?.nid || null,
          address: customerUser?.address || null,
          account: {
            id: rel.customer_account.id,
            code: rel.customer_account.code,
            name: rel.customer_account.name,
          },
          price_per_liter: Number(rel.price_per_liter),
          average_supply_quantity: Number(rel.average_supply_quantity),
          relationship_status: rel.relationship_status,
          created_at: rel.created_at,
          updated_at: rel.updated_at,
        };
      });

      return {
        code: 200,
        status: 'success',
        message: 'User business records retrieved successfully.',
        data,
      };
    }

    if (resource === 'farms') {
      const farms = await this.prisma.farm.findMany({
        where: { account_id: opAccountId },
        orderBy: { created_at: 'desc' },
      });

      const data = farms.map((row) => ({
        id: row.id,
        account_id: row.account_id,
        code: row.code,
        name: row.name,
        description: row.description,
        location: row.location,
        location_id: row.location_id,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));

      return {
        code: 200,
        status: 'success',
        message: 'User business records retrieved successfully.',
        data,
      };
    }

    throw new BadRequestException({
      code: 400,
      status: 'error',
      message: `Unsupported resource: ${resource}.`,
    });
  }

  /**
   * Create new user
   */
  async createUser(user: User, accountId: string, createDto: CreateUserDto) {
    await this.checkAdminPermission(user, accountId);

    // Check if email or phone already exists
    if (createDto.email) {
      const existingEmail = await this.prisma.user.findFirst({
        where: { email: createDto.email.toLowerCase() },
      });
      if (existingEmail) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Email already exists.',
        });
      }
    }

    if (createDto.phone) {
      const existingPhone = await this.prisma.user.findFirst({
        where: { phone: createDto.phone },
      });
      if (existingPhone) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Phone number already exists.',
        });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createDto.password, 10);

    // Create user
    const fn = createDto.first_name.trim();
    const ln = createDto.last_name.trim();
    const newUser = await this.prisma.user.create({
      data: {
        first_name: fn,
        last_name: ln,
        name: composeUserFullName(fn, ln),
        email: createDto.email?.toLowerCase(),
        phone: createDto.phone,
        password_hash: hashedPassword,
        account_type: createDto.account_type || 'mcc',
        status: createDto.status || 'active',
        default_account_id: accountId,
        created_by: user.id,
        ...(createDto.supplier_segment
          ? { supplier_segment: createDto.supplier_segment }
          : {}),
      },
    });

    if (createDto.onboarding_payload) {
      await this.prisma.supplierMilkOnboarding.upsert({
        where: { user_id: newUser.id },
        create: {
          user_id: newUser.id,
          payload: createDto.onboarding_payload as object,
          mcc_account_id: accountId,
        },
        update: {
          payload: createDto.onboarding_payload as object,
          mcc_account_id: accountId,
        },
      });
    }

    // Create user account access
    if (createDto.role || createDto.permissions || createDto.platform_role_id) {
      await this.rbac.ensureCatalogFromConfig();
      let roleSlug = canonicalPlatformRoleSlug((createDto.role || 'viewer').trim().slice(0, 64));
      let platformRoleId =
        createDto.platform_role_id || (await this.rbac.resolvePlatformRoleIdFromSlug(roleSlug));
      if (createDto.platform_role_id && !createDto.role) {
        const s = await this.rbac.resolveSlugFromPlatformRoleId(createDto.platform_role_id);
        if (s) roleSlug = s;
      }
      if (!platformRoleId) {
        platformRoleId = await this.rbac.resolvePlatformRoleIdFromSlug(roleSlug);
      }
      await this.prisma.userAccount.create({
        data: {
          user_id: newUser.id,
          account_id: accountId,
          role: roleSlug,
          platform_role_id: platformRoleId,
          permissions: null,
          status: 'active',
          created_by: user.id,
        },
      });
    }

    return {
      code: 201,
      status: 'success',
      message: 'User created successfully.',
      data: newUser,
    };
  }

  /**
   * Update user
   */
  async updateUser(user: User, accountId: string, userId: string, updateDto: UpdateUserDto) {
    await this.checkAdminPermission(user, accountId);

    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'User not found.',
      });
    }

    // Check email uniqueness if updating
    if (updateDto.email && updateDto.email !== targetUser.email) {
      const existingEmail = await this.prisma.user.findFirst({
        where: { email: updateDto.email.toLowerCase() },
      });
      if (existingEmail) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Email already exists.',
        });
      }
    }

    // Check phone uniqueness if updating
    if (updateDto.phone && updateDto.phone !== targetUser.phone) {
      const existingPhone = await this.prisma.user.findFirst({
        where: { phone: updateDto.phone },
      });
      if (existingPhone) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Phone number already exists.',
        });
      }
    }

    const {
      role: dtoRole,
      permissions: _dtoPermissions,
      platform_role_id: dtoPlatformRoleId,
      password: dtoPasswordField,
      name: dtoLegacyName,
      first_name: dtoFirst,
      last_name: dtoLast,
      ...dtoForUserModel
    } = updateDto;

    // Hash password if provided
    const updateData: any = {
      ...dtoForUserModel,
      updated_by: user.id,
    };

    if (dtoFirst !== undefined || dtoLast !== undefined || dtoLegacyName !== undefined) {
      let first = dtoFirst !== undefined ? dtoFirst.trim() : targetUser.first_name;
      let last = dtoLast !== undefined ? dtoLast.trim() : targetUser.last_name;
      if (dtoLegacyName !== undefined && dtoFirst === undefined && dtoLast === undefined) {
        const sp = splitIntoFirstLast(dtoLegacyName);
        first = sp.first_name;
        last = sp.last_name;
      }
      updateData.first_name = first;
      updateData.last_name = last;
      updateData.name = composeUserFullName(first, last);
    }

    if (dtoPasswordField) {
      updateData.password_hash = await bcrypt.hash(dtoPasswordField, 10);
    }

    if (updateDto.email) {
      updateData.email = updateDto.email.toLowerCase();
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    const roleOrPlatformChanging = dtoRole !== undefined || dtoPlatformRoleId !== undefined;

    // Update user account access if role/platform_role_id provided (per-user permission JSON deprecated)
    if (roleOrPlatformChanging) {
      await this.rbac.ensureCatalogFromConfig();
      const userAccount = await this.prisma.userAccount.findFirst({
        where: {
          user_id: userId,
          account_id: accountId,
        },
      });

      if (userAccount) {
        let roleSlug =
          dtoRole !== undefined
            ? canonicalPlatformRoleSlug(dtoRole.trim().slice(0, 64))
            : userAccount.role.trim().slice(0, 64);
        let platformRoleId =
          dtoPlatformRoleId !== undefined
            ? dtoPlatformRoleId
            : dtoRole !== undefined
              ? await this.rbac.resolvePlatformRoleIdFromSlug(roleSlug)
              : userAccount.platform_role_id;
        if (dtoPlatformRoleId !== undefined && dtoRole === undefined) {
          const s = await this.rbac.resolveSlugFromPlatformRoleId(dtoPlatformRoleId);
          if (s) roleSlug = s;
        }
        if (!platformRoleId && dtoRole !== undefined) {
          platformRoleId = await this.rbac.resolvePlatformRoleIdFromSlug(roleSlug);
        }
        await this.prisma.userAccount.update({
          where: { id: userAccount.id },
          data: {
            role: roleSlug,
            platform_role_id: platformRoleId ?? undefined,
            permissions: null,
            updated_by: user.id,
          },
        });
      } else if (dtoRole || dtoPlatformRoleId) {
        let roleSlug = canonicalPlatformRoleSlug((dtoRole || 'viewer').trim().slice(0, 64));
        let platformRoleId =
          dtoPlatformRoleId || (await this.rbac.resolvePlatformRoleIdFromSlug(roleSlug));
        if (dtoPlatformRoleId && !dtoRole) {
          const s = await this.rbac.resolveSlugFromPlatformRoleId(dtoPlatformRoleId);
          if (s) roleSlug = s;
        }
        await this.prisma.userAccount.create({
          data: {
            user_id: userId,
            account_id: accountId,
            role: roleSlug,
            platform_role_id: platformRoleId,
            permissions: null,
            status: 'active',
            created_by: user.id,
          },
        });
      }
    }

    return {
      code: 200,
      status: 'success',
      message: 'User updated successfully.',
      data: updatedUser,
    };
  }

  /**
   * Link or unlink a Gemura user (must belong to account) to an IMMIS member.
   */
  async linkUserImmisMember(
    adminUser: User,
    accountId: string,
    targetUserId: string,
    immis_member_id: number | null,
  ) {
    await this.checkAdminPermission(adminUser, accountId);

    const ua = await this.prisma.userAccount.findFirst({
      where: {
        user_id: targetUserId,
        account_id: accountId,
        status: 'active',
      },
    });
    if (!ua) {
      throw new ForbiddenException({
        code: 403,
        status: 'error',
        message: 'User is not an active member of this account.',
      });
    }

    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'User not found.',
      });
    }

    if (immis_member_id === null) {
      await this.prisma.user.update({
        where: { id: targetUserId },
        data: {
          immis_member_id: null,
          immis_linked_at: null,
          updated_by: adminUser.id,
        },
      });
      return {
        code: 200,
        status: 'success',
        message: 'IMMIS link removed.',
        data: { user_id: targetUserId, immis_member_id: null },
      };
    }

    const exists = await this.immisService.immisMemberExists(immis_member_id);
    if (!exists) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'IMMIS member not found or could not be verified.',
      });
    }

    const taken = await this.prisma.user.findFirst({
      where: {
        immis_member_id,
        NOT: { id: targetUserId },
        status: 'active',
      },
    });
    if (taken) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: `IMMIS member ${immis_member_id} is already linked to "${taken.name}".`,
      });
    }

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        immis_member_id,
        immis_linked_at: new Date(),
        updated_by: adminUser.id,
      },
    });

    return {
      code: 200,
      status: 'success',
      message: 'User linked to IMMIS member.',
      data: { user_id: targetUserId, immis_member_id },
    };
  }

  /**
   * Export users list as CSV with the same columns as the UI table.
   */
  async exportUsersCsv(
    user: User,
    accountId: string,
    search?: string,
    status?: string,
    role?: string,
    accountType?: string,
  ): Promise<string> {
    await this.checkAdminPermission(user, accountId);

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status === 'active' || status === 'inactive') {
      where.status = status;
    }
    if (accountType) {
      where.account_type = accountType;
    }
    if (role) {
      where.user_accounts = { some: { account_id: accountId, role } };
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 10000,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        account_type: true,
        created_at: true,
        user_accounts: {
          where: { account_id: accountId, status: 'active' },
          select: { role: true },
        },
      },
    });

    const headers = ['Name', 'Email', 'Phone', 'Account Type', 'Role', 'Status', 'Created At'];

    const escape = (v: unknown): string => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const csvRows = [
      headers.join(','),
      ...users.map((u) => {
        return [
          escape(u.name),
          escape(u.email),
          escape(u.phone),
          escape(u.account_type),
          escape(u.user_accounts[0]?.role ?? ''),
          escape(u.status),
          escape(u.created_at.toISOString()),
        ].join(',');
      }),
    ];

    return csvRows.join('\n');
  }

  /**
   * Delete user (soft delete by setting status to inactive)
   */
  async deleteUser(user: User, accountId: string, userId: string) {
    await this.checkAdminPermission(user, accountId);

    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'User not found.',
      });
    }

    // Soft delete
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'inactive',
        updated_by: user.id,
      },
    });

    return {
      code: 200,
      status: 'success',
      message: 'User deleted successfully.',
    };
  }

  /** UTC-inclusive window shared by Overview / Milk / Finance admin dashboards (TZ-aligned dates). */
  private resolveAdminDashboardPeriodBounds(
    dateFrom?: string,
    dateTo?: string,
    tzOffsetMinutes?: number,
  ): { gte: Date; lte: Date } {
    const now = new Date();
    const todayStartUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const todayEndUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    const last30DaysUtc = new Date(todayStartUtc.getTime() - 30 * 24 * 60 * 60 * 1000);

    const parseDateOnlyUTC = (s?: string): Date | null => {
      if (!s) return null;
      const match = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return null;
      const y = Number(match[1]);
      const m = Number(match[2]);
      const d = Number(match[3]);
      const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
      return Number.isNaN(dt.getTime()) ? null : dt;
    };

    if (dateFrom && dateTo) {
      const parsedFrom = parseDateOnlyUTC(dateFrom);
      const parsedTo = parseDateOnlyUTC(dateTo);
      if (!parsedFrom || !parsedTo) {
        return { gte: last30DaysUtc, lte: todayEndUtc };
      }
      let fromStr = dateFrom;
      let toStr = dateTo;
      if (parsedFrom.getTime() > parsedTo.getTime()) {
        [fromStr, toStr] = [toStr, fromStr];
      }
      return saleAtBoundsUtcInclusive(fromStr, toStr, tzOffsetMinutes);
    }
    return { gte: last30DaysUtc, lte: todayEndUtc };
  }

  private formatHumanDate(dt: Date): string {
    return dt.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private relativeWhen(dt: Date): string {
    const diffMs = Date.now() - dt.getTime();
    const mins = Math.max(1, Math.floor(diffMs / (60 * 1000)));
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    const days = Math.floor(hrs / 24);
    return `${days} d ago`;
  }

  private clamp(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n));
  }

  private healthLabel(rejectionPct: number, tankPct: number): 'Excellent' | 'Good' | 'Moderate' | 'At risk' | 'Critical' {
    if (rejectionPct <= 1.2 && tankPct <= 80) return 'Excellent';
    if (rejectionPct <= 2.2 && tankPct <= 86) return 'Good';
    if (rejectionPct <= 3.8 && tankPct <= 90) return 'Moderate';
    if (rejectionPct <= 5.8 && tankPct <= 94) return 'At risk';
    return 'Critical';
  }

  private onboardingStatusText(
    status: MccOnboardingReviewStatus,
  ): { status: string; tone: 'pending' | 'review' | 'kyc' } {
    switch (status) {
      case 'needs_changes':
        return { status: 'KYC pending', tone: 'kyc' };
      case 'approved':
        return { status: 'Approved', tone: 'review' };
      case 'rejected':
        return { status: 'Rejected', tone: 'pending' };
      default:
        return { status: 'Under review', tone: 'review' };
    }
  }

  private async buildLiveOverviewData(bounds: { gte: Date; lte: Date }) {
    const todayStartUtc = new Date(
      Date.UTC(bounds.lte.getUTCFullYear(), bounds.lte.getUTCMonth(), bounds.lte.getUTCDate(), 0, 0, 0, 0),
    );

    const [mccRows, qualityRows, onboardingRowsRaw, pendingOnboarding, latestLoan, latestPayroll, latestOnboarding, latestMilk] =
      await Promise.all([
        this.prisma.$queryRaw<
          Array<{
            account_id: string;
            mcc: string;
            collections_liters: number;
            sales_rf: number;
            rejected_txns: number;
            total_txns: number;
            liters_today: number;
          }>
        >(
          Prisma.sql`
          SELECT
            ms.supplier_account_id::text AS account_id,
            COALESCE(a.name, 'MCC') AS mcc,
            COALESCE(SUM(ms.quantity)::numeric, 0)::float8 AS collections_liters,
            COALESCE(SUM(ms.quantity * ms.unit_price)::numeric, 0)::float8 AS sales_rf,
            COALESCE(SUM(CASE WHEN ms.status::text = 'rejected' THEN 1 ELSE 0 END), 0)::int AS rejected_txns,
            COUNT(*)::int AS total_txns,
            COALESCE(SUM(CASE WHEN ms.sale_at >= ${todayStartUtc} THEN ms.quantity ELSE 0 END)::numeric, 0)::float8 AS liters_today
          FROM milk_sales ms
          LEFT JOIN accounts a ON a.id = ms.supplier_account_id
          WHERE ms.sale_at >= ${bounds.gte}
            AND ms.sale_at <= ${bounds.lte}
            AND ms.status::text <> 'deleted'
          GROUP BY ms.supplier_account_id, a.name
          ORDER BY collections_liters DESC
          LIMIT 6
        `,
        ).catch((error) => this.optionalRelationFallback(error, [])),
        this.prisma.$queryRaw<
          Array<{
            account_id: string;
            mcc: string;
            deliveries_count: number;
            manifests_submitted: number;
            manifests_accepted: number;
            manifests_rejected: number;
            tests_total: number;
            tests_rejected: number;
            liters_today: number;
          }>
        >(
          Prisma.sql`
          SELECT
            gd.mcc_account_id::text AS account_id,
            COALESCE(a.name, 'MCC') AS mcc,
            COUNT(DISTINCT gd.id)::int AS deliveries_count,
            COUNT(DISTINCT CASE WHEN mf.id IS NOT NULL THEN mf.id END)::int AS manifests_submitted,
            COUNT(DISTINCT CASE WHEN mf.status::text = 'accepted' THEN mf.id END)::int AS manifests_accepted,
            COUNT(DISTINCT CASE WHEN mf.status::text = 'rejected' THEN mf.id END)::int AS manifests_rejected,
            COUNT(tr.id)::int AS tests_total,
            COALESCE(SUM(CASE WHEN tr.outcome::text = 'rejected' THEN 1 ELSE 0 END), 0)::int AS tests_rejected,
            COALESCE(SUM(CASE WHEN gd.arrived_at >= ${todayStartUtc} THEN gd.gate_volume_litres ELSE 0 END)::numeric, 0)::float8 AS liters_today
          FROM mcc_gate_deliveries gd
          LEFT JOIN accounts a ON a.id = gd.mcc_account_id
          LEFT JOIN mcc_milk_manifests mf ON mf.gate_delivery_id = gd.id
          LEFT JOIN mcc_milk_test_results tr ON tr.mcc_gate_delivery_id = gd.id
          WHERE gd.arrived_at >= ${bounds.gte}
            AND gd.arrived_at <= ${bounds.lte}
          GROUP BY gd.mcc_account_id, a.name
          ORDER BY deliveries_count DESC, liters_today DESC
          LIMIT 6
        `,
        ).catch((error) => this.optionalRelationFallback(error, [])),
        this.prisma.mccOnboardingSubmission.findMany({
          where: { review_status: 'pending' },
          orderBy: { created_at: 'desc' },
          take: 5,
          select: {
            id: true,
            business_name: true,
            common_name: true,
            location_province_id: true,
            created_at: true,
            review_status: true,
          },
        }),
        this.prisma.mccOnboardingSubmission.count({
          where: { review_status: 'pending' },
        }),
        this.prisma.loan.findFirst({
          where: { disbursement_date: { gte: bounds.gte, lte: bounds.lte } },
          orderBy: { disbursement_date: 'desc' },
          select: { disbursement_date: true, principal: true },
        }),
        this.prisma.payrollRun.findFirst({
          where: { run_date: { gte: bounds.gte, lte: bounds.lte }, status: 'completed' },
          orderBy: { run_date: 'desc' },
          select: { run_date: true, total_amount: true },
        }),
        this.prisma.mccOnboardingSubmission.findFirst({
          orderBy: { created_at: 'desc' },
          select: { created_at: true, business_name: true },
        }),
        this.prisma.milkSale.findFirst({
          where: { sale_at: { gte: bounds.gte, lte: bounds.lte }, status: { not: 'deleted' } },
          orderBy: { sale_at: 'desc' },
          select: {
            sale_at: true,
            quantity: true,
            supplier_account: { select: { name: true } },
          },
        }),
      ]);

    const locationIds = [...new Set(onboardingRowsRaw.map((r) => r.location_province_id).filter((v): v is string => !!v))];
    const provinceRows = locationIds.length
      ? await this.prisma.location.findMany({
          where: { id: { in: locationIds.filter((id) => AdminService.LOCATION_UUID_RE.test(id)) } },
          select: { id: true, name: true },
        })
      : [];
    const provinceMap = new Map(provinceRows.map((r) => [r.id, r.name]));

    const onboardingQueue = onboardingRowsRaw.map((r) => {
      const mapped = this.onboardingStatusText(r.review_status);
      const province = r.location_province_id
        ? provinceMap.get(r.location_province_id) ?? r.location_province_id
        : '—';
      return {
        id: r.id,
        applicant: r.common_name || r.business_name,
        region: province,
        appliedOn: this.formatHumanDate(r.created_at),
        status: mapped.status,
        statusTone: mapped.tone,
      };
    });

    const topForWidgets = mccRows.slice(0, 5);
    const topQualityRows = qualityRows.slice(0, 5);
    const maxLitersToday = Math.max(1, ...topForWidgets.map((r) => Number(r.liters_today || 0)));
    const maxGateLitersToday = Math.max(1, ...topQualityRows.map((r) => Number(r.liters_today || 0)));
    const maxSales = Math.max(1, ...topForWidgets.map((r) => Number(r.sales_rf || 0)));
    const maxTxns = Math.max(1, ...topForWidgets.map((r) => Number(r.total_txns || 0)));

    const collectionsByMcc = topForWidgets.map((r) => ({
      mcc: r.mcc,
      collections_liters: Number(r.collections_liters || 0),
      sales_rf: Number(r.sales_rf || 0),
    }));

    const healthRows =
      topQualityRows.length > 0
        ? topQualityRows.map((r) => {
            const manifestsSubmitted = Math.max(0, Number(r.manifests_submitted || 0));
            const manifestsAccepted = Math.max(0, Number(r.manifests_accepted || 0));
            const testsTotal = Math.max(0, Number(r.tests_total || 0));
            const testsRejected = Math.max(0, Number(r.tests_rejected || 0));
            const manifestPct = manifestsSubmitted > 0
              ? Number(((manifestsAccepted / manifestsSubmitted) * 100).toFixed(1))
              : Number((manifestsAccepted > 0 ? 100 : 0).toFixed(1));
            const rejectionBase =
              testsTotal > 0
                ? (testsRejected / testsTotal) * 100
                : manifestsSubmitted > 0
                  ? (Number(r.manifests_rejected || 0) / manifestsSubmitted) * 100
                  : 0;
            const rejectionPctNum = Number(rejectionBase.toFixed(1));
            const tankPct = Math.round(
              this.clamp((Number(r.liters_today || 0) / maxGateLitersToday) * 100, 48, 95),
            );
            const alerts =
              testsRejected >= 6 || rejectionPctNum >= 7 ? 5
                : testsRejected >= 3 || rejectionPctNum >= 4.5 ? 3
                  : rejectionPctNum >= 2.5 ? 1
                    : 0;
            return {
              accountId: r.account_id,
              mcc: r.mcc,
              litersToday: `${new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(Number(r.liters_today || 0))} L`,
              manifestPct,
              rejectionPct: rejectionPctNum,
              tankPct,
              alerts,
              health: this.healthLabel(rejectionPctNum, tankPct),
            };
          })
        : topForWidgets.map((r) => {
            const totalTx = Math.max(1, Number(r.total_txns || 0));
            const rejectionPct = Number(((Number(r.rejected_txns || 0) / totalTx) * 100).toFixed(1));
            const manifestPct = Number((100 - rejectionPct * 1.6).toFixed(1));
            const tankPct = Math.round(this.clamp((Number(r.liters_today || 0) / maxLitersToday) * 100, 52, 95));
            const alerts = rejectionPct >= 5 ? 4 : rejectionPct >= 3 ? 2 : rejectionPct >= 1.6 ? 1 : 0;
            return {
              accountId: r.account_id,
              mcc: r.mcc,
              litersToday: `${new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(Number(r.liters_today || 0))} L`,
              manifestPct,
              rejectionPct,
              tankPct,
              alerts,
              health: this.healthLabel(rejectionPct, tankPct),
            };
          });

    const healthAccountIds = [...new Set(healthRows.map((r) => r.accountId).filter(Boolean))];
    const healthUserLinks = healthAccountIds.length
      ? await this.prisma.userAccount.findMany({
          where: {
            account_id: { in: healthAccountIds },
            status: 'active',
          },
          select: {
            account_id: true,
            user_id: true,
            created_at: true,
          },
          orderBy: { created_at: 'asc' },
        })
      : [];
    const firstUserByAccount = new Map<string, string>();
    for (const link of healthUserLinks) {
      if (!firstUserByAccount.has(link.account_id)) {
        firstUserByAccount.set(link.account_id, link.user_id);
      }
    }

    const adoptionAccountIds = [...new Set(healthRows.map((r) => r.accountId).filter(Boolean))];
    const [milkCounts, payrollCounts, manifestCounts, loanCounts, inventoryCountsRaw] =
      adoptionAccountIds.length > 0
        ? await Promise.all([
            this.prisma.mccGateDelivery.groupBy({
              by: ['mcc_account_id'],
              where: {
                mcc_account_id: { in: adoptionAccountIds },
                arrived_at: { gte: bounds.gte, lte: bounds.lte },
              },
              _count: true,
            }).catch((error) => this.optionalRelationFallback(error, [])),
            this.prisma.payrollRun.groupBy({
              by: ['account_id'],
              where: {
                account_id: { in: adoptionAccountIds },
                run_date: { gte: bounds.gte, lte: bounds.lte },
                status: 'completed',
              },
              _count: true,
            }),
            this.prisma.mccMilkManifest.groupBy({
              by: ['mcc_account_id'],
              where: {
                mcc_account_id: { in: adoptionAccountIds },
                created_at: { gte: bounds.gte, lte: bounds.lte },
              },
              _count: true,
            }).catch((error) => this.optionalRelationFallback(error, [])),
            this.prisma.loan.groupBy({
              by: ['lender_account_id'],
              where: {
                lender_account_id: { in: adoptionAccountIds },
                disbursement_date: { gte: bounds.gte, lte: bounds.lte },
              },
              _count: true,
            }),
            this.prisma.$queryRaw<Array<{ account_id: string; c: bigint }>>(
              Prisma.sql`
                SELECT p.account_id::text AS account_id, COUNT(*)::bigint AS c
                FROM inventory_sales s
                INNER JOIN products p ON p.id = s.product_id
                WHERE p.account_id IS NOT NULL
                  AND p.account_id::text IN (${Prisma.join(adoptionAccountIds)})
                  AND s.sale_date >= ${bounds.gte}
                  AND s.sale_date <= ${bounds.lte}
                GROUP BY p.account_id
              `,
            ),
          ])
        : [[], [], [], [], []];

    const milkEntries: Array<[string, number]> = [];
    for (const r of milkCounts) {
      if (!r.mcc_account_id) continue;
      milkEntries.push([r.mcc_account_id, this.normalizeGroupCount(r)]);
    }
    const milkByAccount = new Map<string, number>(milkEntries);
    const payrollEntries: Array<[string, number]> = [];
    for (const r of payrollCounts) {
      if (!r.account_id) continue;
      payrollEntries.push([r.account_id, this.normalizeGroupCount(r)]);
    }
    const payrollByAccount = new Map<string, number>(payrollEntries);
    const manifestEntries: Array<[string, number]> = [];
    for (const r of manifestCounts) {
      if (!r.mcc_account_id) continue;
      manifestEntries.push([r.mcc_account_id, this.normalizeGroupCount(r)]);
    }
    const manifestByAccount = new Map<string, number>(manifestEntries);
    const loanByAccount = new Map(
      loanCounts.map((r) => [r.lender_account_id, this.normalizeGroupCount(r)]),
    );
    const inventoryByAccount = new Map(inventoryCountsRaw.map((r) => [r.account_id, Number(r.c ?? 0n)]));

    const maxMilkCount = Math.max(1, ...Array.from(milkByAccount.values(), (v) => Number(v || 0)));
    const maxUsageCount = Math.max(1, ...Array.from(manifestByAccount.values(), (v) => Number(v || 0)));
    const maxLoanCount = Math.max(1, ...Array.from(loanByAccount.values(), (v) => Number(v || 0)));
    const maxInventoryCount = Math.max(1, ...Array.from(inventoryByAccount.values(), (v) => Number(v || 0)));
    const maxFinanceComposite = Math.max(
      1,
      ...adoptionAccountIds.map((id) => (Number(payrollByAccount.get(id) ?? 0) * 1.25) + Number(loanByAccount.get(id) ?? 0)),
    );

    const adoptionPct = (count: number, maxCount: number, floor = 34): number => {
      if (count <= 0) return 0;
      return Math.round(this.clamp(floor + (count / Math.max(1, maxCount)) * (100 - floor), floor, 99));
    };

    const adoption = healthRows.slice(0, 3).map((row) => {
      const id = row.accountId;
      const milkCount = Number(milkByAccount.get(id) ?? 0);
      const usageCount = Number(manifestByAccount.get(id) ?? 0);
      const inventoryCount = Number(inventoryByAccount.get(id) ?? 0);
      const loanCount = Number(loanByAccount.get(id) ?? 0);
      const payrollCount = Number(payrollByAccount.get(id) ?? 0);
      const financeComposite = payrollCount * 1.25 + loanCount;

      return {
        accountId: id,
        userId: id ? firstUserByAccount.get(id) : undefined,
        mcc: row.mcc,
        milk: adoptionPct(milkCount, maxMilkCount, 46),
        finance: adoptionPct(financeComposite, maxFinanceComposite, 38),
        usage: adoptionPct(usageCount, maxUsageCount, 34),
        inventory: adoptionPct(inventoryCount, maxInventoryCount, 28),
        loans: adoptionPct(loanCount, maxLoanCount, 30),
      };
    });

    const alerts: Array<{ id: string; severity: 'high' | 'medium' | 'info'; title: string; when: string }> = [];
    healthRows
      .filter((r) => r.rejectionPct >= 2.5)
      .forEach((r) => {
        if (r.rejectionPct >= 4.5) {
          alerts.push({
            id: `rej-${r.accountId}`,
            severity: r.rejectionPct >= 6 ? 'high' : 'medium',
            title: `${r.mcc}: rejection rate ${r.rejectionPct.toFixed(1)}% in selected window`,
            when: 'Live',
          });
        } else {
          alerts.push({
            id: `rej-med-${r.accountId}`,
            severity: 'medium',
            title: `${r.mcc}: rejection trend is above baseline (${r.rejectionPct.toFixed(1)}%)`,
            when: 'Live',
          });
        }
      });
    if (pendingOnboarding > 0) {
      alerts.push({
        id: 'onboarding-pending',
        severity: pendingOnboarding > 12 ? 'high' : 'info',
        title: `${pendingOnboarding} onboarding submissions are pending review`,
        when: 'Live',
      });
    }

    const activityRaw: Array<{ id: string; label: string; actor: string; whenDate: Date | null }> = [
      latestPayroll
        ? {
            id: 'payroll',
            label: 'Payroll completed',
            actor: `RF ${new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(Number(latestPayroll.total_amount || 0))}`,
            whenDate: latestPayroll.run_date,
          }
        : { id: 'payroll', label: '', actor: '', whenDate: null },
      latestLoan
        ? {
            id: 'loan',
            label: 'Disbursement recorded',
            actor: `RF ${new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(Number(latestLoan.principal || 0))}`,
            whenDate: latestLoan.disbursement_date,
          }
        : { id: 'loan', label: '', actor: '', whenDate: null },
      latestOnboarding
        ? {
            id: 'onboarding',
            label: 'New onboarding submission',
            actor: latestOnboarding.business_name,
            whenDate: latestOnboarding.created_at,
          }
        : { id: 'onboarding', label: '', actor: '', whenDate: null },
      latestMilk
        ? {
            id: 'milk',
            label: 'Collection captured',
            actor: `${latestMilk.supplier_account?.name ?? 'Supplier'} · ${new Intl.NumberFormat('en-RW', {
              maximumFractionDigits: 0,
            }).format(Number(latestMilk.quantity || 0))} L`,
            whenDate: latestMilk.sale_at,
          }
        : { id: 'milk', label: '', actor: '', whenDate: null },
    ];

    const activity = activityRaw
      .filter((a) => a.whenDate)
      .sort((a, b) => (b.whenDate?.getTime() ?? 0) - (a.whenDate?.getTime() ?? 0))
      .slice(0, 3)
      .map((a) => ({
        id: a.id,
        label: a.label,
        actor: a.actor,
        when: this.relativeWhen(a.whenDate as Date),
      }));

    return {
      collectionsByMcc,
      healthRows: healthRows.map((row) => ({
        accountId: row.accountId,
        userId: row.accountId ? firstUserByAccount.get(row.accountId) : undefined,
        mcc: row.mcc,
        litersToday: row.litersToday,
        manifestPct: row.manifestPct,
        rejectionPct: row.rejectionPct,
        tankPct: row.tankPct,
        alerts: row.alerts,
        health: row.health,
      })),
      onboardingQueue,
      alerts: alerts.slice(0, 3),
      adoption,
      activity,
      pendingOnboarding,
    };
  }

  /**
   * Get dashboard statistics with comprehensive metrics (platform-wide milk KPIs).
   * Milk charts, summary liters/revenue, sales-by-status, and recent rows respect `date_from`/`date_to`
   * with optional `tz_offset_minutes` aligned to POST /stats/overview (browser `-Date.getTimezoneOffset()`).
   */
  async getDashboardStats(
    user: User,
    accountId: string,
    dateFrom?: string,
    dateTo?: string,
    tzOffsetMinutes?: number,
  ) {
    await this.checkAdminPermission(user, accountId, 'dashboard.view');

    const now = new Date();
    const todayStartUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const last30DaysUtc = new Date(todayStartUtc.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last7DaysUtc = new Date(todayStartUtc.getTime() - 7 * 24 * 60 * 60 * 1000);

    const saleBounds = this.resolveAdminDashboardPeriodBounds(dateFrom, dateTo, tzOffsetMinutes);
    const overviewDataPromise = this.buildLiveOverviewData(saleBounds);

    const milkBase = { status: { not: 'deleted' as const } };

    const milkInPeriod: Prisma.MilkSaleWhereInput = {
      ...milkBase,
      sale_at: { gte: saleBounds.gte, lte: saleBounds.lte },
    };

    const [
      supplierActorRows,
      customerActorRows,
      totalUsers,
      activeUsers,
      totalAccounts,
      totalMccUsers,
      salesInPeriod,
      roll30Rows,
      roll7Rows,
      todayRows,
      salesByStatus,
      recentSales,
      rejectedMilkCount,
      rejectedMilkLitersAgg,
      overview,
    ] = await Promise.all([
      this.prisma.supplierCustomer.findMany({
        where: { relationship_status: 'active' },
        distinct: ['supplier_account_id'],
        select: { supplier_account_id: true },
      }),
      this.prisma.supplierCustomer.findMany({
        where: { relationship_status: 'active' },
        distinct: ['customer_account_id'],
        select: { customer_account_id: true },
      }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'active' } }),
      this.prisma.account.count({ where: { status: 'active' } }),
      this.prisma.user.count({ where: { status: 'active', account_type: 'mcc' } }),
      this.prisma.milkSale.findMany({
        where: milkInPeriod,
        select: {
          quantity: true,
          unit_price: true,
          sale_at: true,
        },
      }),
      this.prisma.milkSale.findMany({
        where: { ...milkBase, sale_at: { gte: last30DaysUtc } },
        select: { quantity: true, unit_price: true },
      }),
      this.prisma.milkSale.findMany({
        where: { ...milkBase, sale_at: { gte: last7DaysUtc } },
        select: { quantity: true, unit_price: true },
      }),
      this.prisma.milkSale.findMany({
        where: { ...milkBase, sale_at: { gte: todayStartUtc } },
        select: { quantity: true, unit_price: true },
      }),
      this.prisma.milkSale.groupBy({
        by: ['status'],
        where: milkInPeriod,
        _count: true,
      }),
      this.prisma.milkSale.findMany({
        where: milkInPeriod,
        take: 10,
        orderBy: { sale_at: 'desc' },
        select: {
          id: true,
          quantity: true,
          unit_price: true,
          status: true,
          sale_at: true,
          supplier_account: {
            select: { name: true },
          },
          customer_account: {
            select: { name: true },
          },
        },
      }),
      this.prisma.milkSale.count({
        where: {
          status: 'rejected',
          sale_at: { gte: saleBounds.gte, lte: saleBounds.lte },
        },
      }),
      this.prisma.milkSale.aggregate({
        where: {
          status: 'rejected',
          sale_at: { gte: saleBounds.gte, lte: saleBounds.lte },
        },
        _sum: { quantity: true },
      }),
      overviewDataPromise,
    ]);

    const totalSuppliers = supplierActorRows.length;
    const totalCustomers = customerActorRows.length;

    const sumQtyValue = (rows: { quantity: unknown; unit_price: unknown }[]) =>
      rows.reduce(
        (acc, sale) => ({
          liters: acc.liters + Number(sale.quantity),
          revenue: acc.revenue + Number(sale.quantity) * Number(sale.unit_price),
        }),
        { liters: 0, revenue: 0 },
      );

    const roll30 = sumQtyValue(roll30Rows);
    const roll7 = sumQtyValue(roll7Rows);
    const rollToday = sumQtyValue(todayRows);

    const periodTotals = sumQtyValue(salesInPeriod);
    const salesInRange = salesInPeriod.length;
    const litersInRange = periodTotals.liters;
    const revenueInRange = periodTotals.revenue;

    const dateKeys = utcCalendarDatesBetweenInclusive(saleBounds.gte, saleBounds.lte);
    const dailyBreakdown = new Map<string, { date: string; revenue: number; sales: number }>();
    for (const dateStr of dateKeys) {
      dailyBreakdown.set(dateStr, { date: dateStr, revenue: 0, sales: 0 });
    }
    for (const sale of salesInPeriod) {
      const dateStr = new Date(sale.sale_at).toISOString().split('T')[0];
      const dayData = dailyBreakdown.get(dateStr);
      if (dayData) {
        dayData.revenue += Number(sale.quantity) * Number(sale.unit_price);
        dayData.sales += Number(sale.quantity);
      }
    }

    const dailyTrend = Array.from(dailyBreakdown.values()).map((day) => ({
      date: day.date,
      label: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue: day.revenue,
      sales: day.sales,
    }));

    return {
      code: 200,
      status: 'success',
      message: 'Dashboard statistics retrieved successfully.',
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: totalUsers - activeUsers,
        },
        accounts: {
          total: totalAccounts,
          /** Active users with `users.account_type = mcc` (platform MCC operators/staff). */
          mcc_users: totalMccUsers,
        },
        sales: {
          total: salesInRange,
          liters: litersInRange,
          last30Days: roll30Rows.length,
          last7Days: roll7Rows.length,
          today: todayRows.length,
        },
        collections: {
          total: salesInRange,
        },
        rejections: {
          transactions: rejectedMilkCount,
          liters: Number(rejectedMilkLitersAgg._sum.quantity ?? 0),
        },
        suppliers: {
          total: totalSuppliers,
        },
        customers: {
          total: totalCustomers,
        },
        revenue: {
          total: revenueInRange,
          last30Days: roll30.revenue,
          last7Days: roll7.revenue,
          today: rollToday.revenue,
        },
        trends: {
          daily: dailyTrend,
        },
        salesByStatus: salesByStatus.map((s) => ({
          status: s.status,
          count: s._count,
        })),
        recentSales: recentSales.map((sale) => ({
          id: sale.id,
          quantity: Number(sale.quantity),
          unitPrice: Number(sale.unit_price),
          total: Number(sale.quantity) * Number(sale.unit_price),
          status: sale.status,
          date: sale.sale_at.toISOString(),
          supplier: sale.supplier_account?.name || 'N/A',
          customer: sale.customer_account?.name || 'N/A',
        })),
        overview: {
          pendingOnboarding: overview.pendingOnboarding,
          collectionsByMcc: overview.collectionsByMcc,
          healthRows: overview.healthRows,
          onboardingQueue: overview.onboardingQueue,
          alerts: overview.alerts,
          adoption: overview.adoption,
          activity: overview.activity,
        },
      },
    };
  }

  /**
   * Platform-wide finance KPIs for Gemura Admin (loans, payroll, milk payments recorded, inventory sales).
   * Respects the same period window as `getDashboardStats`.
   */
  async getFinanceDashboardStats(
    user: User,
    accountId: string,
    dateFrom?: string,
    dateTo?: string,
    tzOffsetMinutes?: number,
  ) {
    await this.checkAdminPermission(user, accountId, 'dashboard.view');

    const bounds = this.resolveAdminDashboardPeriodBounds(dateFrom, dateTo, tzOffsetMinutes);
    const dateFilter = { gte: bounds.gte, lte: bounds.lte };

    const [
      disburseAgg,
      repaymentAgg,
      payrollAgg,
      milkPaidAgg,
      inventoryAgg,
      portfolioAgg,
      disbursedLoansForTrend,
      repaymentsForTrend,
      payrollRunsForTrend,
      inventorySalesForTrend,
      loansByStatus,
      recentDisbursements,
    ] = await Promise.all([
      this.prisma.loan.aggregate({
        where: { disbursement_date: dateFilter },
        _sum: { principal: true },
        _count: { id: true },
      }),
      this.prisma.loanRepayment.aggregate({
        where: { repayment_date: dateFilter },
        _sum: { amount: true },
        _count: { id: true },
      }),
      this.prisma.payrollRun.aggregate({
        where: {
          run_date: dateFilter,
          status: 'completed',
        },
        _sum: { total_amount: true },
        _count: { id: true },
      }),
      this.prisma.milkSale.aggregate({
        where: {
          status: { not: 'deleted' },
          sale_at: dateFilter,
        },
        _sum: { amount_paid: true },
      }),
      this.prisma.inventorySale.aggregate({
        where: { sale_date: dateFilter },
        _sum: { total_amount: true },
        _count: { id: true },
      }),
      this.prisma.loan.aggregate({
        where: { status: 'active' },
        _sum: { principal: true, amount_repaid: true },
        _count: { id: true },
      }),
      this.prisma.loan.findMany({
        where: { disbursement_date: dateFilter },
        select: { disbursement_date: true, principal: true },
      }),
      this.prisma.loanRepayment.findMany({
        where: { repayment_date: dateFilter },
        select: { repayment_date: true, amount: true },
      }),
      this.prisma.payrollRun.findMany({
        where: { run_date: dateFilter, status: 'completed' },
        select: { run_date: true, total_amount: true },
      }),
      this.prisma.inventorySale.findMany({
        where: { sale_date: dateFilter },
        select: { sale_date: true, total_amount: true },
      }),
      this.prisma.loan.groupBy({
        by: ['status'],
        where: { disbursement_date: dateFilter },
        _count: { id: true },
      }),
      this.prisma.loan.findMany({
        where: { disbursement_date: dateFilter },
        orderBy: { disbursement_date: 'desc' },
        take: 8,
        select: {
          id: true,
          principal: true,
          status: true,
          disbursement_date: true,
          borrower_name: true,
          borrower_account: { select: { name: true } },
          lender_account: { select: { name: true } },
        },
      }),
    ]);

    const principalOutstanding =
      Number(portfolioAgg._sum.principal ?? 0) - Number(portfolioAgg._sum.amount_repaid ?? 0);

    const dateKeys = utcCalendarDatesBetweenInclusive(bounds.gte, bounds.lte);
    const dailyMap = new Map<
      string,
      { disbursements: number; repayments: number; payroll: number; inventory_sales: number }
    >();
    for (const d of dateKeys) {
      dailyMap.set(d, { disbursements: 0, repayments: 0, payroll: 0, inventory_sales: 0 });
    }

    const addToDay = (
      at: Date,
      field: 'disbursements' | 'repayments' | 'payroll' | 'inventory_sales',
      amount: number,
    ) => {
      const key = at.toISOString().split('T')[0];
      const cell = dailyMap.get(key);
      if (cell) cell[field] += amount;
    };

    for (const row of disbursedLoansForTrend) {
      addToDay(row.disbursement_date, 'disbursements', Number(row.principal));
    }
    for (const row of repaymentsForTrend) {
      addToDay(row.repayment_date, 'repayments', Number(row.amount));
    }
    for (const row of payrollRunsForTrend) {
      addToDay(row.run_date, 'payroll', Number(row.total_amount));
    }
    for (const row of inventorySalesForTrend) {
      addToDay(row.sale_date, 'inventory_sales', Number(row.total_amount));
    }

    const breakdown = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateStr, v]) => ({
        date: dateStr,
        label: new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        disbursements: v.disbursements,
        repayments: v.repayments,
        payroll: v.payroll,
        inventory_sales: v.inventory_sales,
      }));

    return {
      code: 200,
      status: 'success',
      message: 'Finance dashboard statistics retrieved successfully.',
      data: {
        summary: {
          disbursements: {
            amount: Number(disburseAgg._sum.principal ?? 0),
            count: disburseAgg._count.id,
          },
          repayments: {
            amount: Number(repaymentAgg._sum.amount ?? 0),
            count: repaymentAgg._count.id,
          },
          payroll: {
            amount: Number(payrollAgg._sum.total_amount ?? 0),
            runs: payrollAgg._count.id,
          },
          milk_payments_recorded: {
            amount: Number(milkPaidAgg._sum.amount_paid ?? 0),
          },
          inventory_sales: {
            amount: Number(inventoryAgg._sum.total_amount ?? 0),
            count: inventoryAgg._count.id,
          },
          portfolio_active: {
            loan_count: portfolioAgg._count.id,
            principal_outstanding: principalOutstanding,
          },
        },
        loans_by_status: loansByStatus.map((s) => ({
          status: s.status,
          count: s._count.id,
        })),
        breakdown,
        recent_disbursements: recentDisbursements.map((row) => ({
          id: row.id,
          principal: Number(row.principal),
          status: row.status,
          disbursement_date: row.disbursement_date.toISOString(),
          borrower_label: row.borrower_account?.name ?? row.borrower_name ?? 'Borrower',
          lender_name: row.lender_account?.name ?? null,
        })),
      },
    };
  }

  /**
   * Platform-wide adoption & activity snapshot from existing tables (no separate analytics pipeline).
   * Uses the same period window as other admin dashboards.
   */
  async getUsageDashboardStats(
    user: User,
    accountId: string,
    dateFrom?: string,
    dateTo?: string,
    tzOffsetMinutes?: number,
  ) {
    await this.checkAdminPermission(user, accountId, 'dashboard.view');

    const bounds = this.resolveAdminDashboardPeriodBounds(dateFrom, dateTo, tzOffsetMinutes);
    const dateFilter = { gte: bounds.gte, lte: bounds.lte };

    const dayKey = (d: Date) => d.toISOString().split('T')[0];

    const [
      activePlatformUsers,
      usersLoggedInPeriod,
      usersRegisteredInPeriod,
      auditEventsCount,
      milkTxnCount,
      gateDeliveriesCount,
      payrollRunsCreated,
      linksCreated,
      feedPostsCount,
      inventorySalesCreatedCount,
      auditDistinctRows,
      milkOperatorsDistinctRows,
      auditDailyRows,
      milkDailyRows,
      gateDailyRows,
    ] = await Promise.all([
      this.prisma.user.count({ where: { status: 'active' } }),
      this.prisma.user.count({
        where: { status: 'active', last_login: dateFilter },
      }),
      this.prisma.user.count({ where: { created_at: dateFilter } }),
      this.prisma.auditLog.count({ where: { created_at: dateFilter } }),
      this.prisma.milkSale.count({
        where: { sale_at: dateFilter, status: { not: 'deleted' } },
      }),
      this.prisma.mccGateDelivery
        .count({ where: { arrived_at: dateFilter } })
        .catch((error) => this.optionalRelationFallback(error, 0)),
      this.prisma.payrollRun.count({ where: { created_at: dateFilter } }),
      this.prisma.supplierCustomer.count({ where: { created_at: dateFilter } }),
      this.prisma.feedPost.count({
        where: { created_at: dateFilter, status: 'active' },
      }),
      this.prisma.inventorySale.count({ where: { created_at: dateFilter } }),
      this.prisma.$queryRaw<[{ c: bigint }]>(
        Prisma.sql`
          SELECT COUNT(DISTINCT user_id)::bigint AS c
          FROM audit_logs
          WHERE created_at >= ${bounds.gte}
            AND created_at <= ${bounds.lte}
            AND user_id IS NOT NULL
        `,
      ),
      this.prisma.$queryRaw<[{ c: bigint }]>(
        Prisma.sql`
          SELECT COUNT(DISTINCT recorded_by)::bigint AS c
          FROM milk_sales
          WHERE sale_at >= ${bounds.gte}
            AND sale_at <= ${bounds.lte}
            AND status::text <> 'deleted'
        `,
      ),
      this.prisma.$queryRaw<Array<{ d: Date; events: bigint; users: bigint }>>(
        Prisma.sql`
          SELECT (created_at AT TIME ZONE 'UTC')::date AS d,
                 COUNT(*)::bigint AS events,
                 COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)::bigint AS users
          FROM audit_logs
          WHERE created_at >= ${bounds.gte}
            AND created_at <= ${bounds.lte}
          GROUP BY 1
          ORDER BY 1
        `,
      ),
      this.prisma.$queryRaw<Array<{ d: Date; txns: bigint; ops: bigint }>>(
        Prisma.sql`
          SELECT (sale_at AT TIME ZONE 'UTC')::date AS d,
                 COUNT(*)::bigint AS txns,
                 COUNT(DISTINCT recorded_by)::bigint AS ops
          FROM milk_sales
          WHERE sale_at >= ${bounds.gte}
            AND sale_at <= ${bounds.lte}
            AND status::text <> 'deleted'
          GROUP BY 1
          ORDER BY 1
        `,
      ),
      this.prisma.$queryRaw<Array<{ d: Date; n: bigint }>>(
        Prisma.sql`
          SELECT (arrived_at AT TIME ZONE 'UTC')::date AS d,
                 COUNT(*)::bigint AS n
          FROM mcc_gate_deliveries
          WHERE arrived_at >= ${bounds.gte}
            AND arrived_at <= ${bounds.lte}
          GROUP BY 1
          ORDER BY 1
        `,
      ).catch((error) => this.optionalRelationFallback(error, [])),
    ]);

    const auditDistinctUsers = Number(auditDistinctRows[0]?.c ?? 0n);
    const milkDistinctOperators = Number(milkOperatorsDistinctRows[0]?.c ?? 0n);

    const auditMap = new Map<string, { events: number; users: number }>();
    for (const r of auditDailyRows) {
      const k = dayKey(new Date(r.d));
      auditMap.set(k, { events: Number(r.events), users: Number(r.users) });
    }
    const milkMap = new Map<string, { txns: number; ops: number }>();
    for (const r of milkDailyRows) {
      const k = dayKey(new Date(r.d));
      milkMap.set(k, { txns: Number(r.txns), ops: Number(r.ops) });
    }
    const gateMap = new Map<string, number>();
    for (const r of gateDailyRows) {
      gateMap.set(dayKey(new Date(r.d)), Number(r.n));
    }

    const dateKeys = utcCalendarDatesBetweenInclusive(bounds.gte, bounds.lte);
    const breakdown = dateKeys.map((dateStr) => ({
      date: dateStr,
      label: new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      audit_events: auditMap.get(dateStr)?.events ?? 0,
      audit_users: auditMap.get(dateStr)?.users ?? 0,
      milk_transactions: milkMap.get(dateStr)?.txns ?? 0,
      milk_operators: milkMap.get(dateStr)?.ops ?? 0,
      gate_deliveries: gateMap.get(dateStr) ?? 0,
    }));

    return {
      code: 200,
      status: 'success',
      message: 'Usage dashboard statistics retrieved successfully.',
      data: {
        summary: {
          users: {
            active_platform_total: activePlatformUsers,
            last_login_in_period: usersLoggedInPeriod,
            registered_in_period: usersRegisteredInPeriod,
          },
          audit: {
            events: auditEventsCount,
            distinct_users: auditDistinctUsers,
          },
          milk: {
            transactions: milkTxnCount,
            distinct_operators: milkDistinctOperators,
          },
          mcc_gate_deliveries: gateDeliveriesCount,
          payroll_runs_created: payrollRunsCreated,
          supplier_customer_links_created: linksCreated,
          feed_posts_created: feedPostsCount,
          inventory_sales_created: inventorySalesCreatedCount,
        },
        breakdown,
      },
    };
  }

  /** Paginated milk sales for Gemura Admin drill-down (matches dashboard period semantics). */
  async listPlatformMilkSales(
    user: User,
    accountId: string,
    opts: {
      page: number;
      limit: number;
      scope: 'collections' | 'rejections';
      dateFrom?: string;
      dateTo?: string;
      tzOffsetMinutes?: number;
    },
  ) {
    await this.checkAdminPermission(user, accountId, 'dashboard.view');
    const bounds = this.resolveAdminDashboardPeriodBounds(opts.dateFrom, opts.dateTo, opts.tzOffsetMinutes);
    const skip = (opts.page - 1) * opts.limit;
    const where: Prisma.MilkSaleWhereInput =
      opts.scope === 'rejections'
        ? {
            status: 'rejected',
            sale_at: { gte: bounds.gte, lte: bounds.lte },
          }
        : {
            status: { not: 'deleted' },
            sale_at: { gte: bounds.gte, lte: bounds.lte },
          };

    const [rows, total] = await Promise.all([
      this.prisma.milkSale.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: { sale_at: 'desc' },
        select: {
          id: true,
          quantity: true,
          unit_price: true,
          status: true,
          sale_at: true,
          amount_paid: true,
          supplier_account: { select: { id: true, name: true, code: true } },
          customer_account: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.milkSale.count({ where }),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Milk transactions retrieved successfully.',
      data: {
        scope: opts.scope,
        period: { start: bounds.gte.toISOString(), end: bounds.lte.toISOString() },
        rows: rows.map((r) => ({
          id: r.id,
          quantity: Number(r.quantity),
          unit_price: Number(r.unit_price),
          amount_paid: Number(r.amount_paid),
          status: r.status,
          sale_at: r.sale_at.toISOString(),
          supplier_name: r.supplier_account?.name ?? null,
          supplier_code: r.supplier_account?.code ?? null,
          customer_name: r.customer_account?.name ?? null,
          customer_code: r.customer_account?.code ?? null,
        })),
        pagination: {
          page: opts.page,
          limit: opts.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / opts.limit)),
        },
      },
    };
  }

  /** Active loans (portfolio) or loans disbursed in the dashboard period. */
  async listPlatformLoans(
    user: User,
    accountId: string,
    opts: {
      page: number;
      limit: number;
      mode: 'active_portfolio' | 'disbursed_in_period';
      dateFrom?: string;
      dateTo?: string;
      tzOffsetMinutes?: number;
    },
  ) {
    await this.checkAdminPermission(user, accountId, 'dashboard.view');
    const skip = (opts.page - 1) * opts.limit;
    const where: Prisma.LoanWhereInput =
      opts.mode === 'active_portfolio'
        ? { status: 'active' }
        : (() => {
            const bounds = this.resolveAdminDashboardPeriodBounds(opts.dateFrom, opts.dateTo, opts.tzOffsetMinutes);
            return { disbursement_date: { gte: bounds.gte, lte: bounds.lte } };
          })();

    const [rows, total] = await Promise.all([
      this.prisma.loan.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: { disbursement_date: 'desc' },
        select: {
          id: true,
          principal: true,
          amount_repaid: true,
          status: true,
          disbursement_date: true,
          borrower_name: true,
          borrower_account: { select: { name: true, code: true } },
          lender_account: { select: { name: true, code: true } },
        },
      }),
      this.prisma.loan.count({ where }),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Loans retrieved successfully.',
      data: {
        mode: opts.mode,
        rows: rows.map((r) => ({
          id: r.id,
          principal: Number(r.principal),
          amount_repaid: Number(r.amount_repaid),
          status: r.status,
          disbursement_date: r.disbursement_date.toISOString(),
          borrower_label: r.borrower_account?.name ?? r.borrower_name ?? 'Borrower',
          borrower_code: r.borrower_account?.code ?? null,
          lender_name: r.lender_account?.name ?? null,
          lender_code: r.lender_account?.code ?? null,
        })),
        pagination: {
          page: opts.page,
          limit: opts.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / opts.limit)),
        },
      },
    };
  }

  async listPlatformLoanRepayments(
    user: User,
    accountId: string,
    opts: {
      page: number;
      limit: number;
      dateFrom?: string;
      dateTo?: string;
      tzOffsetMinutes?: number;
    },
  ) {
    await this.checkAdminPermission(user, accountId, 'dashboard.view');
    const bounds = this.resolveAdminDashboardPeriodBounds(opts.dateFrom, opts.dateTo, opts.tzOffsetMinutes);
    const skip = (opts.page - 1) * opts.limit;
    const where = { repayment_date: { gte: bounds.gte, lte: bounds.lte } };

    const [rows, total] = await Promise.all([
      this.prisma.loanRepayment.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: { repayment_date: 'desc' },
        select: {
          id: true,
          amount: true,
          repayment_date: true,
          source: true,
          loan: {
            select: {
              id: true,
              borrower_name: true,
              borrower_account: { select: { name: true, code: true } },
              lender_account: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.loanRepayment.count({ where }),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Loan repayments retrieved successfully.',
      data: {
        period: { start: bounds.gte.toISOString(), end: bounds.lte.toISOString() },
        rows: rows.map((r) => ({
          id: r.id,
          amount: Number(r.amount),
          repayment_date: r.repayment_date.toISOString(),
          source: r.source,
          loan_id: r.loan.id,
          borrower_label: r.loan.borrower_account?.name ?? r.loan.borrower_name ?? 'Borrower',
          lender_name: r.loan.lender_account?.name ?? null,
        })),
        pagination: {
          page: opts.page,
          limit: opts.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / opts.limit)),
        },
      },
    };
  }

  async listPlatformPayrollRuns(
    user: User,
    accountId: string,
    opts: {
      page: number;
      limit: number;
      dateFrom?: string;
      dateTo?: string;
      tzOffsetMinutes?: number;
    },
  ) {
    await this.checkAdminPermission(user, accountId, 'dashboard.view');
    const bounds = this.resolveAdminDashboardPeriodBounds(opts.dateFrom, opts.dateTo, opts.tzOffsetMinutes);
    const skip = (opts.page - 1) * opts.limit;
    const where = {
      run_date: { gte: bounds.gte, lte: bounds.lte },
      status: 'completed',
    };

    const [rows, total] = await Promise.all([
      this.prisma.payrollRun.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: { run_date: 'desc' },
        select: {
          id: true,
          run_name: true,
          run_date: true,
          total_amount: true,
          status: true,
          account: { select: { name: true, code: true } },
        },
      }),
      this.prisma.payrollRun.count({ where }),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Payroll runs retrieved successfully.',
      data: {
        period: { start: bounds.gte.toISOString(), end: bounds.lte.toISOString() },
        rows: rows.map((r) => ({
          id: r.id,
          run_name: r.run_name ?? 'Payroll run',
          run_date: r.run_date.toISOString(),
          total_amount: Number(r.total_amount),
          status: r.status,
          account_name: r.account?.name ?? null,
          account_code: r.account?.code ?? null,
        })),
        pagination: {
          page: opts.page,
          limit: opts.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / opts.limit)),
        },
      },
    };
  }

  async listPlatformInventorySales(
    user: User,
    accountId: string,
    opts: {
      page: number;
      limit: number;
      dateFrom?: string;
      dateTo?: string;
      tzOffsetMinutes?: number;
    },
  ) {
    await this.checkAdminPermission(user, accountId, 'dashboard.view');
    const bounds = this.resolveAdminDashboardPeriodBounds(opts.dateFrom, opts.dateTo, opts.tzOffsetMinutes);
    const skip = (opts.page - 1) * opts.limit;
    const where = { sale_date: { gte: bounds.gte, lte: bounds.lte } };

    const [rows, total] = await Promise.all([
      this.prisma.inventorySale.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: { sale_date: 'desc' },
        select: {
          id: true,
          quantity: true,
          unit_price: true,
          total_amount: true,
          sale_date: true,
          buyer_name: true,
          payment_status: true,
          product: { select: { name: true } },
          buyer_account: { select: { name: true, code: true } },
        },
      }),
      this.prisma.inventorySale.count({ where }),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Inventory sales retrieved successfully.',
      data: {
        period: { start: bounds.gte.toISOString(), end: bounds.lte.toISOString() },
        rows: rows.map((r) => ({
          id: r.id,
          quantity: Number(r.quantity),
          unit_price: Number(r.unit_price),
          total_amount: Number(r.total_amount),
          sale_date: r.sale_date.toISOString(),
          buyer_label: r.buyer_account?.name ?? r.buyer_name ?? 'Buyer',
          buyer_code: r.buyer_account?.code ?? null,
          product_name: r.product?.name ?? 'Product',
          payment_status: r.payment_status,
        })),
        pagination: {
          page: opts.page,
          limit: opts.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / opts.limit)),
        },
      },
    };
  }

  async listPlatformAuditLogs(
    user: User,
    accountId: string,
    opts: {
      page: number;
      limit: number;
      dateFrom?: string;
      dateTo?: string;
      tzOffsetMinutes?: number;
    },
  ) {
    await this.checkAdminPermission(user, accountId, 'dashboard.view');
    const bounds = this.resolveAdminDashboardPeriodBounds(opts.dateFrom, opts.dateTo, opts.tzOffsetMinutes);
    const skip = (opts.page - 1) * opts.limit;
    const where = { created_at: { gte: bounds.gte, lte: bounds.lte } };

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          entity_type: true,
          entity_id: true,
          action: true,
          user_id: true,
          created_at: true,
          ip_address: true,
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true, first_name: true, last_name: true },
          })
        : [];
    const userLabel = new Map(
      users.map((u) => [
        u.id,
        [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email || u.id,
      ]),
    );

    return {
      code: 200,
      status: 'success',
      message: 'Audit events retrieved successfully.',
      data: {
        period: { start: bounds.gte.toISOString(), end: bounds.lte.toISOString() },
        rows: rows.map((r) => ({
          id: r.id,
          entity_type: r.entity_type,
          entity_id: r.entity_id,
          action: r.action,
          user_id: r.user_id,
          user_label: r.user_id ? userLabel.get(r.user_id) ?? null : null,
          created_at: r.created_at.toISOString(),
          ip_address: r.ip_address,
        })),
        pagination: {
          page: opts.page,
          limit: opts.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / opts.limit)),
        },
      },
    };
  }

  /** Supplier charge definitions created or updated in the dashboard period (platform-wide). */
  async listPlatformCharges(
    user: User,
    accountId: string,
    opts: {
      page: number;
      limit: number;
      dateFrom?: string;
      dateTo?: string;
      tzOffsetMinutes?: number;
    },
  ) {
    await this.checkAdminPermission(user, accountId, 'dashboard.view');
    const bounds = this.resolveAdminDashboardPeriodBounds(opts.dateFrom, opts.dateTo, opts.tzOffsetMinutes);
    const skip = (opts.page - 1) * opts.limit;
    const where: Prisma.ChargeWhereInput = {
      OR: [
        { created_at: { gte: bounds.gte, lte: bounds.lte } },
        { updated_at: { gte: bounds.gte, lte: bounds.lte } },
      ],
    };

    const [rows, total] = await Promise.all([
      this.prisma.charge.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: { updated_at: 'desc' },
        select: {
          id: true,
          name: true,
          kind: true,
          amount_type: true,
          amount: true,
          recurrence: true,
          is_active: true,
          apply_to_all_suppliers: true,
          effective_from: true,
          effective_to: true,
          created_at: true,
          updated_at: true,
          customer_account: { select: { name: true, code: true } },
        },
      }),
      this.prisma.charge.count({ where }),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Charges retrieved successfully.',
      data: {
        period: { start: bounds.gte.toISOString(), end: bounds.lte.toISOString() },
        rows: rows.map((r) => ({
          id: r.id,
          name: r.name,
          kind: r.kind,
          amount_type: r.amount_type,
          amount: Number(r.amount),
          recurrence: r.recurrence,
          is_active: r.is_active,
          apply_to_all_suppliers: r.apply_to_all_suppliers,
          effective_from: r.effective_from?.toISOString() ?? null,
          effective_to: r.effective_to?.toISOString() ?? null,
          created_at: r.created_at.toISOString(),
          updated_at: r.updated_at.toISOString(),
          mcc_name: r.customer_account?.name ?? null,
          mcc_code: r.customer_account?.code ?? null,
        })),
        pagination: {
          page: opts.page,
          limit: opts.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / opts.limit)),
        },
      },
    };
  }

  /** New supplier–customer links created in the dashboard period. */
  async listPlatformSupplierCustomerLinks(
    user: User,
    accountId: string,
    opts: {
      page: number;
      limit: number;
      dateFrom?: string;
      dateTo?: string;
      tzOffsetMinutes?: number;
    },
  ) {
    await this.checkAdminPermission(user, accountId, 'dashboard.view');
    const bounds = this.resolveAdminDashboardPeriodBounds(opts.dateFrom, opts.dateTo, opts.tzOffsetMinutes);
    const skip = (opts.page - 1) * opts.limit;
    const where: Prisma.SupplierCustomerWhereInput = {
      created_at: { gte: bounds.gte, lte: bounds.lte },
    };

    const [rows, total] = await Promise.all([
      this.prisma.supplierCustomer.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          price_per_liter: true,
          relationship_status: true,
          created_at: true,
          supplier_account: { select: { name: true, code: true } },
          customer_account: { select: { name: true, code: true } },
        },
      }),
      this.prisma.supplierCustomer.count({ where }),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Supplier–customer links retrieved successfully.',
      data: {
        period: { start: bounds.gte.toISOString(), end: bounds.lte.toISOString() },
        rows: rows.map((r) => ({
          id: r.id,
          price_per_liter: Number(r.price_per_liter),
          relationship_status: r.relationship_status,
          created_at: r.created_at.toISOString(),
          supplier_name: r.supplier_account?.name ?? null,
          supplier_code: r.supplier_account?.code ?? null,
          customer_name: r.customer_account?.name ?? null,
          customer_code: r.customer_account?.code ?? null,
        })),
        pagination: {
          page: opts.page,
          limit: opts.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / opts.limit)),
        },
      },
    };
  }

  /** Chart-of-accounts journal batches dated in the dashboard period. */
  async listPlatformAccountingTransactions(
    user: User,
    accountId: string,
    opts: {
      page: number;
      limit: number;
      dateFrom?: string;
      dateTo?: string;
      tzOffsetMinutes?: number;
    },
  ) {
    await this.checkAdminPermission(user, accountId, 'dashboard.view');
    const bounds = this.resolveAdminDashboardPeriodBounds(opts.dateFrom, opts.dateTo, opts.tzOffsetMinutes);
    const skip = (opts.page - 1) * opts.limit;
    const where: Prisma.AccountingTransactionWhereInput = {
      transaction_date: { gte: bounds.gte, lte: bounds.lte },
    };

    const [rows, total] = await Promise.all([
      this.prisma.accountingTransaction.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: { transaction_date: 'desc' },
        select: {
          id: true,
          transaction_date: true,
          reference_number: true,
          description: true,
          total_amount: true,
          farm_id: true,
          created_at: true,
          _count: { select: { entries: true } },
        },
      }),
      this.prisma.accountingTransaction.count({ where }),
    ]);

    const farmIds = [...new Set(rows.map((r) => r.farm_id).filter(Boolean))] as string[];
    const farms =
      farmIds.length > 0
        ? await this.prisma.farm.findMany({
            where: { id: { in: farmIds } },
            select: { id: true, name: true, code: true },
          })
        : [];
    const farmLabel = new Map(farms.map((f) => [f.id, f.name || f.code || f.id]));

    return {
      code: 200,
      status: 'success',
      message: 'Accounting transactions retrieved successfully.',
      data: {
        period: { start: bounds.gte.toISOString(), end: bounds.lte.toISOString() },
        rows: rows.map((r) => ({
          id: r.id,
          transaction_date: r.transaction_date.toISOString(),
          reference_number: r.reference_number,
          description: r.description,
          total_amount: Number(r.total_amount),
          farm_id: r.farm_id,
          farm_name: r.farm_id ? farmLabel.get(r.farm_id) ?? null : null,
          entry_lines: r._count.entries,
          created_at: r.created_at.toISOString(),
        })),
        pagination: {
          page: opts.page,
          limit: opts.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / opts.limit)),
        },
      },
    };
  }

  /** MCC gate deliveries by arrival time in the dashboard period. */
  async listPlatformGateDeliveries(
    user: User,
    accountId: string,
    opts: {
      page: number;
      limit: number;
      dateFrom?: string;
      dateTo?: string;
      tzOffsetMinutes?: number;
    },
  ) {
    await this.checkAdminPermission(user, accountId, 'dashboard.view');
    const bounds = this.resolveAdminDashboardPeriodBounds(opts.dateFrom, opts.dateTo, opts.tzOffsetMinutes);
    const skip = (opts.page - 1) * opts.limit;
    const where: Prisma.MccGateDeliveryWhereInput = {
      arrived_at: { gte: bounds.gte, lte: bounds.lte },
    };

    const [rows, total] = await Promise.all([
      this.prisma.mccGateDelivery.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: { arrived_at: 'desc' },
        select: {
          id: true,
          source_type: true,
          gate_volume_litres: true,
          arrived_at: true,
          notes: true,
          mcc_account: { select: { name: true, code: true } },
          source_account: { select: { name: true, code: true } },
          recorded_by: { select: { first_name: true, last_name: true, email: true } },
        },
      }),
      this.prisma.mccGateDelivery.count({ where }),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Gate deliveries retrieved successfully.',
      data: {
        period: { start: bounds.gte.toISOString(), end: bounds.lte.toISOString() },
        rows: rows.map((r) => ({
          id: r.id,
          source_type: r.source_type,
          gate_volume_litres: Number(r.gate_volume_litres),
          arrived_at: r.arrived_at.toISOString(),
          notes: r.notes,
          mcc_name: r.mcc_account?.name ?? null,
          mcc_code: r.mcc_account?.code ?? null,
          source_name: r.source_account?.name ?? null,
          source_code: r.source_account?.code ?? null,
          recorded_by_label:
            [r.recorded_by.first_name, r.recorded_by.last_name].filter(Boolean).join(' ').trim() ||
            r.recorded_by.email ||
            null,
        })),
        pagination: {
          page: opts.page,
          limit: opts.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / opts.limit)),
        },
      },
    };
  }

  /** Umucunda milk manifests created in the dashboard period. */
  async listPlatformMilkManifests(
    user: User,
    accountId: string,
    opts: {
      page: number;
      limit: number;
      dateFrom?: string;
      dateTo?: string;
      tzOffsetMinutes?: number;
    },
  ) {
    await this.checkAdminPermission(user, accountId, 'dashboard.view');
    const bounds = this.resolveAdminDashboardPeriodBounds(opts.dateFrom, opts.dateTo, opts.tzOffsetMinutes);
    const skip = (opts.page - 1) * opts.limit;
    const where: Prisma.MccMilkManifestWhereInput = {
      created_at: { gte: bounds.gte, lte: bounds.lte },
    };

    const [rows, total] = await Promise.all([
      this.prisma.mccMilkManifest.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          manifest_ref: true,
          status: true,
          created_at: true,
          submitted_at: true,
          accepted_at: true,
          rejected_at: true,
          mcc_account: { select: { name: true, code: true } },
          umucunda_supplier: { select: { name: true, code: true } },
          gate_delivery: {
            select: { arrived_at: true, gate_volume_litres: true },
          },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.mccMilkManifest.count({ where }),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Milk manifests retrieved successfully.',
      data: {
        period: { start: bounds.gte.toISOString(), end: bounds.lte.toISOString() },
        rows: rows.map((r) => ({
          id: r.id,
          manifest_ref: r.manifest_ref,
          status: r.status,
          created_at: r.created_at.toISOString(),
          submitted_at: r.submitted_at?.toISOString() ?? null,
          accepted_at: r.accepted_at?.toISOString() ?? null,
          rejected_at: r.rejected_at?.toISOString() ?? null,
          line_count: r._count.lines,
          mcc_name: r.mcc_account?.name ?? null,
          mcc_code: r.mcc_account?.code ?? null,
          umucunda_name: r.umucunda_supplier?.name ?? null,
          umucunda_code: r.umucunda_supplier?.code ?? null,
          gate_arrived_at: r.gate_delivery?.arrived_at.toISOString() ?? null,
          gate_volume_litres: r.gate_delivery ? Number(r.gate_delivery.gate_volume_litres) : null,
        })),
        pagination: {
          page: opts.page,
          limit: opts.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / opts.limit)),
        },
      },
    };
  }

  private locationPathLabel(path: { name: string }[]): string {
    return path.map((p) => p.name).join(' → ');
  }

  private async resolveDistrictIdFromOperationalLocation(operationalLocationId: string | null): Promise<string | null> {
    if (!operationalLocationId) return null;
    const path = await this.locationsService.getPath(operationalLocationId);
    const d = path.find((p) => p.location_type === 'DISTRICT');
    return d?.id ?? null;
  }

  /** List platform accounts with optional district / supervisor filters (operational_district_id). Scoped for regional supervisors. */
  async listTenantAccountsForAdmin(
    user: User,
    accountId: string,
    opts: {
      page: number;
      limit: number;
      search?: string;
      account_type?: 'tenant' | 'branch' | 'admin' | 'all';
      district_location_id?: string;
      /** UUID of assigned supervisor, or the literal `unassigned`. */
      regional_supervisor_user_id?: string;
    },
  ) {
    const { canManageUsers, scopeDistrictIds } = await this.assertPlatformAccountDirectoryAccess(user, accountId);
    const skip = (opts.page - 1) * opts.limit;
    const typeFilter = opts.account_type;
    const types: AccountType[] =
      !typeFilter || typeFilter === 'all'
        ? [AccountType.tenant, AccountType.branch, AccountType.admin]
        : [typeFilter as AccountType];

    const districtRequested = opts.district_location_id?.trim() || undefined;
    let operationalDistrictWhere: Prisma.AccountWhereInput['operational_district_id'];

    if (canManageUsers) {
      operationalDistrictWhere = districtRequested ?? undefined;
    } else {
      const scoped = scopeDistrictIds ?? [];
      if (scoped.length === 0) {
        return {
          code: 200,
          status: 'success',
          message: 'Accounts retrieved.',
          data: {
            rows: [],
            pagination: {
              page: opts.page,
              limit: opts.limit,
              total: 0,
              totalPages: 1,
            },
          },
        };
      }
      if (districtRequested) {
        if (!scoped.includes(districtRequested)) {
          return {
            code: 200,
            status: 'success',
            message: 'Accounts retrieved.',
            data: {
              rows: [],
              pagination: {
                page: opts.page,
                limit: opts.limit,
                total: 0,
                totalPages: 1,
              },
            },
          };
        }
        operationalDistrictWhere = districtRequested;
      } else {
        operationalDistrictWhere = { in: scoped };
      }
    }

    const rsRaw = opts.regional_supervisor_user_id?.trim();
    const supervisorFilter =
      rsRaw === 'unassigned'
        ? ({ regional_supervisor_user_id: null } as const)
        : rsRaw && AdminService.LOCATION_UUID_RE.test(rsRaw)
          ? ({ regional_supervisor_user_id: rsRaw } as const)
          : null;

    const where: Prisma.AccountWhereInput = {
      type: types.length === 1 ? types[0] : { in: types },
      ...(opts.search?.trim()
        ? {
            OR: [
              { name: { contains: opts.search.trim(), mode: 'insensitive' } },
              { code: { contains: opts.search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(operationalDistrictWhere !== undefined && operationalDistrictWhere !== null
        ? { operational_district_id: operationalDistrictWhere }
        : {}),
      ...(supervisorFilter ? supervisorFilter : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.account.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          status: true,
          operational_location_id: true,
          operational_district_id: true,
          regional_supervisor_user_id: true,
          regional_supervisor: {
            select: { id: true, name: true, email: true, phone: true },
          },
        },
      }),
      this.prisma.account.count({ where }),
    ]);

    const uniqueOpIds = [...new Set(rows.map((r) => r.operational_location_id).filter(Boolean))] as string[];
    const uniqueDistrictIds = [...new Set(rows.map((r) => r.operational_district_id).filter(Boolean))] as string[];
    const districtNameById = new Map(
      uniqueDistrictIds.length
        ? (
            await this.prisma.location.findMany({
              where: { id: { in: uniqueDistrictIds } },
              select: { id: true, name: true },
            })
          ).map((loc) => [loc.id, loc.name] as const)
        : [],
    );

    const pathLabelByOpId = new Map<string, string>();
    const districtNameByOperationalLocationId = new Map<string, string>();
    await Promise.all(
      uniqueOpIds.map(async (id) => {
        const path = await this.locationsService.getPath(id);
        pathLabelByOpId.set(id, this.locationPathLabel(path));
        const dist = path.find((p) => p.location_type === 'DISTRICT');
        if (dist?.name) districtNameByOperationalLocationId.set(id, dist.name);
      }),
    );

    const metricsByAccountId = await this.getBusinessMetricsByAccountId(rows.map((r) => r.id));
    const zeroStats = {
      members: 0,
      suppliers: 0,
      customers: 0,
      sales: 0,
      collections: 0,
      farms: 0,
    };

    return {
      code: 200,
      status: 'success',
      message: 'Accounts retrieved.',
      data: {
        rows: rows.map((r) => {
          const districtLabel =
            (r.operational_district_id ? districtNameById.get(r.operational_district_id) : undefined) ??
            (r.operational_location_id ? districtNameByOperationalLocationId.get(r.operational_location_id) : undefined) ??
            null;
          return {
            id: r.id,
            code: r.code,
            name: r.name,
            type: r.type,
            status: r.status,
            operational_location_id: r.operational_location_id,
            operational_district_id: r.operational_district_id,
            regional_supervisor_user_id: r.regional_supervisor_user_id,
            regional_supervisor: r.regional_supervisor
              ? {
                  id: r.regional_supervisor.id,
                  name: r.regional_supervisor.name,
                  email: r.regional_supervisor.email,
                  phone: r.regional_supervisor.phone,
                }
              : null,
            operational_location_label: r.operational_location_id
              ? pathLabelByOpId.get(r.operational_location_id) ?? null
              : null,
            operational_district_label: districtLabel,
            stats: metricsByAccountId[r.id] ?? zeroStats,
          };
        }),
        pagination: {
          page: opts.page,
          limit: opts.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / opts.limit)),
        },
      },
    };
  }

  async getTenantAccountForAdmin(user: User, adminAccountId: string, targetAccountId: string) {
    const { canManageUsers, scopeDistrictIds } = await this.assertPlatformAccountDirectoryAccess(user, adminAccountId);
    const row = await this.prisma.account.findFirst({
      where: { id: targetAccountId },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        status: true,
        operational_location_id: true,
        operational_district_id: true,
        regional_supervisor_user_id: true,
        regional_supervisor: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });
    if (!row) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'Account not found.', data: null });
    }
    if (!canManageUsers) {
      const scoped = scopeDistrictIds ?? [];
      if (scoped.length === 0 || !row.operational_district_id || !scoped.includes(row.operational_district_id)) {
        throw new NotFoundException({ code: 404, status: 'error', message: 'Account not found.', data: null });
      }
    }
    let operational_location_label: string | null = null;
    if (row.operational_location_id) {
      const path = await this.locationsService.getPath(row.operational_location_id);
      operational_location_label = this.locationPathLabel(path);
    }

    const decNOrNull = (v: { toString(): string } | null | undefined): number | null => {
      if (v == null) return null;
      const n = Number(v.toString());
      return Number.isFinite(n) ? n : null;
    };

    const [operationalProfile, coolingTankProfiles, facilitySnapshot] = await Promise.all([
      this.prisma.mccOperationalProfile.findUnique({ where: { account_id: targetAccountId } }),
      this.prisma.mccCoolingTankProfile.findMany({
        where: { account_id: targetAccountId },
        orderBy: { created_at: 'asc' },
      }),
      this.prisma.mccFacilitySnapshot.findUnique({ where: { account_id: targetAccountId } }),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Account retrieved.',
      data: {
        ...row,
        regional_supervisor: row.regional_supervisor
          ? {
              id: row.regional_supervisor.id,
              name: row.regional_supervisor.name,
              email: row.regional_supervisor.email,
              phone: row.regional_supervisor.phone,
            }
          : null,
        operational_location_label,
        operational_profile: operationalProfile
          ? {
              ...operationalProfile,
              daily_milk_volume_litres: decNOrNull(operationalProfile.daily_milk_volume_litres),
              max_milk_one_day_litres: decNOrNull(operationalProfile.max_milk_one_day_litres),
              generator_capacity_kva: decNOrNull(operationalProfile.generator_capacity_kva),
              average_distance_km: decNOrNull(operationalProfile.average_distance_km),
              furthest_farm_km: decNOrNull(operationalProfile.furthest_farm_km),
              average_annual_revenue_rwf: decNOrNull(operationalProfile.average_annual_revenue_rwf),
              captured_at: operationalProfile.captured_at.toISOString(),
              updated_at: operationalProfile.updated_at.toISOString(),
            }
          : null,
        cooling_tank_profiles: coolingTankProfiles.map((t) => ({
          ...t,
          capacity_litres: decNOrNull(t.capacity_litres),
          created_at: t.created_at.toISOString(),
          updated_at: t.updated_at.toISOString(),
        })),
        facility_snapshot: facilitySnapshot
          ? {
              ...facilitySnapshot,
              tank_used_litres: decNOrNull(facilitySnapshot.tank_used_litres),
              tank_used_pct: decNOrNull(facilitySnapshot.tank_used_pct),
              cooling_temperature_c: decNOrNull(facilitySnapshot.cooling_temperature_c),
              generator_fuel_pct: decNOrNull(facilitySnapshot.generator_fuel_pct),
              observed_at: facilitySnapshot.observed_at?.toISOString() ?? null,
              updated_at: facilitySnapshot.updated_at.toISOString(),
            }
          : null,
      },
    };
  }

  async updateTenantAccountOperationalMetricsForAdmin(
    user: User,
    adminAccountId: string,
    targetAccountId: string,
    dto: UpdateTenantAccountOperationalMetricsDto,
  ) {
    await this.checkAdminPermission(user, adminAccountId);
    const exists = await this.prisma.account.findFirst({ where: { id: targetAccountId }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'Account not found.', data: null });
    }

    const hasProfile = Object.prototype.hasOwnProperty.call(dto, 'profile') && dto.profile != null;
    const hasSnapshot = Object.prototype.hasOwnProperty.call(dto, 'facility_snapshot') && dto.facility_snapshot != null;
    const hasTanks = Object.prototype.hasOwnProperty.call(dto, 'cooling_tanks');

    if (!hasProfile && !hasSnapshot && !hasTanks) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Provide at least one of profile, facility_snapshot, or cooling_tanks.',
      });
    }

    if (hasProfile) await this.applyTenantOperationalProfilePatch(targetAccountId, dto.profile!);
    if (hasSnapshot) await this.applyTenantFacilitySnapshotPatch(targetAccountId, dto.facility_snapshot!);
    if (hasTanks) await this.replaceTenantCoolingTanks(targetAccountId, dto.cooling_tanks ?? []);

    return this.getTenantAccountForAdmin(user, adminAccountId, targetAccountId);
  }

  private normalizeProfileStringField(label: string, value: unknown, maxLen: number): string | null {
    if (value === undefined || value === null || value === '') return null;
    const s = String(value);
    if (s.length > maxLen) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: `${label} must be at most ${maxLen} characters.`,
      });
    }
    return s;
  }

  private async applyTenantOperationalProfilePatch(accountId: string, dto: TenantOperationalProfilePatchDto): Promise<void> {
    const hasKey = (key: keyof TenantOperationalProfilePatchDto) =>
      Object.prototype.hasOwnProperty.call(dto, key);

    const ensureRange = (label: string, value: number | null, min: number, max: number) => {
      if (value == null) return;
      if (value < min || value > max) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: `${label} must be between ${min} and ${max}.`,
        });
      }
    };

    const updateData: Prisma.MccOperationalProfileUpdateInput = {};
    const createData: Prisma.MccOperationalProfileCreateInput = {
      account: { connect: { id: accountId } },
    };

    if (hasKey('expected_daily_deliveries')) {
      const v =
        dto.expected_daily_deliveries == null || dto.expected_daily_deliveries === ''
          ? null
          : this.asInt(dto.expected_daily_deliveries);
      if (dto.expected_daily_deliveries != null && dto.expected_daily_deliveries !== '' && v == null) {
        throw new BadRequestException({ code: 400, status: 'error', message: 'expected_daily_deliveries must be numeric.' });
      }
      ensureRange('expected_daily_deliveries', v, 0, 1000);
      updateData.expected_daily_deliveries = v;
      createData.expected_daily_deliveries = v;
    }
    if (hasKey('daily_milk_volume_litres')) {
      const dec =
        dto.daily_milk_volume_litres == null || dto.daily_milk_volume_litres === ''
          ? null
          : this.asDecimal(dto.daily_milk_volume_litres);
      if (dto.daily_milk_volume_litres != null && dto.daily_milk_volume_litres !== '' && dec == null) {
        throw new BadRequestException({ code: 400, status: 'error', message: 'daily_milk_volume_litres must be numeric.' });
      }
      ensureRange('daily_milk_volume_litres', dec != null ? Number(dec.toString()) : null, 0, 500_000);
      updateData.daily_milk_volume_litres = dec;
      createData.daily_milk_volume_litres = dec;
    }
    if (hasKey('max_milk_one_day_litres')) {
      const dec =
        dto.max_milk_one_day_litres == null || dto.max_milk_one_day_litres === ''
          ? null
          : this.asDecimal(dto.max_milk_one_day_litres);
      if (dto.max_milk_one_day_litres != null && dto.max_milk_one_day_litres !== '' && dec == null) {
        throw new BadRequestException({ code: 400, status: 'error', message: 'max_milk_one_day_litres must be numeric.' });
      }
      ensureRange('max_milk_one_day_litres', dec != null ? Number(dec.toString()) : null, 0, 500_000);
      updateData.max_milk_one_day_litres = dec;
      createData.max_milk_one_day_litres = dec;
    }
    if (hasKey('tank_capacity_sufficiency')) {
      const v = this.normalizeProfileStringField('tank_capacity_sufficiency', dto.tank_capacity_sufficiency, 120);
      updateData.tank_capacity_sufficiency = v;
      createData.tank_capacity_sufficiency = v;
    }
    if (hasKey('insufficient_capacity_plan')) {
      const v =
        dto.insufficient_capacity_plan === undefined
          ? undefined
          : dto.insufficient_capacity_plan === null || dto.insufficient_capacity_plan === ''
            ? null
            : String(dto.insufficient_capacity_plan);
      if (typeof v === 'string' && v.length > 20000) {
        throw new BadRequestException({ code: 400, status: 'error', message: 'insufficient_capacity_plan is too long.' });
      }
      if (v !== undefined) {
        updateData.insufficient_capacity_plan = v;
        createData.insufficient_capacity_plan = v;
      }
    }
    if (hasKey('power_supply_sources')) {
      if (dto.power_supply_sources === null) {
        updateData.power_supply_sources = Prisma.JsonNull;
        createData.power_supply_sources = Prisma.JsonNull;
      } else if (dto.power_supply_sources === undefined) {
        /* skip */
      } else if (typeof dto.power_supply_sources === 'object' && !Array.isArray(dto.power_supply_sources)) {
        updateData.power_supply_sources = dto.power_supply_sources as Prisma.InputJsonValue;
        createData.power_supply_sources = dto.power_supply_sources as Prisma.InputJsonValue;
      } else {
        throw new BadRequestException({ code: 400, status: 'error', message: 'power_supply_sources must be a JSON object or null.' });
      }
    }
    if (hasKey('generator_capacity_kva')) {
      const dec =
        dto.generator_capacity_kva == null || dto.generator_capacity_kva === ''
          ? null
          : this.asDecimal(dto.generator_capacity_kva);
      if (dto.generator_capacity_kva != null && dto.generator_capacity_kva !== '' && dec == null) {
        throw new BadRequestException({ code: 400, status: 'error', message: 'generator_capacity_kva must be numeric.' });
      }
      ensureRange('generator_capacity_kva', dec != null ? Number(dec.toString()) : null, 0, 50_000);
      updateData.generator_capacity_kva = dec;
      createData.generator_capacity_kva = dec;
    }
    if (hasKey('mobile_connectivity')) {
      const v = this.normalizeProfileStringField('mobile_connectivity', dto.mobile_connectivity, 120);
      updateData.mobile_connectivity = v;
      createData.mobile_connectivity = v;
    }
    if (hasKey('total_farmers_supplying')) {
      const v =
        dto.total_farmers_supplying == null || dto.total_farmers_supplying === ''
          ? null
          : this.asInt(dto.total_farmers_supplying);
      if (dto.total_farmers_supplying != null && dto.total_farmers_supplying !== '' && v == null) {
        throw new BadRequestException({ code: 400, status: 'error', message: 'total_farmers_supplying must be numeric.' });
      }
      ensureRange('total_farmers_supplying', v, 0, 500_000);
      updateData.total_farmers_supplying = v;
      createData.total_farmers_supplying = v;
    }
    if (hasKey('new_farmers_last_3_months')) {
      const v =
        dto.new_farmers_last_3_months == null || dto.new_farmers_last_3_months === ''
          ? null
          : this.asInt(dto.new_farmers_last_3_months);
      if (dto.new_farmers_last_3_months != null && dto.new_farmers_last_3_months !== '' && v == null) {
        throw new BadRequestException({ code: 400, status: 'error', message: 'new_farmers_last_3_months must be numeric.' });
      }
      ensureRange('new_farmers_last_3_months', v, 0, 100_000);
      updateData.new_farmers_last_3_months = v;
      createData.new_farmers_last_3_months = v;
    }
    if (hasKey('milk_transporters_count')) {
      const v =
        dto.milk_transporters_count == null || dto.milk_transporters_count === ''
          ? null
          : this.asInt(dto.milk_transporters_count);
      if (dto.milk_transporters_count != null && dto.milk_transporters_count !== '' && v == null) {
        throw new BadRequestException({ code: 400, status: 'error', message: 'milk_transporters_count must be numeric.' });
      }
      ensureRange('milk_transporters_count', v, 0, 50_000);
      updateData.milk_transporters_count = v;
      createData.milk_transporters_count = v;
    }
    if (hasKey('average_distance_km')) {
      const dec =
        dto.average_distance_km == null || dto.average_distance_km === ''
          ? null
          : this.asDecimal(dto.average_distance_km);
      if (dto.average_distance_km != null && dto.average_distance_km !== '' && dec == null) {
        throw new BadRequestException({ code: 400, status: 'error', message: 'average_distance_km must be numeric.' });
      }
      ensureRange('average_distance_km', dec != null ? Number(dec.toString()) : null, 0, 10_000);
      updateData.average_distance_km = dec;
      createData.average_distance_km = dec;
    }
    if (hasKey('furthest_farm_km')) {
      const dec =
        dto.furthest_farm_km == null || dto.furthest_farm_km === '' ? null : this.asDecimal(dto.furthest_farm_km);
      if (dto.furthest_farm_km != null && dto.furthest_farm_km !== '' && dec == null) {
        throw new BadRequestException({ code: 400, status: 'error', message: 'furthest_farm_km must be numeric.' });
      }
      ensureRange('furthest_farm_km', dec != null ? Number(dec.toString()) : null, 0, 10_000);
      updateData.furthest_farm_km = dec;
      createData.furthest_farm_km = dec;
    }
    if (hasKey('evening_milk_pattern')) {
      const v = this.normalizeProfileStringField('evening_milk_pattern', dto.evening_milk_pattern, 120);
      updateData.evening_milk_pattern = v;
      createData.evening_milk_pattern = v;
    }
    if (hasKey('own_milk_transport_type')) {
      const v = this.normalizeProfileStringField('own_milk_transport_type', dto.own_milk_transport_type, 160);
      updateData.own_milk_transport_type = v;
      createData.own_milk_transport_type = v;
    }
    if (hasKey('record_system')) {
      const v = this.normalizeProfileStringField('record_system', dto.record_system, 160);
      updateData.record_system = v;
      createData.record_system = v;
    }
    if (hasKey('avg_days_delivery_to_payment')) {
      const v =
        dto.avg_days_delivery_to_payment == null || dto.avg_days_delivery_to_payment === ''
          ? null
          : this.asInt(dto.avg_days_delivery_to_payment);
      if (dto.avg_days_delivery_to_payment != null && dto.avg_days_delivery_to_payment !== '' && v == null) {
        throw new BadRequestException({ code: 400, status: 'error', message: 'avg_days_delivery_to_payment must be numeric.' });
      }
      ensureRange('avg_days_delivery_to_payment', v, 0, 3650);
      updateData.avg_days_delivery_to_payment = v;
      createData.avg_days_delivery_to_payment = v;
    }
    if (hasKey('average_annual_revenue_rwf')) {
      const dec =
        dto.average_annual_revenue_rwf == null || dto.average_annual_revenue_rwf === ''
          ? null
          : this.asDecimal(dto.average_annual_revenue_rwf);
      if (dto.average_annual_revenue_rwf != null && dto.average_annual_revenue_rwf !== '' && dec == null) {
        throw new BadRequestException({ code: 400, status: 'error', message: 'average_annual_revenue_rwf must be numeric.' });
      }
      ensureRange('average_annual_revenue_rwf', dec != null ? Number(dec.toString()) : null, 0, 1e15);
      updateData.average_annual_revenue_rwf = dec;
      createData.average_annual_revenue_rwf = dec;
    }
    if (hasKey('main_buyer_name')) {
      const v = this.normalizeProfileStringField('main_buyer_name', dto.main_buyer_name, 255);
      updateData.main_buyer_name = v;
      createData.main_buyer_name = v;
    }
    if (hasKey('formal_supply_agreement_details')) {
      const v =
        dto.formal_supply_agreement_details === undefined
          ? undefined
          : dto.formal_supply_agreement_details === null || dto.formal_supply_agreement_details === ''
            ? null
            : String(dto.formal_supply_agreement_details);
      if (typeof v === 'string' && v.length > 20000) {
        throw new BadRequestException({ code: 400, status: 'error', message: 'formal_supply_agreement_details is too long.' });
      }
      if (v !== undefined) {
        updateData.formal_supply_agreement_details = v;
        createData.formal_supply_agreement_details = v;
      }
    }

    if (Object.keys(updateData).length === 0) return;

    await this.prisma.mccOperationalProfile.upsert({
      where: { account_id: accountId },
      create: createData,
      update: updateData,
    });
  }

  private async applyTenantFacilitySnapshotPatch(accountId: string, dto: FacilitySnapshotPatchDto): Promise<void> {
    const hasKey = (key: keyof FacilitySnapshotPatchDto) => Object.prototype.hasOwnProperty.call(dto, key);
    const asFiniteNumber = (v: Prisma.Decimal | null): number | null => {
      if (v == null) return null;
      const n = Number(v.toString());
      return Number.isFinite(n) ? n : null;
    };
    const ensureRange = (label: string, value: number | null, min: number, max: number) => {
      if (value == null) return;
      if (value < min || value > max) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: `${label} must be between ${min} and ${max}.`,
        });
      }
    };

    const POWER = new Set(['grid', 'generator', 'solar', 'outage', 'unknown']);
    const GEN = new Set(['available', 'running', 'fault', 'offline', 'unknown']);

    const updateData: Prisma.MccFacilitySnapshotUpdateInput = { source: 'admin_manual' };
    const createData: Prisma.MccFacilitySnapshotCreateInput = {
      account: { connect: { id: accountId } },
      source: 'admin_manual',
    };

    if (hasKey('tank_used_litres')) {
      const v = dto.tank_used_litres == null || dto.tank_used_litres === '' ? null : this.asDecimal(dto.tank_used_litres);
      if (dto.tank_used_litres != null && dto.tank_used_litres !== '' && v == null) {
        throw new BadRequestException({ code: 400, status: 'error', message: 'tank_used_litres must be numeric.' });
      }
      ensureRange('tank_used_litres', asFiniteNumber(v), 0, 200_000);
      updateData.tank_used_litres = v;
      createData.tank_used_litres = v;
    }
    if (hasKey('tank_used_pct')) {
      const v = dto.tank_used_pct == null || dto.tank_used_pct === '' ? null : this.asDecimal(dto.tank_used_pct);
      if (dto.tank_used_pct != null && dto.tank_used_pct !== '' && v == null) {
        throw new BadRequestException({ code: 400, status: 'error', message: 'tank_used_pct must be numeric.' });
      }
      ensureRange('tank_used_pct', asFiniteNumber(v), 0, 100);
      updateData.tank_used_pct = v;
      createData.tank_used_pct = v;
    }
    if (hasKey('cooling_temperature_c')) {
      const v =
        dto.cooling_temperature_c == null || dto.cooling_temperature_c === ''
          ? null
          : this.asDecimal(dto.cooling_temperature_c);
      if (dto.cooling_temperature_c != null && dto.cooling_temperature_c !== '' && v == null) {
        throw new BadRequestException({ code: 400, status: 'error', message: 'cooling_temperature_c must be numeric.' });
      }
      ensureRange('cooling_temperature_c', asFiniteNumber(v), -10, 25);
      updateData.cooling_temperature_c = v;
      createData.cooling_temperature_c = v;
    }
    if (hasKey('power_status')) {
      const raw = dto.power_status == null || dto.power_status === '' ? null : String(dto.power_status).toLowerCase();
      if (raw != null && !POWER.has(raw)) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: `power_status must be one of: ${[...POWER].join(', ')}.`,
        });
      }
      updateData.power_status = raw;
      createData.power_status = raw;
    }
    if (hasKey('generator_status')) {
      const raw = dto.generator_status == null || dto.generator_status === '' ? null : String(dto.generator_status).toLowerCase();
      if (raw != null && !GEN.has(raw)) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: `generator_status must be one of: ${[...GEN].join(', ')}.`,
        });
      }
      updateData.generator_status = raw;
      createData.generator_status = raw;
    }
    if (hasKey('generator_fuel_pct')) {
      const v =
        dto.generator_fuel_pct == null || dto.generator_fuel_pct === '' ? null : this.asDecimal(dto.generator_fuel_pct);
      if (dto.generator_fuel_pct != null && dto.generator_fuel_pct !== '' && v == null) {
        throw new BadRequestException({ code: 400, status: 'error', message: 'generator_fuel_pct must be numeric.' });
      }
      ensureRange('generator_fuel_pct', asFiniteNumber(v), 0, 100);
      updateData.generator_fuel_pct = v;
      createData.generator_fuel_pct = v;
    }

    const snapshotKeys: Array<keyof FacilitySnapshotPatchDto> = [
      'tank_used_litres',
      'tank_used_pct',
      'cooling_temperature_c',
      'power_status',
      'generator_status',
      'generator_fuel_pct',
    ];
    const anyMetric = snapshotKeys.some((key) => hasKey(key));

    if (hasKey('observed_at')) {
      if (dto.observed_at == null || dto.observed_at === '') {
        updateData.observed_at = null;
        createData.observed_at = null;
      } else {
        const observedAt = new Date(dto.observed_at);
        if (Number.isNaN(observedAt.getTime())) {
          throw new BadRequestException({
            code: 400,
            status: 'error',
            message: 'observed_at must be a valid ISO date.',
          });
        }
        updateData.observed_at = observedAt;
        createData.observed_at = observedAt;
      }
    } else if (anyMetric) {
      const now = new Date();
      updateData.observed_at = now;
      createData.observed_at = now;
    }

    await this.prisma.mccFacilitySnapshot.upsert({
      where: { account_id: accountId },
      create: createData,
      update: updateData,
    });
  }

  private async replaceTenantCoolingTanks(accountId: string, rows: CoolingTankRowDto[]): Promise<void> {
    const normalized = rows.filter((row) => {
      const cap =
        row.capacity_litres == null || row.capacity_litres === ''
          ? null
          : this.asDecimal(row.capacity_litres);
      if (row.capacity_litres != null && row.capacity_litres !== '' && cap == null) {
        throw new BadRequestException({ code: 400, status: 'error', message: 'cooling_tanks[].capacity_litres must be numeric.' });
      }
      const tn = row.tank_number != null && row.tank_number !== '' ? String(row.tank_number).slice(0, 120) : '';
      const ya = row.year_or_age != null && row.year_or_age !== '' ? String(row.year_or_age).slice(0, 120) : '';
      const cond = row.condition != null && row.condition !== '' ? String(row.condition).slice(0, 60) : '';
      return Boolean(cap != null || tn || ya || cond);
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.mccCoolingTankProfile.deleteMany({ where: { account_id: accountId } });
      if (normalized.length === 0) return;
      await tx.mccCoolingTankProfile.createMany({
        data: normalized.map((row) => {
          const capacity_litres =
            row.capacity_litres == null || row.capacity_litres === ''
              ? null
              : this.asDecimal(row.capacity_litres);
          return {
            account_id: accountId,
            tank_number:
              row.tank_number != null && row.tank_number !== '' ? String(row.tank_number).slice(0, 120) : null,
            capacity_litres,
            year_or_age:
              row.year_or_age != null && row.year_or_age !== '' ? String(row.year_or_age).slice(0, 120) : null,
            condition:
              row.condition != null && row.condition !== '' ? String(row.condition).slice(0, 60) : null,
          };
        }),
      });
    });
  }

  async updateAccountOperationalLocationForAdmin(
    user: User,
    adminAccountId: string,
    targetAccountId: string,
    dto: UpdateAccountOperationalLocationDto,
  ) {
    await this.checkAdminPermission(user, adminAccountId);
    const exists = await this.prisma.account.findFirst({ where: { id: targetAccountId }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'Account not found.', data: null });
    }

    let operational_location_id: string | null = dto.operational_location_id ?? null;
    if (operational_location_id === '') operational_location_id = null;

    if (operational_location_id) {
      const loc = await this.prisma.location.findUnique({
        where: { id: operational_location_id },
        select: { id: true, location_type: true },
      });
      if (!loc) {
        throw new BadRequestException({ code: 400, status: 'error', message: 'Location not found.', data: null });
      }
      if (loc.location_type !== LocationType.VILLAGE) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Operational location must be a village (select province through village).',
          data: null,
        });
      }
    }

    const operational_district_id = operational_location_id
      ? await this.resolveDistrictIdFromOperationalLocation(operational_location_id)
      : null;

    await this.prisma.account.update({
      where: { id: targetAccountId },
      data: {
        operational_location_id,
        operational_district_id,
      },
    });

    const path = operational_location_id ? await this.locationsService.getPath(operational_location_id) : [];
    return {
      code: 200,
      status: 'success',
      message: 'Account geography updated.',
      data: {
        id: targetAccountId,
        operational_location_id,
        operational_district_id,
        operational_location_label: operational_location_id ? this.locationPathLabel(path) : null,
      },
    };
  }

  private async assertUserIsRegionalSupervisorOnPlatform(supervisorUserId: string, platformAccountId: string): Promise<void> {
    const ua = await this.prisma.userAccount.findFirst({
      where: {
        user_id: supervisorUserId,
        account_id: platformAccountId,
        status: 'active',
        role: 'regional_supervisor',
      },
      select: { id: true },
    });
    if (!ua) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'User must have the regional_supervisor role on this platform account.',
        data: null,
      });
    }
  }

  async setTenantAccountRegionalSupervisorForAdmin(
    user: User,
    adminAccountId: string,
    targetAccountId: string,
    dto: UpdateAccountRegionalSupervisorDto,
  ) {
    await this.checkAdminPermission(user, adminAccountId);
    if (!Object.prototype.hasOwnProperty.call(dto, 'regional_supervisor_user_id')) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'regional_supervisor_user_id is required (use null to clear).',
        data: null,
      });
    }

    const raw = dto.regional_supervisor_user_id;
    let nextSupervisorId: string | null;
    if (raw === null || raw === '') {
      nextSupervisorId = null;
    } else if (!AdminService.LOCATION_UUID_RE.test(raw)) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Invalid regional_supervisor_user_id.',
        data: null,
      });
    } else {
      nextSupervisorId = raw;
    }

    const account = await this.prisma.account.findFirst({
      where: { id: targetAccountId },
      select: { id: true, operational_district_id: true },
    });
    if (!account) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'Account not found.', data: null });
    }

    if (nextSupervisorId) {
      await this.assertUserIsRegionalSupervisorOnPlatform(nextSupervisorId, adminAccountId);
      const districtId = account.operational_district_id;
      if (districtId) {
        const existing = await this.prisma.regionalSupervisorDistrict.findFirst({
          where: { user_id: nextSupervisorId, district_location_id: districtId },
          select: { id: true },
        });
        if (!existing) {
          await this.prisma.regionalSupervisorDistrict.create({
            data: { user_id: nextSupervisorId, district_location_id: districtId },
          });
        }
      }
    }

    await this.prisma.account.update({
      where: { id: targetAccountId },
      data: { regional_supervisor_user_id: nextSupervisorId },
    });

    return this.getTenantAccountForAdmin(user, adminAccountId, targetAccountId);
  }

  async getRegionalSupervisorScope(user: User, adminAccountId: string, targetUserId: string) {
    await this.checkAdminPermission(user, adminAccountId);
    const target = await this.prisma.user.findFirst({ where: { id: targetUserId }, select: { id: true } });
    if (!target) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'User not found.', data: null });
    }
    const rows = await this.prisma.regionalSupervisorDistrict.findMany({
      where: { user_id: targetUserId },
      include: { district: { select: { id: true, code: true, name: true, location_type: true } } },
      orderBy: { created_at: 'asc' },
    });
    return {
      code: 200,
      status: 'success',
      message: 'Regional supervisor scope retrieved.',
      data: {
        user_id: targetUserId,
        districts: rows.map((r) => ({
          id: r.district.id,
          code: r.district.code,
          name: r.district.name,
        })),
      },
    };
  }

  async setRegionalSupervisorScope(
    user: User,
    adminAccountId: string,
    targetUserId: string,
    dto: SetRegionalSupervisorScopeDto,
  ) {
    await this.checkAdminPermission(user, adminAccountId);
    const target = await this.prisma.user.findFirst({ where: { id: targetUserId }, select: { id: true } });
    if (!target) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'User not found.', data: null });
    }

    const ids = [...new Set(dto.district_location_ids ?? [])];
    for (const did of ids) {
      const loc = await this.prisma.location.findUnique({
        where: { id: did },
        select: { id: true, location_type: true },
      });
      if (!loc || loc.location_type !== LocationType.DISTRICT) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: `Invalid district location id: ${did}`,
          data: null,
        });
      }
    }

    await this.prisma.$transaction([
      this.prisma.regionalSupervisorDistrict.deleteMany({ where: { user_id: targetUserId } }),
      ...(ids.length
        ? [
            this.prisma.regionalSupervisorDistrict.createMany({
              data: ids.map((district_location_id) => ({
                user_id: targetUserId,
                district_location_id,
              })),
            }),
          ]
        : []),
    ]);

    return this.getRegionalSupervisorScope(user, adminAccountId, targetUserId);
  }

  /**
   * Get all platform roles with permission codes (database-backed).
   * Initial links come from config only when a role has none yet; admins change grants via `updatePlatformRole`.
   */
  async getRoles(user: User, accountId: string) {
    await this.checkAdminPermission(user, accountId);
    await this.rbac.ensureCatalogFromConfig();
    const rows = await this.prisma.platformRole.findMany({
      orderBy: [{ is_system: 'desc' }, { slug: 'asc' }],
      include: {
        permission_links: {
          include: { permission: true },
        },
      },
    });
    const roles = rows.map((r) => {
      const codes = r.permission_links.map((l) => l.permission.code).sort();
      return {
        id: r.id,
        code: r.slug,
        name: r.name,
        description: r.description ?? '',
        permissions: codes,
        permissionCount: codes.length,
        is_system: r.is_system,
        is_active: r.is_active,
        is_assignable: r.is_assignable,
      };
    });
    return {
      code: 200,
      status: 'success',
      message: 'Roles retrieved successfully.',
      data: { roles },
    };
  }

  /**
   * Get all permissions with role assignments (database-backed).
   */
  async getPermissions(user: User, accountId: string) {
    await this.checkAdminPermission(user, accountId);
    await this.rbac.ensureCatalogFromConfig();
    const permRows = await this.prisma.platformPermission.findMany({
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    });
    const links = await this.prisma.platformRolePermission.findMany({
      include: { role: true },
    });
    const byPerm = new Map<string, { id: string; code: string; name: string }[]>();
    for (const l of links) {
      const list = byPerm.get(l.platform_permission_id) ?? [];
      list.push({ id: l.role.id, code: l.role.slug, name: l.role.name });
      byPerm.set(l.platform_permission_id, list);
    }
    const permissions = permRows.map((perm) => ({
      id: perm.id,
      code: perm.code,
      name: perm.name,
      description: perm.description,
      category: perm.category,
      roles: byPerm.get(perm.id) ?? [],
    }));
    return {
      code: 200,
      status: 'success',
      message: 'Permissions retrieved successfully.',
      data: { permissions },
    };
  }

  private slugifyRoleName(name: string): string {
    const base = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);
    return base || 'role';
  }

  private async ensureUniqueSlug(base: string): Promise<string> {
    let slug = base.slice(0, 64);
    let n = 0;
    while (await this.prisma.platformRole.findUnique({ where: { slug } })) {
      n += 1;
      const suffix = `-${n}`;
      slug = `${base.slice(0, Math.max(1, 64 - suffix.length))}${suffix}`;
    }
    return slug;
  }

  async createPlatformRole(user: User, accountId: string, dto: CreatePlatformRoleDto) {
    await this.checkAdminPermission(user, accountId);
    await this.rbac.ensureCatalogFromConfig();
    const baseSlug = dto.slug?.trim() ? dto.slug.trim().slice(0, 64) : this.slugifyRoleName(dto.name);
    const slug = await this.ensureUniqueSlug(baseSlug);
    const permissionRows = await this.prisma.platformPermission.findMany({
      where: { id: { in: dto.permission_ids } },
    });
    if (permissionRows.length !== dto.permission_ids.length) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'One or more permission IDs are invalid.',
      });
    }
    const role = await this.prisma.platformRole.create({
      data: {
        slug,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        is_system: false,
        is_active: dto.is_active !== false,
        is_assignable: dto.is_assignable !== false,
      },
    });
    const uniquePermRows = [...new Map(permissionRows.map((p) => [p.id, p])).values()];
    await this.prisma.platformRolePermission.createMany({
      data: uniquePermRows.map((p) => ({
        platform_role_id: role.id,
        platform_permission_id: p.id,
      })),
      skipDuplicates: true,
    });
    const links = await this.prisma.platformRolePermission.findMany({
      where: { platform_role_id: role.id },
      include: { permission: true },
    });
    const codes = links.map((l) => l.permission.code).sort();
    return {
      code: 201,
      status: 'success',
      message: 'Role created successfully.',
      data: {
        role: {
          id: role.id,
          code: role.slug,
          name: role.name,
          description: role.description ?? '',
          permissions: codes,
          permissionCount: codes.length,
          is_system: false,
          is_active: role.is_active,
          is_assignable: role.is_assignable,
        },
      },
    };
  }

  async updatePlatformRole(user: User, accountId: string, roleId: string, dto: UpdatePlatformRoleDto) {
    await this.checkAdminPermission(user, accountId);
    const existing = await this.prisma.platformRole.findUnique({ where: { id: roleId } });
    if (!existing) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'Role not found.' });
    }
    if (existing.is_system && dto.slug !== undefined && dto.slug.trim() !== existing.slug) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Cannot change slug of a system role.',
      });
    }

    let newSlug = existing.slug;
    if (dto.slug !== undefined && dto.slug.trim() !== existing.slug) {
      const candidate = dto.slug.trim().slice(0, 64);
      const clash = await this.prisma.platformRole.findFirst({
        where: { slug: candidate, NOT: { id: existing.id } },
      });
      if (clash) {
        throw new ConflictException({
          code: 409,
          status: 'error',
          message: 'Another role already uses this slug.',
        });
      }
      newSlug = candidate;
    }

    if (dto.permission_ids !== undefined) {
      const permissionRows = await this.prisma.platformPermission.findMany({
        where: { id: { in: dto.permission_ids } },
      });
      if (permissionRows.length !== dto.permission_ids.length) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'One or more permission IDs are invalid.',
        });
      }
      await this.prisma.platformRolePermission.deleteMany({
        where: { platform_role_id: existing.id },
      });
      const uniquePermRows = [...new Map(permissionRows.map((p) => [p.id, p])).values()];
      await this.prisma.platformRolePermission.createMany({
        data: uniquePermRows.map((p) => ({
          platform_role_id: existing.id,
          platform_permission_id: p.id,
        })),
        skipDuplicates: true,
      });
    }

    const updated = await this.prisma.platformRole.update({
      where: { id: roleId },
      data: {
        slug: newSlug,
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.is_active !== undefined ? { is_active: dto.is_active } : {}),
        ...(dto.is_assignable !== undefined ? { is_assignable: dto.is_assignable } : {}),
      },
    });

    const cascadeSlug =
      dto.slug !== undefined && dto.slug.trim() !== existing.slug ? newSlug : undefined;
    if (cascadeSlug) {
      await this.prisma.userAccount.updateMany({
        where: { platform_role_id: existing.id },
        data: { role: cascadeSlug },
      });
    }

    const links = await this.prisma.platformRolePermission.findMany({
      where: { platform_role_id: updated.id },
      include: { permission: true },
    });
    const codes = links.map((l) => l.permission.code).sort();
    return {
      code: 200,
      status: 'success',
      message: 'Role updated successfully.',
      data: {
        role: {
          id: updated.id,
          code: updated.slug,
          name: updated.name,
          description: updated.description ?? '',
          permissions: codes,
          permissionCount: codes.length,
          is_system: updated.is_system,
          is_active: updated.is_active,
          is_assignable: updated.is_assignable,
        },
      },
    };
  }

  async deletePlatformRole(user: User, accountId: string, roleId: string) {
    await this.checkAdminPermission(user, accountId);
    const existing = await this.prisma.platformRole.findUnique({ where: { id: roleId } });
    if (!existing) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'Role not found.' });
    }
    if (existing.is_system) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'System roles cannot be deleted.',
      });
    }
    const inUse = await this.prisma.userAccount.count({
      where: { platform_role_id: roleId },
    });
    if (inUse > 0) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: `Role is assigned to ${inUse} user account link(s). Reassign users before deleting.`,
      });
    }
    await this.prisma.platformRole.delete({ where: { id: roleId } });
    return {
      code: 200,
      status: 'success',
      message: 'Role deleted successfully.',
      data: null,
    };
  }

  private normalizePhoneDigits(phone: string): string {
    return String(phone || '').replace(/\D/g, '');
  }

  private generateOnboardingTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let out = '';
    for (let i = 0; i < 14; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  }

  private isLocationUuid(value: string | null | undefined): boolean {
    if (!value || typeof value !== 'string') return false;
    return AdminService.LOCATION_UUID_RE.test(value.trim());
  }

  /**
   * Human-readable admin hierarchy for MCC onboarding.
   * Wizard stores either `locations.id` UUIDs (API picker) or plain names (offline fallback).
   */
  private async resolveMccOnboardingLocationLabels(submission: {
    location_province_id: string | null;
    location_district_id: string | null;
    location_sector_id: string | null;
    location_cell_id: string | null;
    location_village_id: string | null;
    section_payload: Prisma.JsonValue;
  }): Promise<{
    province: string;
    district: string;
    sector: string;
    cell: string;
    village: string;
    path: string;
  }> {
    const payload =
      submission.section_payload &&
      typeof submission.section_payload === 'object' &&
      !Array.isArray(submission.section_payload)
        ? (submission.section_payload as Record<string, unknown>)
        : {};
    const s1 =
      payload.section1Location &&
      typeof payload.section1Location === 'object' &&
      !Array.isArray(payload.section1Location)
        ? (payload.section1Location as Record<string, unknown>)
        : {};

    const pick = (db: string | null | undefined, alt: unknown): string => {
      const a = db && String(db).trim().length > 0 ? String(db).trim() : '';
      if (a) return a;
      const b = typeof alt === 'string' && alt.trim().length > 0 ? alt.trim() : '';
      return b;
    };

    const p = pick(submission.location_province_id, s1.provinceId);
    const d = pick(submission.location_district_id, s1.districtId);
    const s = pick(submission.location_sector_id, s1.sectorId);
    const c = pick(submission.location_cell_id, s1.cellId);
    const v = pick(submission.location_village_id, s1.villageId);

    const empty = (x: string) => !x || x.trim().length === 0;

    const deepestUuid = [v, c, s, d, p].find((id) => this.isLocationUuid(id));
    if (deepestUuid) {
      try {
        const segments = await this.locationsService.getPath(deepestUuid.trim());
        if (segments.length > 0) {
          const byType: Partial<Record<string, string>> = {};
          for (const seg of segments) {
            byType[seg.location_type] = seg.name;
          }
          const province = byType['PROVINCE'] || '—';
          const district = byType['DISTRICT'] || '—';
          const sector = byType['SECTOR'] || '—';
          const cell = byType['CELL'] || '—';
          const village = byType['VILLAGE'] || '—';
          return {
            province,
            district,
            sector,
            cell,
            village,
            path: segments.map((x) => x.name).join(' › '),
          };
        }
      } catch {
        // fall through to per-id resolution
      }
    }

    const ids = [p, d, s, c, v].filter((id) => this.isLocationUuid(id));
    const unique = [...new Set(ids)];
    const rows =
      unique.length > 0
        ? await this.prisma.location.findMany({
            where: { id: { in: unique } },
            select: { id: true, name: true },
          })
        : [];
    const map = new Map(rows.map((r) => [r.id, r.name]));

    const resolve = (id: string): string => {
      if (empty(id)) return '—';
      if (!this.isLocationUuid(id)) return id;
      return map.get(id) || id;
    };

    const province = resolve(p);
    const district = resolve(d);
    const sector = resolve(s);
    const cell = resolve(c);
    const village = resolve(v);
    const parts = [province, district, sector, cell, village].filter((x) => x && x !== '—');

    return {
      province,
      district,
      sector,
      cell,
      village,
      path: parts.length > 0 ? parts.join(' › ') : '—',
    };
  }

  async getMccOnboardingPendingCount(user: User, accountId: string) {
    await this.checkAdminPermission(user, accountId);
    const pendingCount = await this.prisma.mccOnboardingSubmission.count({
      where: { review_status: MccOnboardingReviewStatus.pending },
    });
    return {
      code: 200,
      status: 'success',
      message: 'Pending onboarding count retrieved.',
      data: { pendingCount },
    };
  }

  async listMccOnboardingSubmissions(
    user: User,
    accountId: string,
    page = 1,
    limit = 20,
    reviewStatus?: string,
    search?: string,
    onboardedFrom?: string,
    onboardedTo?: string,
    tzOffsetMinutes?: number,
  ) {
    await this.checkAdminPermission(user, accountId);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);
    const skip = (safePage - 1) * safeLimit;

    const where: Prisma.MccOnboardingSubmissionWhereInput = {};
    const validStatuses: MccOnboardingReviewStatus[] = [
      MccOnboardingReviewStatus.pending,
      MccOnboardingReviewStatus.approved,
      MccOnboardingReviewStatus.rejected,
      MccOnboardingReviewStatus.needs_changes,
    ];
    if (reviewStatus && validStatuses.includes(reviewStatus as MccOnboardingReviewStatus)) {
      where.review_status = reviewStatus as MccOnboardingReviewStatus;
    }
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { submission_code: { contains: q, mode: 'insensitive' } },
        { business_name: { contains: q, mode: 'insensitive' } },
        { common_name: { contains: q, mode: 'insensitive' } },
        { manager_first_name: { contains: q, mode: 'insensitive' } },
        { manager_last_name: { contains: q, mode: 'insensitive' } },
        { manager_phone: { contains: q, mode: 'insensitive' } },
        {
          linked_account: {
            is: {
              OR: [
                { code: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }
    if (onboardedFrom || onboardedTo) {
      const createdAt: Prisma.DateTimeFilter = {};
      const offset = Number.isFinite(tzOffsetMinutes as number) ? (tzOffsetMinutes as number) : 0;
      if (onboardedFrom) {
        const from = this.parseClientLocalDateToUtcBoundary(onboardedFrom, offset, false);
        if (from) createdAt.gte = from;
      }
      if (onboardedTo) {
        const to = this.parseClientLocalDateToUtcBoundary(onboardedTo, offset, true);
        if (to) createdAt.lte = to;
      }
      if (Object.keys(createdAt).length > 0) {
        where.created_at = createdAt;
      }
    }

    const [submissions, total, pendingCount] = await Promise.all([
      this.prisma.mccOnboardingSubmission.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: safeLimit,
        select: {
          id: true,
          submission_code: true,
          business_name: true,
          common_name: true,
          manager_first_name: true,
          manager_last_name: true,
          manager_phone: true,
          final_decision: true,
          pass_count: true,
          review_status: true,
          created_at: true,
          reviewed_at: true,
          linked_user_id: true,
          linked_account_id: true,
          linked_account: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.mccOnboardingSubmission.count({ where }),
      this.prisma.mccOnboardingSubmission.count({
        where: { review_status: MccOnboardingReviewStatus.pending },
      }),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Onboarding submissions retrieved successfully.',
      data: {
        submissions,
        pendingCount,
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages: Math.ceil(total / safeLimit),
        },
      },
    };
  }

  /** MCC accounts that appear on supplier milk onboarding rows (admin filter dropdown). */
  async listSupplierMilkOnboardingMccFilterOptions(user: User, accountId: string) {
    await this.checkAdminPermission(user, accountId);
    const rows = await this.prisma.supplierMilkOnboarding.findMany({
      where: { mcc_account_id: { not: null } },
      distinct: ['mcc_account_id'],
      select: { mcc_account_id: true },
    });
    const uuidList = rows.map((r) => r.mcc_account_id).filter((x): x is string => Boolean(x));
    if (uuidList.length === 0) {
      return {
        code: 200,
        status: 'success',
        message: 'OK',
        data: { mcc_accounts: [] as Array<{ id: string; code: string; name: string }> },
      };
    }
    const accounts = await this.prisma.account.findMany({
      where: { id: { in: uuidList } },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });
    return {
      code: 200,
      status: 'success',
      message: 'OK',
      data: { mcc_accounts: accounts },
    };
  }

  /**
   * List rows from `supplier_milk_onboardings` (MCC wizard → farmer/collector signup).
   */
  async listSupplierMilkOnboardings(
    user: User,
    accountId: string,
    page = 1,
    limit = 20,
    mccAccountId?: string,
    supplierAccountType?: string,
    search?: string,
    createdFrom?: string,
    createdTo?: string,
    tzOffsetMinutes?: number,
  ) {
    await this.checkAdminPermission(user, accountId);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);
    const skip = (safePage - 1) * safeLimit;

    const andParts: Prisma.SupplierMilkOnboardingWhereInput[] = [];

    if (mccAccountId?.trim() && AdminService.LOCATION_UUID_RE.test(mccAccountId.trim())) {
      andParts.push({ mcc_account_id: mccAccountId.trim() });
    }

    if (supplierAccountType === 'farmer' || supplierAccountType === 'supplier') {
      andParts.push({ user: { account_type: supplierAccountType } });
    }

    if (createdFrom || createdTo) {
      const createdAt: Prisma.DateTimeFilter = {};
      const offset = Number.isFinite(tzOffsetMinutes as number) ? (tzOffsetMinutes as number) : 0;
      if (createdFrom) {
        const from = this.parseClientLocalDateToUtcBoundary(createdFrom, offset, false);
        if (from) createdAt.gte = from;
      }
      if (createdTo) {
        const to = this.parseClientLocalDateToUtcBoundary(createdTo, offset, true);
        if (to) createdAt.lte = to;
      }
      if (Object.keys(createdAt).length > 0) {
        andParts.push({ created_at: createdAt });
      }
    }

    if (search?.trim()) {
      const q = search.trim();
      const phoneDigits = q.replace(/\D/g, '');
      const mccMatches = await this.prisma.account.findMany({
        where: {
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
        take: 200,
      });
      const mccIdList = mccMatches.map((m) => m.id);

      const searchOr: Prisma.SupplierMilkOnboardingWhereInput[] = [
        { user: { name: { contains: q, mode: 'insensitive' } } },
        { user: { first_name: { contains: q, mode: 'insensitive' } } },
        { user: { last_name: { contains: q, mode: 'insensitive' } } },
        { user: { code: { contains: q, mode: 'insensitive' } } },
        {
          user: {
            default_account: {
              is: {
                OR: [
                  { code: { contains: q, mode: 'insensitive' } },
                  { name: { contains: q, mode: 'insensitive' } },
                ],
              },
            },
          },
        },
      ];
      if (phoneDigits.length >= 6) {
        searchOr.push({ user: { phone: { contains: phoneDigits } } });
      }
      if (mccIdList.length > 0) {
        searchOr.push({ mcc_account_id: { in: mccIdList } });
      }
      andParts.push({ OR: searchOr });
    }

    const where: Prisma.SupplierMilkOnboardingWhereInput = andParts.length > 0 ? { AND: andParts } : {};

    const [rows, total] = await Promise.all([
      this.prisma.supplierMilkOnboarding.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: safeLimit,
        select: {
          id: true,
          user_id: true,
          mcc_account_id: true,
          created_at: true,
          updated_at: true,
          user: {
            select: {
              id: true,
              code: true,
              name: true,
              first_name: true,
              last_name: true,
              phone: true,
              account_type: true,
              supplier_segment: true,
              default_account: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
      this.prisma.supplierMilkOnboarding.count({ where }),
    ]);

    const mccIds = [...new Set(rows.map((r) => r.mcc_account_id).filter((x): x is string => Boolean(x)))];
    const mccAccounts =
      mccIds.length > 0
        ? await this.prisma.account.findMany({
            where: { id: { in: mccIds } },
            select: { id: true, code: true, name: true },
          })
        : [];
    const mccMap = new Map(mccAccounts.map((a) => [a.id, a]));

    const records = rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      mcc_account_id: r.mcc_account_id,
      created_at: r.created_at,
      updated_at: r.updated_at,
      user: {
        id: r.user.id,
        code: r.user.code,
        name: r.user.name,
        first_name: r.user.first_name,
        last_name: r.user.last_name,
        phone: r.user.phone,
        account_type: r.user.account_type,
        supplier_segment: r.user.supplier_segment,
      },
      linked_supplier_account: r.user.default_account,
      linked_mcc: r.mcc_account_id ? (mccMap.get(r.mcc_account_id) ?? null) : null,
    }));

    return {
      code: 200,
      status: 'success',
      message: 'Supplier onboarding records retrieved successfully.',
      data: {
        records,
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages: Math.ceil(total / safeLimit),
        },
      },
    };
  }

  async getSupplierMilkOnboardingById(user: User, accountId: string, recordId: string) {
    await this.checkAdminPermission(user, accountId);
    const row = await this.prisma.supplierMilkOnboarding.findUnique({
      where: { id: recordId },
      include: {
        user: {
          select: {
            id: true,
            code: true,
            name: true,
            first_name: true,
            last_name: true,
            phone: true,
            email: true,
            account_type: true,
            supplier_segment: true,
            nid: true,
            default_account: { select: { id: true, code: true, name: true, type: true } },
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Supplier onboarding record not found.',
      });
    }
    let linked_mcc: { id: string; code: string; name: string } | null = null;
    if (row.mcc_account_id) {
      const acc = await this.prisma.account.findUnique({
        where: { id: row.mcc_account_id },
        select: { id: true, code: true, name: true },
      });
      linked_mcc = acc;
    }
    return {
      code: 200,
      status: 'success',
      message: 'OK',
      data: {
        id: row.id,
        mcc_account_id: row.mcc_account_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        payload: row.payload,
        user: row.user,
        linked_mcc,
        linked_supplier_account: row.user.default_account,
      },
    };
  }

  async getMccOnboardingSubmissionById(user: User, accountId: string, submissionId: string) {
    await this.checkAdminPermission(user, accountId);

    const submission = await this.prisma.mccOnboardingSubmission.findUnique({
      where: { id: submissionId },
      include: {
        reviewed_by_user: { select: { id: true, name: true, email: true } },
        linked_user: { select: { id: true, name: true, email: true, phone: true } },
        linked_account: { select: { id: true, code: true, name: true, type: true, status: true } },
      },
    });

    if (!submission) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Onboarding submission not found.',
      });
    }

    const location_labels = await this.resolveMccOnboardingLocationLabels(submission);

    return {
      code: 200,
      status: 'success',
      message: 'Onboarding submission retrieved successfully.',
      data: { ...submission, location_labels },
    };
  }

  async getOnboardingOperationalConfig(user: User, accountId: string, submissionId: string) {
    await this.checkAdminPermission(user, accountId);

    const submission = await this.prisma.mccOnboardingSubmission.findUnique({
      where: { id: submissionId },
      select: { id: true, linked_account_id: true },
    });
    if (!submission) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Onboarding submission not found.',
      });
    }
    if (!submission.linked_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Submission is not linked to an account yet.',
      });
    }

    const account = await this.prisma.account.findUnique({
      where: { id: submission.linked_account_id },
      select: { id: true, code: true, name: true },
    });
    if (!account) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Linked account not found.',
      });
    }

    const [profile, snapshot] = await Promise.all([
      this.prisma.mccOperationalProfile.findUnique({
        where: { account_id: account.id },
        select: { expected_daily_deliveries: true },
      }),
      this.prisma.mccFacilitySnapshot.findUnique({
        where: { account_id: account.id },
        select: {
          tank_used_litres: true,
          tank_used_pct: true,
          cooling_temperature_c: true,
          power_status: true,
          generator_status: true,
          generator_fuel_pct: true,
          observed_at: true,
        },
      }),
    ]);

    const decNOrNull = (v: { toString(): string } | null | undefined): number | null => {
      if (v == null) return null;
      const n = Number(v.toString());
      return Number.isFinite(n) ? n : null;
    };

    return {
      code: 200,
      status: 'success',
      message: 'Operational config retrieved successfully.',
      data: {
        submission_id: submission.id,
        account,
        profile: {
          expected_daily_deliveries: profile?.expected_daily_deliveries ?? null,
        },
        facility_snapshot: {
          tank_used_litres: decNOrNull(snapshot?.tank_used_litres),
          tank_used_pct: decNOrNull(snapshot?.tank_used_pct),
          cooling_temperature_c: decNOrNull(snapshot?.cooling_temperature_c),
          power_status: snapshot?.power_status ?? null,
          generator_status: snapshot?.generator_status ?? null,
          generator_fuel_pct: decNOrNull(snapshot?.generator_fuel_pct),
          observed_at: snapshot?.observed_at?.toISOString() ?? null,
        },
      },
    };
  }

  async updateOnboardingOperationalConfig(
    user: User,
    accountId: string,
    submissionId: string,
    dto: UpdateOnboardingOperationalConfigDto,
  ) {
    await this.checkAdminPermission(user, accountId);

    const submission = await this.prisma.mccOnboardingSubmission.findUnique({
      where: { id: submissionId },
      select: { id: true, linked_account_id: true },
    });
    if (!submission) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Onboarding submission not found.',
      });
    }
    if (!submission.linked_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Submission is not linked to an account yet.',
      });
    }

    const linkedAccountId = submission.linked_account_id;
    const hasKey = (key: keyof UpdateOnboardingOperationalConfigDto) =>
      Object.prototype.hasOwnProperty.call(dto, key);
    const asFiniteNumber = (v: Prisma.Decimal | null): number | null => {
      if (v == null) return null;
      const n = Number(v.toString());
      return Number.isFinite(n) ? n : null;
    };
    const ensureRange = (label: string, value: number | null, min: number, max: number) => {
      if (value == null) return;
      if (value < min || value > max) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: `${label} must be between ${min} and ${max}.`,
        });
      }
    };

    const expectedProvided = hasKey('expected_daily_deliveries');
    if (expectedProvided) {
      const expectedValue =
        dto.expected_daily_deliveries == null || dto.expected_daily_deliveries === ''
          ? null
          : this.asInt(dto.expected_daily_deliveries);
      if (dto.expected_daily_deliveries != null && dto.expected_daily_deliveries !== '' && expectedValue == null) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'expected_daily_deliveries must be numeric.',
        });
      }
      ensureRange('expected_daily_deliveries', expectedValue, 0, 1000);

      await this.prisma.mccOperationalProfile.upsert({
        where: { account_id: linkedAccountId },
        create: {
          account_id: linkedAccountId,
          expected_daily_deliveries: expectedValue,
        },
        update: {
          expected_daily_deliveries: expectedValue,
        },
      });
    }

    const snapshotKeys: Array<keyof UpdateOnboardingOperationalConfigDto> = [
      'tank_used_litres',
      'tank_used_pct',
      'cooling_temperature_c',
      'power_status',
      'generator_status',
      'generator_fuel_pct',
      'observed_at',
    ];
    const snapshotProvided = snapshotKeys.some((key) => hasKey(key));

    if (snapshotProvided) {
      const updateData: Prisma.MccFacilitySnapshotUpdateInput = {
        source: 'admin_manual',
      };
      const createData: Prisma.MccFacilitySnapshotCreateInput = {
        account: { connect: { id: linkedAccountId } },
        source: 'admin_manual',
      };

      if (hasKey('tank_used_litres')) {
        const v = dto.tank_used_litres == null || dto.tank_used_litres === '' ? null : this.asDecimal(dto.tank_used_litres);
        if (dto.tank_used_litres != null && dto.tank_used_litres !== '' && v == null) {
          throw new BadRequestException({ code: 400, status: 'error', message: 'tank_used_litres must be numeric.' });
        }
        ensureRange('tank_used_litres', asFiniteNumber(v), 0, 200000);
        updateData.tank_used_litres = v;
        createData.tank_used_litres = v;
      }
      if (hasKey('tank_used_pct')) {
        const v = dto.tank_used_pct == null || dto.tank_used_pct === '' ? null : this.asDecimal(dto.tank_used_pct);
        if (dto.tank_used_pct != null && dto.tank_used_pct !== '' && v == null) {
          throw new BadRequestException({ code: 400, status: 'error', message: 'tank_used_pct must be numeric.' });
        }
        ensureRange('tank_used_pct', asFiniteNumber(v), 0, 100);
        updateData.tank_used_pct = v;
        createData.tank_used_pct = v;
      }
      if (hasKey('cooling_temperature_c')) {
        const v =
          dto.cooling_temperature_c == null || dto.cooling_temperature_c === ''
            ? null
            : this.asDecimal(dto.cooling_temperature_c);
        if (dto.cooling_temperature_c != null && dto.cooling_temperature_c !== '' && v == null) {
          throw new BadRequestException({
            code: 400,
            status: 'error',
            message: 'cooling_temperature_c must be numeric.',
          });
        }
        ensureRange('cooling_temperature_c', asFiniteNumber(v), -10, 25);
        updateData.cooling_temperature_c = v;
        createData.cooling_temperature_c = v;
      }
      if (hasKey('power_status')) {
        const v = this.asString(dto.power_status)?.toLowerCase() ?? null;
        updateData.power_status = v;
        createData.power_status = v;
      }
      if (hasKey('generator_status')) {
        const v = this.asString(dto.generator_status)?.toLowerCase() ?? null;
        updateData.generator_status = v;
        createData.generator_status = v;
      }
      if (hasKey('generator_fuel_pct')) {
        const v =
          dto.generator_fuel_pct == null || dto.generator_fuel_pct === ''
            ? null
            : this.asDecimal(dto.generator_fuel_pct);
        if (dto.generator_fuel_pct != null && dto.generator_fuel_pct !== '' && v == null) {
          throw new BadRequestException({
            code: 400,
            status: 'error',
            message: 'generator_fuel_pct must be numeric.',
          });
        }
        ensureRange('generator_fuel_pct', asFiniteNumber(v), 0, 100);
        updateData.generator_fuel_pct = v;
        createData.generator_fuel_pct = v;
      }
      if (hasKey('observed_at')) {
        if (dto.observed_at == null || dto.observed_at === '') {
          updateData.observed_at = null;
          createData.observed_at = null;
        } else {
          const observedAt = new Date(dto.observed_at);
          if (Number.isNaN(observedAt.getTime())) {
            throw new BadRequestException({
              code: 400,
              status: 'error',
              message: 'observed_at must be a valid ISO date.',
            });
          }
          updateData.observed_at = observedAt;
          createData.observed_at = observedAt;
        }
      } else {
        const now = new Date();
        updateData.observed_at = now;
        createData.observed_at = now;
      }

      await this.prisma.mccFacilitySnapshot.upsert({
        where: { account_id: linkedAccountId },
        create: createData,
        update: updateData,
      });
    }

    return this.getOnboardingOperationalConfig(user, accountId, submissionId);
  }

  async syncOnboardingOperationalConfigFromDefaults(user: User, accountId: string, submissionId: string) {
    await this.checkAdminPermission(user, accountId);

    const submission = await this.prisma.mccOnboardingSubmission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        submission_code: true,
        linked_account_id: true,
        section_payload: true,
      },
    });
    if (!submission) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Onboarding submission not found.',
      });
    }
    if (!submission.linked_account_id) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Submission is not linked to an account yet.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await this.syncMccOperationalDataFromOnboarding(tx, submission.linked_account_id!, {
        id: submission.id,
        submission_code: submission.submission_code,
        section_payload: submission.section_payload,
      });
    });

    return this.getOnboardingOperationalConfig(user, accountId, submissionId);
  }

  async linkMccOnboardingSubmission(
    user: User,
    accountId: string,
    submissionId: string,
    dto: { linkUserId: string; linkAccountId?: string },
  ) {
    await this.checkAdminPermission(user, accountId);

    const uid = dto.linkUserId.trim();
    const aid = dto.linkAccountId?.trim();

    const submission = await this.prisma.mccOnboardingSubmission.findUnique({ where: { id: submissionId } });
    if (!submission) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Onboarding submission not found.',
      });
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id: uid } });
    if (!targetUser) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'User not found.',
      });
    }

    let linkedAccountId: string | null = null;

    const tenantMemberships = await this.prisma.userAccount.findMany({
      where: {
        user_id: uid,
        status: 'active',
        account: { status: 'active', type: { in: ['tenant', 'branch'] } },
      },
      include: {
        account: { select: { id: true, code: true, name: true, type: true, status: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    if (!aid) {
      if (tenantMemberships.length === 1) {
        linkedAccountId = tenantMemberships[0].account_id;
      } else if (tenantMemberships.length > 1) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message:
            'This user belongs to multiple MCC tenant accounts. Select the tenant account that matches this onboarding (same name as the business), then save the link.',
        });
      }
    }

    if (aid) {
      const membership = await this.prisma.userAccount.findFirst({
        where: {
          user_id: uid,
          account_id: aid,
          status: 'active',
        },
        include: {
          account: {
            select: { id: true, code: true, name: true, type: true, status: true },
          },
        },
      });

      if (!membership?.account) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'That user is not an active member of the selected account.',
        });
      }

      if (membership.account.status !== 'active') {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Account is not active.',
        });
      }

      if (!['tenant', 'branch'].includes(membership.account.type)) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Only tenant or branch accounts can be linked for MCC onboarding.',
        });
      }

      linkedAccountId = membership.account.id;
    }

    if (linkedAccountId) {
      const linkedAccount = await this.prisma.account.findUnique({
        where: { id: linkedAccountId },
        select: { name: true, code: true },
      });
      if (
        linkedAccount?.name &&
        submission.business_name &&
        !mccNamesLikelyMatch(linkedAccount.name, submission.business_name)
      ) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: `Account "${linkedAccount.name}" (${linkedAccount.code ?? '—'}) does not match onboarding business "${submission.business_name}". Choose the tenant the manager actually uses (e.g. their dashboard account), not a duplicate created during approve.`,
        });
      }
    }

    const updated = await this.prisma.mccOnboardingSubmission.update({
      where: { id: submissionId },
      data: {
        linked_user_id: uid,
        linked_account_id: linkedAccountId,
      },
      include: {
        linked_user: { select: { id: true, name: true, email: true, phone: true } },
        linked_account: { select: { id: true, code: true, name: true, type: true, status: true } },
      },
    });

    if (linkedAccountId) {
      await this.applyOnboardingToAccountOperationalProfile(linkedAccountId, {
        id: submission.id,
        submission_code: submission.submission_code,
        section_payload: submission.section_payload,
      });
    }

    return {
      code: 200,
      status: 'success',
      message: linkedAccountId
        ? 'Submission linked to user and tenant. Operational profile synced — managers on this account will see onboarding tanks and profile on their dashboard.'
        : 'Submission linked to user only (no tenant). Select the MCC tenant account to sync onboarding data to the manager dashboard.',
      data: updated,
    };
  }

  /**
   * Human-friendly export for MCC onboarding.
   * One row per submission with curated columns (business/manager/review + key section values),
   * not a full flattened JSON dump.
   */
  private async buildMccOnboardingExportRows(
    user: User,
    accountId: string,
    reviewStatus?: string,
    onboardedFrom?: string,
    onboardedTo?: string,
    tzOffsetMinutes?: number,
  ) {
    await this.checkAdminPermission(user, accountId);

    const where: Prisma.MccOnboardingSubmissionWhereInput = {};
    const validStatuses: MccOnboardingReviewStatus[] = [
      MccOnboardingReviewStatus.pending,
      MccOnboardingReviewStatus.approved,
      MccOnboardingReviewStatus.rejected,
      MccOnboardingReviewStatus.needs_changes,
    ];
    if (reviewStatus && validStatuses.includes(reviewStatus as MccOnboardingReviewStatus)) {
      where.review_status = reviewStatus as MccOnboardingReviewStatus;
    }
    if (onboardedFrom || onboardedTo) {
      const createdAt: Prisma.DateTimeFilter = {};
      const offset = Number.isFinite(tzOffsetMinutes as number) ? (tzOffsetMinutes as number) : 0;
      if (onboardedFrom) {
        const from = this.parseClientLocalDateToUtcBoundary(onboardedFrom, offset, false);
        if (from) createdAt.gte = from;
      }
      if (onboardedTo) {
        const to = this.parseClientLocalDateToUtcBoundary(onboardedTo, offset, true);
        if (to) createdAt.lte = to;
      }
      if (Object.keys(createdAt).length > 0) {
        where.created_at = createdAt;
      }
    }

    const MAX_EXPORT = 5000;
    const submissions = await this.prisma.mccOnboardingSubmission.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: MAX_EXPORT,
      include: {
        reviewed_by_user: { select: { name: true, email: true } },
        linked_user: { select: { name: true, email: true, phone: true } },
        linked_account: { select: { code: true, name: true, status: true } },
      },
    });

    const toStr = (v: unknown) => (v == null || v === undefined ? '' : String(v));
    const numStr = (v: unknown) => {
      if (v === null || v === undefined || v === '') return '';
      const n = Number(v);
      return Number.isFinite(n) ? String(n) : '';
    };
    const pick = (o: Record<string, unknown>, key: string) => toStr(o[key]);
    const rows: Record<string, string>[] = [];

    for (const s of submissions) {
      const labels = await this.resolveMccOnboardingLocationLabels(s);
      const { section_payload, reviewed_by_user, linked_user, linked_account } = s;
      const payload =
        section_payload && typeof section_payload === 'object' && !Array.isArray(section_payload)
          ? (section_payload as Record<string, unknown>)
          : {};
      const s1 =
        payload.section1Location && typeof payload.section1Location === 'object' && !Array.isArray(payload.section1Location)
          ? (payload.section1Location as Record<string, unknown>)
          : {};
      const s2 =
        payload.section2 && typeof payload.section2 === 'object' && !Array.isArray(payload.section2)
          ? (payload.section2 as Record<string, unknown>)
          : {};
      const s3 =
        payload.section3 && typeof payload.section3 === 'object' && !Array.isArray(payload.section3)
          ? (payload.section3 as Record<string, unknown>)
          : {};
      const s4 =
        payload.section4 && typeof payload.section4 === 'object' && !Array.isArray(payload.section4)
          ? (payload.section4 as Record<string, unknown>)
          : {};
      const s5 =
        payload.section5 && typeof payload.section5 === 'object' && !Array.isArray(payload.section5)
          ? (payload.section5 as Record<string, unknown>)
          : {};
      const s6 =
        payload.section6 && typeof payload.section6 === 'object' && !Array.isArray(payload.section6)
          ? (payload.section6 as Record<string, unknown>)
          : {};
      const s7 =
        payload.section7 && typeof payload.section7 === 'object' && !Array.isArray(payload.section7)
          ? (payload.section7 as Record<string, unknown>)
          : {};

      const coolingTanks = Array.isArray(s2.coolingTanks)
        ? (s2.coolingTanks as Array<Record<string, unknown>>)
        : [];
      const totalCoolingCapacity = coolingTanks.reduce((sum, t) => sum + (Number(t.capacityLitres) || 0), 0);

      const rejectionRankings =
        s4.rejectionRankings && typeof s4.rejectionRankings === 'object' && !Array.isArray(s4.rejectionRankings)
          ? (s4.rejectionRankings as Record<string, unknown>)
          : {};
      const rankedReasons = Object.entries(rejectionRankings)
        .map(([reason, rank]) => ({ reason, rank: Number(rank) }))
        .filter((x) => Number.isFinite(x.rank) && x.rank >= 1 && x.rank <= 3)
        .sort((a, b) => a.rank - b.rank)
        .map((x) => `${x.rank}. ${x.reason}`)
        .join(' | ');

      const assessment =
        s7.assessment && typeof s7.assessment === 'object' && !Array.isArray(s7.assessment)
          ? (s7.assessment as Record<string, unknown>)
          : {};

      const row: Record<string, string> = {
        id: toStr(s.id),
        submission_code: toStr(s.submission_code),
        created_at: s.created_at.toISOString(),
        business_name: toStr(s.business_name),
        common_name: toStr(s.common_name),
        manager_first_name: toStr(s.manager_first_name),
        manager_last_name: toStr(s.manager_last_name),
        manager_phone: toStr(s.manager_phone),
        manager_id_number: toStr(s.manager_id_number),
        location_path: labels.path,
        location_label_province: labels.province,
        location_label_district: labels.district,
        location_label_sector: labels.sector,
        location_label_cell: labels.cell,
        location_label_village: labels.village,
        section1_latitude: pick(s1, 'latitude'),
        section1_longitude: pick(s1, 'longitude'),

        final_decision: toStr(s.final_decision),
        pass_count: toStr(s.pass_count),
        review_status: toStr(s.review_status),
        review_notes: s.review_notes != null ? String(s.review_notes) : '',
        reviewed_at: s.reviewed_at ? s.reviewed_at.toISOString() : '',
        reviewed_by_name: reviewed_by_user?.name ?? '',
        linked_user_id: toStr(s.linked_user_id),
        linked_user_name: linked_user?.name ?? '',
        linked_user_phone: linked_user?.phone ?? '',
        linked_account_code: linked_account?.code ?? '',
        linked_account_name: linked_account?.name ?? '',
        linked_account_status: linked_account?.status ?? '',
        google_sheet_status: toStr(s.google_sheet_status),
        google_sheet_error: s.google_sheet_error != null ? String(s.google_sheet_error) : '',

        section2_tank_count: String(coolingTanks.length),
        section2_total_cooling_capacity_litres: numStr(totalCoolingCapacity),
        section2_daily_milk_volume_litres: numStr(s2.dailyMilkVolume),
        section2_max_milk_one_day_litres: numStr(s2.maxMilkInOneDay),
        section2_tank_capacity_sufficiency: pick(s2, 'tankCapacitySufficiency'),
        section2_generator_capacity_kva: numStr(s2.generatorCapacityKva),
        section2_mobile_connectivity: pick(s2, 'mobileConnectivity'),
        section2_power_supply_sources: Array.isArray(s2.powerSupplySelections)
          ? (s2.powerSupplySelections as unknown[]).map((x) => toStr(x)).join('; ')
          : '',

        section3_total_farmers_supplying: numStr(s3.totalFarmersSupplying),
        section3_new_farmers_last_3_months: numStr(s3.newFarmersLast3Months),
        section3_transporters_count: numStr(s3.milkTransportersCount),
        section3_average_distance_km: numStr(s3.averageDistanceKm),
        section3_furthest_farm_km: numStr(s3.furthestFarmKm),
        section3_evening_milk_pattern: pick(s3, 'eveningMilkPattern'),
        section3_own_transport_type: pick(s3, 'ownMilkTransportType'),

        section4_testing_equipment: Array.isArray(s4.testingEquipmentSelections)
          ? (s4.testingEquipmentSelections as unknown[]).map((x) => toStr(x)).join('; ')
          : '',
        section4_quality_tests: Array.isArray(s4.qualityTestsSelections)
          ? (s4.qualityTestsSelections as unknown[]).map((x) => toStr(x)).join('; ')
          : '',
        section4_avg_rejected_per_day_litres: numStr(s4.averageRejectedPerDayLitres),
        section4_rejection_rate_percent: numStr(s4.rejectionRatePercent),
        section4_top_rejection_reasons: rankedReasons,
        section4_other_rejection_reason: pick(s4, 'otherRejectionReason'),

        section5_staff_total: numStr(s5.staffTotalIncludingManager),
        section5_staff_women: numStr(s5.staffWomenCount),
        section5_staff_aged_18_35: numStr(s5.staffAged1835),
        section5_staff_women_aged_18_35: numStr(s5.staffWomen1835),
        section5_staff_with_disability: numStr(s5.staffWithDisability),
        section5_members_total: numStr(s5.coopMembersTotal),
        section5_members_women: numStr(s5.coopMembersWomen),
        section5_members_aged_18_35: numStr(s5.coopMembersAged1835),
        section5_members_women_aged_18_35: numStr(s5.coopMembersWomen1835),

        section6_record_system: pick(s6, 'recordSystem'),
        section6_staff_training_status: pick(s6, 'staffTrainingStatus'),
        section6_employment_contracts_status: pick(s6, 'employmentContractsStatus'),
        section6_digital_ledger_willingness: pick(s6, 'digitalLedgerWillingness'),
        section6_digital_devices_available: Array.isArray(s6.digitalDeviceAccess)
          ? (s6.digitalDeviceAccess as unknown[]).map((x) => toStr(x)).join('; ')
          : '',
        section6_farmer_payment_methods: Array.isArray(s6.farmerPaymentMethods)
          ? (s6.farmerPaymentMethods as unknown[]).map((x) => toStr(x)).join('; ')
          : '',
        section6_avg_days_delivery_to_payment: numStr(s6.avgDaysDeliveryToPayment),
        section6_average_annual_revenue_rwf: numStr(s6.averageAnnualRevenueRwf),
        section6_milk_sales_destinations: Array.isArray(s6.milkSalesDestinations)
          ? (s6.milkSalesDestinations as unknown[]).map((x) => toStr(x)).join('; ')
          : '',
        section6_main_buyer_name: pick(s6, 'mainBuyerName'),
        section6_formal_supply_agreement: pick(s6, 'formalSupplyAgreementDetails'),

        section7_key_gaps: pick(s7, 'keyGaps'),
        section7_decision: pick(s7, 'decision'),
        section7_pass_count: numStr(s7.passCount),
        section7_result_cooling_capacity: toStr(assessment.coolingCapacity),
        section7_result_connectivity_viable: toStr(assessment.connectivityViable),
        section7_result_power_backup: toStr(assessment.powerBackup),
        section7_result_ledger_willingness: toStr(assessment.ledgerWillingness),
        section7_result_quality_equipment: toStr(assessment.qualityEquipment),
        section7_result_aml_clear: toStr(assessment.amlClear),
        section7_result_min_farmers: toStr(assessment.minFarmers),
        section7_result_rejection_tracking: toStr(assessment.rejectionTracking),
      };
      rows.push(row);
    }

    return rows;
  }

  async exportMccOnboardingSubmissionsCsv(
    user: User,
    accountId: string,
    reviewStatus?: string,
    onboardedFrom?: string,
    onboardedTo?: string,
    tzOffsetMinutes?: number,
  ) {
    const rows = await this.buildMccOnboardingExportRows(
      user,
      accountId,
      reviewStatus,
      onboardedFrom,
      onboardedTo,
      tzOffsetMinutes,
    );
    return buildCsvFromRows(rows);
  }

  async exportMccOnboardingSubmissionsXlsx(
    user: User,
    accountId: string,
    reviewStatus?: string,
    onboardedFrom?: string,
    onboardedTo?: string,
    tzOffsetMinutes?: number,
  ): Promise<Buffer> {
    const rows = await this.buildMccOnboardingExportRows(
      user,
      accountId,
      reviewStatus,
      onboardedFrom,
      onboardedTo,
      tzOffsetMinutes,
    );
    const keySet = new Set<string>();
    for (const row of rows) {
      Object.keys(row).forEach((key) => keySet.add(key));
    }

    const orderedPrimaryKeys = MCC_ONBOARDING_CSV_PRIMARY_KEYS.filter((k) => keySet.has(k));
    for (const k of MCC_ONBOARDING_CSV_PRIMARY_KEYS) keySet.delete(k);
    const remainingKeys = [...keySet].sort((a, b) => a.localeCompare(b, 'en'));
    const headers = [...orderedPrimaryKeys, ...remainingKeys];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Gemura Admin';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('MCC Onboarding');

    sheet.columns = headers.map((key) => ({
      header: resolveMccOnboardingColumnTitle(key),
      key,
      width: 24,
    }));

    for (const row of rows) {
      const excelRow: Record<string, string> = {};
      for (const key of headers) {
        excelRow[key] = humanizeMccOnboardingValue(key, row[key] ?? '');
      }
      sheet.addRow(excelRow);
    }

    if (sheet.rowCount > 0) {
      sheet.getRow(1).font = { bold: true };
    }
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.columns.forEach((col) => {
      if (!col.width || col.width < 20) col.width = 20;
    });

    const out = await workbook.xlsx.writeBuffer();
    return Buffer.from(out);
  }

  async approveMccOnboardingSubmission(
    user: User,
    accountId: string,
    submissionId: string,
    dto: { password?: string; linkExistingUserId?: string; linkExistingAccountId?: string; reviewNotes?: string },
  ) {
    await this.checkAdminPermission(user, accountId);

    const result = await this.prisma.$transaction(async (tx) => {
      const submission = await tx.mccOnboardingSubmission.findUnique({ where: { id: submissionId } });
      if (!submission) {
        throw new NotFoundException({
          code: 404,
          status: 'error',
          message: 'Onboarding submission not found.',
        });
      }

      if (submission.review_status === MccOnboardingReviewStatus.approved && submission.linked_user_id) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'This submission is already approved and linked to a user.',
        });
      }

      if (
        submission.review_status !== MccOnboardingReviewStatus.pending &&
        submission.review_status !== MccOnboardingReviewStatus.needs_changes
      ) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Only pending or needs_changes submissions can be approved.',
        });
      }

      const linkExistingAccountId = dto.linkExistingAccountId?.trim();
      if (linkExistingAccountId) {
        const uid = dto.linkExistingUserId?.trim();
        if (!uid) {
          throw new BadRequestException({
            code: 400,
            status: 'error',
            message: 'linkExistingUserId is required when linkExistingAccountId is set.',
          });
        }

        const existingUser = await tx.user.findUnique({ where: { id: uid } });
        if (!existingUser) {
          throw new BadRequestException({
            code: 400,
            status: 'error',
            message: 'Existing user not found.',
          });
        }

        const membership = await tx.userAccount.findFirst({
          where: {
            user_id: uid,
            account_id: linkExistingAccountId,
            status: 'active',
          },
          include: {
            account: {
              select: { id: true, code: true, name: true, type: true, status: true },
            },
          },
        });

        if (!membership?.account) {
          throw new BadRequestException({
            code: 400,
            status: 'error',
            message: 'That user is not an active member of the selected account.',
          });
        }

        if (membership.account.status !== 'active') {
          throw new BadRequestException({
            code: 400,
            status: 'error',
            message: 'Account is not active.',
          });
        }

        if (!['tenant', 'branch'].includes(membership.account.type)) {
          throw new BadRequestException({
            code: 400,
            status: 'error',
            message: 'Only tenant or branch accounts can be linked for MCC KYC.',
          });
        }

        if (
          membership.account.name &&
          submission.business_name &&
          !mccNamesLikelyMatch(membership.account.name, submission.business_name)
        ) {
          throw new BadRequestException({
            code: 400,
            status: 'error',
            message: `Account "${membership.account.name}" does not match onboarding business "${submission.business_name}". Use the tenant the manager logs into.`,
          });
        }

        const updatedSubmission = await tx.mccOnboardingSubmission.update({
          where: { id: submissionId },
          data: {
            review_status: MccOnboardingReviewStatus.approved,
            review_notes: dto.reviewNotes ?? null,
            reviewed_at: new Date(),
            reviewed_by_user_id: user.id,
            linked_user_id: existingUser.id,
            linked_account_id: membership.account.id,
          },
        });
        await this.syncMccOperationalDataFromOnboarding(tx, membership.account.id, submission);

        return {
          flow: 'kyc_existing' as const,
          updatedSubmission,
          linkedUser: existingUser,
          linkedAccount: membership.account,
        };
      }

      const plainPassword =
        dto.password && dto.password.length >= 8 ? dto.password : this.generateOnboardingTempPassword();

      const managerPhoneDigits = this.normalizePhoneDigits(submission.manager_phone);
      if (!managerPhoneDigits || managerPhoneDigits.length < 9) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Submission has an invalid manager phone number.',
        });
      }

      let linkedUser: User;

      if (dto.linkExistingUserId) {
        const existing = await tx.user.findUnique({ where: { id: dto.linkExistingUserId } });
        if (!existing) {
          throw new BadRequestException({
            code: 400,
            status: 'error',
            message: 'Existing user not found.',
          });
        }
        const existingDigits = this.normalizePhoneDigits(existing.phone || '');
        if (existingDigits !== managerPhoneDigits) {
          throw new BadRequestException({
            code: 400,
            status: 'error',
            message: 'Existing user phone does not match submission manager phone.',
          });
        }
        linkedUser = existing;
      } else {
        const dup = await tx.user.findFirst({ where: { phone: managerPhoneDigits } });
        if (dup) {
          const existingMembership = await tx.userAccount.findFirst({
            where: {
              user_id: dup.id,
              status: 'active',
              account: {
                status: 'active',
                type: { in: ['tenant', 'branch'] },
              },
            },
            include: {
              account: {
                select: { id: true, code: true, name: true, type: true, status: true },
              },
            },
            orderBy: { created_at: 'desc' },
          });

          if (!existingMembership?.account) {
            throw new BadRequestException({
              code: 400,
              status: 'error',
              message:
                'A user with this phone already exists, but no active tenant/branch membership was found to link. Provide linkExistingAccountId with a valid active membership.',
            });
          }

          const updatedSubmission = await tx.mccOnboardingSubmission.update({
            where: { id: submissionId },
            data: {
              review_status: MccOnboardingReviewStatus.approved,
              review_notes: dto.reviewNotes ?? null,
              reviewed_at: new Date(),
              reviewed_by_user_id: user.id,
              linked_user_id: dup.id,
              linked_account_id: existingMembership.account.id,
            },
          });
          await this.syncMccOperationalDataFromOnboarding(tx, existingMembership.account.id, submission);

          return {
            flow: 'kyc_existing' as const,
            updatedSubmission,
            linkedUser: dup,
            linkedAccount: existingMembership.account,
          };
        }
        const hashedPassword = await bcrypt.hash(plainPassword, 10);
        const fn = (submission.manager_first_name ?? '').trim();
        const ln = (submission.manager_last_name ?? '').trim();
        const displayName = composeUserFullName(fn, ln) || submission.business_name.trim();
        linkedUser = await tx.user.create({
          data: {
            first_name: fn || displayName,
            last_name: ln,
            name: displayName,
            phone: managerPhoneDigits,
            email: null,
            nid: submission.manager_id_number,
            password_hash: hashedPassword,
            account_type: 'mcc',
            status: 'active',
            registration_type: 'onboarded',
            created_by: user.id,
          },
        });
      }

      const safeCode = submission.submission_code.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
      const accountCode = `ACC_ONB_${safeCode}`;

      const accountName = submission.common_name?.trim() || submission.business_name;
      const newAccount = await tx.account.create({
        data: {
          code: accountCode,
          name: accountName,
          type: 'tenant',
          status: 'active',
          created_by: user.id,
        },
      });

      const ownerPermissions = { can_manage: true, can_view: true, can_edit: true };
      await tx.userAccount.create({
        data: {
          user_id: linkedUser.id,
          account_id: newAccount.id,
          role: 'system_admin',
          permissions: ownerPermissions as unknown as Prisma.InputJsonValue,
          status: 'active',
          created_by: user.id,
        },
      });

      const walletCode = `W_ONB_${submission.id.replace(/-/g, '').slice(0, 24)}`;
      await tx.wallet.create({
        data: {
          code: walletCode,
          account_id: newAccount.id,
          type: 'regular',
          is_joint: false,
          is_default: true,
          balance: new Prisma.Decimal(0),
          currency: 'RWF',
          status: 'active',
          created_by: user.id,
        },
      });

      if (!linkedUser.default_account_id) {
        await tx.user.update({
          where: { id: linkedUser.id },
          data: { default_account_id: newAccount.id, updated_by: user.id },
        });
      }

      const updatedSubmission = await tx.mccOnboardingSubmission.update({
        where: { id: submissionId },
        data: {
          review_status: MccOnboardingReviewStatus.approved,
          review_notes: dto.reviewNotes ?? null,
          reviewed_at: new Date(),
          reviewed_by_user_id: user.id,
          linked_user_id: linkedUser.id,
          linked_account_id: newAccount.id,
        },
      });
      await this.syncMccOperationalDataFromOnboarding(tx, newAccount.id, submission);

      return {
        flow: 'create_tenant' as const,
        updatedSubmission,
        linkedUser,
        newAccount,
        createdNewUser: !dto.linkExistingUserId,
        plainPassword,
      };
    });

    if (result.flow === 'kyc_existing') {
      return {
        code: 200,
        status: 'success',
        message: 'Submission approved and linked as KYC to the selected tenant.',
        data: {
          submission: result.updatedSubmission,
          user: {
            id: result.linkedUser.id,
            name: result.linkedUser.name,
            phone: result.linkedUser.phone,
            email: result.linkedUser.email,
          },
          account: {
            id: result.linkedAccount.id,
            code: result.linkedAccount.code,
            name: result.linkedAccount.name,
          },
          tempPassword: undefined,
        },
      };
    }

    return {
      code: 200,
      status: 'success',
      message: 'Submission approved. Account and access created.',
      data: {
        submission: result.updatedSubmission,
        user: {
          id: result.linkedUser.id,
          name: result.linkedUser.name,
          phone: result.linkedUser.phone,
          email: result.linkedUser.email,
        },
        account: {
          id: result.newAccount.id,
          code: result.newAccount.code,
          name: result.newAccount.name,
        },
        tempPassword: result.createdNewUser ? result.plainPassword : undefined,
      },
    };
  }

  async rejectMccOnboardingSubmission(user: User, accountId: string, submissionId: string, notes: string) {
    await this.checkAdminPermission(user, accountId);

    const submission = await this.prisma.mccOnboardingSubmission.findUnique({ where: { id: submissionId } });
    if (!submission) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Onboarding submission not found.',
      });
    }
    if (submission.review_status === MccOnboardingReviewStatus.approved) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Cannot reject an already approved submission.',
      });
    }

    const updated = await this.prisma.mccOnboardingSubmission.update({
      where: { id: submissionId },
      data: {
        review_status: MccOnboardingReviewStatus.rejected,
        review_notes: notes,
        reviewed_at: new Date(),
        reviewed_by_user_id: user.id,
      },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Submission rejected.',
      data: updated,
    };
  }

  async needsChangesMccOnboardingSubmission(user: User, accountId: string, submissionId: string, notes: string) {
    await this.checkAdminPermission(user, accountId);

    const submission = await this.prisma.mccOnboardingSubmission.findUnique({ where: { id: submissionId } });
    if (!submission) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Onboarding submission not found.',
      });
    }
    if (submission.review_status === MccOnboardingReviewStatus.approved) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Cannot request changes on an already approved submission.',
      });
    }

    const updated = await this.prisma.mccOnboardingSubmission.update({
      where: { id: submissionId },
      data: {
        review_status: MccOnboardingReviewStatus.needs_changes,
        review_notes: notes,
        reviewed_at: new Date(),
        reviewed_by_user_id: user.id,
      },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Submission marked as needs changes.',
      data: updated,
    };
  }
}
