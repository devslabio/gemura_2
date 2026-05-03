import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery, ApiBody, ApiBadRequestResponse, ApiUnauthorizedResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { InventoryService } from './inventory.service';
import { TokenGuard } from '../../common/guards/token.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User } from '@prisma/client';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { ToggleListingDto } from './dto/toggle-listing.dto';
import { CreateInventorySaleDto } from './dto/create-inventory-sale.dto';
import { BulkCreateInventoryDto } from './dto/bulk-create-inventory.dto';

@ApiTags('Inventory')
@Controller('inventory')
@UseGuards(TokenGuard, PermissionGuard)
@ApiBearerAuth()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @RequirePermission('view_inventory')
  @ApiOperation({
    summary: 'Get inventory items',
    description: 'Retrieve a list of inventory items for the current user\'s default account. Can be filtered by status and low stock alerts. Data is scoped to the user\'s default account.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['active', 'inactive', 'out_of_stock'],
    description: 'Filter by inventory status',
    example: 'active',
  })
  @ApiQuery({
    name: 'low_stock',
    required: false,
    type: Boolean,
    description: 'Filter items with low stock (set to true)',
    example: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Inventory items retrieved successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Inventory items retrieved successfully.',
      data: [
        {
          id: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
          name: 'Fresh Milk 500ml',
          description: 'Fresh pasteurized milk',
          category: 'Dairy',
          unit: 'bottle',
          quantity: 150,
          min_stock_level: 50,
          unit_price: 800,
          status: 'active',
          is_listed: true,
          created_at: '2025-01-20T10:00:00Z',
          updated_at: '2025-01-20T10:00:00Z',
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
    description: 'Unauthorized - invalid or missing token',
    example: {
      code: 401,
      status: 'error',
      message: 'Access denied. Token is required.',
    },
  })
  async getInventory(
    @CurrentUser() user: User,
    @Query('account_id') accountId?: string,
    @Query('status') status?: string,
    @Query('low_stock') lowStock?: string,
  ) {
    return this.inventoryService.getInventory(user, {
      status,
      low_stock: lowStock === 'true',
    }, accountId);
  }

  @Get('stats')
  @RequirePermission('view_inventory')
  @ApiOperation({
    summary: 'Get inventory statistics',
    description: 'Retrieve aggregated statistics about inventory for the user\'s default account including total items, stock levels, low stock alerts, and value summaries.',
  })
  @ApiQuery({
    name: 'account_id',
    required: false,
    description: 'Account UUID. If omitted, uses the authenticated user\'s default account.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Inventory statistics retrieved successfully',
    schema: {
      example: {
        code: 200,
        status: 'success',
        message: 'Inventory statistics retrieved successfully.',
        data: {
          total_items: 25,
          active_items: 20,
          out_of_stock_items: 2,
          listed_in_marketplace: 15,
          low_stock_items: 5,
          total_stock_value: 1250000,
          total_stock_quantity: 1250,
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'No default account found or account access denied',
    schema: { example: { code: 400, status: 'error', message: 'No valid default account found. Please set a default account.' } },
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - invalid or missing token',
    schema: { example: { code: 401, status: 'error', message: 'Access denied. Token is required.' } },
  })
  async getInventoryStats(@CurrentUser() user: User, @Query('account_id') accountId?: string) {
    return this.inventoryService.getInventoryStats(user, accountId);
  }

  @Get('stats/valuation-over-time')
  @RequirePermission('view_inventory')
  @ApiOperation({
    summary: 'Get inventory valuation over time',
    description: 'Returns stock valuation (total value and quantity) for the account. Currently returns a single snapshot (as of today); historical series can be added when daily snapshots are stored. Used by the dashboard "Stock value over time" chart.',
  })
  @ApiQuery({
    name: 'date_from',
    required: true,
    description: 'Start of the period (YYYY-MM-DD). Used for future historical series.',
    example: '2025-01-01',
  })
  @ApiQuery({
    name: 'date_to',
    required: true,
    description: 'End of the period (YYYY-MM-DD).',
    example: '2025-01-31',
  })
  @ApiQuery({
    name: 'account_id',
    required: false,
    description: 'Account UUID. If omitted, uses the authenticated user\'s default account.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Valuation series (one or more points: date, total_value, total_quantity)',
    schema: {
      example: {
        code: 200,
        status: 'success',
        message: 'Valuation over time (current snapshot; historical API can be added).',
        data: {
          series: [
            { date: '2025-01-31', total_value: 1250000, total_quantity: 1250 },
          ],
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Missing date params or invalid account',
    schema: { example: { code: 400, status: 'error', message: 'No valid default account found.' } },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing token',
    schema: { example: { code: 401, status: 'error', message: 'Access denied. Token is required.' } },
  })
  async getValuationOverTime(
    @CurrentUser() user: User,
    @Query('date_from') dateFrom: string,
    @Query('date_to') dateTo: string,
    @Query('account_id') accountId?: string,
  ) {
    return this.inventoryService.getValuationOverTime(user, dateFrom, dateTo, accountId);
  }

  @Get('stats/top-by-value')
  @RequirePermission('view_inventory')
  @ApiOperation({
    summary: 'Get top inventory items by stock value',
    description: 'Returns inventory items sorted by stock value (price × quantity) descending. Used by the dashboard "Top items by value" chart. Only includes non-inactive items.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of items to return. Default: 10.',
    example: '10',
  })
  @ApiQuery({
    name: 'account_id',
    required: false,
    description: 'Account UUID. If omitted, uses the authenticated user\'s default account.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'List of top items with id, name, price, stock_quantity, stock_value',
    schema: {
      example: {
        code: 200,
        status: 'success',
        message: 'Top items by value.',
        data: {
          items: [
            { id: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e', name: 'Fresh Milk 500ml', price: 800, stock_quantity: 150, stock_value: 120000 },
            { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', name: 'Yogurt 250ml', price: 500, stock_quantity: 80, stock_value: 40000 },
          ],
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid account or limit',
    schema: { example: { code: 400, status: 'error', message: 'No valid default account found.' } },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing token',
    schema: { example: { code: 401, status: 'error', message: 'Access denied. Token is required.' } },
  })
  async getTopByValue(
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
    @Query('account_id') accountId?: string,
  ) {
    return this.inventoryService.getTopByValue(user, limit ? parseInt(limit, 10) : 10, accountId);
  }

  @Get('stats/stock-movement')
  @RequirePermission('view_inventory')
  @ApiOperation({
    summary: 'Get stock movement (in/out) by date',
    description: 'Returns daily stock movement: stock_out is aggregated from inventory sales; stock_in is reserved for future use (e.g. stock receipts). Used by the dashboard "Stock movement" chart. Scoped to the account\'s products.',
  })
  @ApiQuery({
    name: 'date_from',
    required: true,
    description: 'Start date of the period (YYYY-MM-DD).',
    example: '2025-01-01',
  })
  @ApiQuery({
    name: 'date_to',
    required: true,
    description: 'End date of the period (YYYY-MM-DD).',
    example: '2025-01-31',
  })
  @ApiQuery({
    name: 'account_id',
    required: false,
    description: 'Account UUID. If omitted, uses the authenticated user\'s default account.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Series of { date, stock_in, stock_out } per day',
    schema: {
      example: {
        code: 200,
        status: 'success',
        message: 'Stock movement (out from sales).',
        data: {
          series: [
            { date: '2025-01-15', stock_in: 0, stock_out: 25 },
            { date: '2025-01-18', stock_in: 0, stock_out: 10 },
          ],
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Missing date params or invalid account',
    schema: { example: { code: 400, status: 'error', message: 'No valid default account found.' } },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing token',
    schema: { example: { code: 401, status: 'error', message: 'Access denied. Token is required.' } },
  })
  async getStockMovement(
    @CurrentUser() user: User,
    @Query('date_from') dateFrom: string,
    @Query('date_to') dateTo: string,
    @Query('account_id') accountId?: string,
  ) {
    return this.inventoryService.getStockMovement(user, dateFrom, dateTo, accountId);
  }

  @Get('template')
  @RequirePermission('view_inventory')
  @ApiOperation({
    summary: 'Download inventory CSV template',
    description: 'Returns a CSV file with header row and one example row for bulk import.',
  })
  @ApiResponse({
    status: 200,
    description: 'CSV template file',
    headers: {
      'Content-Disposition': { description: 'attachment; filename="inventory-template.csv"', schema: { type: 'string' } },
      'Content-Type': { description: 'text/csv; charset=utf-8', schema: { type: 'string' } },
    },
  })
  async getTemplate(@Res() res: Response) {
    const csv =
      'name,description,price,stock_quantity,min_stock_level\n' +
      'Fresh Milk 500ml,Fresh pasteurized milk,800,100,50';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory-template.csv"');
    res.send(csv);
  }

  @Get('movements')
  @RequirePermission('view_inventory')
  @ApiOperation({
    summary: 'Get all inventory movements',
    description: 'Returns paginated list of stock movements across all inventory items. Scoped to account_id (or user default). Optional filters: product_id, movement_type, date_from, date_to.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'account_id', required: false, type: String, description: 'Account UUID (default: user\'s default account)' })
  @ApiQuery({ name: 'product_id', required: false, type: String, description: 'Filter by product UUID' })
  @ApiQuery({ name: 'movement_type', required: false, enum: ['sale_out', 'adjustment_in', 'adjustment_out', 'purchase_in', 'transfer_in', 'transfer_out'] })
  @ApiQuery({ name: 'date_from', required: false, type: String, description: 'Filter from date (ISO)' })
  @ApiQuery({ name: 'date_to', required: false, type: String, description: 'Filter to date (ISO)' })
  @ApiResponse({ status: 200, description: 'Movements retrieved successfully.' })
  @ApiBadRequestResponse({ description: 'No valid default account' })
  async getAllMovements(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('account_id') accountId?: string,
    @Query('product_id') productId?: string,
    @Query('movement_type') movementType?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    return this.inventoryService.getMovementsAll(user, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      account_id: accountId,
      product_id: productId,
      movement_type: movementType,
      date_from: dateFrom,
      date_to: dateTo,
    });
  }

  @Get(':id/movements')
  @RequirePermission('view_inventory')
  @ApiOperation({
    summary: 'Get inventory movements for a product',
    description: 'Returns paginated list of stock movements for the given product. Scoped to account_id (or user default).',
  })
  @ApiParam({ name: 'id', description: 'Product ID (UUID)', type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'account_id', required: false, type: String, description: 'Account UUID (default: user\'s default account)' })
  @ApiQuery({ name: 'movement_type', required: false, enum: ['sale_out', 'adjustment_in', 'adjustment_out', 'purchase_in', 'transfer_in', 'transfer_out'] })
  @ApiQuery({ name: 'date_from', required: false, type: String, description: 'Filter from date (ISO)' })
  @ApiQuery({ name: 'date_to', required: false, type: String, description: 'Filter to date (ISO)' })
  @ApiResponse({
    status: 200,
    description: 'Movements retrieved successfully',
    schema: {
      example: {
        code: 200,
        status: 'success',
        message: 'Movements retrieved successfully.',
        data: {
          items: [
            {
              id: 'movement-uuid',
              product_id: 'product-uuid',
              movement_type: 'sale_out',
              quantity: 5,
              reference_type: 'inventory_sale',
              reference_id: 'sale-uuid',
              description: 'Sale to John (A_ABC)',
              unit_price: 800,
              created_at: '2025-01-20T10:00:00Z',
              created_by: { id: 'user-uuid', name: 'Admin' },
            },
          ],
          pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'No valid default account' })
  @ApiNotFoundResponse({ description: 'Inventory item not found' })
  async getMovements(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('account_id') accountId?: string,
    @Query('movement_type') movementType?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    return this.inventoryService.getMovements(user, id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      account_id: accountId,
      movement_type: movementType,
      date_from: dateFrom,
      date_to: dateTo,
    });
  }

  @Get(':id')
  @RequirePermission('view_inventory')
  @ApiOperation({
    summary: 'Get inventory item by ID',
    description: 'Retrieve detailed information about a specific inventory item by its ID. The item must belong to the user\'s default account.',
  })
  @ApiParam({
    name: 'id',
    description: 'Product ID (UUID)',
    example: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Inventory item fetched successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Inventory item fetched successfully.',
      data: {
        id: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
        name: 'Fresh Milk 500ml',
        description: 'Fresh pasteurized milk',
        category: 'Dairy',
        unit: 'bottle',
        quantity: 150,
        min_stock_level: 50,
        unit_price: 800,
        status: 'active',
        is_listed: true,
        created_at: '2025-01-20T10:00:00Z',
        updated_at: '2025-01-20T10:00:00Z',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid UUID format or no default account',
    example: {
      code: 400,
      status: 'error',
      message: 'No valid default account found. Please set a default account.',
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
  @ApiNotFoundResponse({
    description: 'Inventory item not found',
    example: {
      code: 404,
      status: 'error',
      message: 'Inventory item not found.',
    },
  })
  async getInventoryItem(@CurrentUser() user: User, @Param('id') id: string, @Query('account_id') accountId?: string) {
    return this.inventoryService.getInventoryItem(user, id, accountId);
  }

  @Post()
  @RequirePermission('manage_inventory')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Create inventory item',
    description: 'Create a new inventory item (product) in the system. The item will be associated with the current user\'s default account. Requires name, unit, and initial quantity.',
  })
  @ApiBody({
    type: CreateInventoryDto,
    description: 'Inventory item details',
    examples: {
      createItem: {
        summary: 'Create new inventory item',
        value: {
          name: 'Fresh Milk 500ml',
          description: 'Fresh pasteurized milk',
          category: 'Dairy',
          unit: 'bottle',
          quantity: 100,
          min_stock_level: 50,
          unit_price: 800,
        },
      },
      minimalItem: {
        summary: 'Create item with minimal info',
        value: {
          name: 'Yogurt 250ml',
          unit: 'bottle',
          quantity: 50,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Inventory item created successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Inventory item created successfully.',
      data: {
        id: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
        name: 'Fresh Milk 500ml',
        description: 'Fresh pasteurized milk',
        category: 'Dairy',
        unit: 'bottle',
        quantity: 100,
        min_stock_level: 50,
        unit_price: 800,
        status: 'active',
        is_listed: false,
        created_at: '2025-01-28T10:00:00Z',
        updated_at: '2025-01-28T10:00:00Z',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Bad request - validation failed or no default account',
    examples: {
      validationError: {
        summary: 'Validation failed',
        value: {
          code: 400,
          status: 'error',
          message: 'Name, unit, and quantity are required.',
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
    description: 'Unauthorized - invalid or missing token',
    example: {
      code: 401,
      status: 'error',
      message: 'Access denied. Token is required.',
    },
  })
  async createInventoryItem(@CurrentUser() user: User, @Body() createDto: CreateInventoryDto) {
    return this.inventoryService.createInventoryItem(user, createDto);
  }

  @Post('bulk')
  @RequirePermission('manage_inventory')
  @ApiOperation({
    summary: 'Bulk create inventory items',
    description: 'Create multiple inventory items from an array. Returns success count and per-row errors.',
  })
  @ApiBody({ type: BulkCreateInventoryDto })
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
  async bulkCreateInventoryItems(@CurrentUser() user: User, @Body() body: BulkCreateInventoryDto) {
    const result = await this.inventoryService.bulkCreateInventoryItems(user, body.rows);
    return {
      code: 200,
      status: 'success',
      message: 'Bulk import completed.',
      data: result,
    };
  }

  @Put(':id')
  @RequirePermission('manage_inventory')
  @ApiOperation({
    summary: 'Update inventory item',
    description: 'Update details of an existing inventory item. Only items belonging to the user\'s default account can be updated.',
  })
  @ApiParam({
    name: 'id',
    description: 'Product ID (UUID)',
    example: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
    type: String,
  })
  @ApiBody({
    type: UpdateInventoryDto,
    description: 'Inventory item update data',
    examples: {
      updatePrice: {
        summary: 'Update price',
        value: {
          unit_price: 850,
        },
      },
      updateAll: {
        summary: 'Update multiple fields',
        value: {
          name: 'Fresh Milk 500ml Premium',
          description: 'Premium fresh pasteurized milk',
          category: 'Dairy',
          min_stock_level: 75,
          unit_price: 900,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Inventory item updated successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Inventory item updated successfully.',
      data: {
        id: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
        name: 'Fresh Milk 500ml Premium',
        unit_price: 900,
        updated_at: '2025-01-28T10:00:00Z',
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
    description: 'Unauthorized - invalid or missing token',
    example: {
      code: 401,
      status: 'error',
      message: 'Access denied. Token is required.',
    },
  })
  @ApiNotFoundResponse({
    description: 'Inventory item not found',
    example: {
      code: 404,
      status: 'error',
      message: 'Inventory item not found.',
    },
  })
  async updateInventoryItem(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() updateDto: UpdateInventoryDto,
  ) {
    return this.inventoryService.updateInventoryItem(user, id, updateDto);
  }

  @Put(':id/stock')
  @RequirePermission('manage_inventory')
  @ApiOperation({
    summary: 'Update stock quantity',
    description: 'Update the stock quantity of an inventory item. Can be used to add stock (positive value) or adjust stock levels. Only items belonging to the user\'s default account can be updated.',
  })
  @ApiParam({
    name: 'id',
    description: 'Product ID (UUID)',
    example: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
    type: String,
  })
  @ApiBody({
    type: UpdateStockDto,
    description: 'New absolute stock quantity. Optional notes are stored on the inventory movement record.',
    examples: {
      addStock: {
        summary: 'Set stock (e.g. after receiving shipment)',
        value: {
          stock_quantity: 150,
          notes: 'New shipment received',
        },
      },
      adjustStock: {
        summary: 'Set stock (e.g. after damage count)',
        value: {
          stock_quantity: 140,
          notes: 'Damaged items removed',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Stock updated successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Stock updated successfully.',
      data: {
        id: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
        name: 'Fresh Milk 500ml',
        quantity: 200,
        previous_quantity: 150,
        updated_at: '2025-01-28T10:00:00Z',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request or insufficient stock',
    examples: {
      invalidQuantity: {
        summary: 'Invalid quantity',
        value: {
          code: 400,
          status: 'error',
          message: 'Quantity adjustment would result in negative stock.',
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
    description: 'Unauthorized - invalid or missing token',
    example: {
      code: 401,
      status: 'error',
      message: 'Access denied. Token is required.',
    },
  })
  @ApiNotFoundResponse({
    description: 'Inventory item not found',
    example: {
      code: 404,
      status: 'error',
      message: 'Inventory item not found.',
    },
  })
  async updateStock(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() updateStockDto: UpdateStockDto,
  ) {
    return this.inventoryService.updateStock(user, id, updateStockDto);
  }

  @Post(':id/toggle-listing')
  @RequirePermission('manage_inventory')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Toggle marketplace listing',
    description: 'Toggle whether an inventory item is listed on the marketplace. When listed, the item becomes visible to other users for purchase.',
  })
  @ApiParam({
    name: 'id',
    description: 'Product ID (UUID)',
    example: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
    type: String,
  })
  @ApiBody({
    type: ToggleListingDto,
    description: 'Listing toggle data',
    examples: {
      listItem: {
        summary: 'List item on marketplace',
        value: {
          is_listed: true,
        },
      },
      unlistItem: {
        summary: 'Remove item from marketplace',
        value: {
          is_listed: false,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Marketplace listing toggled successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Marketplace listing toggled successfully.',
      data: {
        id: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
        name: 'Fresh Milk 500ml',
        is_listed: true,
        updated_at: '2025-01-28T10:00:00Z',
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
    description: 'Unauthorized - invalid or missing token',
    example: {
      code: 401,
      status: 'error',
      message: 'Access denied. Token is required.',
    },
  })
  @ApiNotFoundResponse({
    description: 'Inventory item not found',
    example: {
      code: 404,
      status: 'error',
      message: 'Inventory item not found.',
    },
  })
  async toggleMarketplaceListing(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() toggleDto: ToggleListingDto,
  ) {
    return this.inventoryService.toggleMarketplaceListing(user, id, toggleDto);
  }

  @Delete(':id')
  @RequirePermission('manage_inventory')
  @ApiOperation({
    summary: 'Delete inventory item (soft delete)',
    description: 'Soft delete an inventory item by setting its status to inactive. The item will no longer appear in active listings but can be restored. Only items belonging to the user\'s default account can be deleted.',
  })
  @ApiParam({
    name: 'id',
    description: 'Product ID (UUID)',
    example: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Inventory item deleted successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Inventory item deleted successfully.',
      data: {
        id: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
        name: 'Fresh Milk 500ml',
        status: 'inactive',
        deleted_at: '2025-01-28T10:00:00Z',
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
    description: 'Unauthorized - invalid or missing token',
    example: {
      code: 401,
      status: 'error',
      message: 'Access denied. Token is required.',
    },
  })
  @ApiNotFoundResponse({
    description: 'Inventory item not found',
    example: {
      code: 404,
      status: 'error',
      message: 'Inventory item not found.',
    },
  })
  async deleteInventoryItem(@CurrentUser() user: User, @Param('id') id: string) {
    return this.inventoryService.deleteInventoryItem(user, id);
  }

  @Post(':id/sell')
  @RequirePermission('manage_inventory')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Sell inventory item',
    description: 'Record a sale of an inventory item to a customer. This will update stock levels, create a sales record, and update accounting transactions. The sale is scoped to the user\'s default account.',
  })
  @ApiParam({
    name: 'id',
    description: 'Product ID (UUID)',
    example: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
    type: String,
  })
  @ApiBody({
    type: CreateInventorySaleDto,
    description: 'Sale details',
    examples: {
      sellItem: {
        summary: 'Sell inventory item',
        value: {
          buyer_account_id: '550e8400-e29b-41d4-a716-446655440000',
          quantity: 10,
          unit_price: 800,
          notes: 'Sale to customer',
        },
      },
      sellWithCode: {
        summary: 'Sell using account code',
        value: {
          buyer_account_code: 'A_XYZ789',
          quantity: 5,
          unit_price: 850,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Inventory item sold successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Inventory item sold successfully.',
      data: {
        sale_id: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
        inventory_item_id: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
        buyer_account_id: '550e8400-e29b-41d4-a716-446655440000',
        quantity: 10,
        unit_price: 800,
        total_amount: 8000,
        remaining_stock: 140,
        sale_date: '2025-01-28T10:00:00Z',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Bad request - validation failed or business rule violation',
    examples: {
      insufficientStock: {
        summary: 'Insufficient stock',
        value: {
          code: 400,
          status: 'error',
          message: 'Insufficient stock. Available: 5, Requested: 10',
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
      missingBuyer: {
        summary: 'Missing buyer identifier',
        value: {
          code: 400,
          status: 'error',
          message: 'Either buyer_account_id or buyer_account_code is required.',
        },
      },
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
  @ApiNotFoundResponse({
    description: 'Inventory item or buyer account not found',
    examples: {
      itemNotFound: {
        summary: 'Item not found',
        value: {
          code: 404,
          status: 'error',
          message: 'Inventory item not found.',
        },
      },
      buyerNotFound: {
        summary: 'Buyer not found',
        value: {
          code: 404,
          status: 'error',
          message: 'Buyer account not found.',
        },
      },
    },
  })
  async sellInventoryItem(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() createSaleDto: CreateInventorySaleDto,
  ) {
    return this.inventoryService.sellInventoryItem(user, id, createSaleDto);
  }
}
