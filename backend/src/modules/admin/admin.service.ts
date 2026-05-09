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

@Injectable()
export class AdminService {
  /** UUID v4 (and common variants) — used to tell `locations.id` from fallback text names. */
  private static readonly LOCATION_UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  constructor(
    private prisma: PrismaService,
    private immisService: ImmisService,
    private locationsService: LocationsService,
  ) {}

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

  /**
   * Get all users with pagination and filters
   */
  async getUsers(
    user: User,
    accountId: string,
    page: number = 1,
    limit: number = 20,
    search?: string,
    status?: string,
    role?: string,
  ) {
    await this.checkAdminPermission(user, accountId);

    const skip = (page - 1) * limit;

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
        orderBy: { created_at: 'desc' },
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

    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        user_accounts: {
          where: {
            account_id: accountId,
          },
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

    const ua = targetUser.user_accounts?.[0];
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

    const data = {
      ...userRest,
      role: ua?.role ?? null,
      permissions,
      user_accounts,
      mcc_onboarding: mccOnboarding,
    };

    return {
      code: 200,
      status: 'success',
      message: 'User retrieved successfully.',
      data,
    };
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
          linked_user_id: true,
          linked_account_id: true,
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
