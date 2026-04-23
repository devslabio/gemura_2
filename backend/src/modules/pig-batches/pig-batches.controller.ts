import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { TokenGuard } from '../../common/guards/token.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { PigBatchesService } from './pig-batches.service';

@ApiTags('Pig batches')
@Controller('pig-batches')
@UseGuards(TokenGuard)
@ApiBearerAuth()
export class PigBatchesController {
  constructor(private readonly svc: PigBatchesService) {}

  @Get()
  @ApiOperation({ summary: 'List pig batches' })
  @ApiQuery({ name: 'account_id', required: false })
  @ApiQuery({ name: 'farm_id', required: false })
  async list(@CurrentUser() user: User, @Query('account_id') accountId?: string, @Query('farm_id') farmId?: string) {
    const data = await this.svc.listBatches(user, accountId, farmId);
    return { code: 200, status: 'success', message: 'Batches retrieved', data };
  }

  @Post()
  @ApiOperation({ summary: 'Create pig batch' })
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
    const data = await this.svc.createBatch(user, dto, accountId);
    return { code: 201, status: 'success', message: 'Batch created', data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update pig batch' })
  @ApiQuery({ name: 'account_id', required: false })
  async patch(
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
    const data = await this.svc.updateBatch(user, id, dto, accountId);
    return { code: 200, status: 'success', message: 'Batch updated', data };
  }

  @Get(':id/weights')
  @ApiOperation({ summary: 'Weight band / growth records' })
  @ApiQuery({ name: 'account_id', required: false })
  async weights(@CurrentUser() user: User, @Param('id') id: string, @Query('account_id') accountId?: string) {
    const data = await this.svc.listWeights(user, id, accountId);
    return { code: 200, status: 'success', message: 'Weights retrieved', data };
  }

  @Post(':id/weights')
  @ApiOperation({ summary: 'Upsert weight row for a date (unique per batch per day)' })
  @ApiQuery({ name: 'account_id', required: false })
  async upsertWeight(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body()
    dto: {
      weighed_date: string;
      avg_weight_kg: number;
      min_weight_kg?: number;
      max_weight_kg?: number;
      animals_weighed?: number;
      weight_band?: string;
      notes?: string;
    },
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.svc.upsertWeight(user, id, dto, accountId);
    return { code: 200, status: 'success', message: 'Weight saved', data };
  }

  @Delete(':id/weights/:weightId')
  @ApiOperation({ summary: 'Delete weight record' })
  @ApiQuery({ name: 'account_id', required: false })
  async deleteWeight(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('weightId') weightId: string,
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.svc.deleteWeight(user, id, weightId, accountId);
    return { code: 200, status: 'success', message: data.message, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get batch' })
  @ApiQuery({ name: 'account_id', required: false })
  async get(@CurrentUser() user: User, @Param('id') id: string, @Query('account_id') accountId?: string) {
    const data = await this.svc.getBatch(user, id, accountId);
    return { code: 200, status: 'success', message: 'Batch retrieved', data };
  }
}
