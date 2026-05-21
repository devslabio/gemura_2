import { Controller, Post, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiUnauthorizedResponse, ApiBadRequestResponse } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { TokenGuard } from '../../common/guards/token.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequireAnyPermission } from '../../common/decorators/permission.decorator';
import { CurrentAccount } from '../../common/decorators/account.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User } from '@prisma/client';
import { GetOverviewDto } from './dto/get-overview.dto';

@ApiTags('Stats')
@Controller('stats')
@UseGuards(TokenGuard, PermissionGuard)
@ApiBearerAuth()
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Post('overview')
  @HttpCode(200)
  @RequireAnyPermission(['dashboard.view', 'view_analytics'])
  @ApiOperation({
    summary: 'Get overview statistics',
    description:
      'Retrieve dashboard overview: summary (sales, collections, suppliers, customers), daily breakdown, recent milk movements. Optional body: account_id (UUID), date_from, date_to, tz_offset_minutes, aggregate_all_accounts (platform-wide milk + relationships; requires manage_users or platform admin on the request membership context).',
  })
  @ApiBody({
    type: GetOverviewDto,
    required: false,
    description: 'Optional filters. Omit or send {} to use default account and default date range.',
    examples: {
      withDates: {
        summary: 'With date range',
        value: { date_from: '2025-01-01', date_to: '2025-01-31' },
      },
      withAccount: {
        summary: 'Specific account',
        value: { account_id: '550e8400-e29b-41d4-a716-446655440000' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Overview statistics fetched successfully',
    schema: {
      example: {
        code: 200,
        status: 'success',
        message: 'Overview data fetched successfully.',
        data: {
          summary: {
            collection: { liters: 12500.5, value: 4375175, transactions: 150 },
            rejections: { liters: 120, value: 46800, transactions: 2 },
            sales: { liters: 8500, value: 3315000, transactions: 120 },
            suppliers: { active: 25, inactive: 5 },
            customers: { active: 45, inactive: 8 },
          },
          breakdown_type: 'daily',
          chart_period: 'last_7_days',
          breakdown: [
            { date: '2025-01-25', label: '25 Jan', sales: { liters: 200, value: 78000 }, collection: { liters: 250, value: 87500 } },
          ],
          recent_transactions: [
            { id: 'uuid', type: 'sale', quantity: 100, total_amount: 40000, transaction_at: '2025-01-25T10:00:00Z', customer_account: { id: 'uuid', code: 'A_ABC', name: 'Customer A' }, supplier_account: null },
          ],
          date_range: { from: '2025-01-01', to: '2025-01-31' },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'No default account found or invalid date format',
    schema: { example: { code: 400, status: 'error', message: 'No valid default account found.' } },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing authentication token',
    schema: { example: { code: 401, status: 'error', message: 'Access denied. Token is required.' } },
  })
  async getOverview(
    @CurrentUser() user: User,
    @CurrentAccount() membershipAccountId: string,
    @Body() dto?: GetOverviewDto,
  ) {
    const opts =
      dto?.aggregate_all_accounts === true
        ? { aggregateAllAccounts: true as const, membershipAccountId }
        : undefined;
    return this.statsService.getOverview(
      user,
      dto?.account_id,
      dto?.date_from,
      dto?.date_to,
      dto?.tz_offset_minutes,
      opts,
    );
  }

  @Post()
  @HttpCode(200)
  @RequireAnyPermission(['dashboard.view', 'view_analytics'])
  @ApiOperation({
    summary: 'Get general statistics',
    description: 'Retrieve general statistics for the authenticated user\'s default account, including collections, sales, and relationship counts.',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics fetched successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Stats fetched successfully.',
      data: {
        collections: {
          total: 150,
          total_quantity: 12500.5,
        },
        sales: {
          total: 120,
          total_quantity: 8500.0,
        },
        suppliers: 30,
        customers: 53,
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'No default account found',
    example: {
      code: 400,
      status: 'error',
      message: 'No valid default account found.',
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing authentication token',
    example: {
      code: 401,
      status: 'error',
      message: 'Access denied. Token is required.',
    },
  })
  async getStats(@CurrentUser() user: User) {
    return this.statsService.getStats(user);
  }
}

