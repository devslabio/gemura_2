import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { PayrollPeriodsService } from './payroll-periods.service';
import { TokenGuard } from '../../../common/guards/token.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { User } from '@prisma/client';
import { CreatePayrollPeriodDto } from './dto/create-payroll-period.dto';

@ApiTags('Payroll - Periods')
@Controller('payroll/periods')
@UseGuards(TokenGuard)
@ApiBearerAuth()
export class PayrollPeriodsController {
  constructor(private readonly payrollPeriodsService: PayrollPeriodsService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Create payroll period', description: 'Define a named period (e.g. January 2025) for payroll runs.' })
  @ApiBody({ type: CreatePayrollPeriodDto })
  @ApiResponse({ status: 200, description: 'Period created successfully.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing token.' })
  async createPeriod(@CurrentUser() user: User, @Body() createDto: CreatePayrollPeriodDto) {
    return this.payrollPeriodsService.createPeriod(user, createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get payroll periods', description: 'List all payroll periods for the default account.' })
  @ApiResponse({ status: 200, description: 'Periods fetched successfully.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing token.' })
  async getPeriods(@CurrentUser() user: User) {
    return this.payrollPeriodsService.getPeriods(user);
  }
}

