import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MccAccessScopeService } from './mcc-access-scope.service';
import { MccOperationsController } from './mcc-operations.controller';
import { MccOperationsService } from './mcc-operations.service';

@Module({
  imports: [PrismaModule],
  controllers: [MccOperationsController],
  providers: [MccAccessScopeService, MccOperationsService],
  exports: [MccAccessScopeService],
})
export class MccOperationsModule {}
