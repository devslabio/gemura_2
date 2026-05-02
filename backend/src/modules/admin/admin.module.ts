import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ImmisModule } from '../immis/immis.module';
import { LocationsModule } from '../locations/locations.module';
import { PermissionGuard } from '../../common/guards/permission.guard';

@Module({
  imports: [PrismaModule, ImmisModule, LocationsModule],
  controllers: [AdminController],
  providers: [AdminService, PermissionGuard],
  exports: [AdminService],
})
export class AdminModule {}
