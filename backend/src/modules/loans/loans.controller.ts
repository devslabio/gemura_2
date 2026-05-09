import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam, ApiQuery, ApiBody, ApiBadRequestResponse, ApiNotFoundResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { LoansService } from './loans.service';
import { TokenGuard } from '../../common/guards/token.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User } from '@prisma/client';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { BulkCreateLoansDto } from './dto/bulk-create-loans.dto';
import { RecordRepaymentDto } from './dto/record-repayment.dto';

@ApiTags('Loans')
@Controller('loans')
@UseGuards(TokenGuard)
@ApiBearerAuth()
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post('create')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Create a loan',
    description: 'Create a new loan. Borrower type can be supplier, customer, or other. For "other", borrower_phone is required to find or create their account. Disbursement is recorded in accounting (DR Loans Receivable, CR Cash).',
  })
  @ApiBody({
    type: CreateLoanDto,
    description: 'Loan details',
    examples: {
      supplier: {
        summary: 'Loan to supplier',
        value: {
          borrower_type: 'supplier',
          borrower_account_id: '550e8400-e29b-41d4-a716-446655440000',
          principal: 100000,
          currency: 'RWF',
          disbursement_date: '2025-02-12',
          due_date: '2025-03-12',
          notes: 'Working capital',
        },
      },
      other: {
        summary: 'Loan to other (phone required)',
        value: {
          borrower_type: 'other',
          borrower_name: 'John Doe',
          borrower_phone: '250788123456',
          principal: 50000,
          disbursement_date: '2025-02-12',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Loan created successfully.' })
  @ApiBadRequestResponse({
    description: 'Invalid input, missing required fields, or accounting failure',
    example: { code: 400, status: 'error', message: 'Borrower phone is required when borrower type is "other".' },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing authentication token.' })
  async create(@CurrentUser() user: User, @Body() dto: CreateLoanDto) {
    return this.loansService.create(user, dto);
  }

  @Post('get')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get all loans with optional filters',
    description: 'Returns loans for the authenticated user\'s default account (or specified account_id). Filter by borrower type, status, date range, or search by borrower name/code.',
  })
  @ApiQuery({ name: 'account_id', required: false, description: 'Filter by lender account ID (UUID).' })
  @ApiQuery({ name: 'borrower_type', required: false, enum: ['supplier', 'customer', 'other'], description: 'Filter by borrower type.' })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'closed'], description: 'Filter by loan status.' })
  @ApiQuery({ name: 'search', required: false, description: 'Search borrower name or code.' })
  @ApiQuery({ name: 'date_from', required: false, description: 'Filter loans disbursed on or after (YYYY-MM-DD).' })
  @ApiQuery({ name: 'date_to', required: false, description: 'Filter loans disbursed on or before (YYYY-MM-DD).' })
  @ApiResponse({ status: 200, description: 'Loans list.' })
  @ApiBadRequestResponse({ description: 'No valid default account found.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing authentication token.' })
  async getMany(
    @CurrentUser() user: User,
    @Query('account_id') accountId?: string,
    @Query('borrower_type') borrowerType?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    return this.loansService.getMany(user, {
      account_id: accountId,
      borrower_type: borrowerType,
      status,
      search,
      date_from: dateFrom,
      date_to: dateTo,
    });
  }

  @Get('template')
  @ApiOperation({
    summary: 'Download loans CSV template',
    description: 'Returns a CSV file with header row and one example row for bulk import.',
  })
  @ApiResponse({
    status: 200,
    description: 'CSV template file',
    headers: {
      'Content-Disposition': {
        description: 'attachment; filename="loans-template.csv"',
        schema: { type: 'string' },
      },
      'Content-Type': { description: 'text/csv; charset=utf-8', schema: { type: 'string' } },
    },
  })
  getTemplate(@Res() res: Response) {
    const csv = this.loansService.getTemplateCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="loans-template.csv"');
    res.send(csv);
  }

  @Post('bulk')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Bulk create loans',
    description: 'Create multiple loans from an array. Each row must match CreateLoanDto shape. Returns count of success/failed and per-row errors.',
  })
  @ApiBody({
    type: BulkCreateLoansDto,
    description: 'Array of loan objects (same fields as create)',
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk import result',
    example: {
      code: 200,
      status: 'success',
      message: 'Bulk import completed.',
      data: { success: 2, failed: 0, errors: [] },
    },
  })
  @ApiBadRequestResponse({ description: 'No valid default account found.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing authentication token.' })
  async bulkCreate(@CurrentUser() user: User, @Body() body: BulkCreateLoansDto) {
    const result = await this.loansService.bulkCreate(user, body.rows);
    return {
      code: 200,
      status: 'success',
      message: 'Bulk import completed.',
      data: result,
    };
  }

  @Get('by-id/:id')
  @ApiOperation({
    summary: 'Get loan by ID',
    description: 'Returns a single loan with repayments list (ordered by repayment_date desc). Loan must belong to user\'s default account.',
  })
  @ApiParam({ name: 'id', description: 'Loan UUID.' })
  @ApiResponse({ status: 200, description: 'Loan details including repayments array.' })
  @ApiBadRequestResponse({ description: 'No valid default account found.' })
  @ApiNotFoundResponse({ description: 'Loan not found or not accessible.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing authentication token.' })
  async getById(@CurrentUser() user: User, @Param('id') id: string) {
    return this.loansService.getById(user, id);
  }

  @Put('update/:id')
  @ApiOperation({
    summary: 'Update a loan',
    description: 'Update loan status, due date, or notes only. Principal and borrower cannot be changed after creation.',
  })
  @ApiParam({ name: 'id', description: 'Loan UUID.' })
  @ApiBody({
    type: UpdateLoanDto,
    description: 'Fields to update (status, due_date, notes)',
  })
  @ApiResponse({ status: 200, description: 'Loan updated.' })
  @ApiBadRequestResponse({ description: 'No valid default account found.' })
  @ApiNotFoundResponse({ description: 'Loan not found or not accessible.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing authentication token.' })
  async update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateLoanDto) {
    return this.loansService.update(user, id, dto);
  }

  @Post(':id/repayment')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Record a repayment for a loan',
    description: 'Record a direct repayment. Updates loan amount_repaid and creates a LoanRepayment record and accounting entry (DR Cash, CR Loans Receivable). Returns updated loan with repayments list.',
  })
  @ApiParam({ name: 'id', description: 'Loan UUID.' })
  @ApiBody({
    type: RecordRepaymentDto,
    description: 'Repayment amount and optional date/notes',
    examples: {
      minimal: { summary: 'Amount only', value: { amount: 25000 } },
      full: { summary: 'With date and notes', value: { amount: 25000, repayment_date: '2025-02-12', notes: 'Mobile money' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Repayment recorded. Returns updated loan with repayments.' })
  @ApiBadRequestResponse({
    description: 'Amount exceeds outstanding, or accounting failure',
    example: { code: 400, status: 'error', message: 'Repayment amount (50000) cannot exceed outstanding balance (30000).' },
  })
  @ApiNotFoundResponse({ description: 'Loan not found or not accessible.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing authentication token.' })
  async recordRepayment(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: RecordRepaymentDto,
  ) {
    return this.loansService.recordRepayment(user, id, dto);
  }
}
