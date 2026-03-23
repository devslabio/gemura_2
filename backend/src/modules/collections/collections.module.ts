import { Module } from '@nestjs/common';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AccountingModule } from '../accounting/accounting.module';
import { SmsService } from '../../common/services/sms.service';

@Module({
  imports: [PrismaModule, AccountingModule],
  controllers: [CollectionsController],
  providers: [CollectionsService, SmsService],
  exports: [CollectionsService],
})
export class CollectionsModule {}

