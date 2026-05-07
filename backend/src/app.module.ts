import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { AccountMembershipsModule } from './modules/account-memberships/account-memberships.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { CollectionsModule } from './modules/collections/collections.module';
import { SalesModule } from './modules/sales/sales.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { ProfileModule } from './modules/profile/profile.module';
import { CustomersModule } from './modules/customers/customers.module';
import { KycModule } from './modules/kyc/kyc.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { StatsModule } from './modules/stats/stats.module';
import { MccManagerModule } from './modules/mcc-manager/mcc-manager.module';
import { MccOperationsModule } from './modules/mcc-operations/mcc-operations.module';
import { ReportsModule } from './modules/reports/reports.module';
import { MarketModule } from './modules/market/market.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { MigrationModule } from './migration/migration.module';
import { FeedModule } from './modules/feed/feed.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { PointsModule } from './modules/points/points.module';
import { OnboardModule } from './modules/onboard/onboard.module';
import { MediaModule } from './modules/media/media.module';
import { HealthModule } from './modules/health/health.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { InventoryItemsModule } from './modules/inventory-items/inventory-items.module';
import { LoansModule } from './modules/loans/loans.module';
import { ChargesModule } from './modules/charges/charges.module';
import { AnimalsModule } from './modules/animals/animals.module';
import { BreedsModule } from './modules/breeds/breeds.module';
import { FarmsModule } from './modules/farms/farms.module';
import { PoultryFlocksModule } from './modules/poultry-flocks/poultry-flocks.module';
import { PigBatchesModule } from './modules/pig-batches/pig-batches.module';
import { LocationsModule } from './modules/locations/locations.module';
import { MilkProductionModule } from './modules/milk-production/milk-production.module';
import { ImmisModule } from './modules/immis/immis.module';
import { AdminModule } from './modules/admin/admin.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { PublicAnalyticsModule } from './modules/public-analytics/public-analytics.module';
import { AppController } from './app.controller';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    RbacModule,
    AuthModule,
    AccountsModule,
    AccountMembershipsModule,
    SuppliersModule,
    CollectionsModule,
    SalesModule,
    WalletsModule,
    ProfileModule,
    CustomersModule,
    KycModule,
    NotificationsModule,
    EmployeesModule,
    AnalyticsModule,
    StatsModule,
    MccManagerModule,
    MccOperationsModule,
    ReportsModule,
    MarketModule,
    AccountingModule,
    PayrollModule,
    MigrationModule,
    FeedModule,
    ApiKeysModule,
    ReferralsModule,
    PointsModule,
    OnboardModule,
    MediaModule,
    HealthModule,
    InventoryModule,
    InventoryItemsModule,
    LoansModule,
    ChargesModule,
    AnimalsModule,
    BreedsModule,
    FarmsModule,
    PoultryFlocksModule,
    PigBatchesModule,
    LocationsModule,
    MilkProductionModule,
    ImmisModule,
    AdminModule,
    PublicAnalyticsModule,
  ],
})
export class AppModule {}

