import { Controller, Post, Get, Put, Body, UseGuards, Param, Query, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { TokenGuard } from '../../../common/guards/token.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { User } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';

@ApiTags('Market - Orders')
@Controller('market/orders')
@UseGuards(TokenGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Create order' })
  @ApiBody({ type: CreateOrderDto })
  @ApiResponse({ status: 200, description: 'Order created successfully.' })
  async createOrder(@CurrentUser() user: User, @Body() createDto: CreateOrderDto) {
    return this.ordersService.createOrder(user, createDto);
  }

  @Get()
  @ApiOperation({ summary: 'List orders' })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200, description: 'Orders fetched successfully.' })
  async getOrders(@CurrentUser() user: User, @Query('status') status?: string) {
    return this.ordersService.getOrders(user, { status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Order fetched successfully.' })
  async getOrder(@CurrentUser() user: User, @Param('id') id: string) {
    return this.ordersService.getOrder(user, id);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update order status' })
  @ApiParam({ name: 'id' })
  @ApiBody({ schema: { type: 'object', properties: { status: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Order status updated successfully.' })
  async updateOrderStatus(@CurrentUser() user: User, @Param('id') id: string, @Body('status') status: string) {
    return this.ordersService.updateOrderStatus(user, id, status);
  }

  @Get('admin/list')
  @ApiOperation({ summary: 'Admin order list' })
  @ApiResponse({ status: 200, description: 'Orders fetched successfully.' })
  async getAdminOrders(@CurrentUser() user: User) {
    return this.ordersService.getAdminOrders(user);
  }

  @Get('admin/:id')
  @ApiOperation({ summary: 'Admin order details' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Order fetched successfully.' })
  async getAdminOrder(@CurrentUser() user: User, @Param('id') id: string) {
    return this.ordersService.getAdminOrder(user, id);
  }

  @Get('customers/my-orders')
  @ApiOperation({ summary: 'Get customer orders' })
  @ApiResponse({ status: 200, description: 'Orders fetched successfully.' })
  async getCustomerOrders(@CurrentUser() user: User) {
    return this.ordersService.getCustomerOrders(user);
  }

  @Get('customers/my-order-details')
  @ApiOperation({ summary: 'Get customer order details' })
  @ApiQuery({ name: 'order_id', required: true })
  @ApiResponse({ status: 200, description: 'Order fetched successfully.' })
  async getCustomerOrderDetails(@CurrentUser() user: User, @Query('order_id') orderId: string) {
    return this.ordersService.getCustomerOrderDetails(user, orderId);
  }

  @Post('customers/place-order')
  @HttpCode(200)
  @ApiOperation({ summary: 'Place order' })
  @ApiBody({ type: CreateOrderDto })
  @ApiResponse({ status: 200, description: 'Order placed successfully.' })
  async placeOrder(@CurrentUser() user: User, @Body() createDto: CreateOrderDto) {
    return this.ordersService.placeOrder(user, createDto);
  }

  @Post('customers/cancel-order')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel order' })
  @ApiBody({ schema: { type: 'object', properties: { order_id: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Order cancelled successfully.' })
  async cancelOrder(@CurrentUser() user: User, @Body('order_id') orderId: string) {
    return this.ordersService.cancelOrder(user, orderId);
  }

  @Get('sellers/orders')
  @ApiOperation({ summary: 'Get seller orders' })
  @ApiResponse({ status: 200, description: 'Orders fetched successfully.' })
  async getSellerOrders(@CurrentUser() user: User) {
    return this.ordersService.getSellerOrders(user);
  }

  @Get('sellers/order-details')
  @ApiOperation({ summary: 'Get seller order details' })
  @ApiQuery({ name: 'order_id', required: true })
  @ApiResponse({ status: 200, description: 'Order fetched successfully.' })
  async getSellerOrderDetails(@CurrentUser() user: User, @Query('order_id') orderId: string) {
    return this.ordersService.getSellerOrderDetails(user, orderId);
  }

  @Post('sellers/update-status')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update order status (seller)' })
  @ApiBody({ schema: { type: 'object', properties: { order_id: { type: 'string' }, status: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Order status updated successfully.' })
  async updateSellerOrderStatus(@CurrentUser() user: User, @Body('order_id') orderId: string, @Body('status') status: string) {
    return this.ordersService.updateSellerOrderStatus(user, orderId, status);
  }
}

