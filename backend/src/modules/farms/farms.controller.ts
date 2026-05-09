import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { FarmsService, FarmsListFilters } from './farms.service';
import { TokenGuard } from '../../common/guards/token.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User, FarmStatus } from '@prisma/client';
import { CreateFarmDto } from './dto/create-farm.dto';
import { UpdateFarmDto } from './dto/update-farm.dto';

@ApiTags('Farms')
@Controller('farms')
@UseGuards(TokenGuard)
@ApiBearerAuth()
export class FarmsController {
  constructor(private readonly farmsService: FarmsService) {}

  @Get()
  @ApiOperation({
    summary: 'List farms',
    description: 'List all farms for the current account (or the provided account_id). Supports filtering by status and search (name, code, location).',
  })
  @ApiQuery({
    name: 'account_id',
    required: false,
    description: 'Account ID (defaults to user default account)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['active', 'inactive', 'archived'],
    description: 'Filter farms by status',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by name, code, or location',
  })
  @ApiBadRequestResponse({
    description: 'No default account found',
    schema: {
      example: {
        code: 400,
        status: 'error',
        message: 'No valid default account found. Please set a default account.',
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - invalid or missing token',
    schema: {
      example: {
        code: 401,
        status: 'error',
        message: 'Access denied. Token is required.',
      },
    },
  })
  async listFarms(
    @CurrentUser() user: User,
    @Query('account_id') accountId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const filters: FarmsListFilters | undefined =
      status || search
        ? {
            status: status as FarmStatus,
            search,
          }
        : undefined;
    const data = await this.farmsService.listFarms(user, filters, accountId);
    return {
      code: 200,
      status: 'success',
      message: 'Farms retrieved successfully',
      data,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get farm by ID',
    description: 'Get a single farm with basic stats (animals count).',
  })
  @ApiParam({ name: 'id', description: 'Farm ID (UUID).' })
  @ApiQuery({
    name: 'account_id',
    required: false,
    description: 'Account ID (defaults to user default account)',
  })
  @ApiResponse({ status: 200, description: 'Farm retrieved successfully.' })
  @ApiNotFoundResponse({
    description: 'Farm not found',
    schema: {
      example: { code: 404, status: 'error', message: 'Farm not found' },
    },
  })
  async getFarm(@CurrentUser() user: User, @Param('id') id: string, @Query('account_id') accountId?: string) {
    const data = await this.farmsService.getFarm(user, id, accountId);
    return {
      code: 200,
      status: 'success',
      message: 'Farm retrieved successfully',
      data,
    };
  }

  @Post()
  @ApiOperation({
    summary: 'Create farm',
    description: 'Create a new farm for the current account. The farm will be active by default.',
  })
  @ApiBadRequestResponse({
    description: 'Validation failed, no default account, or duplicate code',
  })
  async createFarm(
    @CurrentUser() user: User,
    @Body() dto: CreateFarmDto,
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.farmsService.createFarm(user, dto, accountId);
    return {
      code: 201,
      status: 'success',
      message: 'Farm created successfully',
      data,
    };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update farm',
    description: 'Update farm details (name, code, location, description, status).',
  })
  @ApiParam({ name: 'id', description: 'Farm ID (UUID).' })
  @ApiResponse({ status: 200, description: 'Farm updated successfully.' })
  @ApiNotFoundResponse({
    description: 'Farm not found',
  })
  async updateFarm(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateFarmDto,
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.farmsService.updateFarm(user, id, dto, accountId);
    return {
      code: 200,
      status: 'success',
      message: 'Farm updated successfully',
      data,
    };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete or deactivate farm',
    description:
      'Delete a farm if it has no animals. If animals exist, the farm is marked inactive instead of being removed.',
  })
  @ApiParam({ name: 'id', description: 'Farm ID (UUID).' })
  @ApiResponse({ status: 200, description: 'Farm deleted/deactivated successfully.' })
  @ApiNotFoundResponse({
    description: 'Farm not found',
  })
  async deleteFarm(@CurrentUser() user: User, @Param('id') id: string, @Query('account_id') accountId?: string) {
    const result = await this.farmsService.deleteFarm(user, id, accountId);
    return {
      code: 200,
      status: 'success',
      message: result.message,
      data: null,
    };
  }
}

