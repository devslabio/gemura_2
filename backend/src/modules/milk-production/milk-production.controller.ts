import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { MilkProductionService } from './milk-production.service';
import { TokenGuard } from '../../common/guards/token.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User } from '@prisma/client';
import { CreateMilkProductionDto } from './dto/create-milk-production.dto';
import { UpdateMilkProductionDto } from './dto/update-milk-production.dto';

@ApiTags('Milk Production')
@Controller('milk-production')
@UseGuards(TokenGuard)
@ApiBearerAuth()
export class MilkProductionController {
  constructor(private readonly milkProductionService: MilkProductionService) {}

  @Post()
  @ApiOperation({ summary: 'Record milk production', description: 'Record milk produced (per animal or farm) for a given date.' })
  @ApiBody({ type: CreateMilkProductionDto, description: 'Production record (animal_id or farm_id, production_date, quantity_litres; optional session, notes)' })
  @ApiResponse({ status: 201, description: 'Production record created' })
  @ApiBadRequestResponse({ description: 'Invalid input or animal/farm not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateMilkProductionDto,
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.milkProductionService.create(user, dto, accountId);
    return { code: 201, status: 'success', message: 'Milk production recorded', data };
  }

  @Get('report')
  @ApiOperation({ summary: 'Production vs sold report', description: 'Totals of milk produced and sold for the account in the optional date range.' })
  @ApiQuery({ name: 'account_id', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'From date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'to', required: false, description: 'To date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'Report with total_production_litres and total_sold_litres' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async report(
    @CurrentUser() user: User,
    @Query('account_id') accountId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const data = await this.milkProductionService.reportProductionVsSold(user, accountId, from, to);
    return { code: 200, status: 'success', message: 'Report retrieved', data };
  }

  @Get('cost-per-litre')
  @ApiOperation({
    summary: 'Milk cost-per-litre report',
    description:
      'Calculates milk cost per litre from accounting expenses and milk production, allocating total herd cost between producing and non-producing cows.',
  })
  @ApiQuery({ name: 'account_id', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'From date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'to', required: false, description: 'To date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'farm_id', required: false, description: 'Optional farm UUID for farm-level report' })
  @ApiQuery({ name: 'include_inventory_feed_costs', required: false, description: 'Include feed costs derived from inventory inflow movements', example: 'true' })
  @ApiQuery({ name: 'avoid_double_counting', required: false, description: 'Exclude expense transactions tagged inventory_feed/inventory_linked when inventory feed costs are included', example: 'true' })
  @ApiResponse({ status: 200, description: 'Cost-per-litre report' })
  async costPerLitre(
    @CurrentUser() user: User,
    @Query('account_id') accountId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('farm_id') farmId?: string,
    @Query('include_inventory_feed_costs') includeInventoryFeedCosts?: string,
    @Query('avoid_double_counting') avoidDoubleCounting?: string,
  ) {
    const data = await this.milkProductionService.reportCostPerLitre(
      user,
      accountId,
      from,
      to,
      farmId,
      includeInventoryFeedCosts !== 'false',
      avoidDoubleCounting !== 'false',
    );
    return { code: 200, status: 'success', message: 'Cost-per-litre report retrieved', data };
  }

  @Get()
  @ApiOperation({ summary: 'List milk production records', description: 'List production with optional filters by animal, farm, session, date range.' })
  @ApiQuery({ name: 'account_id', required: false })
  @ApiQuery({ name: 'animal_id', required: false, description: 'Filter by animal UUID' })
  @ApiQuery({ name: 'farm_id', required: false, description: 'Filter by farm UUID' })
  @ApiQuery({ name: 'session', required: false, description: 'Filter by session (e.g. morning, evening)' })
  @ApiQuery({ name: 'from', required: false, description: 'From date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'to', required: false, description: 'To date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'List of production records' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async findAll(
    @CurrentUser() user: User,
    @Query('account_id') accountId?: string,
    @Query('animal_id') animalId?: string,
    @Query('farm_id') farmId?: string,
    @Query('session') session?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const filters = animalId || farmId || session || from || to
      ? { animal_id: animalId, farm_id: farmId, session, from, to }
      : undefined;
    const data = await this.milkProductionService.findAll(user, accountId, filters);
    return { code: 200, status: 'success', message: 'Milk production records retrieved', data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get milk production by ID' })
  @ApiParam({ name: 'id', description: 'Production record UUID' })
  @ApiQuery({ name: 'account_id', required: false })
  @ApiResponse({ status: 200, description: 'Production record' })
  @ApiNotFoundResponse({ description: 'Record not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async findOne(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.milkProductionService.findOne(user, id, accountId);
    return { code: 200, status: 'success', message: 'Milk production record retrieved', data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update milk production record' })
  @ApiParam({ name: 'id', description: 'Production record UUID' })
  @ApiQuery({ name: 'account_id', required: false })
  @ApiBody({ type: UpdateMilkProductionDto, description: 'Fields to update (production_date, quantity_litres, session, notes, etc.)' })
  @ApiResponse({ status: 200, description: 'Production record updated' })
  @ApiNotFoundResponse({ description: 'Record not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateMilkProductionDto,
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.milkProductionService.update(user, id, dto, accountId);
    return { code: 200, status: 'success', message: 'Milk production record updated', data };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete milk production record' })
  @ApiParam({ name: 'id', description: 'Production record UUID' })
  @ApiQuery({ name: 'account_id', required: false })
  @ApiResponse({ status: 200, description: 'Record deleted' })
  @ApiNotFoundResponse({ description: 'Record not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async remove(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.milkProductionService.remove(user, id, accountId);
    return { code: 200, status: 'success', message: data.message, data };
  }
}
