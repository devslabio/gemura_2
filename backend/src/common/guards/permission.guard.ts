import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSION_KEY, PERMISSION_ANY_KEY, ROLE_KEY } from '../decorators/permission.decorator';
import { RbacService } from '../../modules/rbac/rbac.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private rbac: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException({
        code: 403,
        status: 'error',
        message: 'User not authenticated.',
      });
    }

    // Get required permission from metadata (set by decorator)
    const requiredPermission = this.reflectPermission(context);
    const requiredAnyPermissions = this.reflectPermissionAny(context);
    const requiredRole = this.reflectRole(context);

    if (!requiredPermission && !requiredRole && !(requiredAnyPermissions?.length ?? 0)) {
      // No permission/role required, allow access
      return true;
    }

    // Get user's active account access
    const accountId = request.body?.account_id || request.query?.account_id || user.default_account_id;

    if (!accountId) {
      throw new ForbiddenException({
        code: 403,
        status: 'error',
        message: 'No account context found.',
      });
    }

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

    if (requiredAnyPermissions?.length) {
      const okAny = await this.rbac.assertGuardAnyPermission(userAccount, requiredAnyPermissions);
      if (!okAny) {
        throw new ForbiddenException({
          code: 403,
          status: 'error',
          message: `Insufficient permissions. Required one of: ${requiredAnyPermissions.join(', ')}`,
        });
      }
    }

    if (requiredPermission) {
      const okPerm = await this.rbac.assertGuardPermission(userAccount, requiredPermission);
      if (!okPerm) {
        throw new ForbiddenException({
          code: 403,
          status: 'error',
          message: `Insufficient permissions. Required: ${requiredPermission}`,
        });
      }
    }

    if (requiredRole) {
      const okRole = await this.rbac.assertGuardRole(userAccount, requiredRole);
      if (!okRole) {
        throw new ForbiddenException({
          code: 403,
          status: 'error',
          message: `Insufficient role. Required: ${requiredRole}`,
        });
      }
    }

    return true;
  }

  private reflectPermissionAny(context: ExecutionContext): string[] | undefined {
    const handler = context.getHandler();
    return Reflect.getMetadata(PERMISSION_ANY_KEY, handler);
  }

  private reflectPermission(context: ExecutionContext): string | undefined {
    // Get permission from handler metadata (set by @RequirePermission decorator)
    const handler = context.getHandler();
    return Reflect.getMetadata(PERMISSION_KEY, handler);
  }

  private reflectRole(context: ExecutionContext): string | undefined {
    // Get role from handler metadata (set by @RequireRole decorator)
    const handler = context.getHandler();
    return Reflect.getMetadata(ROLE_KEY, handler);
  }
}
