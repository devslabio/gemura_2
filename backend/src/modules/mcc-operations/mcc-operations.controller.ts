import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { RequireAnyPermission, RequirePermission } from '../../common/decorators/permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TokenGuard } from '../../common/guards/token.guard';
import { CreateGateDeliveryDto } from './dto/create-gate-delivery.dto';
import { CreateManifestDto } from './dto/create-manifest.dto';
import { CreateTestResultDto } from './dto/create-test-result.dto';
import { RejectManifestDto } from './dto/reject-manifest.dto';
import { StartShiftDto } from './dto/start-shift.dto';
import { UpdateManifestDraftDto } from './dto/update-manifest-draft.dto';
import { UpdateTestResultDto } from './dto/update-test-result.dto';
import { MccOperationsService } from './mcc-operations.service';

@ApiTags('MCC Operations')
@Controller('mcc/operations')
@UseGuards(TokenGuard, PermissionGuard)
@ApiBearerAuth()
export class MccOperationsController {
  constructor(private readonly ops: MccOperationsService) {}

  @Get('gate-deliveries')
  @RequireAnyPermission([
    'mcc_view_operations',
    'mcc_view_own_operations',
    'view_collections',
    'mcc_floor_operations',
  ])
  @ApiOperation({ summary: 'List gate deliveries for the MCC (date range, UTC).' })
  @ApiQuery({ name: 'account_id', required: true })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD' })
  listGate(
    @CurrentUser() user: User,
    @Query('account_id') accountId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.ops.listGateDeliveries(user, accountId, from, to);
  }

  @Post('gate-deliveries')
  @RequireAnyPermission(['mcc_manage_operations', 'mcc_manage_own_operations', 'mcc_floor_operations'])
  @ApiOperation({ summary: 'Record a gate delivery' })
  createGate(@CurrentUser() user: User, @Body() dto: CreateGateDeliveryDto) {
    return this.ops.createGateDelivery(user, dto);
  }

  @Get('manifests')
  @RequireAnyPermission([
    'mcc_view_operations',
    'mcc_view_own_operations',
    'view_collections',
    'mcc_floor_operations',
  ])
  @ApiQuery({ name: 'account_id', required: true })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  listManifests(
    @CurrentUser() user: User,
    @Query('account_id') accountId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.ops.listManifests(user, accountId, from, to);
  }

  @Post('manifests')
  @RequireAnyPermission(['mcc_manage_operations', 'mcc_manage_own_operations', 'mcc_floor_operations'])
  @ApiOperation({ summary: 'Create draft manifest for an Umucunda gate delivery' })
  createManifest(@CurrentUser() user: User, @Body() dto: CreateManifestDto) {
    return this.ops.createManifest(user, dto);
  }

  @Patch('manifests/:manifestId/draft')
  @RequireAnyPermission(['mcc_manage_operations', 'mcc_manage_own_operations', 'mcc_floor_operations'])
  updateDraft(
    @CurrentUser() user: User,
    @Param('manifestId') manifestId: string,
    @Body() dto: UpdateManifestDraftDto,
  ) {
    return this.ops.updateManifestDraft(user, manifestId, dto);
  }

  @Patch('manifests/:manifestId/submit')
  @RequireAnyPermission(['mcc_manage_operations', 'mcc_manage_own_operations', 'mcc_floor_operations'])
  submit(@CurrentUser() user: User, @Param('manifestId') manifestId: string, @Query('account_id') accountId?: string) {
    return this.ops.submitManifest(user, manifestId, accountId);
  }

  @Patch('manifests/:manifestId/accept')
  @RequirePermission('mcc_accept_manifests')
  accept(@CurrentUser() user: User, @Param('manifestId') manifestId: string, @Query('account_id') accountId?: string) {
    return this.ops.acceptManifest(user, manifestId, accountId);
  }

  @Patch('manifests/:manifestId/reject')
  @RequirePermission('mcc_accept_manifests')
  reject(
    @CurrentUser() user: User,
    @Param('manifestId') manifestId: string,
    @Body() dto: RejectManifestDto,
  ) {
    return this.ops.rejectManifest(user, manifestId, dto);
  }

  @Get('test-results')
  @RequireAnyPermission(['view_collections', 'mcc_view_operations', 'mcc_view_own_operations'])
  @ApiQuery({ name: 'account_id', required: true })
  @ApiQuery({ name: 'outcome', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  listTests(
    @CurrentUser() user: User,
    @Query('account_id') accountId: string,
    @Query('outcome') outcome?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.ops.listTestResults(user, accountId, outcome, from, to);
  }

  @Post('test-results')
  @RequireAnyPermission(['mcc_manage_operations'])
  createTest(@CurrentUser() user: User, @Body() dto: CreateTestResultDto) {
    return this.ops.createTestResult(user, dto);
  }

  @Patch('test-results/:testResultId')
  @RequireAnyPermission(['mcc_manage_operations'])
  updateTest(
    @CurrentUser() user: User,
    @Param('testResultId') testResultId: string,
    @Body() dto: UpdateTestResultDto,
  ) {
    return this.ops.updateTestResult(user, testResultId, dto);
  }

  @Get('shifts')
  @RequireAnyPermission([
    'mcc_view_operations',
    'mcc_view_own_operations',
    'view_collections',
    'mcc_floor_operations',
  ])
  @ApiQuery({ name: 'account_id', required: true })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  listShifts(
    @CurrentUser() user: User,
    @Query('account_id') accountId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.ops.listShifts(user, accountId, from, to);
  }

  @Get('staff-options')
  @RequireAnyPermission([
    'mcc_view_operations',
    'mcc_view_own_operations',
    'view_collections',
    'mcc_floor_operations',
  ])
  @ApiQuery({ name: 'account_id', required: true })
  staffOptions(@CurrentUser() user: User, @Query('account_id') accountId: string) {
    return this.ops.staffOptions(user, accountId);
  }

  @Post('shifts/start')
  @RequireAnyPermission(['mcc_manage_operations', 'mcc_manage_own_operations', 'mcc_floor_operations'])
  startShift(@CurrentUser() user: User, @Body() dto: StartShiftDto) {
    return this.ops.startShift(user, dto);
  }

  @Patch('shifts/:shiftId/end')
  @RequireAnyPermission(['mcc_manage_operations', 'mcc_manage_own_operations', 'mcc_floor_operations'])
  endShift(
    @CurrentUser() user: User,
    @Param('shiftId') shiftId: string,
    @Query('account_id') accountId?: string,
  ) {
    return this.ops.endShift(user, shiftId, accountId);
  }
}
