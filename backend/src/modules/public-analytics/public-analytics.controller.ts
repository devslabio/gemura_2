import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiQuery,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ApiKeyScopes, AnalyticsScopes } from '../../common/decorators/api-key-scopes.decorator';
import { CurrentApiKey } from '../../common/decorators/api-key.decorator';
import { AnalyticsQueryDto, ExportFormat, GroupByPeriod } from './dto/analytics-query.dto';
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
import { ApiKey, Account } from '@prisma/client';
import { UnifiedAnalyticsQueryDto } from './dto/unified-analytics-query.dto';

type ApiKeyWithAccount = ApiKey & { account?: Account | null };

function requirePlatformWideKey(apiKey: ApiKeyWithAccount): void {
  if (apiKey.account_id) {
    throw new ForbiddenException({
      code: 403,
      status: 'error',
      message: 'Platform analytics require a platform-wide API key (not scoped to a specific account).',
    });
  }
}

@ApiTags('Public Analytics API')
@ApiSecurity('X-API-Key')
@Controller('v1/analytics')
@UseGuards(ApiKeyGuard)
export class PublicAnalyticsController {
  constructor(
    private readonly baseService: BaseAnalyticsService,
    private readonly collectionsService: CollectionsAnalyticsService,
    private readonly salesService: SalesAnalyticsService,
    private readonly suppliersService: SuppliersAnalyticsService,
    private readonly financialService: FinancialAnalyticsService,
    private readonly inventoryService: InventoryAnalyticsService,
    private readonly payrollService: PayrollAnalyticsService,
    private readonly loansService: LoansAnalyticsService,
    private readonly platformService: PlatformAnalyticsService,
    private readonly unifiedService: UnifiedAnalyticsService,
  ) {}

  // ==========================================
  // MILK COLLECTIONS ANALYTICS
  // ==========================================

  @Get('collections/summary')
  @ApiKeyScopes(AnalyticsScopes.COLLECTIONS_READ)
  @ApiOperation({
    summary: 'Get milk collections summary',
    description: 'Returns aggregated summary of milk collections including total volume, value, transaction count, and acceptance rates. Collections are milk purchases from suppliers.',
  })
  @ApiQuery({ name: 'start_date', required: false, example: '2024-01-01' })
  @ApiQuery({ name: 'end_date', required: false, example: '2024-12-31' })
  @ApiQuery({ name: 'account_id', required: false, description: 'Specific account ID (platform-wide API keys only)' })
  @ApiResponse({
    status: 200,
    description: 'Collections summary retrieved successfully',
    schema: {
      example: {
        code: 200,
        status: 'success',
        message: 'Collections summary retrieved successfully',
        data: {
          summary: {
            total_volume: 125000.5,
            total_value: 15625062.5,
            transaction_count: 4521,
            unique_suppliers: 234,
            average_price_per_liter: 125,
            average_volume_per_transaction: 27.65,
            accepted_count: 4400,
            rejected_count: 100,
            pending_count: 21,
            acceptance_rate: 97.32,
          },
          growth: {
            volume_change_percent: 12.5,
            value_change_percent: 15.2,
            transaction_change_percent: 8.3,
            period: 'period_over_period',
          },
        },
        meta: {
          account_id: 'uuid-or-null',
          account_name: 'Gahengeri MCC',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          generated_at: '2024-12-15T10:30:00Z',
          api_version: 'v1',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing API key' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions or account access denied' })
  async getCollectionsSummary(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const [summary, growth] = await Promise.all([
      this.collectionsService.getSummary(context),
      this.collectionsService.getGrowth(context),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Collections summary retrieved successfully',
      data: { summary, growth },
      meta: this.baseService.buildMeta(context, apiKey.account),
    };
  }

  @Get('collections/breakdown')
  @ApiKeyScopes(AnalyticsScopes.COLLECTIONS_READ)
  @ApiOperation({
    summary: 'Get milk collections breakdown by time period',
    description: 'Returns collections data grouped by day, week, month, quarter, or year.',
  })
  @ApiQuery({ name: 'group_by', required: false, enum: GroupByPeriod, example: 'month' })
  @ApiResponse({ status: 200, description: 'Collections breakdown retrieved successfully' })
  async getCollectionsBreakdown(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const breakdown = await this.collectionsService.getBreakdown(context);

    return {
      code: 200,
      status: 'success',
      message: 'Collections breakdown retrieved successfully',
      data: { breakdown },
      meta: this.baseService.buildMeta(context, apiKey.account),
    };
  }

  @Get('collections/by-supplier')
  @ApiKeyScopes(AnalyticsScopes.COLLECTIONS_READ)
  @ApiOperation({
    summary: 'Get collections performance by supplier',
    description: 'Returns supplier rankings based on collection volume, value, and acceptance rates.',
  })
  @ApiResponse({ status: 200, description: 'Supplier performance data retrieved successfully' })
  async getCollectionsBySupplier(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const [suppliers, total] = await Promise.all([
      this.collectionsService.getSupplierPerformance(context),
      this.collectionsService.getTotalCount(context),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Supplier performance data retrieved successfully',
      data: { suppliers },
      meta: this.baseService.buildMeta(context, apiKey.account, total),
    };
  }

  @Get('collections/export')
  @ApiKeyScopes(AnalyticsScopes.COLLECTIONS_READ, AnalyticsScopes.EXPORT_READ)
  @ApiOperation({
    summary: 'Export raw collections data',
    description: 'Returns raw collections data for export to external tools like Looker Studio or Power BI.',
  })
  @ApiQuery({ name: 'format', required: false, enum: ExportFormat, example: 'json' })
  @ApiResponse({ status: 200, description: 'Collections data exported successfully' })
  async exportCollections(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
    @Res() res: Response,
  ) {
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const [data, total] = await Promise.all([
      this.collectionsService.getRawData(context),
      this.collectionsService.getTotalCount(context),
    ]);

    if (query.format === ExportFormat.CSV) {
      return this.sendCsvResponse(res, data, 'collections');
    }

    return res.json({
      code: 200,
      status: 'success',
      message: 'Collections data exported successfully',
      data,
      meta: this.baseService.buildMeta(context, apiKey.account, total),
    });
  }

  // ==========================================
  // MILK SALES ANALYTICS
  // ==========================================

  @Get('sales/summary')
  @ApiKeyScopes(AnalyticsScopes.SALES_READ)
  @ApiOperation({
    summary: 'Get milk sales summary',
    description: 'Returns aggregated summary of milk sales including total volume, value, payment collection rates. Sales are milk sold to customers.',
  })
  @ApiResponse({ status: 200, description: 'Sales summary retrieved successfully' })
  async getSalesSummary(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const [summary, growth] = await Promise.all([
      this.salesService.getSummary(context),
      this.salesService.getGrowth(context),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Sales summary retrieved successfully',
      data: { summary, growth },
      meta: this.baseService.buildMeta(context, apiKey.account),
    };
  }

  @Get('sales/breakdown')
  @ApiKeyScopes(AnalyticsScopes.SALES_READ)
  @ApiOperation({
    summary: 'Get milk sales breakdown by time period',
    description: 'Returns sales data grouped by day, week, month, quarter, or year.',
  })
  @ApiResponse({ status: 200, description: 'Sales breakdown retrieved successfully' })
  async getSalesBreakdown(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const breakdown = await this.salesService.getBreakdown(context);

    return {
      code: 200,
      status: 'success',
      message: 'Sales breakdown retrieved successfully',
      data: { breakdown },
      meta: this.baseService.buildMeta(context, apiKey.account),
    };
  }

  @Get('sales/by-customer')
  @ApiKeyScopes(AnalyticsScopes.SALES_READ)
  @ApiOperation({
    summary: 'Get sales performance by customer',
    description: 'Returns customer rankings based on purchase volume, value, and payment rates.',
  })
  @ApiResponse({ status: 200, description: 'Customer performance data retrieved successfully' })
  async getSalesByCustomer(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const [customers, total] = await Promise.all([
      this.salesService.getCustomerPerformance(context),
      this.salesService.getTotalCount(context),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Customer performance data retrieved successfully',
      data: { customers },
      meta: this.baseService.buildMeta(context, apiKey.account, total),
    };
  }

  @Get('sales/export')
  @ApiKeyScopes(AnalyticsScopes.SALES_READ, AnalyticsScopes.EXPORT_READ)
  @ApiOperation({
    summary: 'Export raw sales data',
    description: 'Returns raw sales data for export to external tools.',
  })
  @ApiResponse({ status: 200, description: 'Sales data exported successfully' })
  async exportSales(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
    @Res() res: Response,
  ) {
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const [data, total] = await Promise.all([
      this.salesService.getRawData(context),
      this.salesService.getTotalCount(context),
    ]);

    if (query.format === ExportFormat.CSV) {
      return this.sendCsvResponse(res, data, 'sales');
    }

    return res.json({
      code: 200,
      status: 'success',
      message: 'Sales data exported successfully',
      data,
      meta: this.baseService.buildMeta(context, apiKey.account, total),
    });
  }

  // ==========================================
  // SUPPLIERS ANALYTICS
  // ==========================================

  @Get('suppliers/summary')
  @ApiKeyScopes(AnalyticsScopes.SUPPLIERS_READ)
  @ApiOperation({
    summary: 'Get suppliers summary',
    description: 'Returns aggregated summary of supplier relationships and supply activity.',
  })
  @ApiResponse({ status: 200, description: 'Suppliers summary retrieved successfully' })
  async getSuppliersSummary(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const [summary, growth] = await Promise.all([
      this.suppliersService.getSummary(context),
      this.suppliersService.getGrowth(context),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Suppliers summary retrieved successfully',
      data: { summary, growth },
      meta: this.baseService.buildMeta(context, apiKey.account),
    };
  }

  @Get('suppliers/breakdown')
  @ApiKeyScopes(AnalyticsScopes.SUPPLIERS_READ)
  @ApiOperation({
    summary: 'Get suppliers breakdown by time period',
    description: 'Returns new suppliers and activity data grouped by time period.',
  })
  @ApiResponse({ status: 200, description: 'Suppliers breakdown retrieved successfully' })
  async getSuppliersBreakdown(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const breakdown = await this.suppliersService.getBreakdown(context);

    return {
      code: 200,
      status: 'success',
      message: 'Suppliers breakdown retrieved successfully',
      data: { breakdown },
      meta: this.baseService.buildMeta(context, apiKey.account),
    };
  }

  @Get('suppliers/list')
  @ApiKeyScopes(AnalyticsScopes.SUPPLIERS_READ)
  @ApiOperation({
    summary: 'Get detailed supplier list',
    description: 'Returns detailed information about all suppliers with performance metrics.',
  })
  @ApiResponse({ status: 200, description: 'Supplier list retrieved successfully' })
  async getSupplierList(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const [suppliers, total] = await Promise.all([
      this.suppliersService.getSupplierList(context),
      this.suppliersService.getTotalCount(context),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Supplier list retrieved successfully',
      data: { suppliers },
      meta: this.baseService.buildMeta(context, apiKey.account, total),
    };
  }

  @Get('everything')
  @ApiKeyScopes(AnalyticsScopes.ALL)
  @ApiOperation({
    summary: 'Get unified account analytics payload',
    description:
      'Returns one consolidated payload with account details, linked users, suppliers, customers, collections, and sales. Account-scoped API keys return their own account by default. Platform-wide keys can filter by account_id/account_ids or page through matching accounts. Use `page`/`limit` for top-level account pagination and `nested_page`/`nested_limit` for each nested section inside every account bundle.',
  })
  @ApiQuery({ name: 'start_date', required: false, example: '2024-01-01', description: 'Start date filter applied to collections and sales.' })
  @ApiQuery({ name: 'end_date', required: false, example: '2024-12-31', description: 'End date filter applied to collections and sales.' })
  @ApiQuery({ name: 'account_id', required: false, description: 'Single account ID to scope the payload to. Platform-wide keys only.' })
  @ApiQuery({ name: 'account_ids', required: false, description: 'Comma-separated account IDs to scope the payload to. Platform-wide keys only.' })
  @ApiQuery({ name: 'page', required: false, example: 1, description: 'Top-level account page number.' })
  @ApiQuery({ name: 'limit', required: false, example: 50, description: 'Top-level account page size.' })
  @ApiQuery({ name: 'nested_page', required: false, example: 1, description: 'Nested section page number for users, suppliers, customers, collections, and sales inside each account.' })
  @ApiQuery({ name: 'nested_limit', required: false, example: 100, description: 'Nested section page size for users, suppliers, customers, collections, and sales inside each account.' })
  @ApiQuery({ name: 'search', required: false, example: 'gahengeri', description: 'Free-text search across account code/name and linked user name/phone/email.' })
  @ApiQuery({ name: 'account_status', required: false, example: 'active', description: 'Filter accounts by status.' })
  @ApiQuery({ name: 'user_status', required: false, example: 'active', description: 'Filter linked users by user-account link status.' })
  @ApiQuery({ name: 'relationship_status', required: false, example: 'active', description: 'Filter supplier/customer relationships by relationship status.' })
  @ApiQuery({ name: 'sale_status', required: false, example: 'accepted', description: 'Filter collections and sales by milk sale status.' })
  @ApiQuery({ name: 'payment_status', required: false, example: 'paid', description: 'Filter collections and sales by payment status.' })
  @ApiResponse({
    status: 200,
    description: 'Unified analytics payload retrieved successfully',
    schema: {
      example: {
        code: 200,
        status: 'success',
        message: 'Unified analytics payload retrieved successfully',
        data: {
          accounts: [
            {
              name: 'Jean Baptiste',
              phone: '250788123456',
              email: 'jean@example.com',
              account_type: 'mcc',
              status: 'active',
              created_at: '2025-01-04T10:00:00.000Z',
              suppliers: 12,
              customers: 3,
              collections: 420,
              sales: 0,
              farms: 1,
            },
          ],
        },
        meta: {
          account_id: '550e8400-e29b-41d4-a716-446655440000',
          account_name: 'Gahengeri MCC',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          generated_at: '2026-04-27T16:00:00.000Z',
          api_version: 'v1',
          page: 1,
          limit: 50,
          total: 1,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing API key' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions or account access denied' })
  async getEverything(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: UnifiedAnalyticsQueryDto,
  ) {
    const result = await this.unifiedService.getEverything(apiKey, query);

    return {
      code: 200,
      status: 'success',
      message: 'Unified analytics payload retrieved successfully',
      data: {
        accounts: result.accounts,
      },
      meta: this.baseService.buildMeta(result.context, apiKey.account, result.total),
    };
  }

  // ==========================================
  // FINANCIAL ANALYTICS
  // ==========================================

  @Get('financial/summary')
  @ApiKeyScopes(AnalyticsScopes.FINANCIAL_READ)
  @ApiOperation({
    summary: 'Get financial summary',
    description: 'Returns comprehensive financial summary including revenue, expenses, receivables, and payables.',
  })
  @ApiResponse({ status: 200, description: 'Financial summary retrieved successfully' })
  async getFinancialSummary(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const [summary, growth] = await Promise.all([
      this.financialService.getSummary(context),
      this.financialService.getGrowth(context),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Financial summary retrieved successfully',
      data: { summary, growth },
      meta: this.baseService.buildMeta(context, apiKey.account),
    };
  }

  @Get('financial/breakdown')
  @ApiKeyScopes(AnalyticsScopes.FINANCIAL_READ)
  @ApiOperation({
    summary: 'Get financial breakdown by time period',
    description: 'Returns revenue, expenses, and net income grouped by time period.',
  })
  @ApiResponse({ status: 200, description: 'Financial breakdown retrieved successfully' })
  async getFinancialBreakdown(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const breakdown = await this.financialService.getBreakdown(context);

    return {
      code: 200,
      status: 'success',
      message: 'Financial breakdown retrieved successfully',
      data: { breakdown },
      meta: this.baseService.buildMeta(context, apiKey.account),
    };
  }

  @Get('financial/payables')
  @ApiKeyScopes(AnalyticsScopes.FINANCIAL_READ)
  @ApiOperation({
    summary: 'Get accounts payable details',
    description: 'Returns outstanding amounts owed to suppliers.',
  })
  @ApiResponse({ status: 200, description: 'Payables data retrieved successfully' })
  async getPayablesDetails(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const payables = await this.financialService.getPayablesDetails(context);

    return {
      code: 200,
      status: 'success',
      message: 'Payables data retrieved successfully',
      data: { payables },
      meta: this.baseService.buildMeta(context, apiKey.account),
    };
  }

  @Get('financial/receivables')
  @ApiKeyScopes(AnalyticsScopes.FINANCIAL_READ)
  @ApiOperation({
    summary: 'Get accounts receivable details',
    description: 'Returns outstanding amounts owed by customers.',
  })
  @ApiResponse({ status: 200, description: 'Receivables data retrieved successfully' })
  async getReceivablesDetails(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const receivables = await this.financialService.getReceivablesDetails(context);

    return {
      code: 200,
      status: 'success',
      message: 'Receivables data retrieved successfully',
      data: { receivables },
      meta: this.baseService.buildMeta(context, apiKey.account),
    };
  }

  // ==========================================
  // INVENTORY ANALYTICS
  // ==========================================

  @Get('inventory/summary')
  @ApiKeyScopes(AnalyticsScopes.INVENTORY_READ)
  @ApiOperation({
    summary: 'Get inventory summary',
    description: 'Returns inventory overview including stock levels, values, and sales metrics.',
  })
  @ApiResponse({ status: 200, description: 'Inventory summary retrieved successfully' })
  async getInventorySummary(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const summary = await this.inventoryService.getSummary(context);

    return {
      code: 200,
      status: 'success',
      message: 'Inventory summary retrieved successfully',
      data: { summary },
      meta: this.baseService.buildMeta(context, apiKey.account),
    };
  }

  @Get('inventory/breakdown')
  @ApiKeyScopes(AnalyticsScopes.INVENTORY_READ)
  @ApiOperation({
    summary: 'Get inventory breakdown by time period',
    description: 'Returns inventory sales and stock movements grouped by time period.',
  })
  @ApiResponse({ status: 200, description: 'Inventory breakdown retrieved successfully' })
  async getInventoryBreakdown(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const breakdown = await this.inventoryService.getBreakdown(context);

    return {
      code: 200,
      status: 'success',
      message: 'Inventory breakdown retrieved successfully',
      data: { breakdown },
      meta: this.baseService.buildMeta(context, apiKey.account),
    };
  }

  @Get('inventory/top-products')
  @ApiKeyScopes(AnalyticsScopes.INVENTORY_READ)
  @ApiOperation({
    summary: 'Get top performing products',
    description: 'Returns products ranked by stock value and sales performance.',
  })
  @ApiResponse({ status: 200, description: 'Top products data retrieved successfully' })
  async getTopProducts(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const [products, total] = await Promise.all([
      this.inventoryService.getTopProducts(context),
      this.inventoryService.getTotalCount(context),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Top products data retrieved successfully',
      data: { products },
      meta: this.baseService.buildMeta(context, apiKey.account, total),
    };
  }

  @Get('inventory/low-stock')
  @ApiKeyScopes(AnalyticsScopes.INVENTORY_READ)
  @ApiOperation({
    summary: 'Get low stock items',
    description: 'Returns products with stock levels below threshold.',
  })
  @ApiResponse({ status: 200, description: 'Low stock items retrieved successfully' })
  async getLowStockItems(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const items = await this.inventoryService.getLowStockItems(context);

    return {
      code: 200,
      status: 'success',
      message: 'Low stock items retrieved successfully',
      data: { items },
      meta: this.baseService.buildMeta(context, apiKey.account),
    };
  }

  // ==========================================
  // PAYROLL ANALYTICS
  // ==========================================

  @Get('payroll/summary')
  @ApiKeyScopes(AnalyticsScopes.PAYROLL_READ)
  @ApiOperation({
    summary: 'Get payroll summary',
    description: 'Returns payroll overview including total disbursements, deductions, and supplier counts.',
  })
  @ApiResponse({ status: 200, description: 'Payroll summary retrieved successfully' })
  async getPayrollSummary(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const [summary, growth] = await Promise.all([
      this.payrollService.getSummary(context),
      this.payrollService.getGrowth(context),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Payroll summary retrieved successfully',
      data: { summary, growth },
      meta: this.baseService.buildMeta(context, apiKey.account),
    };
  }

  @Get('payroll/breakdown')
  @ApiKeyScopes(AnalyticsScopes.PAYROLL_READ)
  @ApiOperation({
    summary: 'Get payroll breakdown by time period',
    description: 'Returns payroll disbursements grouped by time period.',
  })
  @ApiResponse({ status: 200, description: 'Payroll breakdown retrieved successfully' })
  async getPayrollBreakdown(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const breakdown = await this.payrollService.getBreakdown(context);

    return {
      code: 200,
      status: 'success',
      message: 'Payroll breakdown retrieved successfully',
      data: { breakdown },
      meta: this.baseService.buildMeta(context, apiKey.account),
    };
  }

  @Get('payroll/runs')
  @ApiKeyScopes(AnalyticsScopes.PAYROLL_READ)
  @ApiOperation({
    summary: 'Get payroll run details',
    description: 'Returns detailed information about payroll runs including deduction breakdowns.',
  })
  @ApiResponse({ status: 200, description: 'Payroll runs retrieved successfully' })
  async getPayrollRuns(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const [runs, total] = await Promise.all([
      this.payrollService.getPayrollRuns(context),
      this.payrollService.getTotalCount(context),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Payroll runs retrieved successfully',
      data: { runs },
      meta: this.baseService.buildMeta(context, apiKey.account, total),
    };
  }

  @Get('payroll/by-supplier')
  @ApiKeyScopes(AnalyticsScopes.PAYROLL_READ)
  @ApiOperation({
    summary: 'Get payroll details by supplier',
    description: 'Returns payroll totals and deductions grouped by supplier.',
  })
  @ApiResponse({ status: 200, description: 'Supplier payroll data retrieved successfully' })
  async getPayrollBySupplier(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const suppliers = await this.payrollService.getSupplierPayrollDetails(context);

    return {
      code: 200,
      status: 'success',
      message: 'Supplier payroll data retrieved successfully',
      data: { suppliers },
      meta: this.baseService.buildMeta(context, apiKey.account),
    };
  }

  // ==========================================
  // LOANS ANALYTICS
  // ==========================================

  @Get('loans/summary')
  @ApiKeyScopes(AnalyticsScopes.LOANS_READ)
  @ApiOperation({
    summary: 'Get loans summary',
    description: 'Returns loans overview including outstanding balances, repayment rates, and loan status counts.',
  })
  @ApiResponse({ status: 200, description: 'Loans summary retrieved successfully' })
  async getLoansSummary(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const [summary, growth] = await Promise.all([
      this.loansService.getSummary(context),
      this.loansService.getGrowth(context),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Loans summary retrieved successfully',
      data: { summary, growth },
      meta: this.baseService.buildMeta(context, apiKey.account),
    };
  }

  @Get('loans/breakdown')
  @ApiKeyScopes(AnalyticsScopes.LOANS_READ)
  @ApiOperation({
    summary: 'Get loans breakdown by time period',
    description: 'Returns loan disbursements and repayments grouped by time period.',
  })
  @ApiResponse({ status: 200, description: 'Loans breakdown retrieved successfully' })
  async getLoansBreakdown(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const breakdown = await this.loansService.getBreakdown(context);

    return {
      code: 200,
      status: 'success',
      message: 'Loans breakdown retrieved successfully',
      data: { breakdown },
      meta: this.baseService.buildMeta(context, apiKey.account),
    };
  }

  @Get('loans/list')
  @ApiKeyScopes(AnalyticsScopes.LOANS_READ)
  @ApiOperation({
    summary: 'Get loan list',
    description: 'Returns detailed list of all loans with repayment status.',
  })
  @ApiResponse({ status: 200, description: 'Loan list retrieved successfully' })
  async getLoanList(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const [loans, total] = await Promise.all([
      this.loansService.getLoanList(context),
      this.loansService.getTotalCount(context),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Loan list retrieved successfully',
      data: { loans },
      meta: this.baseService.buildMeta(context, apiKey.account, total),
    };
  }

  @Get('loans/by-borrower')
  @ApiKeyScopes(AnalyticsScopes.LOANS_READ)
  @ApiOperation({
    summary: 'Get loan performance by borrower',
    description: 'Returns borrower rankings based on loan amounts and repayment performance.',
  })
  @ApiResponse({ status: 200, description: 'Borrower performance data retrieved successfully' })
  async getLoansByBorrower(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const borrowers = await this.loansService.getBorrowerPerformance(context);

    return {
      code: 200,
      status: 'success',
      message: 'Borrower performance data retrieved successfully',
      data: { borrowers },
      meta: this.baseService.buildMeta(context, apiKey.account),
    };
  }

  // ==========================================
  // PLATFORM ANALYTICS (Admin Only)
  // ==========================================

  @Get('platform/summary')
  @ApiKeyScopes(AnalyticsScopes.PLATFORM_READ)
  @ApiOperation({
    summary: 'Get platform-wide summary',
    description: 'Returns platform-wide statistics including total accounts, users, and transaction volumes. Requires platform-wide API key.',
  })
  @ApiResponse({ status: 200, description: 'Platform summary retrieved successfully' })
  async getPlatformSummary(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    requirePlatformWideKey(apiKey);
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const [summary, growth] = await Promise.all([
      this.platformService.getSummary(context),
      this.platformService.getGrowth(context),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Platform summary retrieved successfully',
      data: { summary, growth },
      meta: this.baseService.buildMeta(context, null),
    };
  }

  @Get('platform/breakdown')
  @ApiKeyScopes(AnalyticsScopes.PLATFORM_READ)
  @ApiOperation({
    summary: 'Get platform breakdown by time period',
    description: 'Returns platform-wide metrics grouped by time period.',
  })
  @ApiResponse({ status: 200, description: 'Platform breakdown retrieved successfully' })
  async getPlatformBreakdown(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    requirePlatformWideKey(apiKey);
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const breakdown = await this.platformService.getBreakdown(context);

    return {
      code: 200,
      status: 'success',
      message: 'Platform breakdown retrieved successfully',
      data: { breakdown },
      meta: this.baseService.buildMeta(context, null),
    };
  }

  @Get('platform/accounts')
  @ApiKeyScopes(AnalyticsScopes.PLATFORM_READ)
  @ApiOperation({
    summary: 'Get account overviews',
    description: 'Returns detailed overview of all accounts with activity metrics.',
  })
  @ApiResponse({ status: 200, description: 'Account overviews retrieved successfully' })
  async getAccountOverviews(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    requirePlatformWideKey(apiKey);
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const [accounts, total] = await Promise.all([
      this.platformService.getAccountOverviews(context),
      this.platformService.getTotalCount(),
    ]);

    return {
      code: 200,
      status: 'success',
      message: 'Account overviews retrieved successfully',
      data: { accounts },
      meta: this.baseService.buildMeta(context, null, total),
    };
  }

  @Get('platform/geography')
  @ApiKeyScopes(AnalyticsScopes.PLATFORM_READ)
  @ApiOperation({
    summary: 'Get geographic distribution',
    description: 'Returns platform metrics grouped by geographic region (province).',
  })
  @ApiResponse({ status: 200, description: 'Geographic distribution retrieved successfully' })
  async getGeographyDistribution(
    @CurrentApiKey() apiKey: ApiKeyWithAccount,
    @Query() query: AnalyticsQueryDto,
  ) {
    requirePlatformWideKey(apiKey);
    const context = await this.baseService.resolveAccountContext(apiKey, query);
    const distribution = await this.platformService.getGeographyDistribution(context);

    return {
      code: 200,
      status: 'success',
      message: 'Geographic distribution retrieved successfully',
      data: { distribution },
      meta: this.baseService.buildMeta(context, null),
    };
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  private sendCsvResponse(res: Response, data: any[], filename: string): void {
    if (!data || data.length === 0) {
      res.status(HttpStatus.OK).send('');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            if (value === null || value === undefined) return '';
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return String(value);
          })
          .join(','),
      ),
    ];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    res.status(HttpStatus.OK).send(csvRows.join('\n'));
  }
}
