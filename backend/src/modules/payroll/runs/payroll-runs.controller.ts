import { Controller, Post, Get, Put, Body, UseGuards, Param, Query, HttpCode, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam, ApiQuery, ApiBadRequestResponse, ApiUnauthorizedResponse, ApiNotFoundResponse, ApiProduces } from '@nestjs/swagger';
import { Response } from 'express';
import { PayrollRunsService } from './payroll-runs.service';
import { TokenGuard } from '../../../common/guards/token.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { User } from '@prisma/client';
import { CreatePayrollRunDto } from './dto/create-payroll-run.dto';
import { UpdatePayrollRunDto } from './dto/update-payroll-run.dto';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { MarkPayrollPaidDto } from './dto/mark-payroll-paid.dto';

@ApiTags('Payroll - Runs')
@Controller('payroll/runs')
@UseGuards(TokenGuard)
@ApiBearerAuth()
export class PayrollRunsController {
  constructor(private readonly payrollRunsService: PayrollRunsService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Create payroll run',
    description: 'Create a new payroll run for processing supplier payments. The run will be associated with the user\'s default account.',
  })
  @ApiBody({
    type: CreatePayrollRunDto,
    description: 'Payroll run creation data',
  })
  @ApiResponse({
    status: 200,
    description: 'Run created successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Payroll run created successfully.',
      data: {
        id: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
        period_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'pending',
        created_at: '2025-01-28T10:00:00Z',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request or no default account',
    example: {
      code: 400,
      status: 'error',
      message: 'No valid default account found.',
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - invalid or missing token',
    example: {
      code: 401,
      status: 'error',
      message: 'Access denied. Token is required.',
    },
  })
  async createRun(@CurrentUser() user: User, @Body() createDto: CreatePayrollRunDto) {
    return this.payrollRunsService.createRun(user, createDto);
  }

  @Post('generate')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Generate payroll with selected suppliers and date range',
    description: 'Creates a payroll run and processes it immediately: selects suppliers by account codes, period_start/period_end, optional payment_terms_days and run_name. Returns run_id and payslips summary.',
  })
  @ApiBody({ type: GeneratePayrollDto })
  @ApiResponse({ status: 200, description: 'Payroll generated successfully.' })
  @ApiBadRequestResponse({ description: 'Invalid input or no default account.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing token.' })
  async generatePayroll(@CurrentUser() user: User, @Body() generateDto: GeneratePayrollDto) {
    return this.payrollRunsService.generatePayroll(user, generateDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get payroll runs',
    description: 'List payroll runs for the given account (or user default). Scoped so Kozamgi only sees Kozamgi runs. Optionally filter by period_id.',
  })
  @ApiQuery({ name: 'period_id', required: false, description: 'Optional payroll period UUID to filter runs.' })
  @ApiQuery({ name: 'account_id', required: false, description: 'Account UUID (default: user\'s default account)' })
  @ApiResponse({ status: 200, description: 'Runs fetched successfully.' })
  @ApiBadRequestResponse({ description: 'No valid default account found.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing token.' })
  async getRuns(@CurrentUser() user: User, @Query('period_id') periodId?: string, @Query('account_id') accountId?: string) {
    return this.payrollRunsService.getRuns(user, periodId, accountId);
  }

  @Get(':runId/payslips/:payslipId')
  @ApiOperation({
    summary: 'Get payslip detail',
    description: 'Returns a single payslip with full transparency: earnings (milk collections in the period with date, quantity, unit price, amount) and deductions (each with type, amount, and reason e.g. charge name, loan repayment, inventory debt). Used when clicking a person in the payroll list.',
  })
  @ApiParam({ name: 'runId', description: 'Payroll run ID (UUID).' })
  @ApiParam({ name: 'payslipId', description: 'Payslip ID (UUID).' })
  @ApiQuery({ name: 'account_id', required: false, description: 'Account UUID (default: user\'s default account)' })
  @ApiResponse({
    status: 200,
    description: 'Payslip detail with earnings and deductions',
    schema: {
      example: {
        code: 200,
        status: 'success',
        message: 'Payslip detail fetched.',
        data: {
          id: 'payslip-uuid',
          supplier: 'Supplier Name',
          supplier_code: 'A_ABC123',
          gross_amount: 150000,
          total_deductions: 15000,
          net_amount: 135000,
          milk_sales_count: 12,
          period_start: '2025-01-01T00:00:00Z',
          period_end: '2025-01-15T23:59:59Z',
          status: 'generated',
          earnings: [{ id: 'uuid', date: '2025-01-05T10:00:00Z', quantity: 50, unit_price: 350, amount: 17500, notes: null }],
          deductions: [{ id: 'uuid', type: 'fee', amount: 5000, reason: 'Membership fee' }],
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'No valid default account found.' })
  @ApiNotFoundResponse({ description: 'Payroll run or payslip not found.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing token.' })
  async getPayslipDetail(
    @CurrentUser() user: User,
    @Param('runId') runId: string,
    @Param('payslipId') payslipId: string,
    @Query('account_id') accountId?: string,
  ) {
    return this.payrollRunsService.getPayslipDetail(user, runId, payslipId, accountId);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update payroll run',
    description: 'Update payroll run status or total amount. Only the run creator can update.',
  })
  @ApiParam({ name: 'id', description: 'Payroll run ID (UUID).' })
  @ApiBody({ type: UpdatePayrollRunDto })
  @ApiResponse({ status: 200, description: 'Run updated successfully.' })
  @ApiNotFoundResponse({ description: 'Payroll run not found.' })
  @ApiBadRequestResponse({ description: 'No permission to update this run.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing token.' })
  async updateRun(@CurrentUser() user: User, @Param('id') id: string, @Body() updateDto: UpdatePayrollRunDto) {
    return this.payrollRunsService.updateRun(user, id, updateDto);
  }

  @Post(':id/process')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Process payroll',
    description: 'Process a draft payroll run: compute payslips from milk sales and applicable charges/loans/inventory deductions for the run period.',
  })
  @ApiParam({ name: 'id', description: 'Payroll run ID (UUID).' })
  @ApiResponse({ status: 200, description: 'Payroll processed successfully.' })
  @ApiNotFoundResponse({ description: 'Payroll run not found.' })
  @ApiBadRequestResponse({ description: 'No permission or no default account.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing token.' })
  async processPayroll(@CurrentUser() user: User, @Param('id') id: string) {
    return this.payrollRunsService.processPayroll(user, id);
  }

  @Post(':id/mark-paid')
  @HttpCode(200)
  @ApiOperation({ 
    summary: 'Mark payroll as paid',
    description: 'Marks payroll payslip(s) as paid and creates expense transaction in finance. If payslip_id is provided, marks only that payslip. Otherwise, marks all unpaid payslips in the run.'
  })
  @ApiParam({ name: 'id', description: 'Payroll run ID.' })
  @ApiBody({ type: MarkPayrollPaidDto })
  @ApiResponse({ status: 200, description: 'Payroll marked as paid successfully.' })
  async markAsPaid(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() markPaidDto: MarkPayrollPaidDto,
  ) {
    return this.payrollRunsService.markAsPaid(user, id, markPaidDto);
  }

  @Get(':id/export')
  @ApiOperation({
    summary: 'Export payroll to Excel or PDF',
    description: 'Exports payroll run to Excel (.xlsx) or PDF format. Response is a file download. Default format is Excel.',
  })
  @ApiParam({ name: 'id', description: 'Payroll run ID (UUID).' })
  @ApiQuery({ name: 'format', required: false, enum: ['excel', 'pdf'], description: 'Export format. Default: excel.' })
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/pdf')
  @ApiResponse({ status: 200, description: 'File download (Excel or PDF).' })
  @ApiNotFoundResponse({ description: 'Payroll run not found or no access.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing token.' })
  async exportPayroll(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('format') format: string = 'excel',
    @Res() res: Response,
  ) {
    return this.payrollRunsService.exportPayroll(user, id, format, res);
  }
}

