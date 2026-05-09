import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { TokenGuard } from '../../common/guards/token.guard';
import { ImmisService, ImmisApiResponse } from './immis.service';

@ApiTags('IMMIS')
@ApiBearerAuth()
@UseGuards(TokenGuard)
@Controller('immis')
export class ImmisController {
  constructor(private readonly immisService: ImmisService) {}

  @Get('members')
  @ApiOperation({
    summary: 'List IMMIS members',
    description:
      'Retrieve a paginated list of IMMIS members via the IMMIS integration API. This is a read-only proxy used by Gemura web for membership alignment.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Zero-based page index (default from IMMIS)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size (default from IMMIS)' })
  @ApiResponse({ status: 200, description: 'Members retrieved successfully from IMMIS.' })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid authentication or IMMIS API key not configured.',
  })
  async listMembers(@Query('page') page?: string, @Query('limit') limit?: string): Promise<ImmisApiResponse> {
    const pageNum = page != null ? Number(page) : undefined;
    const limitNum = limit != null ? Number(limit) : undefined;
    return this.immisService.listMembers(
      Number.isFinite(pageNum as number) ? (pageNum as number) : undefined,
      Number.isFinite(limitNum as number) ? (limitNum as number) : undefined,
    );
  }

  @Get('members/:id')
  @ApiOperation({
    summary: 'Get IMMIS member by ID',
    description: 'Retrieve a single IMMIS member by its IMMIS member_id.',
  })
  @ApiParam({ name: 'id', description: 'IMMIS member ID', type: String })
  @ApiResponse({ status: 200, description: 'Member retrieved successfully from IMMIS.' })
  async getMember(@Param('id') id: string): Promise<ImmisApiResponse> {
    return this.immisService.getMember(id);
  }

  @Get('member-links')
  @ApiOperation({
    summary: 'IMMIS member → Gemura user links',
    description:
      'For each IMMIS member ID, returns the linked Gemura user (if any). Query: ids=1,2,3 (max 200).',
  })
  @ApiQuery({ name: 'ids', required: true, description: 'Comma-separated IMMIS member IDs' })
  @ApiResponse({ status: 200, description: 'Map of member_id to linked user.' })
  async memberLinks(@Query('ids') ids: string) {
    const list = (ids || '')
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n));
    if (list.length > 200) {
      return {
        status: 400,
        message: 'Maximum 200 member IDs per request.',
        data: null,
      };
    }
    const map = await this.immisService.getMemberLinkMap(list);
    return { status: 200, message: 'OK', data: map };
  }
}

