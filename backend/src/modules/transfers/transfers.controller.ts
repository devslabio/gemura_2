import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TransfersService } from './transfers.service';
import { ProcessTransferDto } from './dto/process-transfer.dto';
import { TokenGuard } from '../../common/guards/token.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User } from '@prisma/client';

@ApiTags('Transfers')
@Controller('transfers')
@UseGuards(TokenGuard)
@ApiBearerAuth()
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get('incoming')
  @ApiOperation({ summary: 'List incoming transfers from suppliers/farmers for the MCC' })
  @ApiQuery({ name: 'status', required: false, enum: ['submitted', 'accepted', 'partially_accepted', 'rejected'] })
  async getIncomingTransfers(
    @CurrentUser() user: User,
    @Query('status') status?: string,
  ) {
    return this.transfersService.getIncomingTransfers(user, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single transfer by ID' })
  async getTransferById(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    return this.transfersService.getTransferById(user, id);
  }

  @Post(':id/process')
  @ApiOperation({ summary: 'Process (accept/reject) an incoming transfer' })
  async processTransfer(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: ProcessTransferDto,
  ) {
    return this.transfersService.processTransfer(user, id, dto);
  }
}
