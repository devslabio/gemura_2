import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CommonModule } from '../../common/common.module';
import { PublicAnalyticsController } from './public-analytics.controller';
import { BaseAnalyticsService } from './services/base-analytics.service';
import { CollectionsAnalyticsService } from './services/collections-analytics.service';
import { SalesAnalyticsService } from './services/sales-analytics.service';
import { SuppliersAnalyticsService } from './services/suppliers-analytics.service';
import { FinancialAnalyticsService } from './services/financial-analytics.service';
import { InventoryAnalyticsService } from './services/inventory-analytics.service';
import { PayrollAnalyticsService } from './services/payroll-analytics.service';
import { LoansAnalyticsService } from './services/loans-analytics.service';
import { PlatformAnalyticsService } from './services/platform-analytics.service';
import { UnifiedAnalyticsService } from './services/unified-analytics.service';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [PublicAnalyticsController],
  providers: [
    BaseAnalyticsService,
    CollectionsAnalyticsService,
    SalesAnalyticsService,
    SuppliersAnalyticsService,
    FinancialAnalyticsService,
    InventoryAnalyticsService,
    PayrollAnalyticsService,
    LoansAnalyticsService,
    PlatformAnalyticsService,
    UnifiedAnalyticsService,
  ],
  exports: [
    BaseAnalyticsService,
    CollectionsAnalyticsService,
    SalesAnalyticsService,
    SuppliersAnalyticsService,
    FinancialAnalyticsService,
    InventoryAnalyticsService,
    PayrollAnalyticsService,
    LoansAnalyticsService,
    PlatformAnalyticsService,
    UnifiedAnalyticsService,
  ],
})
export class PublicAnalyticsModule {}
