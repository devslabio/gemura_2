import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CommonModule } from '../../common/common.module';
import { LocationsModule } from '../locations/locations.module';
import { AdminModule } from '../admin/admin.module';
import { SupervisorController } from './supervisor.controller';
import { SupervisorService } from './supervisor.service';

@Module({
  imports: [PrismaModule, CommonModule, LocationsModule, AdminModule],
  controllers: [SupervisorController],
  providers: [SupervisorService],
})
export class SupervisorModule {}

