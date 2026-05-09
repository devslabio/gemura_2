import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { CurrentAccount } from '../../common/decorators/account.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { TokenGuard } from '../../common/guards/token.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { SupervisorService } from './supervisor.service';

@ApiTags('Supervisor')
@UseGuards(TokenGuard, PermissionGuard)
@Controller('supervisor')
export class SupervisorController {
  constructor(private readonly supervisor: SupervisorService) {}

  @Get('scope')
  @RequirePermission('view_regional_accounts')
  @ApiOperation({ summary: 'Get region/district scope for regional supervisor dashboards' })
  @ApiResponse({ status: 200, description: 'Scope returned.' })
  async getScope(@CurrentUser() user: User, @CurrentAccount() accountId: string) {
    return this.supervisor.getScope(user, accountId);
  }

  @Get('accounts')
  @RequirePermission('view_regional_accounts')
  @ApiOperation({ summary: 'List scoped platform accounts for regional supervisor dashboards' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'account_type', required: false, enum: ['tenant', 'branch', 'admin', 'all'] })
  @ApiQuery({ name: 'district_location_id', required: false })
  @ApiQuery({ name: 'region_id', required: false, description: 'Province location UUID (filters scoped districts).' })
  async listAccounts(
    @CurrentUser() user: User,
    @CurrentAccount() accountId: string,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('search') search?: string,
    @Query('account_type') accountType?: string,
    @Query('district_location_id') districtLocationId?: string,
    @Query('region_id') regionId?: string,
  ) {
    const page = Math.max(1, Number.parseInt(pageRaw ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(limitRaw ?? '50', 10) || 50));
    const at =
      accountType === 'tenant' || accountType === 'branch' || accountType === 'admin' || accountType === 'all'
        ? accountType
        : 'all';
    return this.supervisor.listAccounts(user, accountId, {
      page,
      limit,
      search: search?.trim() || undefined,
      account_type: at,
      district_location_id: districtLocationId?.trim() || undefined,
      region_id: regionId?.trim() || undefined,
    });
  }

  @Get('summary')
  @RequirePermission('view_regional_accounts')
  @ApiOperation({ summary: 'Get KPI summary for regional supervisor dashboards' })
  @ApiQuery({ name: 'district_location_id', required: false })
  @ApiQuery({ name: 'region_id', required: false })
  async getSummary(
    @CurrentUser() user: User,
    @CurrentAccount() accountId: string,
    @Query('district_location_id') districtLocationId?: string,
    @Query('region_id') regionId?: string,
  ) {
    return this.supervisor.getSummary(user, accountId, {
      district_location_id: districtLocationId?.trim() || undefined,
      region_id: regionId?.trim() || undefined,
    });
  }
}

