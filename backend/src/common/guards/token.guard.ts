import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TokenGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Extract token from multiple sources (compatible with PHP API)
    let token: string | undefined;

    // 1. From JSON body (primary method in PHP)
    if (request.body?.token) {
      token = request.body.token;
    }
    // 2. From query parameter
    else if (request.query?.token) {
      token = request.query.token;
    }
    // 3. From Authorization header (Bearer token)
    else if (request.headers?.authorization) {
      const authHeader = request.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      throw new UnauthorizedException({
        code: 401,
        status: 'error',
        message: 'Access denied. Token is required.',
      });
    }

    // Validate token against database (same as PHP: SELECT * FROM users WHERE token = ?)
    // Note: token is not unique in schema, so we use findFirst
    const user = await this.prisma.user.findFirst({
      where: { token },
      select: {
        id: true,
        code: true,
        name: true,
        phone: true,
        email: true,
        token: true,
        status: true,
        /** Required by PermissionGuard when request body/query has no account_id */
        default_account_id: true,
        user_accounts: {
          where: { status: 'active' },
          select: {
            id: true,
            user_id: true,
            account_id: true,
            status: true,
            account: {
              select: {
                id: true,
                code: true,
                name: true,
                type: true,
                status: true,
                parent_id: true,
              },
            },
          },
        },
      },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException({
        code: 401,
        status: 'error',
        message: 'Invalid or expired token.',
      });
    }

    // Attach user to request for use in controllers
    request.user = user;
    request.token = token;

    return true;
  }
}

