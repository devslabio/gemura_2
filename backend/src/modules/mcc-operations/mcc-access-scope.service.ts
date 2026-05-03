import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { isPlatformSuperAdminRole } from '../admin/roles-permissions.config';

export type MccAccessScope =
  | { mode: 'full' }
  | { mode: 'scoped'; supplierAccountId: string };

@Injectable()
export class MccAccessScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
  ) {}

  /** List/overview: full MCC vs Umucunda supplier-scoped rows only. */
  async resolveViewScope(userId: string, mccAccountId: string): Promise<MccAccessScope> {
    const ua = await this.prisma.userAccount.findFirst({
      where: { user_id: userId, account_id: mccAccountId, status: 'active' },
    });
    if (!ua) {
      throw new ForbiddenException({ code: 403, status: 'error', message: 'No access to this account.' });
    }

    const role = (ua.role || '').toLowerCase();
    if (isPlatformSuperAdminRole(role)) {
      return { mode: 'full' };
    }

    const codes = await this.rbac.getEffectivePermissionCodes(ua);
    if (codes.includes('mcc_view_operations')) {
      return { mode: 'full' };
    }

    const needsScoped =
      codes.includes('mcc_view_own_operations') || codes.includes('mcc_manage_own_operations');
    if (needsScoped) {
      const sid = ua.linked_umucunda_supplier_account_id;
      if (!sid) {
        throw new ForbiddenException({
          code: 403,
          status: 'error',
          message:
            'Umucunda route supplier is not linked for this user. Ask an admin to set linked Umucunda supplier on your team membership.',
        });
      }
      return { mode: 'scoped', supplierAccountId: sid };
    }

    // Legacy: collections-only operators still see full gate/manifest lists when permitted by controller.
    if (codes.includes('view_collections')) {
      return { mode: 'full' };
    }

    throw new ForbiddenException({ code: 403, status: 'error', message: 'Insufficient permissions for MCC operations.' });
  }

  /** Mutations: site-wide manage vs manage limited to own Umucunda supplier routes. */
  async resolveManageScope(userId: string, mccAccountId: string): Promise<MccAccessScope> {
    const ua = await this.prisma.userAccount.findFirst({
      where: { user_id: userId, account_id: mccAccountId, status: 'active' },
    });
    if (!ua) {
      throw new ForbiddenException({ code: 403, status: 'error', message: 'No access to this account.' });
    }

    const role = (ua.role || '').toLowerCase();
    if (isPlatformSuperAdminRole(role)) {
      return { mode: 'full' };
    }

    const codes = await this.rbac.getEffectivePermissionCodes(ua);
    if (codes.includes('mcc_manage_operations')) {
      return { mode: 'full' };
    }

    if (codes.includes('mcc_manage_own_operations')) {
      const sid = ua.linked_umucunda_supplier_account_id;
      if (!sid) {
        throw new ForbiddenException({
          code: 403,
          status: 'error',
          message:
            'Umucunda route supplier is not linked for this user. Ask an admin to set linked Umucunda supplier on your team membership.',
        });
      }
      return { mode: 'scoped', supplierAccountId: sid };
    }

    throw new ForbiddenException({ code: 403, status: 'error', message: 'Insufficient permissions to manage MCC operations.' });
  }
}
