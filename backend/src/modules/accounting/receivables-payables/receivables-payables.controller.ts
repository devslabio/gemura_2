import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth, 
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { ReceivablesPayablesService } from './receivables-payables.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { TokenGuard } from '../../../common/guards/token.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { User } from '@prisma/client';

@Controller('accounting')
@ApiTags('Accounting - Receivables & Payables')
@UseGuards(TokenGuard)
@ApiBearerAuth()
export class ReceivablesPayablesController {
  constructor(private receivablesPayablesService: ReceivablesPayablesService) {}

  @Get('receivables')
  @ApiOperation({
    summary: 'Get Receivables',
    description: 'Returns all unpaid/partial milk sales (and inventory sales to suppliers on credit) where the authenticated user is the supplier. Includes aging_summary (current, days_31_60, days_61_90, days_90_plus) in numeric form for dashboard aging charts, grouping by customer, and detailed invoice information. Data is scoped to the user\'s default account.',
  })
  @ApiQuery({ 
    name: 'customer_account_id', 
    required: false, 
    description: 'Filter by specific customer account ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @ApiQuery({ 
    name: 'date_from', 
    required: false, 
    description: 'Start date for filtering sales (YYYY-MM-DD format)',
    example: '2025-01-01',
    type: String,
  })
  @ApiQuery({ 
    name: 'date_to', 
    required: false, 
    description: 'End date for filtering sales (YYYY-MM-DD format)',
    example: '2025-01-31',
    type: String,
  })
  @ApiQuery({ 
    name: 'payment_status', 
    required: false, 
    description: 'Filter by payment status',
    enum: ['unpaid', 'partial', 'paid'],
    example: 'unpaid',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Receivables fetched successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Receivables fetched successfully',
      data: {
        total_receivables: 150000,
        total_invoices: 5,
        by_customer: [
          {
            customer: {
              id: '550e8400-e29b-41d4-a716-446655440000',
              code: 'A_XYZ789',
              name: 'KOPERATIVE KOZAMGI',
            },
            total_outstanding: 100000,
            invoice_count: 3,
            invoices: [
              {
                sale_id: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
                sale_date: '2025-01-20T10:00:00Z',
                quantity: 100,
                unit_price: 400,
                total_amount: 40000,
                amount_paid: 0,
                outstanding: 40000,
                payment_status: 'unpaid',
                days_outstanding: 8,
                aging_bucket: 'current',
              },
            ],
          },
        ],
        aging_summary: {
          current: 100000,
          days_31_60: 30000,
          days_61_90: 20000,
          days_90_plus: 0,
        },
        all_receivables: [],
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid date format or no default account found',
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
  async getReceivables(
    @CurrentUser() user: User,
    @Query('customer_account_id') customerAccountId?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('payment_status') paymentStatus?: string,
  ) {
    return this.receivablesPayablesService.getReceivables(user, {
      customer_account_id: customerAccountId,
      date_from: dateFrom,
      date_to: dateTo,
      payment_status: paymentStatus,
    });
  }

  @Get('payables')
  @ApiOperation({
    summary: 'Get Payables',
    description: 'Returns all unpaid/partial milk collections where the authenticated user is the customer/collector (buying from suppliers). Includes aging_summary (current, days_31_60, days_61_90, days_90_plus) in numeric form for dashboard aging charts, grouping by supplier, and detailed invoice information. Data is scoped to the user\'s default account.',
  })
  @ApiQuery({ 
    name: 'supplier_account_id', 
    required: false, 
    description: 'Filter by specific supplier account ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @ApiQuery({ 
    name: 'date_from', 
    required: false, 
    description: 'Start date for filtering collections (YYYY-MM-DD format)',
    example: '2025-01-01',
    type: String,
  })
  @ApiQuery({ 
    name: 'date_to', 
    required: false, 
    description: 'End date for filtering collections (YYYY-MM-DD format)',
    example: '2025-01-31',
    type: String,
  })
  @ApiQuery({ 
    name: 'payment_status', 
    required: false, 
    description: 'Filter by payment status',
    enum: ['unpaid', 'partial', 'paid'],
    example: 'unpaid',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Payables fetched successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Payables fetched successfully',
      data: {
        total_payables: 200000,
        total_invoices: 8,
        by_supplier: [
          {
            supplier: {
              id: '550e8400-e29b-41d4-a716-446655440000',
              code: 'S_ABC123',
              name: 'Jean Baptiste Uwimana',
            },
            total_outstanding: 120000,
            invoice_count: 4,
            invoices: [
              {
                collection_id: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
                collection_date: '2025-01-20T10:00:00Z',
                quantity: 200,
                unit_price: 350,
                total_amount: 70000,
                amount_paid: 0,
                outstanding: 70000,
                payment_status: 'unpaid',
                days_outstanding: 8,
                aging_bucket: 'current',
              },
            ],
          },
        ],
        aging_summary: {
          current: 150000,
          days_31_60: 30000,
          days_61_90: 20000,
          days_90_plus: 0,
        },
        all_payables: [],
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid date format or no default account found',
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
  async getPayables(
    @CurrentUser() user: User,
    @Query('supplier_account_id') supplierAccountId?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('payment_status') paymentStatus?: string,
  ) {
    return this.receivablesPayablesService.getPayables(user, {
      supplier_account_id: supplierAccountId,
      date_from: dateFrom,
      date_to: dateTo,
      payment_status: paymentStatus,
    });
  }

  @Post('receivables/inventory/:inventorySaleId/payment')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Record payment for inventory receivable',
    description: 'Record a direct payment against an InventorySale receivable (supplier debt). Use when a supplier pays off their inventory debt directly, not via payroll deduction. Updates Receivables automatically.',
  })
  @ApiParam({ name: 'inventorySaleId', description: 'Inventory sale ID (receivable UUID).' })
  @ApiBody({
    type: RecordPaymentDto,
    description: 'Payment amount and optional date/notes',
  })
  @ApiResponse({ status: 200, description: 'Payment recorded successfully.' })
  @ApiBadRequestResponse({ description: 'Invalid amount or exceeds outstanding.' })
  @ApiUnauthorizedResponse({ description: 'Access denied.' })
  async recordPaymentForReceivable(
    @CurrentUser() user: User,
    @Param('inventorySaleId') inventorySaleId: string,
    @Body() paymentDto: RecordPaymentDto,
  ) {
    return this.receivablesPayablesService.recordPaymentForReceivable(
      user,
      inventorySaleId,
      paymentDto,
    );
  }
}
