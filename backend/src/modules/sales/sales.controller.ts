import { Controller, Get, Post, Put, Body, UseGuards, Query, Param, HttpCode, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiBadRequestResponse, ApiUnauthorizedResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { SalesService } from './sales.service';
import { TokenGuard } from '../../common/guards/token.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User } from '@prisma/client';
import { GetSalesDto } from './dto/get-sales.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { CancelSaleDto } from './dto/cancel-sale.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { BulkCreateSalesDto } from './dto/bulk-create-sales.dto';
import { RecordPaymentDto } from '../accounting/receivables-payables/dto/record-payment.dto';

@ApiTags('Sales')
@Controller('sales')
@UseGuards(TokenGuard, PermissionGuard)
@ApiBearerAuth()
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post('sales')
  @RequirePermission('view_sales')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get sales list with filters',
    description: 'Retrieve milk sales for the authenticated user\'s default account (as supplier). Supports filtering by customer account code, status, date range, quantity range, and price range. Data is scoped to the user\'s default account.',
  })
  @ApiBody({
    type: GetSalesDto,
    description: 'Optional filters for sales query',
    examples: {
      allSales: {
        summary: 'Get all sales',
        description: 'Retrieve all sales without filters',
        value: {
          filters: {},
        },
      },
      filteredSales: {
        summary: 'Get filtered sales',
        description: 'Filter by status, date range, quantity, and price',
        value: {
          filters: {
            customer_account_code: 'A_XYZ789',
            status: 'completed',
            date_from: '2025-01-01',
            date_to: '2025-01-31',
            quantity_min: 50,
            quantity_max: 200,
            price_min: 350,
            price_max: 450,
          },
        },
      },
      dateRangeOnly: {
        summary: 'Filter by date range',
        description: 'Get sales for a specific period',
        value: {
          filters: {
            date_from: '2025-01-01',
            date_to: '2025-01-31',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Sales fetched successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Sales fetched successfully.',
      data: [
        {
          id: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
          quantity: 120.5,
          unit_price: 390.0,
          total_amount: 46995.0,
          status: 'completed',
          sale_at: '2025-01-20T10:00:00Z',
          payment_status: 'unpaid',
          notes: 'Morning delivery',
          supplier_account: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            code: 'A_ABC123',
            name: 'KOPERATIVE KOZAMGI',
            type: 'tenant',
            status: 'active',
          },
          customer_account: {
            id: '660e8400-e29b-41d4-a716-446655440001',
            code: 'A_XYZ789',
            name: 'Customer Account',
            type: 'tenant',
            status: 'active',
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request - no default account found or invalid filter values',
    examples: {
      noDefaultAccount: {
        summary: 'No default account',
        value: {
          code: 400,
          status: 'error',
          message: 'No valid default account found. Please set a default account.',
        },
      },
      invalidDate: {
        summary: 'Invalid date format',
        value: {
          code: 400,
          status: 'error',
          message: 'Invalid date format. Use YYYY-MM-DD',
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
  async getSales(@CurrentUser() user: User, @Body() getSalesDto: GetSalesDto) {
    return this.salesService.getSales(user, getSalesDto.filters, getSalesDto.account_id);
  }

  @Put('update')
  @RequirePermission('update_sales')
  @ApiOperation({
    summary: 'Update a sale',
    description: 'Update sale details including quantity, status, customer, notes, or date. Only sales belonging to the user\'s default account can be updated.',
  })
  @ApiBody({
    type: UpdateSaleDto,
    description: 'Sale update data',
    examples: {
      updateStatus: {
        summary: 'Update sale status',
        value: {
          sale_id: 'sale-uuid',
          status: 'accepted',
        },
      },
      updateWithUUID: {
        summary: 'Update sale with customer UUID',
        value: {
          sale_id: 'sale-uuid',
          customer_account_id: '123e4567-e89b-12d3-a456-426614174000',
          quantity: 150.0,
          notes: 'Updated quantity after verification',
        },
      },
      updateQuantity: {
        summary: 'Update quantity and notes',
        value: {
          sale_id: 'sale-uuid',
          quantity: 150.0,
          notes: 'Updated quantity after verification',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Sale updated successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Sale updated successfully.',
      data: {
        id: 'sale-uuid',
        quantity: 150.0,
        unit_price: 390.0,
        status: 'completed',
        sale_at: '2025-01-04T10:00:00Z',
        notes: 'Updated quantity',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request - no fields to update, missing sale_id, or invalid data',
    examples: {
      noFields: {
        summary: 'No fields to update',
        value: {
          code: 400,
          status: 'error',
          message: 'No fields to update.',
        },
      },
      missingSaleId: {
        summary: 'Missing sale_id',
        value: {
          code: 400,
          status: 'error',
          message: 'Sale ID is required.',
        },
      },
      invalidQuantity: {
        summary: 'Invalid quantity',
        value: {
          code: 400,
          status: 'error',
          message: 'Quantity must be a positive number.',
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
  @ApiNotFoundResponse({
    description: 'Sale not found or not owned by user\'s default account',
    example: {
      code: 404,
      status: 'error',
      message: 'Sale not found or not owned by this supplier.',
    },
  })
  async updateSale(@CurrentUser() user: User, @Body() updateDto: UpdateSaleDto) {
    return this.salesService.updateSale(user, updateDto.sale_id, updateDto);
  }

  @Post('cancel')
  @RequirePermission('update_sales')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cancel a sale',
    description: 'Cancel a sale by setting its status to "cancelled". Only sales belonging to the user\'s default account can be cancelled.',
  })
  @ApiBody({
    type: CancelSaleDto,
    description: 'Sale ID to cancel',
    examples: {
      cancelSale: {
        summary: 'Cancel sale',
        value: {
          sale_id: 'sale-uuid',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Sale cancelled successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Sale cancelled successfully.',
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request - missing sale_id or no default account',
    examples: {
      missingSaleId: {
        summary: 'Missing sale_id',
        value: {
          code: 400,
          status: 'error',
          message: 'Missing token or sale_id.',
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
  @ApiNotFoundResponse({
    description: 'Sale not found or not authorized for user\'s default account',
    example: {
      code: 404,
      status: 'error',
      message: 'Sale not found or not authorized.',
    },
  })
  async cancelSale(@CurrentUser() user: User, @Body() cancelDto: CancelSaleDto) {
    return this.salesService.cancelSale(user, cancelDto);
  }

  @Post()
  @RequirePermission('create_sales')
  @ApiOperation({
    summary: 'Create a new sale',
    description: 'Create a new milk sale transaction. The sale is created from the supplier perspective (user\'s default account is the supplier selling to customers). Supports both UUID and account code for customer identification. Default status is "accepted".',
  })
  @ApiBody({
    type: CreateSaleDto,
    description: 'Sale details - customer can be identified by UUID or account code',
    examples: {
      createSaleWithUUID: {
        summary: 'Create sale using customer UUID (recommended)',
        description: 'Use customer account UUID for precise identification',
        value: {
          customer_account_id: '550e8400-e29b-41d4-a716-446655440000',
          quantity: 120.5,
          unit_price: 390.0,
          status: 'accepted',
          sale_at: '2025-01-28T10:00:00Z',
          notes: 'Morning delivery - good quality milk',
          payment_status: 'unpaid',
        },
      },
      createSaleWithCode: {
        summary: 'Create sale using account code (fallback)',
        description: 'Use account code if UUID is not available',
        value: {
          customer_account_code: 'A_XYZ789',
          quantity: 150.0,
          unit_price: 400.0,
          status: 'accepted',
          sale_at: '2025-01-28T14:30:00Z',
          notes: 'Afternoon delivery',
        },
      },
      minimalSale: {
        summary: 'Create sale with minimal info',
        description: 'Only quantity required; defaults to accepted status and current date',
        value: {
          customer_account_id: '550e8400-e29b-41d4-a716-446655440000',
          quantity: 85.0,
        },
      },
      completedSale: {
        summary: 'Create completed sale',
        description: 'Sale marked as completed immediately',
        value: {
          customer_account_id: '550e8400-e29b-41d4-a716-446655440000',
          quantity: 200.0,
          unit_price: 380.0,
          status: 'completed',
          sale_at: '2025-01-28T08:00:00Z',
          payment_status: 'paid',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Sale created successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Sale created successfully.',
      data: {
        id: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
        quantity: 120.5,
        unit_price: 390.0,
        total_amount: 46995.0,
        status: 'accepted',
        sale_at: '2025-01-28T10:00:00Z',
        notes: 'Morning delivery - good quality milk',
        payment_status: 'unpaid',
        supplier_account: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          code: 'A_ABC123',
          name: 'KOPERATIVE KOZAMGI',
          type: 'tenant',
          status: 'active',
        },
        customer_account: {
          id: '660e8400-e29b-41d4-a716-446655440001',
          code: 'A_XYZ789',
          name: 'Customer Account',
          type: 'tenant',
          status: 'active',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request - missing required fields, invalid data, or no default account',
    examples: {
      noDefaultAccount: {
        summary: 'No default account',
        value: {
          code: 400,
          status: 'error',
          message: 'No valid default account found. Please set a default account.',
        },
      },
      missingCustomer: {
        summary: 'Missing customer identifier',
        value: {
          code: 400,
          status: 'error',
          message: 'Either customer_account_id or customer_account_code is required.',
        },
      },
      invalidQuantity: {
        summary: 'Invalid quantity',
        value: {
          code: 400,
          status: 'error',
          message: 'Quantity must be a positive number.',
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
  @ApiNotFoundResponse({
    description: 'Customer account not found',
    example: {
      code: 404,
      status: 'error',
      message: 'Customer account not found.',
    },
  })
  async createSale(@CurrentUser() user: User, @Body() createDto: CreateSaleDto) {
    return this.salesService.createSale(user, createDto);
  }

  @Get('template')
  @RequirePermission('view_sales')
  @ApiOperation({
    summary: 'Download sales CSV template',
    description: 'Returns a CSV file with header row and one example row for bulk import.',
  })
  @ApiResponse({
    status: 200,
    description: 'CSV template file',
    headers: {
      'Content-Disposition': { description: 'attachment; filename="sales-template.csv"', schema: { type: 'string' } },
      'Content-Type': { description: 'text/csv; charset=utf-8', schema: { type: 'string' } },
    },
  })
  async getTemplate(@Res() res: Response) {
    const csv =
      'customer_account_code,quantity,unit_price,sale_at,notes,payment_status\n' +
      'A_XYZ789,120.5,390,2025-01-15,Morning delivery,unpaid';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="sales-template.csv"');
    res.send(csv);
  }

  @Post('bulk')
  @RequirePermission('create_sales')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Bulk create sales',
    description: 'Create multiple milk sales from an array. Returns success count and per-row errors.',
  })
  @ApiBody({ type: BulkCreateSalesDto })
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
  async bulkCreateSales(@CurrentUser() user: User, @Body() body: BulkCreateSalesDto) {
    const result = await this.salesService.bulkCreateSales(user, body.rows);
    return {
      code: 200,
      status: 'success',
      message: 'Bulk import completed.',
      data: result,
    };
  }

  @Post(':saleId/payment')
  @RequirePermission('update_sales')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Record payment for a sale',
    description: 'Records a payment against an unpaid/partial sale. Creates journal entry: DR Cash, CR Receivable. Supports partial payments.',
  })
  @ApiBody({
    type: RecordPaymentDto,
    description: 'Payment details',
    examples: {
      fullPayment: {
        summary: 'Full payment',
        value: {
          amount: 40000,
          payment_date: '2025-01-23',
          notes: 'Payment via mobile money',
        },
      },
      partialPayment: {
        summary: 'Partial payment',
        value: {
          amount: 20000,
          notes: 'First installment',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Payment recorded successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Payment recorded successfully',
      data: {
        sale_id: 'sale-uuid',
        amount_paid: 40000,
        outstanding: 0,
        payment_status: 'paid',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid payment amount or exceeds outstanding balance',
  })
  @ApiNotFoundResponse({
    description: 'Sale not found or user does not have permission',
  })
  async recordPayment(
    @CurrentUser() user: User,
    @Param('saleId') saleId: string,
    @Body() paymentDto: RecordPaymentDto,
  ) {
    return this.salesService.recordPayment(user, saleId, paymentDto);
  }
}
