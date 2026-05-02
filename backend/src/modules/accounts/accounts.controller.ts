import { Controller, Get, Post, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiUnauthorizedResponse, ApiForbiddenResponse, ApiBadRequestResponse } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { TokenGuard } from '../../common/guards/token.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User } from '@prisma/client';
import { SwitchAccountDto } from './dto/switch-account.dto';

@ApiTags('Accounts')
@Controller('accounts')
@UseGuards(TokenGuard)
@ApiBearerAuth()
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get user accounts',
    description: 'Retrieve all accounts that the authenticated user has access to, including roles, permissions, and default account information.',
  })
  @ApiResponse({
    status: 200,
    description: 'User accounts fetched successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'User accounts fetched successfully.',
      data: {
        user: {
          id: 'uuid-here',
          name: 'John Doe',
          email: 'user@example.com',
          phone: '250788123456',
          default_account_id: 'account-uuid',
        },
        accounts: [
          {
            account_id: 'account-uuid',
            account_code: 'ACC001',
            account_name: 'Main Account',
            account_type: 'tenant',
            account_status: 'active',
            role: 'system_admin',
            permissions: { can_manage: true },
            is_default: true,
          },
        ],
        total_accounts: 1,
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing authentication token',
    example: {
      code: 401,
      status: 'error',
      message: 'Access denied. Token is required.',
    },
  })
  async getAccounts(@CurrentUser() user: User) {
    return this.accountsService.getUserAccounts(user);
  }

  @Get('list')
  @ApiOperation({
    summary: 'List user accounts',
    description: 'Alias endpoint for GET /accounts. Returns the same data structure.',
  })
  @ApiResponse({
    status: 200,
    description: 'User accounts fetched successfully',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing authentication token',
  })
  async listAccounts(@CurrentUser() user: User) {
    return this.accountsService.getUserAccounts(user);
  }

  @Post('switch')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Switch default account',
    description: 'Change the user\'s default account. The default account is used for operations when no specific account is specified.',
  })
  @ApiBody({
    type: SwitchAccountDto,
    description: 'Account ID to switch to',
    examples: {
      switchAccount: {
        summary: 'Switch to account',
        value: {
          account_id: '550e8400-e29b-41d4-a716-446655440000',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Default account switched successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Default account switched successfully.',
      data: {
        user: {
          id: 'uuid-here',
          name: 'John Doe',
          default_account_id: 'account-uuid',
        },
        account: {
          id: 'account-uuid',
          code: 'ACC001',
          name: 'Main Account',
          type: 'tenant',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request - missing account_id',
    example: {
      code: 400,
      status: 'error',
      message: 'Token and account_id are required.',
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing authentication token',
    example: {
      code: 401,
      status: 'error',
      message: 'Access denied. Token is required.',
    },
  })
  @ApiForbiddenResponse({
    description: 'User does not have access to the specified account',
    example: {
      code: 403,
      status: 'error',
      message: 'Access denied. You don\'t have permission to access this account.',
    },
  })
  async switchAccount(@CurrentUser() user: User, @Body() switchDto: SwitchAccountDto) {
    return this.accountsService.switchAccount(user, switchDto);
  }
}
