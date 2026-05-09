import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { TokenGuard } from '../../common/guards/token.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { PigBatchesService } from './pig-batches.service';

@ApiTags('Pig farrowing')
@Controller('pig-farrowings')
@UseGuards(TokenGuard)
@ApiBearerAuth()
export class PigFarrowingsController {
  constructor(private readonly svc: PigBatchesService) {}

  @Get()
  @ApiOperation({ summary: 'List farrowing records' })
  @ApiQuery({ name: 'account_id', required: false })
  @ApiQuery({ name: 'farm_id', required: false })
  @ApiQuery({ name: 'pig_batch_id', required: false })
  async list(
    @CurrentUser() user: User,
    @Query('account_id') accountId?: string,
    @Query('farm_id') farmId?: string,
    @Query('pig_batch_id') batchId?: string,
  ) {
    const data = await this.svc.listFarrowings(user, accountId, farmId, batchId);
    return { code: 200, status: 'success', message: 'Farrowing records retrieved', data };
  }

  @Post()
  @ApiOperation({
    summary: 'Record farrowing',
    description: 'If pig_batch_id is set, live_born are added to batch head count.',
  })
  @ApiQuery({ name: 'account_id', required: false })
  async create(
    @CurrentUser() user: User,
    @Body()
    dto: {
      farm_id?: string;
      pig_batch_id?: string;
      sow_animal_id?: string;
      farrowing_date: string;
      live_born?: number;
      stillborn?: number;
      mummified?: number;
      notes?: string;
    },
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.svc.createFarrowing(user, dto, accountId);
    return { code: 201, status: 'success', message: 'Farrowing recorded', data };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete farrowing record' })
  @ApiParam({ name: 'id', description: 'Farrowing record ID.' })
  @ApiQuery({ name: 'account_id', required: false })
  @ApiResponse({ status: 200, description: 'Farrowing record deleted successfully.' })
  async delete(@CurrentUser() user: User, @Param('id') id: string, @Query('account_id') accountId?: string) {
    const data = await this.svc.deleteFarrowing(user, id, accountId);
    return { code: 200, status: 'success', message: data.message, data };
  }
}
