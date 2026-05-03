import { Controller, Post, Get, Put, Delete, Body, UseGuards, Param, HttpCode, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiBadRequestResponse, ApiUnauthorizedResponse, ApiNotFoundResponse, ApiParam } from '@nestjs/swagger';
import { Response } from 'express';
import { CustomersService } from './customers.service';
import { TokenGuard } from '../../common/guards/token.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequireAnyPermission, RequirePermission } from '../../common/decorators/permission.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User } from '@prisma/client';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { BulkCreateCustomersDto } from './dto/bulk-create-customers.dto';

@ApiTags('Customers')
@Controller('customers')
@UseGuards(TokenGuard, PermissionGuard)
@ApiBearerAuth()
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @RequireAnyPermission(['create_customers', 'update_customers'])
  @ApiOperation({
    summary: 'Create or update customer',
    description: 'Create a new customer relationship or update an existing one. If customer exists (by phone/email/nid), updates the relationship. Otherwise, creates new user, account, and wallet.',
  })
  @ApiBody({
    type: CreateCustomerDto,
    description: 'Customer information',
    examples: {
      createCustomer: {
        summary: 'Create new customer',
        value: {
          name: 'John Doe',
          phone: '250788123456',
          price_per_liter: 400.0,
          email: 'customer@example.com',
          nid: '1199887766554433',
          address: 'Kigali, Rwanda',
        },
      },
      minimalCustomer: {
        summary: 'Create customer with minimal info',
        value: {
          name: 'Jane Smith',
          phone: '250788654321',
          price_per_liter: 390.0,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Customer created/updated successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Customer created/updated successfully.',
      data: {
        customer: {
          account_id: 'account-uuid',
          account_code: 'A_XYZ789',
          name: 'John Doe',
          phone: '250788123456',
          price_per_liter: 400.0,
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request - missing required fields or no default account',
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
      message: 'Unauthorized. Invalid token.',
    },
  })
  async createCustomer(@CurrentUser() user: User, @Body() createDto: CreateCustomerDto) {
    return this.customersService.createCustomer(user, createDto);
  }

  @Get('template')
  @RequirePermission('view_customers')
  @ApiOperation({
    summary: 'Download customers CSV template',
    description: 'Returns a CSV file with header row and one example row for bulk import.',
  })
  @ApiResponse({
    status: 200,
    description: 'CSV template file',
    headers: {
      'Content-Disposition': {
        description: 'attachment; filename="customers-template.csv"',
        schema: { type: 'string' },
      },
      'Content-Type': {
        description: 'text/csv; charset=utf-8',
        schema: { type: 'string' },
      },
    },
  })
  async getTemplate(@Res() res: Response) {
    const csv =
      'name,phone,email,nid,address,price_per_liter\n' +
      'Example Customer,250788123456,customer@example.com,1199887766554433,Kigali Rwanda,400';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="customers-template.csv"');
    res.send(csv);
  }

  @Post('bulk')
  @RequireAnyPermission(['create_customers', 'update_customers'])
  @ApiOperation({
    summary: 'Bulk create or update customers',
    description: 'Create or update multiple customers from an array. Each row uses the same validation as single create. Returns success count and per-row errors.',
  })
  @ApiBody({ type: BulkCreateCustomersDto })
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
  async bulkCreateCustomers(@CurrentUser() user: User, @Body() body: BulkCreateCustomersDto) {
    const result = await this.customersService.bulkCreateCustomers(user, body.rows);
    return {
      code: 200,
      status: 'success',
      message: 'Bulk import completed.',
      data: result,
    };
  }

  @Post('get')
  @RequirePermission('view_customers')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get all customers',
    description: 'Retrieve all active customer relationships for the authenticated user\'s default account. Returns customer information including account details, pricing, and relationship status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Customers fetched successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Customers fetched successfully.',
      data: [
        {
          relationship_id: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
          code: 'U_XYZ789',
          name: 'KOPERATIVE KOZAMGI',
          phone: '250788123456',
          email: 'customer@example.com',
          nid: '1199887766554433',
          address: 'Kigali, Rwanda',
          account: {
            code: 'A_XYZ789',
            name: 'KOPERATIVE KOZAMGI',
          },
          price_per_liter: 400.0,
          average_supply_quantity: 120.5,
          relationship_status: 'active',
          created_at: '2025-01-04T10:00:00Z',
          updated_at: '2025-01-04T10:00:00Z',
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
      message: 'Unauthorized. Invalid token.',
    },
  })
  async getAllCustomers(@CurrentUser() user: User, @Body('account_id') accountId?: string) {
    return this.customersService.getAllCustomers(user, accountId);
  }

  @Get('by-id/:id')
  @RequirePermission('view_customers')
  @ApiOperation({
    summary: 'Get customer details by ID',
    description: 'Retrieve detailed information about a specific customer by account ID (UUID). Returns customer account details, user information, and relationship data. The customer must be associated with the user\'s default account.',
  })
  @ApiParam({
    name: 'id',
    description: 'Customer account ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Customer fetched successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Customer fetched successfully.',
      data: {
        customer: {
          account_id: '550e8400-e29b-41d4-a716-446655440000',
          account_code: 'A_XYZ789',
          name: 'KOPERATIVE KOZAMGI',
          type: 'tenant',
          status: 'active',
          user: {
            id: '660e8400-e29b-41d4-a716-446655440001',
            name: 'KOPERATIVE KOZAMGI',
            phone: '250788123456',
            email: 'customer@example.com',
            nid: '1199887766554433',
            address: 'Kigali, Rwanda',
            account_type: 'customer',
          },
          relationship: {
            price_per_liter: 400.0,
            average_supply_quantity: 120.5,
            relationship_status: 'active',
            created_at: '2025-01-04T10:00:00Z',
            updated_at: '2025-01-04T10:00:00Z',
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request - no default account found or invalid UUID',
    examples: {
      noDefaultAccount: {
        summary: 'No default account',
        value: {
          code: 400,
          status: 'error',
          message: 'No valid default account found. Please set a default account.',
        },
      },
      invalidUUID: {
        summary: 'Invalid UUID format',
        value: {
          code: 400,
          status: 'error',
          message: 'Invalid account ID format.',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing authentication token',
    example: {
      code: 401,
      status: 'error',
      message: 'Unauthorized. Invalid token.',
    },
  })
  @ApiNotFoundResponse({
    description: 'Customer not found or not associated with user\'s account',
    example: {
      code: 404,
      status: 'error',
      message: 'Customer not found.',
    },
  })
  async getCustomerById(@CurrentUser() user: User, @Param('id') id: string) {
    return this.customersService.getCustomerById(user, id);
  }

  @Get(':code')
  @RequirePermission('view_customers')
  @ApiOperation({
    summary: 'Get customer details by code',
    description: 'Retrieve details of a specific customer by account code. Returns customer information and relationship details.',
  })
  @ApiParam({
    name: 'code',
    description: 'Customer account code',
    example: 'A_XYZ789',
  })
  @ApiResponse({
    status: 200,
    description: 'Customer fetched successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Customer fetched successfully.',
      data: {
        customer: {
          account_id: 'account-uuid',
          account_code: 'A_XYZ789',
          name: 'John Doe',
          type: 'tenant',
          status: 'active',
          user: {
            id: 'user-uuid',
            name: 'John Doe',
            phone: '250788123456',
            email: 'customer@example.com',
            nid: '1199887766554433',
            address: 'Kigali, Rwanda',
            account_type: 'customer',
          },
          relationship: {
            price_per_liter: 400.0,
            average_supply_quantity: 120.5,
            relationship_status: 'active',
            created_at: '2025-01-04T10:00:00Z',
            updated_at: '2025-01-04T10:00:00Z',
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing authentication token',
    example: {
      code: 401,
      status: 'error',
      message: 'Unauthorized. Invalid token.',
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
  async getCustomer(@CurrentUser() user: User, @Param('code') code: string) {
    return this.customersService.getCustomer(user, code);
  }

  @Put('update')
  @RequirePermission('update_customers')
  @ApiOperation({
    summary: 'Update customer',
    description: 'Update customer details including name, contact info, price per liter, and relationship status.',
  })
  @ApiBody({
    type: UpdateCustomerDto,
    description: 'Customer update data',
    examples: {
      updatePrice: {
        summary: 'Update price per liter',
        value: {
          customer_account_code: 'A_XYZ789',
          price_per_liter: 410.0,
        },
      },
      updateInfo: {
        summary: 'Update customer information',
        value: {
          customer_account_code: 'A_XYZ789',
          name: 'John Doe Updated',
          phone: '250788123456',
          email: 'newemail@example.com',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Customer updated successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Customer updated successfully.',
      data: {
        customer: {
          account_code: 'A_XYZ789',
          price_per_liter: 430.0,
          relationship_status: 'active',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request - no fields to update or customer not found',
    example: {
      code: 400,
      status: 'error',
      message: 'No fields to update.',
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing authentication token',
    example: {
      code: 401,
      status: 'error',
      message: 'Unauthorized. Invalid token.',
    },
  })
  @ApiNotFoundResponse({
    description: 'Customer relationship not found',
    example: {
      code: 404,
      status: 'error',
      message: 'Customer relationship not found.',
    },
  })
  async updateCustomer(@CurrentUser() user: User, @Body() updateDto: UpdateCustomerDto) {
    return this.customersService.updateCustomer(user, updateDto);
  }

  @Delete(':code')
  @RequirePermission('update_customers')
  @ApiOperation({
    summary: 'Delete customer relationship',
    description: 'Delete (deactivate) a customer relationship. This sets the relationship status to inactive.',
  })
  @ApiParam({
    name: 'code',
    description: 'Customer account code',
    example: 'A_XYZ789',
  })
  @ApiResponse({
    status: 200,
    description: 'Customer relationship deleted successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Customer relationship deleted successfully.',
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing authentication token',
    example: {
      code: 401,
      status: 'error',
      message: 'Unauthorized. Invalid token.',
    },
  })
  @ApiNotFoundResponse({
    description: 'Customer relationship not found',
    example: {
      code: 404,
      status: 'error',
      message: 'Customer relationship not found.',
    },
  })
  async deleteCustomer(@CurrentUser() user: User, @Param('code') code: string) {
    return this.customersService.deleteCustomer(user, code);
  }
}

