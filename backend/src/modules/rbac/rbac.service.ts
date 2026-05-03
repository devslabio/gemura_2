import { randomUUID } from 'crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PERMISSIONS,
  ROLES,
  ROLE_DEFAULT_PERMISSIONS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  canonicalPlatformRoleSlug,
  isPlatformSuperAdminRole,
  type RoleCode,
} from '../admin/roles-permissions.config';

@Injectable()
export class RbacService implements OnModuleInit {
  private readonly logger = new Logger(RbacService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureCatalogFromConfig();
      await this.backfillUserAccountPlatformRoles();
    } catch (e) {
      this.logger.warn(`RBAC catalog bootstrap skipped or partial: ${(e as Error).message}`);
    }
  }

  /**
   * Upsert permission catalog and default roles from roles-permissions.config (idempotent).
   */
  async ensureCatalogFromConfig(): Promise<void> {
    for (const p of PERMISSIONS) {
      const existing = await this.prisma.platformPermission.findUnique({ where: { code: p.code } });
      const id = existing?.id ?? randomUUID();
      await this.prisma.platformPermission.upsert({
        where: { code: p.code },
        create: {
          id,
          code: p.code,
          name: p.name,
          description: p.description ?? null,
          category: p.category ?? null,
        },
        update: {
          name: p.name,
          description: p.description ?? null,
          category: p.category ?? null,
        },
      });
    }

    for (const slug of ROLES) {
      const rc = slug as RoleCode;
      const existingRole = await this.prisma.platformRole.findUnique({ where: { slug } });
      const id = existingRole?.id ?? randomUUID();
      const isSystem = slug === 'system_admin' || slug === 'admin';
      /** Not offered in tenant team management (`GET /employees/roles`); use admin tooling for top-tier links. */
      const isAssignable =
        slug !== 'supplier' && slug !== 'customer' && slug !== 'system_admin';

      const roleRow = await this.prisma.platformRole.upsert({
        where: { slug },
        create: {
          id,
          slug,
          name: ROLE_LABELS[rc],
          description: ROLE_DESCRIPTIONS[rc] ?? null,
          is_system: isSystem,
          is_active: true,
          is_assignable: isAssignable,
        },
        update: {
          name: ROLE_LABELS[rc],
          description: ROLE_DESCRIPTIONS[rc] ?? null,
          is_system: isSystem,
          is_assignable: isAssignable,
        },
      });

      const permCodes = [...new Set(ROLE_DEFAULT_PERMISSIONS[rc] || [])];
      const permRows = await this.prisma.platformPermission.findMany({
        where: { code: { in: permCodes } },
      });
      const uniquePerms = [...new Map(permRows.map((p) => [p.id, p])).values()];

      await this.prisma.platformRolePermission.deleteMany({
        where: { platform_role_id: roleRow.id },
      });

      if (uniquePerms.length > 0) {
        await this.prisma.platformRolePermission.createMany({
          data: uniquePerms.map((perm) => ({
            platform_role_id: roleRow.id,
            platform_permission_id: perm.id,
          })),
          skipDuplicates: true,
        });
      }
    }

    await this.mergeLegacyOwnerPlatformRoleIntoSystemAdmin();
  }

  /**
   * If `platform_roles` still has slug `owner` (migration not applied or duplicate bootstrap),
   * merge it into `system_admin` and normalize `user_accounts`. Idempotent.
   */
  private async mergeLegacyOwnerPlatformRoleIntoSystemAdmin(): Promise<void> {
    const systemAdmin = await this.prisma.platformRole.findUnique({
      where: { slug: 'system_admin' },
      select: { id: true },
    });
    if (!systemAdmin) {
      this.logger.warn('RBAC: system_admin platform role missing; skip legacy owner merge');
      return;
    }

    const legacyOwner = await this.prisma.platformRole.findUnique({
      where: { slug: 'owner' },
      select: { id: true },
    });

    if (legacyOwner) {
      await this.prisma.userAccount.updateMany({
        where: { platform_role_id: legacyOwner.id },
        data: { platform_role_id: systemAdmin.id, role: 'system_admin' },
      });
      await this.prisma.platformRolePermission.deleteMany({
        where: { platform_role_id: legacyOwner.id },
      });
      await this.prisma.platformRole.delete({ where: { id: legacyOwner.id } });
      this.logger.log('RBAC: removed duplicate platform_roles.slug=owner; reassigned links to system_admin');
    }

    await this.prisma.$executeRaw`
      UPDATE user_accounts
      SET role = 'system_admin', platform_role_id = ${systemAdmin.id}::uuid
      WHERE LOWER(TRIM(role)) = 'owner'
    `;

    await this.prisma.userAccount.updateMany({
      where: {
        role: 'system_admin',
        platform_role_id: null,
      },
      data: { platform_role_id: systemAdmin.id },
    });
  }

  async backfillUserAccountPlatformRoles(): Promise<void> {
    const roles = await this.prisma.platformRole.findMany({
      select: { id: true, slug: true },
    });
    const slugToId = new Map(roles.map((r) => [r.slug, r.id]));

    const missing = await this.prisma.userAccount.findMany({
      where: { platform_role_id: null },
      select: { id: true, role: true },
    });

    for (const ua of missing) {
      const key = canonicalPlatformRoleSlug(ua.role);
      const rid = key ? slugToId.get(key) : undefined;
      if (rid) {
        await this.prisma.userAccount.update({
          where: { id: ua.id },
          data: { platform_role_id: rid },
        });
      }
    }
  }

  permissionsJsonToCodes(permissions: unknown): string[] {
    if (permissions == null) return [];
    let parsed = permissions;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return [];
      }
    }
    if (Array.isArray(parsed)) {
      return parsed.filter((x) => typeof x === 'string');
    }
    if (typeof parsed === 'object' && parsed !== null) {
      return Object.entries(parsed as Record<string, boolean>)
        .filter(([, v]) => v === true)
        .map(([k]) => k);
    }
    return [];
  }

  /**
   * Effective permission codes for API responses and guards (arrays).
   */
  async getEffectivePermissionCodes(userAccount: {
    role: string;
    platform_role_id: string | null;
    permissions: unknown;
  }): Promise<string[]> {
    const r = (userAccount.role || '').toLowerCase();
    if (isPlatformSuperAdminRole(r)) {
      const all = await this.prisma.platformPermission.findMany({ select: { code: true } });
      return all.map((p) => p.code);
    }

    if (userAccount.platform_role_id) {
      const links = await this.prisma.platformRolePermission.findMany({
        where: { platform_role_id: userAccount.platform_role_id },
        include: { permission: true },
      });
      const fromRole = links.map((l) => l.permission.code);
      return this.mergeLegacyOverrides(fromRole, userAccount.permissions);
    }

    return this.permissionsJsonToCodes(userAccount.permissions);
  }

  private mergeLegacyOverrides(fromRole: string[], permissions: unknown): string[] {
    if (permissions == null) return [...new Set(fromRole)];
    let parsed = permissions;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return [...new Set(fromRole)];
      }
    }
    if (Array.isArray(parsed)) {
      const extra = (parsed as string[]).filter((x) => typeof x === 'string');
      return [...new Set([...fromRole, ...extra])];
    }
    if (typeof parsed === 'object' && parsed !== null) {
      const obj = parsed as Record<string, boolean>;
      const keys = Object.keys(obj).filter((k) => obj[k] === true);
      return [...new Set([...fromRole, ...keys])];
    }
    return [...new Set(fromRole)];
  }

  async resolvePlatformRoleIdFromSlug(slug: string | undefined | null): Promise<string | null> {
    if (!slug?.trim()) return null;
    const key = canonicalPlatformRoleSlug(slug);
    if (!key) return null;
    const row = await this.prisma.platformRole.findFirst({
      where: { slug: key, is_active: true },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  async resolveSlugFromPlatformRoleId(roleId: string | undefined | null): Promise<string | null> {
    if (!roleId?.trim()) return null;
    const row = await this.prisma.platformRole.findFirst({
      where: { id: roleId.trim(), is_active: true },
      select: { slug: true },
    });
    return row?.slug ?? null;
  }

  /** Used by login/profile to attach permissions array to each account. */
  async formatPermissionsForApi(userAccount: {
    role: string;
    platform_role_id: string | null;
    permissions: unknown;
  }): Promise<string[] | null> {
    const codes = await this.getEffectivePermissionCodes(userAccount);
    return codes.length > 0 ? codes : null;
  }

  async assertGuardPermission(
    userAccount: { role: string; platform_role_id: string | null; permissions: unknown },
    requiredPermission: string,
  ): Promise<boolean> {
    const r = (userAccount.role || '').toLowerCase();
    if (isPlatformSuperAdminRole(r)) return true;
    const codes = await this.getEffectivePermissionCodes(userAccount);
    return codes.includes(requiredPermission);
  }

  async assertGuardAnyPermission(
    userAccount: { role: string; platform_role_id: string | null; permissions: unknown },
    requiredAny: string[],
  ): Promise<boolean> {
    const r = (userAccount.role || '').toLowerCase();
    if (isPlatformSuperAdminRole(r)) return true;
    const codes = await this.getEffectivePermissionCodes(userAccount);
    return requiredAny.some((p) => codes.includes(p));
  }

  async assertGuardRole(userAccount: { role: string }, requiredRole: string): Promise<boolean> {
    const r = (userAccount.role || '').toLowerCase();
    if (isPlatformSuperAdminRole(r)) return true;
    return r === (requiredRole || '').toLowerCase();
  }
}
