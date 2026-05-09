import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { User } from '@prisma/client';
import { SwitchAccountDto } from './dto/switch-account.dto';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async getUserAccounts(user: User) {
    // Get all accounts user has access to (same query as PHP)
    const userAccounts = await this.prisma.userAccount.findMany({
      where: {
        user_id: user.id,
        status: 'active',
      },
      include: {
        account: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Format accounts (matching PHP response structure)
    const accounts = userAccounts
      .filter((ua) => ua.account && ua.account.status === 'active')
      .map((ua) => ({
        account_id: ua.account!.id,
        account_code: ua.account!.code,
        account_name: ua.account!.name,
        account_type: String(user.account_type),
        account_status: ua.account!.status,
        account_created_at: ua.account!.created_at,
        role: ua.role,
        permissions: ua.permissions
          ? typeof ua.permissions === 'string'
            ? JSON.parse(ua.permissions)
            : ua.permissions
          : null,
        user_account_status: ua.status,
        access_granted_at: ua.created_at,
        is_default: user.default_account_id === ua.account!.id,
        supplier_segment: user.supplier_segment ?? null,
      }));

    return {
      code: 200,
      status: 'success',
      message: 'User accounts fetched successfully.',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          default_account_id: user.default_account_id,
        },
        accounts,
        total_accounts: accounts.length,
      },
    };
  }

  async switchAccount(user: User, switchDto: SwitchAccountDto) {
    const { account_id } = switchDto;

    // Check if user has access to this account
    const userAccount = await this.prisma.userAccount.findFirst({
      where: {
        user_id: user.id,
        account_id: account_id,
        status: 'active',
      },
      include: {
        account: true,
      },
    });

    if (!userAccount || !userAccount.account || userAccount.account.status !== 'active') {
      throw new ForbiddenException({
        code: 403,
        status: 'error',
        message: 'Access denied. You don\'t have permission to access this account.',
      });
    }

    // Update user's default account
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        default_account_id: account_id,
      },
    });

    // Get all user accounts (same as getUserAccounts) for consistent response
    const userAccounts = await this.prisma.userAccount.findMany({
      where: {
        user_id: user.id,
        status: 'active',
      },
      include: {
        account: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Format accounts (matching getUserAccounts structure)
    const accounts = userAccounts
      .filter((ua) => ua.account && ua.account.status === 'active')
      .map((ua) => ({
        account_id: ua.account!.id,
        account_code: ua.account!.code,
        account_name: ua.account!.name,
        account_type: String(updatedUser.account_type),
        account_status: ua.account!.status,
        account_created_at: ua.account!.created_at,
        role: ua.role,
        permissions: ua.permissions
          ? typeof ua.permissions === 'string'
            ? JSON.parse(ua.permissions)
            : ua.permissions
          : null,
        user_account_status: ua.status,
        access_granted_at: ua.created_at,
        is_default: updatedUser.default_account_id === ua.account!.id,
        supplier_segment: updatedUser.supplier_segment ?? null,
      }));

    return {
      code: 200,
      status: 'success',
      message: 'Default account switched successfully.',
      data: {
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          default_account_id: updatedUser.default_account_id,
        },
        account: {
          id: userAccount.account.id,
          code: userAccount.account.code,
          name: userAccount.account.name,
          type: userAccount.account.type,
        },
        accounts,
      },
    };
  }
}

