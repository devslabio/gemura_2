import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiUnauthorizedResponse, ApiQuery } from '@nestjs/swagger';
import { BreedsService } from './breeds.service';
import { TokenGuard } from '../../common/guards/token.guard';

@ApiTags('Breeds')
@Controller('breeds')
@UseGuards(TokenGuard)
@ApiBearerAuth()
export class BreedsController {
  constructor(private readonly breedsService: BreedsService) {}

  @Get()
  @ApiOperation({
    summary: 'List breeds',
    description: 'List predefined breeds for animal registration/editing. Pass species_id to limit to one species.',
  })
  @ApiQuery({ name: 'species_id', required: false, description: 'Filter breeds by species UUID' })
  @ApiResponse({ status: 200, description: 'List of breeds (includes species_id and nested species)' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async findAll(@Query('species_id') speciesId?: string) {
    const data = await this.breedsService.findAll(speciesId);
    return { code: 200, status: 'success', message: 'Breeds retrieved', data };
  }
}
