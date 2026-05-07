import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AccountMembershipsController } from './account-memberships.controller';
import { AccountMembershipsService } from './account-memberships.service';

@Module({
  imports: [PrismaModule],
  controllers: [AccountMembershipsController],
  providers: [AccountMembershipsService],
  exports: [AccountMembershipsService],
})
export class AccountMembershipsModule {}
