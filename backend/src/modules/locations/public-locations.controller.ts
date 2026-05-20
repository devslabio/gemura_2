import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LocationsService } from './locations.service';

/**
 * Read-only location hierarchy for pre-login flows (MCC business onboarding wizard).
 * No auth — same data as `/locations` but scoped to geography lookups only.
 */
@ApiTags('Public Locations')
@Controller('public/locations')
export class PublicLocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('provinces')
  @ApiOperation({ summary: 'List provinces (public)', description: 'Unauthenticated province list for onboarding forms.' })
  @ApiResponse({ status: 200, description: 'Provinces retrieved' })
  async getProvinces() {
    const data = await this.locationsService.getProvinces();
    return { code: 200, status: 'success', message: 'Provinces retrieved', data };
  }

  @Get()
  @ApiOperation({
    summary: 'List child locations (public)',
    description: 'Direct children of parent_id (districts, sectors, cells, villages).',
  })
  @ApiQuery({ name: 'parent_id', required: true, description: 'Parent location UUID' })
  @ApiResponse({ status: 200, description: 'Child locations retrieved' })
  async getChildren(@Query('parent_id') parentId: string) {
    const data = await this.locationsService.getChildren(parentId);
    return { code: 200, status: 'success', message: 'Locations retrieved', data };
  }

  @Get(':id/path')
  @ApiOperation({ summary: 'Location path to root (public)' })
  @ApiParam({ name: 'id', description: 'Location UUID (typically village)' })
  @ApiResponse({ status: 200, description: 'Path retrieved' })
  async getPath(@Param('id') id: string) {
    const data = await this.locationsService.getPath(id);
    return { code: 200, status: 'success', message: 'Path retrieved', data };
  }
}
