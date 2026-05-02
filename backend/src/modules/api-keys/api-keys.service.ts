import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import * as crypto from 'crypto';

/**
 * Available scopes for API keys
 */
export const AVAILABLE_SCOPES = [
  'analytics:*',
  'analytics:collections:read',
  'analytics:sales:read',
  'analytics:suppliers:read',
  'analytics:inventory:read',
  'analytics:financial:read',
  'analytics:payroll:read',
  'analytics:loans:read',
  'analytics:platform:read',
  'export:read',
] as const;

@Injectable()
export class ApiKeysService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createApiKeyDto: CreateApiKeyDto) {
    // Get user's default account
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, default_account_id: true },
    });

    if (!user) {
      throw new BadRequestException({
        code: 400,
        status: 'error',
        message: 'User not found.',
      });
    }

    // Validate scopes if provided
    if (createApiKeyDto.scopes && createApiKeyDto.scopes.length > 0) {
      const invalidScopes = createApiKeyDto.scopes.filter(
        (scope) => !AVAILABLE_SCOPES.includes(scope as any) && scope !== '*',
      );
      if (invalidScopes.length > 0) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: `Invalid scopes: ${invalidScopes.join(', ')}. Valid scopes are: ${AVAILABLE_SCOPES.join(', ')}`,
        });
      }
    }

    // Validate account_id if provided
    let accountId = createApiKeyDto.account_id;
    if (accountId) {
      // Verify user has access to this account
      const hasAccess = await this.prisma.userAccount.findFirst({
        where: {
          user_id: userId,
          account_id: accountId,
          status: 'active',
        },
      });

      if (!hasAccess) {
        throw new ForbiddenException({
          code: 403,
          status: 'error',
          message: 'You do not have access to the specified account.',
        });
      }
    } else {
      // Default to user's default account (account-scoped key)
      accountId = user.default_account_id || undefined;
    }

    // For platform-wide keys (account_id = null), check if user is admin
    if (createApiKeyDto.platform_wide === true) {
      const isAdmin = await this.prisma.userAccount.findFirst({
        where: {
          user_id: userId,
          account: { type: 'admin' },
          role: { in: ['system_admin', 'admin', 'owner'] },
          status: 'active',
        },
      });

      if (!isAdmin) {
        throw new ForbiddenException({
          code: 403,
          status: 'error',
          message: 'Only administrators can create platform-wide API keys.',
        });
      }
      accountId = undefined; // null account_id for platform-wide
    }

    // Generate API key
    const apiKey = this.generateApiKey();
    const keyHash = this.hashApiKey(apiKey);

    // Set expiration date (default 1 year)
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    // Default scopes if not provided
    const scopes = createApiKeyDto.scopes && createApiKeyDto.scopes.length > 0
      ? createApiKeyDto.scopes
      : ['analytics:*']; // Default to full analytics access

    const apiKeyRecord = await this.prisma.apiKey.create({
      data: {
        key: apiKey,
        key_hash: keyHash,
        name: createApiKeyDto.name,
        description: createApiKeyDto.description,
        account_id: accountId,
        created_by_user_id: userId,
        scopes: scopes,
        rate_limit: createApiKeyDto.rate_limit || 1000,
        expires_at: createApiKeyDto.expires_at ? new Date(createApiKeyDto.expires_at) : expiresAt,
        is_active: true,
      },
      include: {
        account: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    // Return the API key (only shown once on creation)
    return {
      code: 200,
      status: 'success',
      message: 'API key created successfully. Save this key securely - it will not be shown again.',
      data: {
        id: apiKeyRecord.id,
        api_key: apiKey, // Only returned on creation
        name: apiKeyRecord.name,
        description: apiKeyRecord.description,
        account: apiKeyRecord.account,
        scopes: apiKeyRecord.scopes,
        rate_limit: apiKeyRecord.rate_limit,
        is_active: apiKeyRecord.is_active,
        expires_at: apiKeyRecord.expires_at,
        created_at: apiKeyRecord.created_at,
      },
    };
  }

  async findAll(userId: string) {
    // Get all accounts user has access to
    const userAccounts = await this.prisma.userAccount.findMany({
      where: {
        user_id: userId,
        status: 'active',
      },
      select: { account_id: true },
    });

    const accountIds = userAccounts.map((ua) => ua.account_id);

    // Find API keys created by user OR belonging to user's accounts
    const apiKeys = await this.prisma.apiKey.findMany({
      where: {
        OR: [
          { created_by_user_id: userId },
          { account_id: { in: accountIds } },
        ],
      },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        scopes: true,
        rate_limit: true,
        request_count: true,
        last_used_at: true,
        expires_at: true,
        is_active: true,
        created_at: true,
        updated_at: true,
        account: {
          select: { id: true, code: true, name: true },
        },
        created_by: {
          select: { id: true, name: true },
        },
      },
    });

    return {
      code: 200,
      status: 'success',
      message: 'API keys retrieved successfully.',
      data: apiKeys,
    };
  }

  async findOne(id: string, userId: string) {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        scopes: true,
        rate_limit: true,
        request_count: true,
        last_used_at: true,
        expires_at: true,
        is_active: true,
        created_at: true,
        updated_at: true,
        account: {
          select: { id: true, code: true, name: true },
        },
        created_by: {
          select: { id: true, name: true },
        },
      },
    });

    if (!apiKey) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'API key not found.',
      });
    }

    return {
      code: 200,
      status: 'success',
      message: 'API key retrieved successfully.',
      data: apiKey,
    };
  }

  async update(id: string, userId: string, updateDto: { name?: string; description?: string; scopes?: string[]; is_active?: boolean }) {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id },
    });

    if (!apiKey) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'API key not found.',
      });
    }

    // Verify user has permission to update this key
    if (apiKey.created_by_user_id !== userId) {
      const hasAccess = apiKey.account_id
        ? await this.prisma.userAccount.findFirst({
            where: {
              user_id: userId,
              account_id: apiKey.account_id,
              role: { in: ['system_admin', 'admin', 'owner'] },
              status: 'active',
            },
          })
        : false;

      if (!hasAccess) {
        throw new ForbiddenException({
          code: 403,
          status: 'error',
          message: 'You do not have permission to update this API key.',
        });
      }
    }

    // Validate scopes if provided
    if (updateDto.scopes && updateDto.scopes.length > 0) {
      const invalidScopes = updateDto.scopes.filter(
        (scope) => !AVAILABLE_SCOPES.includes(scope as any) && scope !== '*',
      );
      if (invalidScopes.length > 0) {
        throw new BadRequestException({
          code: 400,
          status: 'error',
          message: `Invalid scopes: ${invalidScopes.join(', ')}`,
        });
      }
    }

    const updated = await this.prisma.apiKey.update({
      where: { id },
      data: {
        name: updateDto.name,
        description: updateDto.description,
        scopes: updateDto.scopes,
        is_active: updateDto.is_active,
      },
      select: {
        id: true,
        name: true,
        description: true,
        scopes: true,
        rate_limit: true,
        is_active: true,
        expires_at: true,
        updated_at: true,
        account: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    return {
      code: 200,
      status: 'success',
      message: 'API key updated successfully.',
      data: updated,
    };
  }

  async remove(id: string, userId: string) {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id },
    });

    if (!apiKey) {
      throw new NotFoundException({
        code: 404,
        status: 'error',
        message: 'API key not found.',
      });
    }

    // Verify user has permission to delete this key
    if (apiKey.created_by_user_id !== userId) {
      const hasAccess = apiKey.account_id
        ? await this.prisma.userAccount.findFirst({
            where: {
              user_id: userId,
              account_id: apiKey.account_id,
              role: { in: ['system_admin', 'admin', 'owner'] },
              status: 'active',
            },
          })
        : false;

      if (!hasAccess) {
        throw new ForbiddenException({
          code: 403,
          status: 'error',
          message: 'You do not have permission to delete this API key.',
        });
      }
    }

    await this.prisma.apiKey.delete({
      where: { id },
    });

    return {
      code: 200,
      status: 'success',
      message: 'API key deleted successfully.',
    };
  }

  async getAvailableScopes() {
    return {
      code: 200,
      status: 'success',
      message: 'Available scopes retrieved successfully.',
      data: {
        scopes: AVAILABLE_SCOPES,
        descriptions: {
          'analytics:*': 'Full access to all analytics endpoints',
          'analytics:collections:read': 'Read milk collections analytics',
          'analytics:sales:read': 'Read milk sales analytics',
          'analytics:suppliers:read': 'Read suppliers analytics',
          'analytics:inventory:read': 'Read inventory analytics',
          'analytics:financial:read': 'Read financial analytics',
          'analytics:payroll:read': 'Read payroll analytics',
          'analytics:loans:read': 'Read loans analytics',
          'analytics:platform:read': 'Read platform-wide analytics (admin only)',
          'export:read': 'Export data to CSV format',
        },
      },
    };
  }

  private generateApiKey(): string {
    const prefix = 'gemura_';
    const randomBytes = crypto.randomBytes(32).toString('hex');
    return `${prefix}${randomBytes}`;
  }

  private hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }
}

