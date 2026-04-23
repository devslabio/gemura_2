import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { SpeciesService } from './species.service';
import { TokenGuard } from '../../common/guards/token.guard';

@ApiTags('Species')
@Controller('species')
@UseGuards(TokenGuard)
@ApiBearerAuth()
export class SpeciesController {
  constructor(private readonly speciesService: SpeciesService) {}

  @Get()
  @ApiOperation({
    summary: 'List species',
    description: 'List livestock species (cattle, goat, poultry, pig) for registration and filtering.',
  })
  @ApiResponse({ status: 200, description: 'List of species' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async findAll() {
    const data = await this.speciesService.findAll();
    return { code: 200, status: 'success', message: 'Species retrieved', data };
  }
}
