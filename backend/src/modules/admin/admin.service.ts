import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MccOnboardingReviewStatus, Prisma, User } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ImmisService } from '../immis/immis.service';
import { LocationsService } from '../locations/locations.service';
import * as bcrypt from 'bcrypt';
import {
  ROLES,
  PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  type RoleCode,
} from './roles-permissions.config';
import * as ExcelJS from 'exceljs';
import {
  buildCsvFromRows,
  humanizeMccOnboardingValue,
  MCC_ONBOARDING_CSV_PRIMARY_KEYS,
  resolveMccOnboardingColumnTitle,
} from './mcc-onboarding-csv.util';

export type UserActivityMetric =
  | 'suppliers'
  | 'customers'
  | 'sales'
  | 'collections'
  | 'farms'
  | 'accounts';

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

  /** UUID v4 (and common variants) — used to tell `locations.id` from fallback text names. */
  private static readonly LOCATION_UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  constructor(
    private prisma: PrismaService,
    private immisService: ImmisService,
    private locationsService: LocationsService,
  ) {}

  private normalizeGroupCount(row: { _count?: number | { _all?: number } }): number {
    if (typeof row._count === 'number') return row._count;
    return row._count?._all ?? 0;
  }

  private async getUserOperationalStats(userIds: string[]) {
    const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
    const empty = Object.fromEntries(
      uniqueUserIds.map((id) => [
        id,
        {
          accounts: 0,
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

    const [
      suppliersByCustomerAccount,
      customersBySupplierAccount,
      salesBySupplierAccount,
      collectionsByCustomerAccount,
      farmsByAccount,
    ] = await Promise.all([
      this.prisma.supplierCustomer.groupBy({
        by: ['customer_account_id'],
        where: {
          customer_account_id: { in: accountIds },
          relationship_status: 'active',
        },
        _count: true,
      }),
      this.prisma.supplierCustomer.groupBy({
        by: ['supplier_account_id'],
        where: {
          supplier_account_id: { in: accountIds },
          relationship_status: 'active',
        },
        _count: true,
      }),
      this.prisma.milkSale.groupBy({
        by: ['supplier_account_id'],
        where: {
          supplier_account_id: { in: accountIds },
          status: { not: 'deleted' },
        },
        _count: true,
      }),
      this.prisma.milkSale.groupBy({
        by: ['customer_account_id'],
        where: {
          customer_account_id: { in: accountIds },
          status: { not: 'deleted' },
        },
        _count: true,
      }),
      this.prisma.farm.groupBy({
        by: ['account_id'],
        where: {
          account_id: { in: accountIds },
        },
        _count: true,
      }),
    ]);

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
    const farmsByAccountId = new Map(
      farmsByAccount.map((row) => [row.account_id, this.normalizeGroupCount(row)]),
    );

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
        empty[userId].suppliers += suppliersByAccountId.get(linkedAccountId) ?? 0;
        empty[userId].customers += customersByAccountId.get(linkedAccountId) ?? 0;
        empty[userId].sales += salesByAccountId.get(linkedAccountId) ?? 0;
        empty[userId].collections += collectionsByAccountId.get(linkedAccountId) ?? 0;
        empty[userId].farms += farmsByAccountId.get(linkedAccountId) ?? 0;
      }
    }

    return empty;
  }

  /**
   * Check if user has admin permission
   */
  private async checkAdminPermission(user: User, accountId: string): Promise<void> {
    const userAccount = await this.prisma.userAccount.findFirst({
      where: {
        user_id: user.id,
        account_id: accountId,
        status: 'active',
      },
    });

    if (!userAccount) {
      throw new ForbiddenException({
        code: 403,
        status: 'error',
        message: 'No active account access found.',
      });
    }

    // Owner and admin have all permissions
    if (userAccount.role === 'owner' || userAccount.role === 'admin') {
      return;
    }

    // Check for manage_users permission
    let permissions: any = null;
    if (userAccount.permissions) {
      if (typeof userAccount.permissions === 'string') {
        try {
          permissions = JSON.parse(userAccount.permissions);
        } catch {
          permissions = null;
        }
      } else {
        permissions = userAccount.permissions;
      }
    }

    if (!permissions) {
      throw new ForbiddenException({
        code: 403,
        status: 'error',
        message: 'Insufficient permissions to manage users.',
      });
    }

    let hasPermission = false;
    if (Array.isArray(permissions)) {
      hasPermission = permissions.includes('manage_users');
    } else if (typeof permissions === 'object') {
      hasPermission = permissions['manage_users'] === true;
    }

    if (!hasPermission) {
      throw new ForbiddenException({
        code: 403,
        status: 'error',
        message: 'Insufficient permissions to manage users.',
      });
    }
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

    if (role) {
      where.user_accounts = {
        some: {
          account_id: accountId,
          role,
        },
      };
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

    const statsByUserId = await this.getUserOperationalStats(users.map((u) => u.id));

    return {
      code: 200,
      status: 'success',
      message: 'Users retrieved successfully.',
      data: {
        users: users.map((u) => ({
          ...u,
          role: u.user_accounts[0]?.role || null,
          permissions: u.user_accounts[0]?.permissions || null,
          stats: statsByUserId[u.id],
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

    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        user_accounts: {
          include: {
            account: {
              select: {
                id: true,
                code: true,
                name: true,
              },
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

    const ua =
      targetUser.user_accounts?.find((row) => row.account_id === accountId && row.status === 'active') ?? null;

    let permissions: Record<string, boolean> | null = null;
    if (ua?.permissions) {
      try {
        permissions = typeof ua.permissions === 'string' ? JSON.parse(ua.permissions) : ua.permissions;
      } catch {
        permissions = null;
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
      permissions,
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

    if (resource === 'members') {
      const userAnd: Prisma.UserWhereInput[] = [];
      const q = filters.search?.trim();
      if (q) {
        userAnd.push({
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
          ],
        });
      }
      if (filters.status?.trim()) {
        userAnd.push({ status: filters.status.trim() });
      }

      const rows = await this.prisma.userAccount.findMany({
        where: {
          account_id: opAccountId,
          status: 'active',
          ...(userAnd.length ? { user: { AND: userAnd } } : {}),
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
          account: { select: { id: true, code: true, name: true } },
        },
        orderBy: { created_at: 'desc' },
        take: 1000,
      });

      const data = rows.map((ua) => ({
        id: ua.user?.id ?? ua.id,
        name: ua.user?.name ?? null,
        email: ua.user?.email ?? null,
        phone: ua.user?.phone ?? null,
        account: ua.account ? { id: ua.account.id, code: ua.account.code, name: ua.account.name } : null,
        role: ua.role,
        relationship_status: ua.status,
        status: ua.user?.status ?? ua.status,
      }));

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
    const newUser = await this.prisma.user.create({
      data: {
        name: createDto.name,
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
    if (createDto.role || createDto.permissions) {
      await this.prisma.userAccount.create({
        data: {
          user_id: newUser.id,
          account_id: accountId,
          role: createDto.role || 'viewer',
          permissions: createDto.permissions ? JSON.stringify(createDto.permissions) : null,
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

    // Hash password if provided
    const updateData: any = {
      ...updateDto,
      updated_by: user.id,
    };

    if (updateDto.password) {
      updateData.password_hash = await bcrypt.hash(updateDto.password, 10);
      delete updateData.password;
    }

    if (updateDto.email) {
      updateData.email = updateDto.email.toLowerCase();
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Update user account access if role/permissions provided
    if (updateDto.role !== undefined || updateDto.permissions !== undefined) {
      const userAccount = await this.prisma.userAccount.findFirst({
        where: {
          user_id: userId,
          account_id: accountId,
        },
      });

      if (userAccount) {
        await this.prisma.userAccount.update({
          where: { id: userAccount.id },
          data: {
            role: updateDto.role || userAccount.role,
            permissions: updateDto.permissions ? JSON.stringify(updateDto.permissions) : userAccount.permissions,
            updated_by: user.id,
          },
        });
      } else if (updateDto.role || updateDto.permissions) {
        // Create new user account access
        await this.prisma.userAccount.create({
          data: {
            user_id: userId,
            account_id: accountId,
            role: updateDto.role || 'viewer',
            permissions: updateDto.permissions ? JSON.stringify(updateDto.permissions) : null,
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

    const statsByUserId = await this.getUserOperationalStats(users.map((u) => u.id));

    const headers = ['Name', 'Email', 'Phone', 'Account Type', 'Role', 'Suppliers', 'Customers', 'Sales', 'Collections', 'Farms', 'Status', 'Created At'];

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
        const stats = statsByUserId[u.id] ?? { suppliers: 0, customers: 0, sales: 0, collections: 0, farms: 0 };
        return [
          escape(u.name),
          escape(u.email),
          escape(u.phone),
          escape(u.account_type),
          escape(u.user_accounts[0]?.role ?? ''),
          escape(stats.suppliers),
          escape(stats.customers),
          escape(stats.sales),
          escape(stats.collections),
          escape(stats.farms),
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

  /**
   * Get dashboard statistics with comprehensive metrics
   */
  async getDashboardStats(user: User, accountId: string, dateFrom?: string, dateTo?: string) {
    await this.checkAdminPermission(user, accountId);

    // Get date ranges for trends
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const last30Days = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last7Days = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    // For range-based trend calculations we must stay consistent with how we bucket days:
    // we use `new Date(sale.sale_at).toISOString().split('T')[0]` which is UTC day-based.
    // So we interpret `date_from`/`date_to` as UTC dates too (not local midnights).
    const todayStartUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const last30DaysUtc = new Date(todayStartUtc.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last7DaysUtc = new Date(todayStartUtc.getTime() - 7 * 24 * 60 * 60 * 1000);

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

    // Trend range drives revenue chart + sales volume chart.
    const trendStart = parseDateOnlyUTC(dateFrom) ?? (() => new Date(last30DaysUtc))();
    const trendEnd = parseDateOnlyUTC(dateTo) ?? todayStartUtc;
    const rangeStartDate = trendStart <= trendEnd ? trendStart : trendEnd;
    const rangeEndDate = trendStart <= trendEnd ? trendEnd : trendStart;

    // Include the full end day in range filtering (UTC).
    rangeStartDate.setUTCHours(0, 0, 0, 0);
    rangeEndDate.setUTCHours(23, 59, 59, 999);

    // Basic counts
    const [
      totalUsers,
      activeUsers,
      totalAccounts,
      totalSales,
      totalCollections,
      totalSuppliers,
      totalCustomers,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'active' } }),
      this.prisma.account.count({ where: { status: 'active' } }),
      this.prisma.milkSale.count({ where: { status: 'accepted' } }),
      this.prisma.milkSale.count({ where: { status: 'accepted' } }),
      this.prisma.supplierCustomer.count({ where: { relationship_status: 'active' } }),
      this.prisma.supplierCustomer.count({ where: { relationship_status: 'active' } }),
    ]);

    // Get sales data for revenue calculations
    const allSales = await this.prisma.milkSale.findMany({
      where: {
        status: 'accepted',
      },
      select: {
        quantity: true,
        unit_price: true,
        sale_at: true,
      },
    });

    // Calculate revenue metrics
    const totalRevenue = allSales.reduce(
      (sum, sale) => sum + Number(sale.quantity) * Number(sale.unit_price),
      0,
    );

    const salesLast30Days = allSales.filter(
      (sale) => new Date(sale.sale_at) >= last30Days,
    );
    const revenueLast30Days = salesLast30Days.reduce(
      (sum, sale) => sum + Number(sale.quantity) * Number(sale.unit_price),
      0,
    );

    const salesLast7Days = allSales.filter(
      (sale) => new Date(sale.sale_at) >= last7Days,
    );
    const revenueLast7Days = salesLast7Days.reduce(
      (sum, sale) => sum + Number(sale.quantity) * Number(sale.unit_price),
      0,
    );

    const salesToday = allSales.filter(
      (sale) => new Date(sale.sale_at) >= todayStart,
    );
    const revenueToday = salesToday.reduce(
      (sum, sale) => sum + Number(sale.quantity) * Number(sale.unit_price),
      0,
    );

    // Generate daily breakdown for selected date range
    const dailyBreakdown = new Map<string, { date: string; revenue: number; sales: number }>();

    for (let d = new Date(rangeStartDate); d <= rangeEndDate; d.setUTCDate(d.getUTCDate() + 1)) {
      // Ensure we're bucketing by UTC day.
      d.setUTCHours(0, 0, 0, 0);
      const dateStr = d.toISOString().split('T')[0];
      dailyBreakdown.set(dateStr, { date: dateStr, revenue: 0, sales: 0 });
    }

    // Populate with actual data
    allSales.forEach((sale) => {
      const dateStr = new Date(sale.sale_at).toISOString().split('T')[0];
      if (dailyBreakdown.has(dateStr)) {
        const dayData = dailyBreakdown.get(dateStr)!;
        dayData.revenue += Number(sale.quantity) * Number(sale.unit_price);
        dayData.sales += Number(sale.quantity);
      }
    });

    const dailyTrend = Array.from(dailyBreakdown.values()).map((day) => ({
      date: day.date,
      label: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue: day.revenue,
      sales: day.sales,
    }));

    // Compute range totals from the same accepted sales dataset.
    const acceptedSalesInRange = allSales.filter((sale) => {
      const dt = new Date(sale.sale_at);
      return dt >= rangeStartDate && dt <= rangeEndDate;
    });

    const salesInRange = acceptedSalesInRange.length;
    const revenueInRange = acceptedSalesInRange.reduce(
      (sum, sale) => sum + Number(sale.quantity) * Number(sale.unit_price),
      0,
    );

    // Get sales by status
    const salesByStatus = await this.prisma.milkSale.groupBy({
      by: ['status'],
      _count: true,
    });

    // Get recent sales (last 10)
    const recentSales = await this.prisma.milkSale.findMany({
      where: {
        status: { not: 'deleted' },
      },
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
    });

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
        },
        sales: {
          total: salesInRange,
          last30Days: salesLast30Days.length,
          last7Days: salesLast7Days.length,
          today: salesToday.length,
        },
        collections: {
          total: totalCollections,
        },
        suppliers: {
          total: totalSuppliers,
        },
        customers: {
          total: totalCustomers,
        },
        revenue: {
          total: revenueInRange,
          last30Days: revenueLast30Days,
          last7Days: revenueLast7Days,
          today: revenueToday,
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
      },
    };
  }

  /**
   * Get all roles with their default permissions (ResolveIT-style)
   */
  async getRoles(user: User, accountId: string) {
    await this.checkAdminPermission(user, accountId);
    const roles = ROLES.map((role) => ({
      code: role,
      name: ROLE_LABELS[role as RoleCode],
      description: ROLE_DESCRIPTIONS[role as RoleCode],
      permissions: ROLE_DEFAULT_PERMISSIONS[role as RoleCode],
      permissionCount: ROLE_DEFAULT_PERMISSIONS[role as RoleCode].length,
    }));
    return {
      code: 200,
      status: 'success',
      message: 'Roles retrieved successfully.',
      data: { roles },
    };
  }

  /**
   * Get all permissions with which roles have them (ResolveIT-style)
   */
  async getPermissions(user: User, accountId: string) {
    await this.checkAdminPermission(user, accountId);
    const permissions = PERMISSIONS.map((perm) => {
      const rolesWithPermission = ROLES.filter((role) =>
        ROLE_DEFAULT_PERMISSIONS[role as RoleCode].includes(perm.code),
      );
      return {
        code: perm.code,
        name: perm.name,
        description: perm.description,
        category: perm.category,
        roles: rolesWithPermission.map((r) => ({
          code: r,
          name: ROLE_LABELS[r as RoleCode],
        })),
      };
    });
    return {
      code: 200,
      status: 'success',
      message: 'Permissions retrieved successfully.',
      data: { permissions },
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

  async getMccOnboardingSubmissionById(user: User, accountId: string, submissionId: string) {
    await this.checkAdminPermission(user, accountId);

    const submission = await this.prisma.mccOnboardingSubmission.findUnique({
      where: { id: submissionId },
      include: {
        reviewed_by_user: { select: { id: true, name: true, email: true } },
        linked_user: { select: { id: true, name: true, email: true, phone: true } },
        linked_account: { select: { id: true, code: true, name: true, status: true } },
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
    dto: { password?: string; linkExistingUserId?: string; reviewNotes?: string },
  ) {
    await this.checkAdminPermission(user, accountId);

    const plainPassword =
      dto.password && dto.password.length >= 8 ? dto.password : this.generateOnboardingTempPassword();

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
          throw new BadRequestException({
            code: 400,
            status: 'error',
            message:
              'A user with this phone already exists. Approve again with linkExistingUserId set to that user UUID, or reject this submission.',
          });
        }
        const hashedPassword = await bcrypt.hash(plainPassword, 10);
        const displayName = `${submission.manager_first_name} ${submission.manager_last_name}`.trim();
        linkedUser = await tx.user.create({
          data: {
            name: displayName || submission.business_name,
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
          role: 'owner',
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

      return { updatedSubmission, linkedUser, newAccount, createdNewUser: !dto.linkExistingUserId };
    });

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
        tempPassword: result.createdNewUser ? plainPassword : undefined,
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
