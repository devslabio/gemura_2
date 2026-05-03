import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { InviteEmployeeDto } from './dto/invite-employee.dto';
import {
  ROLES,
  ROLE_DEFAULT_PERMISSIONS,
  canonicalPlatformRoleSlug,
  type RoleCode,
} from '../admin/roles-permissions.config';
import { RbacService } from '../rbac/rbac.service';

// Updated: Include is_owner flag for account owners
type AccessGroup = 'general_access' | 'limited_access' | 'milk_receptionist_access';

const ACCESS_GROUP_PERMISSIONS: Record<AccessGroup, string[]> = {
  general_access: [
    'dashboard.view',
    'view_sales',
    'create_sales',
    'update_sales',
    'view_collections',
    'create_collections',
    'view_suppliers',
    'create_suppliers',
    'view_customers',
    'create_customers',
    'view_inventory',
    'manage_inventory',
    'view_analytics',
  ],
  limited_access: [
    'dashboard.view',
    'view_sales',
    'create_sales',
    'view_collections',
    'create_collections',
    'view_suppliers',
    'view_customers',
    'view_inventory',
  ],
  // Backward compatibility alias for existing clients.
  milk_receptionist_access: [
    'dashboard.view',
    'view_sales',
    'create_sales',
    'view_collections',
    'create_collections',
    'view_suppliers',
    'view_customers',
    'view_inventory',
  ],
};

@Injectable()
export class EmployeesService {
  constructor(
    private prisma: PrismaService,
    private rbac: RbacService,
  ) {}

  private resolvePermissions(
    role?: string,
    explicitPermissions?: string[],
    accessGroup?: AccessGroup,
  ): string[] | null {
    if (Array.isArray(explicitPermissions)) {
      return explicitPermissions;
    }
    const slug = role?.trim() ? canonicalPlatformRoleSlug(role.trim().slice(0, 64)) : undefined;
    // Role-based granularity inside each group to keep 4-role model distinct.
    if (accessGroup === 'general_access') {
      if (slug === 'manager' || slug === 'accountant') {
        return ROLE_DEFAULT_PERMISSIONS[slug as RoleCode] || null;
      }
      return ACCESS_GROUP_PERMISSIONS.general_access;
    }
    if (accessGroup === 'limited_access' || accessGroup === 'milk_receptionist_access') {
      if (
        slug === 'collector' ||
        slug === 'viewer' ||
        slug === 'agent' ||
        slug === 'casual_laborer'
      ) {
        return ROLE_DEFAULT_PERMISSIONS[slug as RoleCode] || null;
      }
      return ACCESS_GROUP_PERMISSIONS.limited_access;
    }
    if (accessGroup && ACCESS_GROUP_PERMISSIONS[accessGroup]) {
      return ACCESS_GROUP_PERMISSIONS[accessGroup];
    }
    if (slug && ROLES.includes(slug as RoleCode)) {
      return ROLE_DEFAULT_PERMISSIONS[slug as RoleCode] || null;
    }
    return null;
  }

  /** Resolve account ID and ensure current user can manage it (system admin, admin, or manager; legacy owner). */
  private async ensureCanManageAccount(user: User, accountId?: string | null): Promise<string> {
    const resolved = accountId || user.default_account_id;
    if (!resolved) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'No valid default account found. Please set a default account.',
      });
    }
    const userAccount = await this.prisma.userAccount.findFirst({
      where: {
        user_id: user.id,
        account_id: resolved,
        role: { in: ['system_admin', 'admin', 'manager', 'owner'] },
        status: 'active',
      },
    });
    if (!userAccount) {
      throw new ForbiddenException({
        code: 403,
        status: 'error',
        message: 'You do not have permission to manage this account.',
      });
    }
    return resolved;
  }

  /** Blocks assigning catalog roles marked `is_assignable: false` (e.g. system_admin, supplier). */
  private async ensurePlatformRoleAssignable(roleSlug: string) {
    await this.rbac.ensureCatalogFromConfig();
    const slug = canonicalPlatformRoleSlug(roleSlug.trim().slice(0, 64));
    const row = await this.prisma.platformRole.findUnique({ where: { slug } });
    if (!row?.is_active) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Unknown or inactive role.',
      });
    }
    if (!row.is_assignable) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'This role cannot be assigned from team management.',
      });
    }
  }

  async createEmployee(user: User, createDto: CreateEmployeeDto) {
    const accountId = await this.ensureCanManageAccount(user, createDto.account_id);

    // Check if user is already an employee of this account
    const existingLink = await this.prisma.userAccount.findFirst({
      where: {
        user_id: createDto.user_id,
        account_id: accountId,
      },
    });

    if (existingLink) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'User is already an employee of this account.',
      });
    }

    await this.rbac.ensureCatalogFromConfig();
    const roleSlug = canonicalPlatformRoleSlug(createDto.role.trim().slice(0, 64));
    await this.ensurePlatformRoleAssignable(roleSlug);
    if (createDto.platform_role_id) {
      const pr = await this.prisma.platformRole.findUnique({ where: { id: createDto.platform_role_id } });
      if (pr) await this.ensurePlatformRoleAssignable(pr.slug);
    }
    const platformRoleId =
      createDto.platform_role_id || (await this.rbac.resolvePlatformRoleIdFromSlug(roleSlug));

    const employee = await this.prisma.userAccount.create({
      data: {
        user_id: createDto.user_id,
        account_id: accountId,
        role: roleSlug,
        platform_role_id: platformRoleId,
        permissions: createDto.permissions ? JSON.stringify(createDto.permissions) : null,
        status: 'active',
        created_by: user.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        account: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Employee added successfully.',
      data: {
        id: employee.id,
        user: employee.user,
        account: employee.account,
        role: employee.role,
        permissions: employee.permissions || null,
        status: employee.status,
      },
    };
  }

  async getEmployees(user: User, accountId?: string | null, status?: 'active' | 'inactive') {
    const resolvedAccountId = await this.ensureCanManageAccount(user, accountId);

    const where: { account_id: string; status?: 'active' | 'inactive' } = {
      account_id: resolvedAccountId,
    };
    if (status === 'active' || status === 'inactive') {
      where.status = status;
    }

    // Fetch account to get created_by info
    const account = await this.prisma.account.findUnique({
      where: { id: resolvedAccountId },
      select: { created_by: true },
    });

    const employees = await this.prisma.userAccount.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            account_type: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Employees fetched successfully.',
      data: employees.map((e) => {
        const row = e as typeof e & { user: { id: string; name: string | null; email: string | null; phone: string | null; account_type?: string } };
        const isOwner = account?.created_by === row.user.id;
        return {
          id: e.id,
          user: row.user,
          role: e.role,
          permissions: e.permissions || null,
          status: e.status,
          created_at: e.created_at,
          is_owner: isOwner,
          linked_umucunda_supplier_account_id: e.linked_umucunda_supplier_account_id ?? null,
        };
      }),
    };
  }

  async updateEmployee(user: User, employeeId: string, updateDto: UpdateEmployeeDto, accountId?: string | null) {
    const resolvedAccountId = await this.ensureCanManageAccount(user, accountId);

    const employee = await this.prisma.userAccount.findFirst({
      where: {
        id: employeeId,
        account_id: resolvedAccountId,
      },
    });

    if (!employee) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Employee not found.',
      });
    }

    const updateData: any = { updated_by: user.id };
    if (updateDto.role || updateDto.platform_role_id !== undefined) {
      if (updateDto.role) {
        await this.ensurePlatformRoleAssignable(updateDto.role);
      }
      if (updateDto.platform_role_id !== undefined) {
        const pr = await this.prisma.platformRole.findUnique({
          where: { id: updateDto.platform_role_id },
        });
        if (pr) await this.ensurePlatformRoleAssignable(pr.slug);
      }
      const nextSlug = updateDto.role
        ? canonicalPlatformRoleSlug(updateDto.role.trim().slice(0, 64))
        : employee.role;
      updateData.role = nextSlug;
      if (updateDto.platform_role_id !== undefined) {
        updateData.platform_role_id = updateDto.platform_role_id;
      } else if (updateDto.role) {
        updateData.platform_role_id = await this.rbac.resolvePlatformRoleIdFromSlug(nextSlug);
      }
    }
    if (updateDto.permissions !== undefined || updateDto.access_group !== undefined) {
      const resolved = this.resolvePermissions(
        updateDto.role || employee.role,
        updateDto.permissions,
        updateDto.access_group,
      );
      updateData.permissions = resolved ? JSON.stringify(resolved) : null;
    }
    if (updateDto.status) updateData.status = updateDto.status as any;

    if (updateDto.linked_umucunda_supplier_account_id !== undefined) {
      const sid = updateDto.linked_umucunda_supplier_account_id;
      if (sid === null) {
        updateData.linked_umucunda_supplier_account_id = null;
      } else {
        const link = await this.prisma.supplierCustomer.findFirst({
          where: {
            supplier_account_id: sid,
            customer_account_id: resolvedAccountId,
            relationship_status: 'active',
          },
        });
        if (!link) {
          throw new BadRequestException({
            code: 400,
            status: 'error',
            message: 'linked_umucunda_supplier_account_id must be an active supplier for this MCC.',
          });
        }
        updateData.linked_umucunda_supplier_account_id = sid;
      }
    }

    const updated = await this.prisma.userAccount.update({
      where: { id: employeeId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Employee updated successfully.',
      data: {
        id: updated.id,
        user: updated.user,
        role: updated.role,
        permissions: updated.permissions || null,
        status: updated.status,
      },
    };
  }

  async deleteEmployee(user: User, employeeId: string, accountId?: string | null) {
    const resolvedAccountId = await this.ensureCanManageAccount(user, accountId);

    const employee = await this.prisma.userAccount.findFirst({
      where: {
        id: employeeId,
        account_id: resolvedAccountId,
      },
    });

    if (!employee) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'Employee not found.',
      });
    }

    // Soft delete by setting status to inactive
    await this.prisma.userAccount.update({
      where: { id: employeeId },
      data: {
        status: 'inactive',
        updated_by: user.id,
      },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Employee removed successfully.',
    };
  }

  /** Add a user to the account by email/phone: create user if they have no account, then add to account. */
  async inviteEmployee(user: User, dto: InviteEmployeeDto) {
    const accountId = await this.ensureCanManageAccount(user, dto.account_id);

    if (!dto.email?.trim() && !dto.phone?.trim()) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'Email or phone is required.',
      });
    }

    const normalizedEmail = dto.email?.trim().toLowerCase();
    const normalizedPhone = dto.phone?.trim();

    let targetUser: User | null = null;
    if (normalizedEmail) {
      targetUser = await this.prisma.user.findFirst({
        where: { email: normalizedEmail },
      });
    }
    if (!targetUser && normalizedPhone) {
      targetUser = await this.prisma.user.findFirst({
        where: { phone: normalizedPhone },
      });
    }

    if (targetUser) {
      const existing = await this.prisma.userAccount.findFirst({
        where: {
          user_id: targetUser.id,
          account_id: accountId,
        },
      });
      if (existing) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'This user already has access to this account.',
        });
      }
    } else {
      if (!dto.password?.trim() || dto.password.length < 6) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: 'Password is required for new users (at least 6 characters). This person does not have an account yet.',
        });
      }
      const hashedPassword = await bcrypt.hash(dto.password, 10);
      targetUser = await this.prisma.user.create({
        data: {
          name: dto.name.trim(),
          email: normalizedEmail || null,
          phone: normalizedPhone || null,
          password_hash: hashedPassword,
          account_type: 'mcc',
          status: 'active',
          default_account_id: accountId,
          created_by: user.id,
        },
      });
    }

    await this.rbac.ensureCatalogFromConfig();
    const roleSlug = canonicalPlatformRoleSlug(dto.role.trim().slice(0, 64));
    await this.ensurePlatformRoleAssignable(roleSlug);
    if (dto.platform_role_id) {
      const pr = await this.prisma.platformRole.findUnique({ where: { id: dto.platform_role_id } });
      if (pr) await this.ensurePlatformRoleAssignable(pr.slug);
    }
    let platformRoleId = dto.platform_role_id || (await this.rbac.resolvePlatformRoleIdFromSlug(roleSlug));

    let permissionsStored: string | null = null;
    if (dto.permissions && dto.permissions.length > 0) {
      permissionsStored = JSON.stringify(dto.permissions);
    } else if (!platformRoleId) {
      const resolved = this.resolvePermissions(dto.role, undefined, dto.access_group);
      permissionsStored = resolved ? JSON.stringify(resolved) : null;
    }

    const employee = await this.prisma.userAccount.create({
      data: {
        user_id: targetUser!.id,
        account_id: accountId,
        role: roleSlug,
        platform_role_id: platformRoleId,
        permissions: permissionsStored,
        status: 'active',
        created_by: user.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        account: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    return {
      code: 201,
      status: 'success',
      message: 'Team member added successfully.',
      data: {
        id: employee.id,
        user: employee.user,
        account: employee.account,
        role: employee.role,
        permissions: employee.permissions || null,
        status: employee.status,
      },
    };
  }

  async getRoles(user: User, accountId?: string | null) {
    await this.ensureCanManageAccount(user, accountId);
    await this.rbac.ensureCatalogFromConfig();
    const rows = await this.prisma.platformRole.findMany({
      where: { is_assignable: true, is_active: true },
      orderBy: { slug: 'asc' },
      include: {
        permission_links: {
          include: { permission: true },
        },
      },
    });
    const roles = rows.map((r) => {
      const codes = r.permission_links.map((l) => l.permission.code);
      return {
        id: r.id,
        code: r.slug,
        name: r.name,
        description: r.description ?? '',
        permissions: codes,
        permissionCount: codes.length,
      };
    });
    return {
      code: 200,
      status: 'success',
      message: 'Roles retrieved successfully.',
      data: { roles },
    };
  }

  async getPermissions(user: User, accountId?: string | null) {
    await this.ensureCanManageAccount(user, accountId);
    await this.rbac.ensureCatalogFromConfig();
    const permRows = await this.prisma.platformPermission.findMany({
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    });
    const links = await this.prisma.platformRolePermission.findMany({
      include: { role: true },
    });
    const byPerm = new Map<string, { code: string; name: string }[]>();
    for (const l of links) {
      if (!l.role.is_assignable) continue;
      const list = byPerm.get(l.platform_permission_id) ?? [];
      list.push({ code: l.role.slug, name: l.role.name });
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
}

