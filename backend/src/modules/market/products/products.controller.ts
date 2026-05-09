import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam, ApiQuery, ApiBadRequestResponse, ApiUnauthorizedResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { TokenGuard } from '../../../common/guards/token.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { User } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@ApiTags('Market - Products')
@Controller('market/products')
@UseGuards(TokenGuard)
@ApiBearerAuth()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Create product',
    description: 'Create a new product listing in the market. Products can be dairy products, feed, equipment, or other agricultural items.',
  })
  @ApiBody({
    type: CreateProductDto,
    description: 'Product creation data',
  })
  @ApiResponse({
    status: 200,
    description: 'Product created successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Product created successfully.',
      data: {
        product: {
          id: 'product-uuid',
          name: 'Fresh Milk',
          description: 'Fresh cow milk',
          price: 800,
          category_id: 1,
          status: 'active',
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid request data.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  async createProduct(@CurrentUser() user: User, @Body() createDto: CreateProductDto) {
    return this.productsService.createProduct(user, createDto);
  }

  @Get()
  @ApiOperation({
    summary: 'List products',
    description: 'Retrieve a list of products. Can be filtered by status (active, inactive, etc.).',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter products by status (active, inactive, etc.)',
    example: 'active',
  })
  @ApiResponse({
    status: 200,
    description: 'Products fetched successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Products fetched successfully.',
      data: {
        products: [],
        total: 0,
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  async getProducts(@CurrentUser() user: User, @Query('status') status?: string) {
    return this.productsService.getProducts(user, { status });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get product details',
    description: 'Retrieve detailed information about a specific product by ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'Product ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Product fetched successfully',
  })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  async getProduct(@CurrentUser() user: User, @Param('id') id: string) {
    return this.productsService.getProduct(user, id);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update product',
    description: 'Update product information including name, description, price, and status.',
  })
  @ApiParam({
    name: 'id',
    description: 'Product ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiBody({ type: UpdateProductDto })
  @ApiResponse({
    status: 200,
    description: 'Product updated successfully',
  })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  async updateProduct(@CurrentUser() user: User, @Param('id') id: string, @Body() updateDto: UpdateProductDto) {
    return this.productsService.updateProduct(user, id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete product',
    description: 'Delete a product listing. This action is permanent.',
  })
  @ApiParam({
    name: 'id',
    description: 'Product ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Product deleted successfully',
  })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  async deleteProduct(@CurrentUser() user: User, @Param('id') id: string) {
    return this.productsService.deleteProduct(user, id);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search products',
    description: 'Search for products by name, description, or other criteria. Returns matching products.',
  })
  @ApiQuery({
    name: 'q',
    description: 'Search query string',
    required: true,
    example: 'milk',
  })
  @ApiResponse({
    status: 200,
    description: 'Products searched successfully',
  })
  @ApiBadRequestResponse({ description: 'Search query is required.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  async searchProducts(@CurrentUser() user: User, @Query('q') query: string) {
    return this.productsService.searchProducts(user, query);
  }

  @Get('featured')
  @ApiOperation({
    summary: 'Get featured products',
    description: 'Retrieve a list of featured products. Featured products are typically highlighted or promoted items.',
  })
  @ApiResponse({
    status: 200,
    description: 'Featured products fetched successfully',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  async getFeaturedProducts(@CurrentUser() user: User) {
    return this.productsService.getFeaturedProducts(user);
  }

  @Get('recent')
  @ApiOperation({
    summary: 'Get recent products',
    description: 'Retrieve recently added or updated products, ordered by creation date.',
  })
  @ApiResponse({
    status: 200,
    description: 'Recent products fetched successfully',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  async getRecentProducts(@CurrentUser() user: User) {
    return this.productsService.getRecentProducts(user);
  }
}

