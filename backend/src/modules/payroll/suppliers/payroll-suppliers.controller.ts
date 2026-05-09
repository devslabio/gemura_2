import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam, ApiUnauthorizedResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { PayrollSuppliersService } from './payroll-suppliers.service';
import { TokenGuard } from '../../../common/guards/token.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { User } from '@prisma/client';
import { CreatePayrollSupplierDto } from './dto/create-payroll-supplier.dto';
import { UpdatePayrollSupplierDto } from './dto/update-payroll-supplier.dto';

@ApiTags('Payroll - Suppliers')
@Controller('payroll/suppliers')
@UseGuards(TokenGuard)
@ApiBearerAuth()
export class PayrollSuppliersController {
  constructor(private readonly payrollSuppliersService: PayrollSuppliersService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Create payroll supplier', description: 'Add a supplier to payroll processing (links account to payroll).' })
  @ApiBody({ type: CreatePayrollSupplierDto })
  @ApiResponse({ status: 200, description: 'Supplier created successfully.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing token.' })
  async createSupplier(@CurrentUser() user: User, @Body() createDto: CreatePayrollSupplierDto) {
    return this.payrollSuppliersService.createSupplier(user, createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get payroll suppliers', description: 'List all suppliers configured for payroll for the default account.' })
  @ApiResponse({ status: 200, description: 'Suppliers fetched successfully.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing token.' })
  async getSuppliers(@CurrentUser() user: User) {
    return this.payrollSuppliersService.getSuppliers(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payroll supplier by ID' })
  @ApiParam({ name: 'id', description: 'Payroll supplier ID (UUID).' })
  @ApiResponse({ status: 200, description: 'Supplier fetched successfully.' })
  @ApiNotFoundResponse({ description: 'Supplier not found.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing token.' })
  async getSupplier(@CurrentUser() user: User, @Param('id') id: string) {
    return this.payrollSuppliersService.getSupplier(user, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update payroll supplier' })
  @ApiParam({ name: 'id', description: 'Payroll supplier ID (UUID).' })
  @ApiBody({ type: UpdatePayrollSupplierDto })
  @ApiResponse({ status: 200, description: 'Supplier updated successfully.' })
  @ApiNotFoundResponse({ description: 'Supplier not found.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing token.' })
  async updateSupplier(@CurrentUser() user: User, @Param('id') id: string, @Body() updateDto: UpdatePayrollSupplierDto) {
    return this.payrollSuppliersService.updateSupplier(user, id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete payroll supplier (remove from payroll)' })
  @ApiParam({ name: 'id', description: 'Payroll supplier ID (UUID).' })
  @ApiResponse({ status: 200, description: 'Supplier deleted successfully.' })
  @ApiNotFoundResponse({ description: 'Supplier not found.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing token.' })
  async deleteSupplier(@CurrentUser() user: User, @Param('id') id: string) {
    return this.payrollSuppliersService.deleteSupplier(user, id);
  }
}

