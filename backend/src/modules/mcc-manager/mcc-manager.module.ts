import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MccManagerController } from './mcc-manager.controller';
import { MccManagerService } from './mcc-manager.service';

@Module({
  imports: [PrismaModule],
  controllers: [MccManagerController],
  providers: [MccManagerService],
  exports: [MccManagerService],
})
export class MccManagerModule {}
