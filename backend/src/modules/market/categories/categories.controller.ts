import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { TokenGuard } from '../../../common/guards/token.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { User } from '@prisma/client';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('Market - Categories')
@Controller('market/categories')
@UseGuards(TokenGuard)
@ApiBearerAuth()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Create category' })
  @ApiBody({ type: CreateCategoryDto })
  @ApiResponse({ status: 200, description: 'Category created successfully.' })
  async createCategory(@CurrentUser() user: User, @Body() createDto: CreateCategoryDto) {
    return this.categoriesService.createCategory(user, createDto);
  }

  @Get()
  @ApiOperation({ summary: 'List categories' })
  @ApiResponse({ status: 200, description: 'Categories fetched successfully.' })
  async getCategories(@CurrentUser() user: User) {
    return this.categoriesService.getCategories(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Category fetched successfully.' })
  async getCategory(@CurrentUser() user: User, @Param('id') id: string) {
    return this.categoriesService.getCategory(user, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update category' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateCategoryDto })
  @ApiResponse({ status: 200, description: 'Category updated successfully.' })
  async updateCategory(@CurrentUser() user: User, @Param('id') id: string, @Body() updateDto: UpdateCategoryDto) {
    return this.categoriesService.updateCategory(user, id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete category' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Category deleted successfully.' })
  async deleteCategory(@CurrentUser() user: User, @Param('id') id: string) {
    return this.categoriesService.deleteCategory(user, id);
  }
}

