import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiKeyRateLimiterService } from '../services/api-key-rate-limiter.service';
import * as crypto from 'crypto';

export const API_KEY_SCOPES_KEY = 'api_key_scopes';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
    private rateLimiter: ApiKeyRateLimiterService,
  ) {}

  /**
   * Prefer X-API-Key; otherwise Authorization: Bearer <api-key> (BI tools often use Bearer).
   */
  private extractApiKey(request: { headers?: Record<string, string | string[] | undefined> }): string | undefined {
    const rawX = request.headers?.['x-api-key'];
    const x = Array.isArray(rawX) ? rawX[0] : rawX;
    if (typeof x === 'string' && x.trim()) {
      return x.trim();
    }

    const rawAuth = request.headers?.authorization ?? request.headers?.Authorization;
    const auth = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
    if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
      const token = auth.slice(7).trim();
      if (token) {
        return token;
      }
    }

    return undefined;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      throw new UnauthorizedException({
        code: 401,
        status: 'error',
        message:
          'API key is required. Provide it via X-API-Key header or Authorization: Bearer <api-key>.',
      });
    }

    // Find API key in database
    const apiKeyRecord = await this.prisma.apiKey.findFirst({
      where: {
        OR: [
          { key: apiKey },
          { key_hash: this.hashApiKey(apiKey) },
        ],
      },
      include: {
        account: true,
        created_by: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
          },
        },
      },
    });

    if (!apiKeyRecord) {
      throw new UnauthorizedException({
        code: 401,
        status: 'error',
        message: 'Invalid API key.',
      });
    }

    // Check if key is active
    if (!apiKeyRecord.is_active) {
      throw new UnauthorizedException({
        code: 401,
        status: 'error',
        message: 'API key is deactivated.',
      });
    }

    // Check if key is expired
    if (apiKeyRecord.expires_at && new Date() > apiKeyRecord.expires_at) {
      throw new UnauthorizedException({
        code: 401,
        status: 'error',
        message: 'API key has expired.',
      });
    }

    // Check if associated account is still active (if scoped to account)
    if (apiKeyRecord.account && apiKeyRecord.account.status !== 'active') {
      throw new ForbiddenException({
        code: 403,
        status: 'error',
        message: 'Associated account is not active.',
      });
    }

    // Get required scopes from decorator
    const requiredScopes = this.reflector.get<string[]>(
      API_KEY_SCOPES_KEY,
      context.getHandler(),
    ) || [];

    // Check scopes if required
    if (requiredScopes.length > 0) {
      const hasAllScopes = this.checkScopes(apiKeyRecord.scopes, requiredScopes);
      if (!hasAllScopes) {
        throw new ForbiddenException({
          code: 403,
          status: 'error',
          message: `Insufficient permissions. Required scopes: ${requiredScopes.join(', ')}`,
        });
      }
    }

    this.rateLimiter.checkOrThrow(apiKeyRecord.id, apiKeyRecord.rate_limit);

    // Update last_used_at and request_count
    await this.prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: {
        last_used_at: new Date(),
        request_count: { increment: 1 },
      },
    });

    // Attach API key info to request
    request.apiKey = apiKeyRecord;
    request.apiKeyAccountId = apiKeyRecord.account_id;
    request.apiKeyAccount = apiKeyRecord.account;
    request.isPlatformWide = !apiKeyRecord.account_id;

    return true;
  }

  private hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  private checkScopes(keyScopes: string[], requiredScopes: string[]): boolean {
    // Wildcard scope grants all access
    if (keyScopes.includes('*') || keyScopes.includes('analytics:*')) {
      return true;
    }

    // Check each required scope
    return requiredScopes.every((required) => {
      // Direct match
      if (keyScopes.includes(required)) {
        return true;
      }

      // Check for category wildcard (e.g., 'analytics:collections:*' matches 'analytics:collections:read')
      const parts = required.split(':');
      for (let i = parts.length - 1; i > 0; i--) {
        const wildcardScope = [...parts.slice(0, i), '*'].join(':');
        if (keyScopes.includes(wildcardScope)) {
          return true;
        }
      }

      return false;
    });
  }
}
