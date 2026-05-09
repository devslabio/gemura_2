import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiQuery, ApiParam, ApiBadRequestResponse, ApiUnauthorizedResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { TokenGuard } from '../../../common/guards/token.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { User } from '@prisma/client';
import { CreateTransactionDto, TransactionType } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@ApiTags('Accounting - Transactions')
@Controller('accounting/transactions')
@UseGuards(TokenGuard)
@ApiBearerAuth()
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Record revenue or expense transaction',
    description: 'Creates a simplified revenue or expense transaction. Automatically creates journal entries with balanced debit/credit entries. Links to user\'s default account and creates cash/revenue/expense accounts if needed.',
  })
  @ApiBody({
    type: CreateTransactionDto,
    description: 'Transaction details',
    examples: {
      revenue: {
        summary: 'Record revenue transaction',
        value: {
          type: 'revenue',
          amount: 50000,
          description: 'Milk sales revenue',
          transaction_date: '2025-01-19',
        },
      },
      expense: {
        summary: 'Record expense transaction',
        value: {
          type: 'expense',
          amount: 15000,
          description: 'Office supplies purchase',
          transaction_date: '2025-01-19',
          account_id: 'optional-uuid-for-specific-account',
        },
      },
      revenueWithAccount: {
        summary: 'Record revenue with specific account',
        value: {
          type: 'revenue',
          amount: 75000,
          description: 'Product sales',
          transaction_date: '2025-01-19',
          account_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction recorded successfully',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'number', example: 200 },
        status: { type: 'string', example: 'success' },
        message: { type: 'string', example: 'Revenue recorded successfully.' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e' },
            type: { type: 'string', example: 'revenue' },
            amount: { type: 'number', example: 50000 },
            description: { type: 'string', example: 'Milk sales revenue' },
            transaction_date: { type: 'string', example: '2025-01-19T00:00:00.000Z' },
            account: { type: 'string', example: 'Jean Baptiste Uwimana - Supplier' },
            category_account: { type: 'string', example: 'General Revenue - Jean Baptiste Uwimana - Supplier' },
            cash_account: { type: 'string', example: 'Cash - Jean Baptiste Uwimana - Supplier' },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request - missing required fields, invalid data, or no default account',
    examples: {
      missingFields: {
        summary: 'Missing required fields',
        value: {
          code: 400,
          status: 'error',
          message: 'Type, amount, description, and transaction_date are required',
        },
      },
      invalidAmount: {
        summary: 'Invalid amount',
        value: {
          code: 400,
          status: 'error',
          message: 'Amount must be a positive number',
        },
      },
      noDefaultAccount: {
        summary: 'No default account',
        value: {
          code: 400,
          status: 'error',
          message: 'No valid default account found. Please set a default account.',
        },
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
  async createTransaction(@CurrentUser() user: User, @Body() createDto: CreateTransactionDto) {
    return this.transactionsService.createTransaction(user, createDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get revenue and expense transactions',
    description:
      'Lists journal activity that drives the income statement for the user\'s default account (CASH/REV/EXP chart lines): manual entries, milk-sale revenue, payments, etc. Scoped to the farm ledger, not to the logged-in user who created the entry.',
  })
  @ApiQuery({
    name: 'type',
    enum: TransactionType,
    required: false,
    description: 'Filter by transaction type',
    example: 'revenue',
  })
  @ApiQuery({
    name: 'date_from',
    required: false,
    description: 'Start date for filtering transactions (YYYY-MM-DD format)',
    example: '2025-01-01',
  })
  @ApiQuery({
    name: 'date_to',
    required: false,
    description: 'End date for filtering transactions (YYYY-MM-DD format)',
    example: '2025-01-31',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of transactions to return',
    type: Number,
    example: 50,
  })
  @ApiQuery({
    name: 'farm_id',
    required: false,
    description: 'Optional farm UUID for farm-attributed transactions',
  })
  @ApiResponse({
    status: 200,
    description: 'Transactions fetched successfully',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'number', example: 200 },
        status: { type: 'string', example: 'success' },
        message: { type: 'string', example: 'Transactions fetched successfully.' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e' },
              type: { type: 'string', example: 'revenue' },
              amount: { type: 'number', example: 50000 },
              description: { type: 'string', example: 'Milk sales revenue' },
              transaction_date: { type: 'string', example: '2025-01-19T00:00:00.000Z' },
              category_account: { type: 'string', example: 'General Revenue - Jean Baptiste Uwimana - Supplier' },
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid query parameters',
    example: {
      code: 400,
      status: 'error',
      message: 'Invalid date format. Use YYYY-MM-DD',
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
  async getTransactions(
    @CurrentUser() user: User,
    @Query('type') type?: TransactionType,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('limit') limit?: string,
    @Query('farm_id') farmId?: string,
  ) {
    return this.transactionsService.getTransactions(user, {
      type,
      date_from: dateFrom,
      date_to: dateTo,
      limit: limit ? parseInt(limit, 10) : undefined,
      farm_id: farmId,
    });
  }

  @Get('expense-accounts/list')
  @ApiOperation({
    summary: 'List expense category accounts',
    description:
      'Returns account-scoped Expense chart accounts (EXP-*). Optional ensure_defaults=true seeds dairy-specific categories if missing.',
  })
  @ApiQuery({
    name: 'ensure_defaults',
    required: false,
    description: 'Create default dairy expense categories before listing',
    example: 'true',
  })
  @ApiResponse({
    status: 200,
    description: 'Expense accounts fetched successfully',
  })
  async getExpenseAccounts(
    @CurrentUser() user: User,
    @Query('ensure_defaults') ensureDefaults?: string,
  ) {
    return this.transactionsService.getExpenseAccounts(user, ensureDefaults === 'true');
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get transaction by ID',
    description: 'Retrieves detailed information about a specific transaction by its ID. Includes transaction details, associated journal entries, and account names.',
  })
  @ApiParam({
    name: 'id',
    description: 'Transaction ID (UUID)',
    example: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction fetched successfully',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'number', example: 200 },
        status: { type: 'string', example: 'success' },
        message: { type: 'string', example: 'Transaction fetched successfully' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e' },
            type: { type: 'string', example: 'revenue' },
            amount: { type: 'number', example: 50000 },
            description: { type: 'string', example: 'Milk sales revenue' },
            transaction_date: { type: 'string', example: '2025-01-19T00:00:00.000Z' },
            category_account: { type: 'string', example: 'General Revenue - Jean Baptiste Uwimana - Supplier' },
            cash_account: { type: 'string', example: 'Cash - Jean Baptiste Uwimana - Supplier' },
            entries: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  account_name: { type: 'string', example: 'Cash - Jean Baptiste Uwimana - Supplier' },
                  debit_amount: { type: 'number', example: 50000 },
                  credit_amount: { type: 'number', example: null },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Transaction not found or not accessible',
    example: {
      code: 404,
      status: 'error',
      message: 'Transaction not found or not accessible',
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
  async getTransaction(@CurrentUser() user: User, @Param('id') id: string) {
    return this.transactionsService.getTransaction(user, id);
  }
}
