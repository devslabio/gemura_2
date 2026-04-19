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
  ApiResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AnimalsService, AnimalsListFilters } from './animals.service';
import { TokenGuard } from '../../common/guards/token.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User } from '@prisma/client';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { UpdateAnimalDto } from './dto/update-animal.dto';
import { CreateAnimalWeightDto } from './dto/create-animal-weight.dto';
import { CreateAnimalHealthDto } from './dto/create-animal-health.dto';
import { CreateAnimalBreedingDto } from './dto/create-animal-breeding.dto';
import { CreateAnimalCalvingDto } from './dto/create-animal-calving.dto';

@ApiTags('Animals')
@Controller('animals')
@UseGuards(TokenGuard)
@ApiBearerAuth()
export class AnimalsController {
  constructor(private readonly animalsService: AnimalsService) {}

  @Get('vaccinations-due')
  @ApiOperation({ summary: 'List vaccinations due', description: 'Vaccination records with next_due_date set. Use ?overdue=true for overdue only.' })
  @ApiQuery({ name: 'account_id', required: false })
  @ApiQuery({ name: 'overdue', required: false, type: Boolean, description: 'If true, only return vaccinations past due' })
  @ApiResponse({ status: 200, description: 'Vaccination records with next_due_date' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async getVaccinationsDue(
    @CurrentUser() user: User,
    @Query('account_id') accountId?: string,
    @Query('overdue') overdue?: string,
  ) {
    const overdueOnly = overdue === 'true' || overdue === '1';
    const data = await this.animalsService.getVaccinationsDue(user, accountId, overdueOnly);
    return { code: 200, status: 'success', message: 'Vaccinations due retrieved', data };
  }

  @Get()
  @ApiOperation({ summary: 'List animals', description: 'List all animals for the account with optional filters.' })
  @ApiQuery({ name: 'account_id', required: false, description: 'Account ID (defaults to user default account)' })
  @ApiQuery({ name: 'farm_id', required: false, description: 'Farm ID to scope animals to a single farm' })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'lactating', 'dry', 'pregnant', 'sick', 'sold', 'dead', 'culled'] })
  @ApiQuery({ name: 'breed_id', required: false, description: 'Filter by breed UUID' })
  @ApiQuery({ name: 'species_id', required: false, description: 'Filter by species UUID' })
  @ApiQuery({ name: 'gender', required: false, enum: ['male', 'female'] })
  @ApiQuery({ name: 'search', required: false, description: 'Search by tag number, name, or breed' })
  @ApiResponse({ status: 200, description: 'Animals list' })
  @ApiBadRequestResponse({ description: 'No default account' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async getAnimals(
    @CurrentUser() user: User,
    @Query('account_id') accountId?: string,
    @Query('farm_id') farmId?: string,
    @Query('status') status?: string,
    @Query('breed_id') breedId?: string,
    @Query('species_id') speciesId?: string,
    @Query('gender') gender?: string,
    @Query('search') search?: string,
  ) {
    const filters: AnimalsListFilters | undefined =
      status || breedId || speciesId || gender || search || farmId
        ? { status: status as any, breed_id: breedId, species_id: speciesId, gender, search, farm_id: farmId }
        : undefined;
    const data = await this.animalsService.getAnimals(user, filters, accountId);
    return { code: 200, status: 'success', message: 'Animals retrieved successfully', data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get animal by ID', description: 'Get animal details including recent weights and health records.' })
  @ApiParam({ name: 'id', description: 'Animal UUID' })
  @ApiQuery({ name: 'account_id', required: false })
  @ApiResponse({ status: 200, description: 'Animal details' })
  @ApiNotFoundResponse({ description: 'Animal not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async getAnimal(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.animalsService.getAnimal(user, id, accountId);
    return { code: 200, status: 'success', message: 'Animal retrieved successfully', data };
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get animal history', description: 'Weights and health records for the animal.' })
  @ApiParam({ name: 'id', description: 'Animal UUID' })
  @ApiQuery({ name: 'account_id', required: false })
  @ApiResponse({ status: 200, description: 'Animal history' })
  @ApiNotFoundResponse({ description: 'Animal not found' })
  async getAnimalHistory(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.animalsService.getAnimalHistory(user, id, accountId);
    return { code: 200, status: 'success', message: 'Animal history retrieved successfully', data };
  }

  @Post()
  @ApiOperation({ summary: 'Create animal', description: 'Register a new animal.' })
  @ApiResponse({ status: 201, description: 'Animal created' })
  @ApiBadRequestResponse({ description: 'Invalid input or duplicate tag number' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async createAnimal(
    @CurrentUser() user: User,
    @Body() dto: CreateAnimalDto,
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.animalsService.createAnimal(user, dto, accountId);
    return { code: 201, status: 'success', message: 'Animal created successfully', data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update animal' })
  @ApiParam({ name: 'id', description: 'Animal UUID' })
  @ApiResponse({ status: 200, description: 'Animal updated' })
  @ApiBadRequestResponse({ description: 'Invalid input or duplicate tag' })
  @ApiNotFoundResponse({ description: 'Animal not found' })
  async updateAnimal(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateAnimalDto,
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.animalsService.updateAnimal(user, id, dto, accountId);
    return { code: 200, status: 'success', message: 'Animal updated successfully', data };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete animal', description: 'Permanently delete an animal and its weights/health records.' })
  @ApiParam({ name: 'id', description: 'Animal UUID' })
  @ApiResponse({ status: 200, description: 'Animal deleted' })
  @ApiNotFoundResponse({ description: 'Animal not found' })
  async deleteAnimal(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.animalsService.deleteAnimal(user, id, accountId);
    return { code: 200, status: 'success', message: data.message, data };
  }

  // --- Weights ---
  @Post(':id/weights')
  @ApiOperation({ summary: 'Record weight', description: 'Add a weight record for the animal.' })
  @ApiParam({ name: 'id', description: 'Animal UUID' })
  @ApiResponse({ status: 201, description: 'Weight record created' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @ApiNotFoundResponse({ description: 'Animal not found' })
  async addWeight(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: CreateAnimalWeightDto,
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.animalsService.addWeight(user, id, dto, accountId);
    return { code: 201, status: 'success', message: 'Weight recorded successfully', data };
  }

  @Get(':id/weights')
  @ApiOperation({ summary: 'Get weight history' })
  @ApiParam({ name: 'id', description: 'Animal UUID' })
  @ApiQuery({ name: 'account_id', required: false })
  @ApiResponse({ status: 200, description: 'Weight history' })
  @ApiNotFoundResponse({ description: 'Animal not found' })
  async getWeights(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.animalsService.getWeights(user, id, accountId);
    return { code: 200, status: 'success', message: 'Weights retrieved successfully', data };
  }

  @Delete(':id/weights/:weightId')
  @ApiOperation({ summary: 'Delete weight record' })
  @ApiParam({ name: 'id', description: 'Animal UUID' })
  @ApiParam({ name: 'weightId', description: 'Weight record UUID' })
  @ApiResponse({ status: 200, description: 'Weight record deleted' })
  @ApiNotFoundResponse({ description: 'Animal or weight record not found' })
  async deleteWeight(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('weightId') weightId: string,
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.animalsService.deleteWeight(user, id, weightId, accountId);
    return { code: 200, status: 'success', message: data.message, data };
  }

  // --- Health ---
  @Post(':id/health')
  @ApiOperation({ summary: 'Add health record', description: 'Record a health event (vaccination, treatment, etc.).' })
  @ApiParam({ name: 'id', description: 'Animal UUID' })
  @ApiResponse({ status: 201, description: 'Health record created' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @ApiNotFoundResponse({ description: 'Animal not found' })
  async addHealth(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: CreateAnimalHealthDto,
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.animalsService.addHealth(user, id, dto, accountId);
    return { code: 201, status: 'success', message: 'Health record created successfully', data };
  }

  @Get(':id/health')
  @ApiOperation({ summary: 'Get health records', description: 'Optionally filter by event_type (e.g. vaccination).' })
  @ApiParam({ name: 'id', description: 'Animal UUID' })
  @ApiQuery({ name: 'account_id', required: false })
  @ApiQuery({ name: 'event_type', required: false, enum: ['vaccination', 'treatment', 'deworming', 'examination', 'surgery', 'injury', 'illness', 'other'] })
  @ApiResponse({ status: 200, description: 'Health records' })
  @ApiNotFoundResponse({ description: 'Animal not found' })
  async getHealth(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('account_id') accountId?: string,
    @Query('event_type') eventType?: string,
  ) {
    const data = await this.animalsService.getHealth(user, id, accountId, eventType);
    return { code: 200, status: 'success', message: 'Health records retrieved successfully', data };
  }

  @Delete(':id/health/:healthId')
  @ApiOperation({ summary: 'Delete health record' })
  @ApiParam({ name: 'id', description: 'Animal UUID' })
  @ApiParam({ name: 'healthId', description: 'Health record UUID' })
  @ApiResponse({ status: 200, description: 'Health record deleted' })
  @ApiNotFoundResponse({ description: 'Animal or health record not found' })
  async deleteHealth(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('healthId') healthId: string,
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.animalsService.deleteHealth(user, id, healthId, accountId);
    return { code: 200, status: 'success', message: data.message, data };
  }

  // --- Breeding ---
  @Post(':id/breeding')
  @ApiOperation({ summary: 'Add breeding record', description: 'Record a breeding event for this animal (dam).' })
  @ApiParam({ name: 'id', description: 'Animal UUID (dam)' })
  @ApiResponse({ status: 201, description: 'Breeding record created' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @ApiNotFoundResponse({ description: 'Animal not found' })
  async addBreeding(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: CreateAnimalBreedingDto,
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.animalsService.addBreeding(user, id, dto, accountId);
    return { code: 201, status: 'success', message: 'Breeding record created', data };
  }

  @Get(':id/breeding')
  @ApiOperation({ summary: 'Get breeding records' })
  @ApiParam({ name: 'id', description: 'Animal UUID' })
  @ApiQuery({ name: 'account_id', required: false })
  @ApiResponse({ status: 200, description: 'Breeding records' })
  @ApiNotFoundResponse({ description: 'Animal not found' })
  async getBreeding(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.animalsService.getBreeding(user, id, accountId);
    return { code: 200, status: 'success', message: 'Breeding records retrieved', data };
  }

  @Delete(':id/breeding/:breedingId')
  @ApiOperation({ summary: 'Delete breeding record' })
  @ApiParam({ name: 'id', description: 'Animal UUID' })
  @ApiParam({ name: 'breedingId', description: 'Breeding record UUID' })
  @ApiResponse({ status: 200, description: 'Breeding record deleted' })
  @ApiNotFoundResponse({ description: 'Animal or breeding record not found' })
  async deleteBreeding(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('breedingId') breedingId: string,
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.animalsService.deleteBreeding(user, id, breedingId, accountId);
    return { code: 200, status: 'success', message: data.message, data };
  }

  // --- Calving ---
  @Post(':id/calvings')
  @ApiOperation({ summary: 'Add calving record', description: 'Record a calving for this animal (mother).' })
  @ApiParam({ name: 'id', description: 'Animal UUID (mother)' })
  @ApiResponse({ status: 201, description: 'Calving record created' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @ApiNotFoundResponse({ description: 'Animal not found' })
  async addCalving(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: CreateAnimalCalvingDto,
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.animalsService.addCalving(user, id, dto, accountId);
    return { code: 201, status: 'success', message: 'Calving record created', data };
  }

  @Get(':id/calvings')
  @ApiOperation({ summary: 'Get calving records' })
  @ApiParam({ name: 'id', description: 'Animal UUID (mother)' })
  @ApiQuery({ name: 'account_id', required: false })
  @ApiResponse({ status: 200, description: 'Calving records' })
  @ApiNotFoundResponse({ description: 'Animal not found' })
  async getCalvings(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.animalsService.getCalvings(user, id, accountId);
    return { code: 200, status: 'success', message: 'Calving records retrieved', data };
  }

  @Delete(':id/calvings/:calvingId')
  @ApiOperation({ summary: 'Delete calving record' })
  @ApiParam({ name: 'id', description: 'Animal UUID' })
  @ApiParam({ name: 'calvingId', description: 'Calving record UUID' })
  @ApiResponse({ status: 200, description: 'Calving record deleted' })
  @ApiNotFoundResponse({ description: 'Animal or calving record not found' })
  async deleteCalving(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('calvingId') calvingId: string,
    @Query('account_id') accountId?: string,
  ) {
    const data = await this.animalsService.deleteCalving(user, id, calvingId, accountId);
    return { code: 200, status: 'success', message: data.message, data };
  }
}
