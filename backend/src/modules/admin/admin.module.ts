import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ImmisModule } from '../immis/immis.module';
import { LocationsModule } from '../locations/locations.module';

@Module({
  imports: [PrismaModule, ImmisModule, LocationsModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
