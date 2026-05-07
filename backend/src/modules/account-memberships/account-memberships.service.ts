import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountMembershipStatus, Prisma, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { ACCOUNT_MEMBERSHIP_LIST_PERMISSIONS } from '../admin/roles-permissions.config';
import { CreateAccountMembershipDto } from './dto/create-account-membership.dto';
import { UpdateAccountMembershipDto } from './dto/update-account-membership.dto';

@Injectable()
export class AccountMembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
  ) {}

  private async loadActiveUserAccount(actorId: string, accountId: string) {
    const ua = await this.prisma.userAccount.findFirst({
      where: {
        user_id: actorId,
        account_id: accountId,
        status: 'active',
      },
      include: { account: true },
    });
    if (!ua?.account || ua.account.status !== 'active') {
      throw new ForbiddenException({
        code: 403,
        status: 'error',
        message: 'No active account access for this operation.',
      });
    }
    return ua;
  }

  /** Roster / menu: managers, supplier onboarding, or supplier-directory visibility. */
  private async assertCanListMemberships(actorId: string, accountId: string): Promise<void> {
    const ua = await this.loadActiveUserAccount(actorId, accountId);
    const ok = await this.rbac.assertGuardAnyPermission(ua, [...ACCOUNT_MEMBERSHIP_LIST_PERMISSIONS]);
    if (!ok) {
      throw new ForbiddenException({
        code: 403,
        status: 'error',
        message:
          'Insufficient permissions. Requires manage_users, create/update suppliers, or view_suppliers on this account.',
      });
    }
  }

  /** Direct create/update membership rows (not supplier onboarding). */
  private async assertManageUsersOnAccount(actorId: string, accountId: string): Promise<void> {
    const ua = await this.loadActiveUserAccount(actorId, accountId);
    const ok = await this.rbac.assertGuardPermission(ua, 'manage_users');
    if (!ok) {
      throw new ForbiddenException({
        code: 403,
        status: 'error',
        message: 'Insufficient permissions. manage_users required.',
      });
    }
  }

  async listMine(userId: string) {
    const rows = await this.prisma.accountMembership.findMany({
      where: { user_id: userId },
      include: {
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
      orderBy: { created_at: 'desc' },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Memberships fetched successfully.',
      data: rows,
    };
  }

  async listForAccount(actorId: string, accountId: string | null, status?: AccountMembershipStatus) {
    const resolvedAccountId = accountId;
    if (!resolvedAccountId) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'account_id query parameter is required.',
      });
    }

    await this.assertCanListMemberships(actorId, resolvedAccountId);

    const where: Prisma.AccountMembershipWhereInput = {
      account_id: resolvedAccountId,
      ...(status ? { status } : {}),
    };

    const rows = await this.prisma.accountMembership.findMany({
      where,
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
            status: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Account memberships fetched successfully.',
      data: rows,
    };
  }

  async create(actor: User, dto: CreateAccountMembershipDto) {
    await this.assertManageUsersOnAccount(actor.id, dto.account_id);

    const [userRow, accountRow] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: dto.user_id } }),
      this.prisma.account.findUnique({ where: { id: dto.account_id } }),
    ]);
    if (!userRow) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'User not found.' });
    }
    if (!accountRow || accountRow.status !== 'active') {
      throw new NotFoundException({ code: 404, status: 'error', message: 'Account not found or inactive.' });
    }

    const status = dto.status ?? AccountMembershipStatus.active;
    const memberSince = dto.member_since ? new Date(dto.member_since) : null;

    try {
      const row = await this.prisma.accountMembership.create({
        data: {
          account_id: dto.account_id,
          user_id: dto.user_id,
          status,
          member_since: memberSince,
          created_by: actor.id,
          updated_by: actor.id,
        },
        include: {
          user: {
            select: {
              id: true,
              code: true,
              name: true,
              phone: true,
              email: true,
            },
          },
          account: {
            select: { id: true, code: true, name: true },
          },
        },
      });

      return {
        code: 201,
        status: 'success',
        message: 'Membership created successfully.',
        data: row,
      };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({
          code: 409,
          status: 'error',
          message: 'This user already has membership for this account.',
        });
      }
      throw e;
    }
  }

  async update(actor: User, membershipId: string, dto: UpdateAccountMembershipDto) {
    const existing = await this.prisma.accountMembership.findUnique({
      where: { id: membershipId },
    });
    if (!existing) {
      throw new NotFoundException({ code: 404, status: 'error', message: 'Membership not found.' });
    }

    await this.assertManageUsersOnAccount(actor.id, existing.account_id);

    const data: Prisma.AccountMembershipUncheckedUpdateInput = {
      updated_by: actor.id,
    };
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.member_since !== undefined) {
      data.member_since = dto.member_since === null ? null : new Date(dto.member_since);
    }

    const row = await this.prisma.accountMembership.update({
      where: { id: membershipId },
      data,
      include: {
        user: {
          select: {
            id: true,
            code: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        account: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Membership updated successfully.',
      data: row,
    };
  }
}
