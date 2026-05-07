import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccountMembershipStatus, User } from '@prisma/client';
import { TokenGuard } from '../../common/guards/token.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { AccountMembershipsService } from './account-memberships.service';
import { CreateAccountMembershipDto } from './dto/create-account-membership.dto';
import { UpdateAccountMembershipDto } from './dto/update-account-membership.dto';

@ApiTags('Account memberships')
@Controller('account-memberships')
@UseGuards(TokenGuard)
@ApiBearerAuth()
export class AccountMembershipsController {
  constructor(private readonly accountMembershipsService: AccountMembershipsService) {}

  @Get('me')
  @ApiOperation({
    summary: 'My cooperative memberships',
    description: 'All MCC/tenant accounts where the authenticated user has a membership record.',
  })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiUnauthorizedResponse()
  async listMine(@CurrentUser() user: User) {
    return this.accountMembershipsService.listMine(user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'List memberships for an account',
    description: 'Requires manage_users on the account (pass account_id query).',
  })
  @ApiQuery({ name: 'account_id', required: true })
  @ApiQuery({ name: 'status', required: false, enum: AccountMembershipStatus })
  @ApiUnauthorizedResponse()
  async listForAccount(
    @CurrentUser() user: User,
    @Query('account_id') accountId?: string,
    @Query('status') status?: AccountMembershipStatus,
  ) {
    return this.accountMembershipsService.listForAccount(user.id, accountId ?? null, status);
  }

  @Post()
  @ApiOperation({ summary: 'Create membership (user ↔ account)' })
  @ApiUnauthorizedResponse()
  async create(@CurrentUser() user: User, @Body() dto: CreateAccountMembershipDto) {
    return this.accountMembershipsService.create(user, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update membership status / member_since' })
  @ApiUnauthorizedResponse()
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateAccountMembershipDto,
  ) {
    return this.accountMembershipsService.update(user, id, dto);
  }
}
