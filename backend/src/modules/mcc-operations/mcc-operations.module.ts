import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MccOperationsController } from './mcc-operations.controller';
import { MccOperationsService } from './mcc-operations.service';

@Module({
  imports: [PrismaModule],
  controllers: [MccOperationsController],
  providers: [MccOperationsService],
})
export class MccOperationsModule {}
