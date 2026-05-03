import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MccOperationsModule } from '../mcc-operations/mcc-operations.module';
import { MccManagerController } from './mcc-manager.controller';
import { MccManagerService } from './mcc-manager.service';

@Module({
  imports: [PrismaModule, MccOperationsModule],
  controllers: [MccManagerController],
  providers: [MccManagerService],
  exports: [MccManagerService],
})
export class MccManagerModule {}
