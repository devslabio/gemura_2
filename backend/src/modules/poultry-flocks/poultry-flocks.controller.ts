import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { TokenGuard } from '../../common/guards/token.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { PoultryFlocksService } from './poultry-flocks.service';

@ApiTags('Poultry flocks')
@Controller('poultry-flocks')
@UseGuards(TokenGuard)
@ApiBearerAuth()
export class PoultryFlocksController {
  constructor(private readonly svc: PoultryFlocksService) {}

  @Get()
  @ApiOperation({ summary: 'List poultry flocks' })
  @ApiQuery({ name: 'account_id', required: false })
  @ApiQuery({ name: 'farm_id', required: false })
  async list(
    @CurrentUser() user: User,
    @Query('account_id') accountId?: string,
    @Query('farm_id') farmId?: string,
  ) {
    const data = await this.svc.list(user, accountId, farmId);
    return { code: 200, status: 'success', message: 'Flocks retrieved', data };
  }

  @Post()
  @ApiOperation({ summary: 'Create flock' })
  @ApiQuery({ name: 'account_id', required: false })
  async create(
    @CurrentUser() user: User,
    @Body()
    dto: {
      name: string;
      farm_id?: string;
      breed_id?: string;
      started_at: string;
      opening_head_count: number;
      notes?: string;
    },
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.svc.create(user, dto, accountId);
    return { code: 201, status: 'success', message: 'Flock created', data };
  }

  @Get(':id/daily')
  @ApiOperation({ summary: 'Daily egg & mortality records' })
  @ApiQuery({ name: 'account_id', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async listDaily(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('account_id') accountId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const data = await this.svc.listDaily(user, id, accountId, from, to);
    return { code: 200, status: 'success', message: 'Daily records retrieved', data };
  }

  @Post(':id/daily')
  @ApiOperation({ summary: 'Upsert daily record by date' })
  @ApiQuery({ name: 'account_id', required: false })
  async upsertDaily(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: { record_date: string; eggs_collected?: number; mortality_count?: number; notes?: string },
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.svc.upsertDaily(user, id, dto, accountId);
    return { code: 200, status: 'success', message: 'Daily record saved', data };
  }

  @Delete(':id/daily/:recordId')
  @ApiOperation({ summary: 'Delete daily record' })
  @ApiQuery({ name: 'account_id', required: false })
  async deleteDaily(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('recordId') recordId: string,
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.svc.deleteDaily(user, id, recordId, accountId);
    return { code: 200, status: 'success', message: data.message, data };
  }

  @Get(':id/movements')
  @ApiOperation({ summary: 'Batch intake & other movements' })
  @ApiQuery({ name: 'account_id', required: false })
  async listMovements(@CurrentUser() user: User, @Param('id') id: string, @Query('account_id') accountId?: string) {
    const data = await this.svc.listMovements(user, id, accountId);
    return { code: 200, status: 'success', message: 'Movements retrieved', data };
  }

  @Post(':id/movements')
  @ApiOperation({ summary: 'Add movement' })
  @ApiQuery({ name: 'account_id', required: false })
  async addMovement(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body()
    dto: {
      movement_date: string;
      type: 'intake' | 'sale' | 'transfer_out' | 'transfer_in' | 'adjustment';
      quantity: number;
      notes?: string;
    },
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.svc.addMovement(user, id, dto as any, accountId);
    return { code: 201, status: 'success', message: 'Movement recorded', data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get flock' })
  @ApiQuery({ name: 'account_id', required: false })
  async getOne(@CurrentUser() user: User, @Param('id') id: string, @Query('account_id') accountId?: string) {
    const data = await this.svc.getOne(user, id, accountId);
    return { code: 200, status: 'success', message: 'Flock retrieved', data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update flock' })
  @ApiQuery({ name: 'account_id', required: false })
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body()
    dto: {
      name?: string;
      farm_id?: string | null;
      breed_id?: string | null;
      status?: 'active' | 'closed' | 'archived';
      notes?: string | null;
    },
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.svc.update(user, id, dto, accountId);
    return { code: 200, status: 'success', message: 'Flock updated', data };
  }
}
