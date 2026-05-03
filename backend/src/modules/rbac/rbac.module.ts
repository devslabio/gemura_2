import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RbacService } from './rbac.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [RbacService, PermissionGuard],
  exports: [RbacService, PermissionGuard],
})
export class RbacModule {}
