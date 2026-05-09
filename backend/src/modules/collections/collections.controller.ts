import { Controller, Post, Get, Put, Delete, Body, UseGuards, Param, Query, HttpCode, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiBadRequestResponse, ApiUnauthorizedResponse, ApiNotFoundResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { CollectionsService } from './collections.service';
import { TokenGuard } from '../../common/guards/token.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User } from '@prisma/client';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { BulkCreateCollectionsDto } from './dto/bulk-create-collections.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { CancelCollectionDto } from './dto/cancel-collection.dto';
import { CreateRejectionReasonDto } from './dto/create-rejection-reason.dto';
import { UpdateRejectionReasonDto } from './dto/update-rejection-reason.dto';
import { RecordPaymentDto } from '../accounting/receivables-payables/dto/record-payment.dto';

@ApiTags('Collections')
@Controller('collections')
@UseGuards(TokenGuard, PermissionGuard)
@ApiBearerAuth()
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get('rejection-reasons')
  @RequirePermission('view_collections')
  @ApiOperation({
    summary: 'Get all milk rejection reasons',
    description: 'Returns a list of all active milk rejection reasons ordered by sort order. Use query parameter include_inactive=true to include inactive reasons.',
  })
  @ApiQuery({
    name: 'include_inactive',
    required: false,
    type: String,
    description: 'Set to "true" to include inactive rejection reasons',
    example: 'false',
  })
  @ApiResponse({
    status: 200,
    description: 'Rejection reasons retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'number', example: 200 },
        status: { type: 'string', example: 'success' },
        message: { type: 'string', example: 'Rejection reasons retrieved successfully' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'edd315d2-dc7f-4a21-b58c-810d2295b258' },
              name: { type: 'string', example: 'Added Water' },
              description: { type: 'string', example: 'Water was added to the milk' },
              is_active: { type: 'boolean', example: true },
              sort_order: { type: 'number', example: 1 },
              created_at: { type: 'string', example: '2025-01-19T20:11:54.000Z' },
              updated_at: { type: 'string', example: '2025-01-19T20:11:54.000Z' },
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
      message: 'Invalid query parameter format',
    },
  })
  async getRejectionReasons(@Query('include_inactive') includeInactive?: string) {
    const include = includeInactive === 'true';
    const reasons = await this.collectionsService.getRejectionReasons(include);
    return {
      code: 200,
      status: 'success',
      message: 'Rejection reasons retrieved successfully',
      data: reasons,
    };
  }

  @Get('rejection-reasons/:id')
  @RequirePermission('view_collections')
  @ApiOperation({
    summary: 'Get rejection reason by ID',
    description: 'Returns a single milk rejection reason by its ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Rejection reason ID (UUID)',
    example: 'edd315d2-dc7f-4a21-b58c-810d2295b258',
  })
  @ApiResponse({
    status: 200,
    description: 'Rejection reason retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'number', example: 200 },
        status: { type: 'string', example: 'success' },
        message: { type: 'string', example: 'Rejection reason retrieved successfully' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'edd315d2-dc7f-4a21-b58c-810d2295b258' },
            name: { type: 'string', example: 'Added Water' },
            description: { type: 'string', example: 'Water was added to the milk' },
            is_active: { type: 'boolean', example: true },
            sort_order: { type: 'number', example: 1 },
            created_at: { type: 'string', example: '2025-01-19T20:11:54.000Z' },
            updated_at: { type: 'string', example: '2025-01-19T20:11:54.000Z' },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Rejection reason not found',
    example: {
      code: 404,
      status: 'error',
      message: 'Rejection reason not found',
    },
  })
  async getRejectionReasonById(@Param('id') id: string) {
    const reason = await this.collectionsService.getRejectionReasonById(id);
    return {
      code: 200,
      status: 'success',
      message: 'Rejection reason retrieved successfully',
      data: reason,
    };
  }

  @Post('rejection-reasons')
  @RequirePermission('manage_users')
  @ApiOperation({
    summary: 'Create a new milk rejection reason',
    description: 'Creates a new milk rejection reason. The name must be unique.',
  })
  @ApiBody({
    type: CreateRejectionReasonDto,
    description: 'Rejection reason details',
    examples: {
      addedWater: {
        summary: 'Added Water',
        value: {
          name: 'Added Water',
          description: 'Water was added to the milk',
          sort_order: 1,
        },
      },
      antibiotics: {
        summary: 'Antibiotics',
        value: {
          name: 'Antibiotics',
          description: 'Antibiotic residues detected in milk',
          sort_order: 2,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Rejection reason created successfully',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'number', example: 201 },
        status: { type: 'string', example: 'success' },
        message: { type: 'string', example: 'Rejection reason created successfully' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'edd315d2-dc7f-4a21-b58c-810d2295b258' },
            name: { type: 'string', example: 'Added Water' },
            description: { type: 'string', example: 'Water was added to the milk' },
            is_active: { type: 'boolean', example: true },
            sort_order: { type: 'number', example: 1 },
            created_at: { type: 'string', example: '2025-01-19T20:11:54.000Z' },
            updated_at: { type: 'string', example: '2025-01-19T20:11:54.000Z' },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid input or name already exists',
    examples: {
      invalidInput: {
        summary: 'Invalid input',
        value: {
          code: 400,
          status: 'error',
          message: 'Name is required',
        },
      },
      duplicateName: {
        summary: 'Duplicate name',
        value: {
          code: 400,
          status: 'error',
          message: 'A rejection reason with this name already exists',
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
  async createRejectionReason(@Body() createDto: CreateRejectionReasonDto) {
    const reason = await this.collectionsService.createRejectionReason(createDto);
    return {
      code: 201,
      status: 'success',
      message: 'Rejection reason created successfully',
      data: reason,
    };
  }

  @Put('rejection-reasons/:id')
  @RequirePermission('manage_users')
  @ApiOperation({
    summary: 'Update a milk rejection reason',
    description: 'Updates an existing milk rejection reason. All fields are optional.',
  })
  @ApiParam({
    name: 'id',
    description: 'Rejection reason ID (UUID)',
    example: 'edd315d2-dc7f-4a21-b58c-810d2295b258',
  })
  @ApiBody({
    type: UpdateRejectionReasonDto,
    description: 'Rejection reason update details',
    examples: {
      updateName: {
        summary: 'Update name',
        value: {
          name: 'Water Added',
        },
      },
      deactivate: {
        summary: 'Deactivate reason',
        value: {
          is_active: false,
        },
      },
      updateAll: {
        summary: 'Update all fields',
        value: {
          name: 'Added Water',
          description: 'Water was added to the milk',
          is_active: true,
          sort_order: 1,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Rejection reason updated successfully',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'number', example: 200 },
        status: { type: 'string', example: 'success' },
        message: { type: 'string', example: 'Rejection reason updated successfully' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'edd315d2-dc7f-4a21-b58c-810d2295b258' },
            name: { type: 'string', example: 'Added Water' },
            description: { type: 'string', example: 'Water was added to the milk' },
            is_active: { type: 'boolean', example: true },
            sort_order: { type: 'number', example: 1 },
            created_at: { type: 'string', example: '2025-01-19T20:11:54.000Z' },
            updated_at: { type: 'string', example: '2025-01-19T20:11:54.000Z' },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Rejection reason not found',
    example: {
      code: 404,
      status: 'error',
      message: 'Rejection reason not found',
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid input or name already exists',
    examples: {
      invalidInput: {
        summary: 'Invalid input',
        value: {
          code: 400,
          status: 'error',
          message: 'Invalid input data',
        },
      },
      duplicateName: {
        summary: 'Duplicate name',
        value: {
          code: 400,
          status: 'error',
          message: 'A rejection reason with this name already exists',
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
  async updateRejectionReason(@Param('id') id: string, @Body() updateDto: UpdateRejectionReasonDto) {
    const reason = await this.collectionsService.updateRejectionReason(id, updateDto);
    return {
      code: 200,
      status: 'success',
      message: 'Rejection reason updated successfully',
      data: reason,
    };
  }

  @Delete('rejection-reasons/:id')
  @RequirePermission('manage_users')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Delete a milk rejection reason',
    description: 'Soft deletes a milk rejection reason by setting is_active to false. The reason will no longer appear in active lists but can be reactivated.',
  })
  @ApiParam({
    name: 'id',
    description: 'Rejection reason ID (UUID)',
    example: 'edd315d2-dc7f-4a21-b58c-810d2295b258',
  })
  @ApiResponse({
    status: 200,
    description: 'Rejection reason deleted successfully',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'number', example: 200 },
        status: { type: 'string', example: 'success' },
        message: { type: 'string', example: 'Rejection reason deleted successfully' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e' },
            name: { type: 'string', example: 'Added Water' },
            description: { type: 'string', example: 'Water was added to the milk' },
            is_active: { type: 'boolean', example: false },
            sort_order: { type: 'number', example: 1 },
            created_at: { type: 'string', example: '2025-01-19T20:11:54.000Z' },
            updated_at: { type: 'string', example: '2025-01-19T20:11:54.000Z' },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Rejection reason not found',
    example: {
      code: 404,
      status: 'error',
      message: 'Rejection reason not found',
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
  async deleteRejectionReason(@Param('id') id: string) {
    const reason = await this.collectionsService.deleteRejectionReason(id);
    return {
      code: 200,
      status: 'success',
      message: 'Rejection reason deleted successfully',
      data: reason,
    };
  }

  @Get('supplier-animals')
  @RequirePermission('view_collections')
  @ApiOperation({
    summary: 'Get animals for a supplier',
    description: 'Returns animals belonging to the given supplier account. Only available when the supplier is linked to your account. Use when linking a milk collection to an animal.',
  })
  @ApiQuery({
    name: 'supplier_account_code',
    required: true,
    description: 'Supplier account code',
    example: 'A_ABC123',
    type: String,
  })
  @ApiResponse({ status: 200, description: 'Animals retrieved successfully.' })
  @ApiBadRequestResponse({ description: 'No default account or supplier not linked.' })
  @ApiNotFoundResponse({ description: 'Supplier account not found.' })
  async getSupplierAnimals(@CurrentUser() user: User, @Query('supplier_account_code') supplierAccountCode: string) {
    const data = await this.collectionsService.getSupplierAnimals(user, supplierAccountCode);
    return {
      code: 200,
      status: 'success',
      message: 'Supplier animals retrieved successfully',
      data,
    };
  }

  @Get()
  @RequirePermission('view_collections')
  @ApiOperation({
    summary: 'Get all collections',
    description: 'Retrieve all milk collections for the authenticated user\'s default account (as customer/collector buying from suppliers). Supports filtering by supplier name, status, date range, quantity range, and price range. Data is scoped to the user\'s default account.',
  })
  @ApiQuery({
    name: 'supplier_account_id',
    required: false,
    description: 'Filter by supplier account UUID (exact match). Takes precedence over supplier_name.',
    type: String,
  })
  @ApiQuery({
    name: 'supplier_name',
    required: false,
    description: 'Filter by supplier name using a partial, case-insensitive match',
    example: 'Jean',
    type: String,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by collection status',
    enum: ['pending', 'accepted', 'rejected', 'completed', 'cancelled'],
    example: 'accepted',
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
    name: 'quantity_min',
    required: false,
    description: 'Minimum quantity filter',
    example: 50,
    type: Number,
  })
  @ApiQuery({
    name: 'quantity_max',
    required: false,
    description: 'Maximum quantity filter',
    example: 200,
    type: Number,
  })
  @ApiQuery({
    name: 'price_min',
    required: false,
    description: 'Minimum unit price filter',
    example: 350,
    type: Number,
  })
  @ApiQuery({
    name: 'price_max',
    required: false,
    description: 'Maximum unit price filter',
    example: 450,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Collections fetched successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Collections fetched successfully.',
      data: [
        {
          id: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
          quantity: 120.5,
          unit_price: 390.0,
          total_amount: 46995.0,
          status: 'accepted',
          collection_at: '2025-01-20T10:00:00Z',
          notes: 'Morning collection - good quality',
          payment_status: 'unpaid',
          supplier_account: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            code: 'A_ABC123',
            name: 'Jean Baptiste Uwimana',
            type: 'tenant',
            status: 'active',
          },
          customer_account: {
            id: '660e8400-e29b-41d4-a716-446655440001',
            code: 'A_XYZ789',
            name: 'KOPERATIVE KOZAMGI',
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
  async getCollections(@CurrentUser() user: User, @Query('account_id') accountId?: string, @Query('supplier_account_id') supplierAccountId?: string, @Query('supplier_name') supplierName?: string, @Query('status') status?: string, @Query('date_from') dateFrom?: string, @Query('date_to') dateTo?: string, @Query('quantity_min') quantityMin?: number, @Query('quantity_max') quantityMax?: number, @Query('price_min') priceMin?: number, @Query('price_max') priceMax?: number) {
    const filters: any = {};
    if (supplierAccountId) filters.supplier_account_id = supplierAccountId;
    if (supplierName) filters.supplier_name = supplierName;
    if (status) filters.status = status;
    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;
    if (quantityMin !== undefined) filters.quantity_min = quantityMin;
    if (quantityMax !== undefined) filters.quantity_max = quantityMax;
    if (priceMin !== undefined) filters.price_min = priceMin;
    if (priceMax !== undefined) filters.price_max = priceMax;
    return this.collectionsService.getCollections(user, Object.keys(filters).length > 0 ? filters : undefined, accountId);
  }

  @Post('create')
  @HttpCode(200)
  @RequirePermission('create_collections')
  @ApiOperation({
    summary: 'Record milk collection',
    description: 'Record a milk collection transaction from a supplier. The collection is stored as a milk sale record with quantity, unit price, and status.',
  })
  @ApiBody({
    type: CreateCollectionDto,
    description: 'Milk collection details',
    examples: {
      createCollection: {
        summary: 'Record collection (defaults to accepted)',
        value: {
          supplier_account_code: 'A_ABC123',
          quantity: 120.5,
          collection_at: '2025-01-04 10:00:00',
          notes: 'Morning collection',
        },
      },
      createCollectionWithStatus: {
        summary: 'Record collection with explicit status',
        value: {
          supplier_account_code: 'A_ABC123',
          quantity: 120.5,
          status: 'accepted',
          collection_at: '2025-01-04 10:00:00',
          notes: 'Morning collection',
        },
      },
      minimalCollection: {
        summary: 'Record collection with minimal info',
        value: {
          supplier_account_code: 'A_XYZ789',
          quantity: 85.0,
          collection_at: '2025-01-04 14:30:00',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Milk collection recorded successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Milk collection recorded successfully.',
      data: {
        collection_id: 'uuid-here',
        supplier_account_code: 'A_ABC123',
        customer_account_id: 'account-uuid',
        quantity: 120.5,
        unit_price: 390.0,
        total_amount: 46995.0,
        status: 'accepted',
        collection_at: '2025-01-04 10:00:00',
        payment_status: 'unpaid',
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
      message: 'Access denied. Token is required.',
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
  async createCollection(@CurrentUser() user: User, @Body() createDto: CreateCollectionDto) {
    return this.collectionsService.createCollection(user, createDto);
  }

  @Get('template')
  @RequirePermission('view_collections')
  @ApiOperation({
    summary: 'Download collections CSV template',
    description: 'Returns a CSV file with header row and one example row for bulk import.',
  })
  @ApiResponse({
    status: 200,
    description: 'CSV template file',
    headers: {
      'Content-Disposition': { description: 'attachment; filename="collections-template.csv"', schema: { type: 'string' } },
      'Content-Type': { description: 'text/csv; charset=utf-8', schema: { type: 'string' } },
    },
  })
  async getTemplate(@Res() res: Response) {
    const csv =
      'supplier_account_code,quantity,status,collection_at,notes,payment_status\n' +
      'A_ABC123,120.5,accepted,2025-01-15 10:00:00,Morning collection,unpaid';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="collections-template.csv"');
    res.send(csv);
  }

  @Post('bulk')
  @HttpCode(200)
  @RequirePermission('create_collections')
  @ApiOperation({
    summary: 'Bulk create collections',
    description: 'Create multiple milk collections from an array. Returns success count and per-row errors.',
  })
  @ApiBody({ type: BulkCreateCollectionsDto })
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
  async bulkCreateCollections(@CurrentUser() user: User, @Body() body: BulkCreateCollectionsDto) {
    const result = await this.collectionsService.bulkCreateCollections(user, body.rows);
    return {
      code: 200,
      status: 'success',
      message: 'Bulk import completed.',
      data: result,
    };
  }

  @Delete(':id')
  @RequirePermission('update_collections')
  @ApiOperation({
    summary: 'Delete collection (soft delete)',
    description: 'Soft delete a milk collection by setting status to deleted. This preserves the record for historical purposes. Only collections belonging to the user\'s default account can be deleted.',
  })
  @ApiParam({
    name: 'id',
    description: 'Collection ID (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Collection deleted successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Collection deleted successfully.',
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid collection ID format',
    example: {
      code: 400,
      status: 'error',
      message: 'Invalid collection ID format.',
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
    description: 'Collection not found or not authorized',
    example: {
      code: 404,
      status: 'error',
      message: 'Collection not found or not authorized.',
    },
  })
  async deleteCollection(@CurrentUser() user: User, @Param('id') id: string) {
    return this.collectionsService.deleteCollection(user, id);
  }

  @Get(':id')
  @RequirePermission('view_collections')
  @ApiOperation({
    summary: 'Get collection details',
    description: 'Retrieve details of a specific milk collection by ID. Only collections belonging to the user\'s default account can be accessed.',
  })
  @ApiParam({
    name: 'id',
    description: 'Collection ID',
    example: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
  })
  @ApiResponse({
    status: 200,
    description: 'Collection fetched successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Collection fetched successfully.',
      data: {
        id: 'collection-uuid',
        quantity: 120.5,
        unit_price: 390.0,
        total_amount: 46995.0,
        status: 'accepted',
        collection_at: '2025-01-04T10:00:00Z',
        notes: 'Morning collection',
        supplier_account: {
          id: 'supplier-account-uuid',
          code: 'A_ABC123',
          name: 'Supplier Name',
          type: 'tenant',
          status: 'active',
        },
        customer_account: {
          id: 'customer-account-uuid',
          code: 'A_XYZ789',
          name: 'Customer Name',
          type: 'tenant',
          status: 'active',
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
    description: 'Collection not found or not authorized',
    example: {
      code: 404,
      status: 'error',
      message: 'Collection not found or not authorized.',
    },
  })
  async getCollection(@CurrentUser() user: User, @Param('id') id: string, @Query('account_id') accountId?: string) {
    return this.collectionsService.getCollection(user, id, accountId);
  }

  @Put('update')
  @RequirePermission('update_collections')
  @ApiOperation({
    summary: 'Update collection',
    description: 'Update collection details including quantity, status, date, or notes. Only collections belonging to the user\'s default account can be updated.',
  })
  @ApiBody({
    type: UpdateCollectionDto,
    description: 'Collection update data',
    examples: {
      updateStatus: {
        summary: 'Update collection status',
        value: {
          collection_id: 'collection-uuid',
          status: 'accepted',
        },
      },
      updateQuantity: {
        summary: 'Update quantity and notes',
        value: {
          collection_id: 'collection-uuid',
          quantity: 150.0,
          notes: 'Updated after verification',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Collection updated successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Collection updated successfully.',
      data: {
        id: 'collection-uuid',
        quantity: 150.0,
        unit_price: 410.0,
        total_amount: 61500.0,
        status: 'accepted',
        collection_at: '2025-01-04T10:00:00Z',
        notes: 'Updated after verification',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request - no fields to update',
    example: {
      code: 400,
      status: 'error',
      message: 'No fields to update.',
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing authentication token',
  })
  @ApiNotFoundResponse({
    description: 'Collection not found or not authorized',
  })
  async updateCollection(@CurrentUser() user: User, @Body() updateDto: UpdateCollectionDto) {
    return this.collectionsService.updateCollection(user, updateDto);
  }

  @Post('cancel')
  @HttpCode(200)
  @RequirePermission('update_collections')
  @ApiOperation({
    summary: 'Cancel collection',
    description: 'Cancel a collection by setting its status to "cancelled". Only collections belonging to the user\'s default account can be cancelled.',
  })
  @ApiBody({
    type: CancelCollectionDto,
    description: 'Collection ID to cancel',
    examples: {
      cancelCollection: {
        summary: 'Cancel collection',
        value: {
          collection_id: 'collection-uuid',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Collection cancelled successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Collection cancelled successfully.',
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
    description: 'Collection not found or not authorized',
    example: {
      code: 404,
      status: 'error',
      message: 'Collection not found or not authorized.',
    },
  })
  async cancelCollection(@CurrentUser() user: User, @Body() cancelDto: CancelCollectionDto) {
    return this.collectionsService.cancelCollection(user, cancelDto);
  }

  @Post(':collectionId/payment')
  @HttpCode(200)
  @RequirePermission('update_collections')
  @ApiOperation({
    summary: 'Record payment for a collection',
    description: 'Records a payment against an unpaid/partial collection. Creates journal entry: DR Payable, CR Cash. Supports partial payments.',
  })
  @ApiParam({
    name: 'collectionId',
    description: 'Collection ID (MilkSale ID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: RecordPaymentDto,
    description: 'Payment details',
    examples: {
      fullPayment: {
        summary: 'Full payment',
        value: {
          amount: 70000,
          payment_date: '2025-01-23',
          notes: 'Payment via bank transfer',
        },
      },
      partialPayment: {
        summary: 'Partial payment',
        value: {
          amount: 35000,
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
        collection_id: 'collection-uuid',
        amount_paid: 70000,
        outstanding: 0,
        payment_status: 'paid',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid payment amount or exceeds outstanding balance',
  })
  @ApiNotFoundResponse({
    description: 'Collection not found or user does not have permission',
  })
  async recordPayment(
    @CurrentUser() user: User,
    @Param('collectionId') collectionId: string,
    @Body() paymentDto: RecordPaymentDto,
  ) {
    return this.collectionsService.recordPayment(user, collectionId, paymentDto);
  }
}
