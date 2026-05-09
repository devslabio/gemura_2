import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ChargesService } from './charges.service';
import { TokenGuard } from '../../common/guards/token.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User } from '@prisma/client';
import { CreateChargeDto } from './dto/create-charge.dto';
import { UpdateChargeDto } from './dto/update-charge.dto';

@ApiTags('Charges')
@Controller('charges')
@UseGuards(TokenGuard)
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Invalid or missing authentication token.' })
export class ChargesController {
  constructor(private readonly chargesService: ChargesService) {}

  @Post('create')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Create a charge',
    description:
      'Create a supplier charge (one-time or recurring). Charges are applied when generating payroll: one-time charges are deducted once per supplier; recurring charges apply every run (per_payroll) or monthly. Can apply to all suppliers or a selected list. Amount can be fixed (RWF) or percentage of gross milk in the period.',
  })
  @ApiBody({
    type: CreateChargeDto,
    description: 'Charge definition',
    examples: {
      fixedRecurring: {
        summary: 'Fixed recurring (e.g. transport fee per payroll)',
        value: {
          name: 'Transport fee',
          description: 'Deduction per payroll run',
          kind: 'recurring',
          amount_type: 'fixed',
          amount: 500,
          recurrence: 'per_payroll',
          apply_to_all_suppliers: true,
          is_active: true,
        },
      },
      percentageRecurring: {
        summary: 'Percentage of gross (e.g. 2% levy)',
        value: {
          name: 'Coop levy',
          kind: 'recurring',
          amount_type: 'percentage',
          amount: 2,
          recurrence: 'per_payroll',
          apply_to_all_suppliers: true,
        },
      },
      oneTimeSelected: {
        summary: 'One-time charge for selected suppliers',
        value: {
          name: 'Registration fee',
          kind: 'one_time',
          amount_type: 'fixed',
          amount: 2000,
          apply_to_all_suppliers: false,
          supplier_account_ids: ['550e8400-e29b-41d4-a716-446655440001'],
          is_active: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Charge created. Returns the created charge with selected_suppliers when applicable.',
    schema: {
      example: {
        code: 200,
        status: 'success',
        message: 'Charge fetched successfully.',
        data: {
          id: 'uuid',
          name: 'Transport fee',
          kind: 'recurring',
          amount_type: 'fixed',
          amount: 500,
          recurrence: 'per_payroll',
          apply_to_all_suppliers: true,
          is_active: true,
          selected_suppliers: [],
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid input: missing required fields, invalid percentage, or recurrence required for recurring.',
    schema: {
      example: { code: 400, status: 'error', message: 'Recurrence is required for recurring charges (monthly or per_payroll).' },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing authentication token.' })
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateChargeDto,
    @Body('account_id') accountId?: string,
  ) {
    const accountIdParam = dto.account_id ?? accountId;
    return this.chargesService.create(user, dto, accountIdParam);
  }

  @Post('get')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get all charges',
    description:
      'Returns all charges for the authenticated user\'s default account (or the account specified by account_id). Use active_only to filter to active charges only. Each charge includes selected_suppliers when apply_to_all_suppliers is false.',
  })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        account_id: { type: 'string', format: 'uuid', description: 'Account ID (uses default if omitted)' },
        active_only: { type: 'boolean', description: 'If true, return only active charges', default: false },
      },
    },
    examples: {
      allCharges: { summary: 'All charges (default account)', value: {} },
      activeOnly: { summary: 'Active only', value: { active_only: true } },
      byAccount: { summary: 'By account', value: { account_id: '550e8400-e29b-41d4-a716-446655440000' } },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'List of charges.',
    schema: {
      example: {
        code: 200,
        status: 'success',
        message: 'Charges fetched successfully.',
        data: [
          {
            id: 'uuid',
            name: 'Transport fee',
            kind: 'recurring',
            amount_type: 'fixed',
            amount: 500,
            apply_to_all_suppliers: true,
            is_active: true,
            selected_suppliers: [],
          },
        ],
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'No valid default account found',
    schema: { example: { code: 400, status: 'error', message: 'No valid default account found. Please set a default account.' } },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing authentication token.' })
  async getMany(
    @CurrentUser() user: User,
    @Body('account_id') accountId?: string,
    @Body('active_only') activeOnly?: boolean,
  ) {
    return this.chargesService.findAll(user, accountId, activeOnly);
  }

  @Get('by-id/:id')
  @ApiOperation({
    summary: 'Get charge by ID',
    description: 'Returns a single charge by ID. Charge must belong to the user\'s default account (or the account specified by query account_id).',
  })
  @ApiParam({ name: 'id', description: 'Charge UUID.', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiQuery({ name: 'account_id', required: false, description: 'Account ID (uses default if omitted).', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({
    status: 200,
    description: 'Charge details including selected_suppliers.',
    schema: {
      example: {
        code: 200,
        status: 'success',
        message: 'Charge fetched successfully.',
        data: {
          id: 'uuid',
          name: 'Transport fee',
          description: null,
          kind: 'recurring',
          amount_type: 'fixed',
          amount: 500,
          recurrence: 'per_payroll',
          apply_to_all_suppliers: true,
          effective_from: null,
          effective_to: null,
          is_active: true,
          created_at: '2025-02-17T12:00:00.000Z',
          updated_at: '2025-02-17T12:00:00.000Z',
          selected_suppliers: [],
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'No valid default account found.' })
  @ApiNotFoundResponse({
    description: 'Charge not found or not accessible',
    schema: { example: { code: 404, status: 'error', message: 'Charge not found.' } },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing authentication token.' })
  async getById(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('account_id') accountId?: string,
  ) {
    return this.chargesService.findOne(user, id, accountId);
  }

  @Put('update/:id')
  @ApiOperation({
    summary: 'Update a charge',
    description:
      'Update an existing charge. All fields are optional (partial update). When changing apply_to_all_suppliers to false, pass supplier_account_ids; when changing to true, selected suppliers are cleared.',
  })
  @ApiParam({ name: 'id', description: 'Charge UUID.', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiBody({
    type: UpdateChargeDto,
    description: 'Fields to update (all optional)',
    examples: {
      updateName: { summary: 'Rename and set inactive', value: { name: 'New fee name', is_active: false } },
      switchToSelected: {
        summary: 'Apply to selected suppliers only',
        value: {
          apply_to_all_suppliers: false,
          supplier_account_ids: ['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002'],
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Charge updated. Returns the updated charge.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid input or recurrence required for recurring',
    schema: { example: { code: 400, status: 'error', message: 'Recurrence is required for recurring charges (monthly or per_payroll).' } },
  })
  @ApiNotFoundResponse({
    description: 'Charge not found or not accessible',
    schema: { example: { code: 404, status: 'error', message: 'Charge not found.' } },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing authentication token.' })
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateChargeDto,
    @Body('account_id') accountId?: string,
  ) {
    const accountIdParam = dto.account_id ?? accountId;
    return this.chargesService.update(user, id, dto, accountIdParam);
  }

  @Delete('delete/:id')
  @ApiOperation({
    summary: 'Delete a charge',
    description: 'Permanently deletes a charge. Does not affect payroll runs or deductions already generated. Charge must belong to the user\'s account.',
  })
  @ApiParam({ name: 'id', description: 'Charge UUID.', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiQuery({ name: 'account_id', required: false, description: 'Account ID (uses default if omitted).', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({
    status: 200,
    description: 'Charge deleted.',
    schema: { example: { code: 200, status: 'success', message: 'Charge deleted successfully.' } },
  })
  @ApiNotFoundResponse({
    description: 'Charge not found or not accessible',
    schema: { example: { code: 404, status: 'error', message: 'Charge not found.' } },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing authentication token.' })
  async delete(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('account_id') accountId?: string,
  ) {
    return this.chargesService.remove(user, id, accountId);
  }
}
