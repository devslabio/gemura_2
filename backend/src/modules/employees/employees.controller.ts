import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiQuery, ApiBadRequestResponse, ApiUnauthorizedResponse, ApiNotFoundResponse, ApiForbiddenResponse, ApiParam } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { TokenGuard } from '../../common/guards/token.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequireAnyPermission, RequirePermission } from '../../common/decorators/permission.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User } from '@prisma/client';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { InviteEmployeeDto } from './dto/invite-employee.dto';

@ApiTags('Employees')
@Controller('employees')
@UseGuards(TokenGuard, PermissionGuard)
@ApiBearerAuth()
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @HttpCode(200)
  @RequirePermission('manage_users')
  @ApiOperation({
    summary: 'Create employee',
    description: 'Add a user as an employee to your default account. The user can be identified by phone, email, or account code. Requires system_admin, admin, manager, or legacy owner on the account. If the user doesn\'t exist, they will be created.',
  })
  @ApiBody({
    type: CreateEmployeeDto,
    description: 'Employee details',
    examples: {
      createByPhone: {
        summary: 'Add employee by phone',
        value: {
          phone: '250788123456',
          role: 'employee',
          permissions: ['read', 'write'],
        },
      },
      createByEmail: {
        summary: 'Add employee by email',
        value: {
          email: 'employee@example.com',
          role: 'manager',
          permissions: ['read', 'write', 'delete'],
        },
      },
      createByAccountCode: {
        summary: 'Add employee by account code',
        value: {
          account_code: 'A_XYZ789',
          role: 'employee',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Employee added successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Employee added successfully.',
      data: {
        employee_id: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
        user_account_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Jane Smith',
        phone: '250788123456',
        email: 'employee@example.com',
        role: 'employee',
        status: 'active',
        created_at: '2025-01-28T10:00:00Z',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request - missing required fields or no default account',
    examples: {
      missingIdentifier: {
        summary: 'Missing identifier',
        value: {
          code: 400,
          status: 'error',
          message: 'Phone, email, or account_code is required.',
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
  @ApiForbiddenResponse({
    description: 'Insufficient permissions — requires system_admin, admin, manager, or legacy owner',
    example: {
      code: 403,
      status: 'error',
      message: 'Insufficient permissions. System admin, admin, or manager role required.',
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
  async createEmployee(@CurrentUser() user: User, @Body() createDto: CreateEmployeeDto) {
    return this.employeesService.createEmployee(user, createDto);
  }

  @Get()
  @RequirePermission('manage_users')
  @ApiOperation({
    summary: 'Get employees',
    description: 'Get all employees for the given account (or default). Optional status filter: active | inactive. Caller must be system_admin, admin, manager, or legacy owner on the account.',
  })
  @ApiQuery({ name: 'account_id', required: false, description: 'Account ID (default: user default account).' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status: active | inactive.' })
  @ApiResponse({
    status: 200,
    description: 'Employees fetched successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Employees fetched successfully.',
      data: [
        {
          employee_id: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
          user_account_id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Jane Smith',
          phone: '250788123456',
          email: 'employee@example.com',
          role: 'employee',
          permissions: ['read', 'write'],
          status: 'active',
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
  async getEmployees(
    @CurrentUser() user: User,
    @Query('account_id') accountId?: string,
    @Query('status') status?: 'active' | 'inactive',
  ) {
    return this.employeesService.getEmployees(user, accountId || null, status);
  }

  @Post('invite')
  @RequirePermission('manage_users')
  @ApiOperation({
    summary: 'Add team member',
    description: 'Add a user to the account by email or phone. If they already have an account, they are linked to this account. If not, a new user is created (name and password required).',
  })
  @ApiBody({ type: InviteEmployeeDto })
  @ApiResponse({
    status: 201,
    description: 'Team member added successfully',
    example: {
      code: 201,
      status: 'success',
      message: 'Team member added successfully.',
      data: {
        id: 'user-account-uuid',
        user: { id: 'user-uuid', name: 'Jane Doe', email: 'jane@example.com', phone: null },
        account: { id: 'account-uuid', code: 'MCC_001', name: 'My MCC' },
        role: 'manager',
        permissions: ['view_sales', 'create_sales'],
        status: 'active',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Email or phone required; user already in account',
  })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions — requires system_admin, admin, manager, or legacy owner',
  })
  async inviteEmployee(@CurrentUser() user: User, @Body() dto: InviteEmployeeDto) {
    return this.employeesService.inviteEmployee(user, dto);
  }

  @Get('roles')
  @RequireAnyPermission(['manage_users', 'create_suppliers', 'update_suppliers'])
  @ApiOperation({
    summary: 'Get roles config',
    description:
      'Returns roles and default permissions for employee/supplier onboarding UI. Requires manage_users, or create/update suppliers on the account.',
  })
  @ApiQuery({ name: 'account_id', required: false, description: 'Account ID (default: user default account).' })
  @ApiResponse({ status: 200, description: 'Roles configuration retrieved successfully.' })
  async getRoles(@CurrentUser() user: User, @Query('account_id') accountId?: string) {
    return this.employeesService.getRoles(user, accountId || null);
  }

  @Get('permissions')
  @RequirePermission('manage_users')
  @ApiOperation({
    summary: 'Get permissions config',
    description: 'Returns permissions list for use in employee management UI. Requires system_admin, admin, manager, or legacy owner on the account.',
  })
  @ApiQuery({ name: 'account_id', required: false, description: 'Account ID (default: user default account).' })
  @ApiResponse({ status: 200, description: 'Permissions configuration retrieved successfully.' })
  async getPermissions(@CurrentUser() user: User, @Query('account_id') accountId?: string) {
    return this.employeesService.getPermissions(user, accountId || null);
  }

  @Put(':id/access')
  @RequirePermission('manage_users')
  @ApiOperation({
    summary: 'Update employee access',
    description: 'Update employee role, permissions, or status. Requires system_admin, admin, manager, or legacy owner. Can update role, permissions array, or status (active/inactive).',
  })
  @ApiParam({
    name: 'id',
    description: 'Employee (UserAccount) ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @ApiBody({
    type: UpdateEmployeeDto,
    description: 'Employee update data',
    examples: {
      updateRole: {
        summary: 'Update role',
        value: {
          role: 'manager',
        },
      },
      updatePermissions: {
        summary: 'Update permissions',
        value: {
          permissions: ['read', 'write', 'delete'],
        },
      },
      updateStatus: {
        summary: 'Deactivate employee',
        value: {
          status: 'inactive',
        },
      },
      updateAll: {
        summary: 'Update multiple fields',
        value: {
          role: 'manager',
          permissions: ['read', 'write', 'delete'],
          status: 'active',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Employee updated successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Employee updated successfully.',
      data: {
        employee_id: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
        role: 'manager',
        permissions: ['read', 'write', 'delete'],
        status: 'active',
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
  @ApiNotFoundResponse({
    description: 'Employee not found',
    example: {
      code: 404,
      status: 'error',
      message: 'Employee not found.',
    },
  })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions — requires system_admin, admin, manager, or legacy owner',
    example: {
      code: 403,
      status: 'error',
      message: 'Insufficient permissions. System admin, admin, or manager role required.',
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
  async updateEmployee(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() updateDto: UpdateEmployeeDto,
    @Query('account_id') accountId?: string,
  ) {
    return this.employeesService.updateEmployee(user, id, updateDto, accountId || null);
  }

  @Delete(':id')
  @RequirePermission('manage_users')
  @ApiOperation({
    summary: 'Delete employee',
    description: 'Remove an employee from your default account (soft delete). The employee will be deactivated but not permanently deleted. Requires system_admin, admin, manager, or legacy owner.',
  })
  @ApiParam({
    name: 'id',
    description: 'Employee (UserAccount) ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Employee removed successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Employee removed successfully.',
      data: {
        employee_id: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
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
  @ApiNotFoundResponse({
    description: 'Employee not found',
    example: {
      code: 404,
      status: 'error',
      message: 'Employee not found.',
    },
  })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions — requires system_admin, admin, manager, or legacy owner',
    example: {
      code: 403,
      status: 'error',
      message: 'Insufficient permissions. System admin, admin, or manager role required.',
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
  async deleteEmployee(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('account_id') accountId?: string,
  ) {
    return this.employeesService.deleteEmployee(user, id, accountId || null);
  }
}

