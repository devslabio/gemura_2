import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { RequireAnyPermission } from '../../common/decorators/permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TokenGuard } from '../../common/guards/token.guard';
import { MccSourceResolutionStatus } from '@prisma/client';
import { MccManagerService } from './mcc-manager.service';
import { ApproveTestResolutionDto } from './dto/approve-test-resolution.dto';

@ApiTags('MCC Manager')
@Controller('mcc/manager')
@UseGuards(TokenGuard, PermissionGuard)
@ApiBearerAuth()
export class MccManagerController {
  constructor(private readonly mccManager: MccManagerService) {}

  @Get('overview')
  @RequireAnyPermission(['mcc_view_operations', 'mcc_view_own_operations', 'view_collections'])
  @ApiOperation({
    summary: 'MCC manager operations overview (gate, manifests, rejections, staff)',
    description:
      'Returns gate volumes split direct vs Umucunda, manifest compliance rows, rejected test results for traceability, and active gate-role staff for the selected calendar day (UTC).',
  })
  @ApiResponse({ status: 200, description: 'MCC manager overview retrieved successfully.' })
  @ApiQuery({ name: 'account_id', required: true })
  @ApiQuery({ name: 'date', required: false, description: 'YYYY-MM-DD (UTC day). Defaults to today UTC.' })
  async overview(
    @CurrentUser() user: User,
    @Query('account_id') accountId: string,
    @Query('date') date?: string,
  ) {
    const d =
      date && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date
        : new Date().toISOString().slice(0, 10);
    return this.mccManager.getManagerOverview(user, accountId, d);
  }

  @Patch('test-results/:testResultId/resolution')
  @RequireAnyPermission(['mcc_manage_operations'])
  @ApiOperation({
    summary: 'Update traceability resolution on a rejected gate test',
    description: 'Sets source_resolution_status for an MccMilkTestResult linked to this MCC account.',
  })
  @ApiParam({ name: 'testResultId', description: 'Milk test result ID.' })
  @ApiResponse({ status: 200, description: 'Traceability resolution updated successfully.' })
  async approveResolution(
    @CurrentUser() user: User,
    @Param('testResultId') testResultId: string,
    @Body() body: ApproveTestResolutionDto,
  ) {
    const status = body.source_resolution_status as MccSourceResolutionStatus;
    return this.mccManager.approveTestResolution(user, body.account_id, testResultId, status);
  }
}
