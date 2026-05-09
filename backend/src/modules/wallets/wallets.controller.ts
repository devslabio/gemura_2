import { Controller, Get, Post, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiUnauthorizedResponse, ApiBadRequestResponse, ApiNotFoundResponse, ApiBody, ApiConflictResponse } from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import { TokenGuard } from '../../common/guards/token.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User } from '@prisma/client';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { GetWalletDetailsDto } from './dto/get-wallet-details.dto';

@ApiTags('Wallets')
@Controller('wallets')
@UseGuards(TokenGuard)
@ApiBearerAuth()
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get('get')
  @ApiOperation({
    summary: 'Get wallets for default account',
    description: 'Retrieve all wallets associated with the user\'s default account, including balance, currency, type, and status information.',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallets fetched successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Wallets fetched successfully.',
      data: [
        {
          wallet_code: 'W_ABC123',
          type: 'regular',
          is_joint: false,
          is_default: true,
          balance: 150000.0,
          currency: 'RWF',
          status: 'active',
          account: {
            code: 'A_XYZ789',
            name: 'Main Account',
            type: 'tenant',
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: 'No default account found',
    example: {
      code: 400,
      status: 'error',
      message: 'No valid default account found. Please set a default account.',
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
  @ApiNotFoundResponse({
    description: 'No wallets found for the account',
    example: {
      code: 404,
      status: 'error',
      message: 'No wallets found for this account.',
    },
  })
  async getWallets(@CurrentUser() user: User) {
    return this.walletsService.getWallets(user);
  }

  @Post('create')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Create a new wallet',
    description: 'Create a new wallet for the user\'s default account. The first wallet created will automatically be set as default.',
  })
  @ApiBody({
    type: CreateWalletDto,
    description: 'Wallet creation details',
    examples: {
      regularWallet: {
        summary: 'Create regular wallet',
        value: {
          name: 'Main Savings Wallet',
          type: 'regular',
          is_joint: false,
          description: 'Primary wallet for daily transactions',
          currency: 'RWF',
        },
      },
      jointWallet: {
        summary: 'Create joint wallet',
        value: {
          name: 'Family Savings',
          type: 'saving',
          is_joint: true,
          description: 'Joint savings for family expenses',
          joint_owners: ['user-uuid-1', 'user-uuid-2'],
          currency: 'RWF',
        },
      },
      minimalWallet: {
        summary: 'Create wallet with minimal info',
        value: {
          name: 'Quick Wallet',
          type: 'regular',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet created successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Wallet created successfully.',
      data: {
        wallet_code: 'W_ABC123',
        type: 'regular',
        is_joint: false,
        is_default: true,
        balance: 0.0,
        currency: 'RWF',
        status: 'active',
        account: {
          code: 'A_XYZ789',
          name: 'Main Account',
          type: 'tenant',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request or no default account',
    example: {
      code: 400,
      status: 'error',
      message: 'No valid default account found. Please set a default account.',
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
  @ApiConflictResponse({
    description: 'Wallet code conflict (should not happen)',
    example: {
      code: 409,
      status: 'error',
      message: 'Wallet code already exists.',
    },
  })
  async createWallet(@CurrentUser() user: User, @Body() createWalletDto: CreateWalletDto) {
    return this.walletsService.createWallet(user, createWalletDto);
  }

  @Post('details')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get wallet details by code',
    description: 'Retrieve detailed information about a specific wallet by its code. The wallet must belong to the user\'s default account.',
  })
  @ApiBody({
    type: GetWalletDetailsDto,
    description: 'Wallet code to retrieve',
    examples: {
      getDetails: {
        summary: 'Get wallet details',
        value: {
          wallet_code: 'W_ABC123',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet details retrieved successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Wallet details retrieved successfully.',
      data: {
        wallet_code: 'W_ABC123',
        type: 'regular',
        is_joint: false,
        is_default: true,
        balance: 150000.0,
        currency: 'RWF',
        status: 'active',
        created_at: '2025-01-04T10:00:00Z',
        updated_at: '2025-01-04T10:00:00Z',
        account: {
          code: 'A_XYZ789',
          name: 'Main Account',
          type: 'tenant',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request or no default account',
    example: {
      code: 400,
      status: 'error',
      message: 'No valid default account found. Please set a default account.',
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
  @ApiNotFoundResponse({
    description: 'Wallet not found',
    example: {
      code: 404,
      status: 'error',
      message: 'Wallet not found.',
    },
  })
  async getWalletDetails(@CurrentUser() user: User, @Body() getWalletDetailsDto: GetWalletDetailsDto) {
    return this.walletsService.getWalletDetails(user, getWalletDetailsDto);
  }
}
