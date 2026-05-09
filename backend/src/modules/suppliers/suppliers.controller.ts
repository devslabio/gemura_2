import { Controller, Post, Get, Put, Delete, Body, UseGuards, Param, Query, HttpCode, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiBadRequestResponse, ApiUnauthorizedResponse, ApiNotFoundResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { SuppliersService } from './suppliers.service';
import { TokenGuard } from '../../common/guards/token.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequireAnyPermission, RequirePermission } from '../../common/decorators/permission.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User } from '@prisma/client';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { BulkCreateSuppliersDto } from './dto/bulk-create-suppliers.dto';

@ApiTags('Suppliers')
@Controller('suppliers')
@UseGuards(TokenGuard, PermissionGuard)
@ApiBearerAuth()
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post('create')
  @HttpCode(200)
  @RequireAnyPermission(['create_suppliers', 'update_suppliers'])
  @ApiOperation({
    summary: 'Create or update supplier',
    description: 'Create a new supplier relationship or update an existing one. If supplier exists (by phone/email/nid), updates the relationship. Otherwise, creates new user, account, and wallet.',
  })
  @ApiBody({
    type: CreateSupplierDto,
    description: 'Supplier information',
    examples: {
      createSupplier: {
        summary: 'Create new supplier',
        value: {
          name: 'John Doe',
          phone: '250788123456',
          price_per_liter: 390.0,
          email: 'supplier@example.com',
          nid: '1199887766554433',
          address: 'Kigali, Rwanda',
          bank_name: 'Bank of Kigali',
          bank_account_number: '0123456789012',
        },
      },
      minimalSupplier: {
        summary: 'Create supplier with minimal info',
        value: {
          name: 'Jane Smith',
          phone: '250788654321',
          price_per_liter: 400.0,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Supplier created/updated successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Supplier created/updated successfully.',
      data: {
        supplier: {
          account_id: 'account-uuid',
          account_code: 'A_ABC123',
          name: 'John Doe',
          phone: '250788123456',
          price_per_liter: 390.0,
          bank_name: 'Bank of Kigali',
          bank_account_number: '0123456789012',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request - missing required fields or no default account',
    examples: {
      missingFields: {
        summary: 'Missing required fields',
        value: {
          code: 400,
          status: 'error',
          message: 'Missing required fields.',
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
      message: 'Unauthorized. Invalid token.',
    },
  })
  async createSupplier(@CurrentUser() user: User, @Body() createDto: CreateSupplierDto) {
    return this.suppliersService.createOrUpdateSupplier(user, createDto);
  }

  @Get('template')
  @RequirePermission('view_suppliers')
  @ApiOperation({
    summary: 'Download suppliers CSV template',
    description: 'Returns a CSV file with header row and one example row for bulk import.',
  })
  @ApiResponse({
    status: 200,
    description: 'CSV template file',
    headers: {
      'Content-Disposition': { description: 'attachment; filename="suppliers-template.csv"', schema: { type: 'string' } },
      'Content-Type': { description: 'text/csv; charset=utf-8', schema: { type: 'string' } },
    },
  })
  async getTemplate(@Res() res: Response) {
    const csv =
      'name,phone,price_per_liter,email,nid,address,bank_name,bank_account_number\n' +
      'Example Supplier,250788123456,390,supplier@example.com,1199887766554433,Kigali Rwanda,Bank of Kigali,0123456789012';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="suppliers-template.csv"');
    res.send(csv);
  }

  @Post('bulk')
  @HttpCode(200)
  @RequireAnyPermission(['create_suppliers', 'update_suppliers'])
  @ApiOperation({
    summary: 'Bulk create or update suppliers',
    description: 'Create or update multiple suppliers from an array. Returns success count and per-row errors.',
  })
  @ApiBody({ type: BulkCreateSuppliersDto })
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
  async bulkCreateSuppliers(@CurrentUser() user: User, @Body() body: BulkCreateSuppliersDto) {
    const result = await this.suppliersService.bulkCreateSuppliers(user, body.rows);
    return {
      code: 200,
      status: 'success',
      message: 'Bulk import completed.',
      data: result,
    };
  }

  @Post('get')
  @HttpCode(200)
  @RequireAnyPermission([
    'view_suppliers',
    'mcc_view_operations',
    'mcc_view_own_operations',
    'mcc_manage_own_operations',
    'mcc_floor_operations',
  ])
  @ApiOperation({
    summary: 'Get all suppliers',
    description: 'Retrieve all active supplier relationships for the authenticated user\'s default account. Returns supplier information including account details, pricing, and relationship status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Suppliers fetched successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Suppliers fetched successfully.',
      data: [
        {
          relationship_id: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
          code: 'U_ABC123',
          name: 'Jean Baptiste Uwimana',
          phone: '250788123456',
          email: 'jean.uwimana@example.com',
          nid: '1199887766554433',
          address: 'Kigali, Rwanda',
          account: {
            code: 'A_ABC123',
            name: 'Jean Baptiste Uwimana',
          },
          price_per_liter: 390.0,
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
  async getAllSuppliers(@CurrentUser() user: User, @Body('account_id') accountId?: string) {
    return this.suppliersService.getAllSuppliers(user, accountId);
  }

  @Get('by-id/:id')
  @RequirePermission('view_suppliers')
  @ApiOperation({
    summary: 'Get supplier details by ID',
    description: 'Retrieve detailed information about a specific supplier by account ID (UUID). Returns supplier account details, user information, and relationship data. The supplier must be associated with the user\'s default account.',
  })
  @ApiParam({
    name: 'id',
    description: 'Supplier account ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Supplier fetched successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Supplier fetched successfully.',
      data: {
        supplier: {
          account_id: '550e8400-e29b-41d4-a716-446655440000',
          account_code: 'A_ABC123',
          name: 'Jean Baptiste Uwimana',
          type: 'tenant',
          status: 'active',
          user: {
            id: '660e8400-e29b-41d4-a716-446655440001',
            name: 'Jean Baptiste Uwimana',
            phone: '250788123456',
            email: 'jean.uwimana@example.com',
            nid: '1199887766554433',
            address: 'Kigali, Rwanda',
            account_type: 'supplier',
          },
          relationship: {
            price_per_liter: 390.0,
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
    description: 'Supplier not found or not associated with user\'s account',
    example: {
      code: 404,
      status: 'error',
      message: 'Supplier not found.',
    },
  })
  async getSupplierById(@CurrentUser() user: User, @Param('id') id: string) {
    return this.suppliersService.getSupplierById(user, id);
  }

  @Get(':code')
  @RequirePermission('view_suppliers')
  @ApiOperation({
    summary: 'Get supplier details by code',
    description: 'Retrieve details of a specific supplier by account code. Returns supplier information and relationship details.',
  })
  @ApiParam({
    name: 'code',
    description: 'Supplier account code',
    example: 'A_ABC123',
  })
  @ApiResponse({
    status: 200,
    description: 'Supplier fetched successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Supplier fetched successfully.',
      data: {
        supplier: {
          account_id: 'account-uuid',
          account_code: 'A_ABC123',
          name: 'John Doe',
          type: 'tenant',
          status: 'active',
          user: {
            id: 'user-uuid',
            name: 'John Doe',
            phone: '250788123456',
            email: 'supplier@example.com',
            nid: '1199887766554433',
            address: 'Kigali, Rwanda',
            account_type: 'supplier',
          },
          relationship: {
            price_per_liter: 390.0,
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
    description: 'Supplier account not found',
    example: {
      code: 404,
      status: 'error',
      message: 'Supplier account not found.',
    },
  })
  async getSupplier(@CurrentUser() user: User, @Param('code') code: string) {
    return this.suppliersService.getSupplier(user, code);
  }

  @Put('update')
  @RequirePermission('update_suppliers')
  @ApiOperation({
    summary: 'Update supplier relationship',
    description: 'Update supplier relationship details including price per liter and relationship status.',
  })
  @ApiBody({
    type: UpdateSupplierDto,
    description: 'Supplier update data',
    examples: {
      updatePrice: {
        summary: 'Update price per liter',
        value: {
          supplier_account_code: 'A_ABC123',
          price_per_liter: 400.0,
          bank_name: 'Bank of Kigali',
          bank_account_number: '0123456789012',
        },
      },
      updateStatus: {
        summary: 'Update relationship status',
        value: {
          supplier_account_code: 'A_ABC123',
          relationship_status: 'inactive',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Supplier updated successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Supplier updated successfully.',
      data: {
        supplier: {
          account_code: 'A_ABC123',
          price_per_liter: 410.0,
          relationship_status: 'active',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request - no fields to update or supplier not found',
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
    description: 'Supplier relationship not found',
    example: {
      code: 404,
      status: 'error',
      message: 'Supplier relationship not found.',
    },
  })
  async updateSupplier(@CurrentUser() user: User, @Body() updateDto: UpdateSupplierDto) {
    return this.suppliersService.updateSupplier(user, updateDto);
  }

  @Delete(':code')
  @RequirePermission('update_suppliers')
  @ApiOperation({
    summary: 'Delete supplier relationship',
    description: 'Delete (deactivate) a supplier relationship. This sets the relationship status to inactive.',
  })
  @ApiParam({
    name: 'code',
    description: 'Supplier account code',
    example: 'A_ABC123',
  })
  @ApiResponse({
    status: 200,
    description: 'Supplier relationship deleted successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Supplier relationship deleted successfully.',
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
    description: 'Supplier relationship not found',
    example: {
      code: 404,
      status: 'error',
      message: 'Supplier relationship not found.',
    },
  })
  async deleteSupplier(@CurrentUser() user: User, @Param('code') code: string) {
    return this.suppliersService.deleteSupplier(user, code);
  }
}
