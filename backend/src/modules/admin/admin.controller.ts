import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { TokenGuard } from '../../common/guards/token.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission, RequireRole } from '../../common/decorators/permission.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { CurrentAccount } from '../../common/decorators/account.decorator';
import { User } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { LinkUserImmisDto } from './dto/link-user-immis.dto';
import { ApproveOnboardingDto } from './dto/approve-onboarding.dto';
import { RejectOnboardingDto } from './dto/reject-onboarding.dto';
import { NeedsChangesOnboardingDto } from './dto/needs-changes-onboarding.dto';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(TokenGuard, PermissionGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/stats')
  @RequirePermission('dashboard.view')
  @ApiOperation({
    summary: 'Get admin dashboard statistics',
    description: 'Retrieve comprehensive dashboard statistics for admin users. Requires dashboard.view permission. Returns aggregated data including user counts, account statistics, and system metrics.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard statistics retrieved successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Dashboard statistics retrieved successfully.',
      data: {
        total_users: 1250,
        active_users: 980,
        total_accounts: 850,
        active_accounts: 720,
        total_transactions: 15000,
        recent_activity: [],
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
  @ApiForbiddenResponse({
    description: 'Insufficient permissions - requires dashboard.view permission',
    example: {
      code: 403,
      status: 'error',
      message: 'Insufficient permissions. dashboard.view permission required.',
    },
  })
  async getDashboardStats(
    @CurrentUser() user: User,
    @CurrentAccount() accountId: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    return this.adminService.getDashboardStats(user, accountId, dateFrom, dateTo);
  }

  @Get('roles')
  @RequirePermission('manage_users')
  @ApiOperation({
    summary: 'Get all roles with default permissions',
    description: 'Returns roles and their default permission set. Used for Roles admin page.',
  })
  @ApiResponse({ status: 200, description: 'Roles retrieved successfully' })
  @ApiForbiddenResponse({ description: 'Requires manage_users permission' })
  async getRoles(
    @CurrentUser() user: User,
    @CurrentAccount() accountId: string,
  ) {
    return this.adminService.getRoles(user, accountId);
  }

  @Get('permissions')
  @RequirePermission('manage_users')
  @ApiOperation({
    summary: 'Get all permissions with role assignments',
    description: 'Returns permissions and which roles have them by default. Used for Permissions admin page.',
  })
  @ApiResponse({ status: 200, description: 'Permissions retrieved successfully' })
  @ApiForbiddenResponse({ description: 'Requires manage_users permission' })
  async getPermissions(
    @CurrentUser() user: User,
    @CurrentAccount() accountId: string,
  ) {
    return this.adminService.getPermissions(user, accountId);
  }

  @Get('onboarding-submissions/pending-count')
  @RequirePermission('manage_users')
  @ApiOperation({ summary: 'Count MCC onboarding submissions awaiting review' })
  async getOnboardingPendingCount(@CurrentUser() user: User, @CurrentAccount() accountId: string) {
    return this.adminService.getMccOnboardingPendingCount(user, accountId);
  }

  @Get('onboarding-submissions')
  @RequirePermission('manage_users')
  @ApiOperation({ summary: 'List MCC onboarding submissions (public wizard)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'review_status', required: false, description: 'pending | approved | rejected | needs_changes' })
  async listOnboardingSubmissions(
    @CurrentUser() user: User,
    @CurrentAccount() accountId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('review_status') reviewStatus?: string,
  ) {
    return this.adminService.listMccOnboardingSubmissions(
      user,
      accountId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      reviewStatus,
    );
  }

  @Get('onboarding-submissions/:submissionId')
  @RequirePermission('manage_users')
  @ApiOperation({ summary: 'Get one MCC onboarding submission including section_payload' })
  @ApiParam({ name: 'submissionId', description: 'Submission UUID' })
  async getOnboardingSubmission(
    @CurrentUser() user: User,
    @CurrentAccount() accountId: string,
    @Param('submissionId') submissionId: string,
  ) {
    return this.adminService.getMccOnboardingSubmissionById(user, accountId, submissionId);
  }

  @Post('onboarding-submissions/:submissionId/approve')
  @RequirePermission('manage_users')
  @ApiOperation({
    summary: 'Approve onboarding: create tenant account, wallet, owner user (or link existing user)',
  })
  @ApiParam({ name: 'submissionId', description: 'Submission UUID' })
  @ApiBody({ type: ApproveOnboardingDto })
  async approveOnboardingSubmission(
    @CurrentUser() user: User,
    @CurrentAccount() accountId: string,
    @Param('submissionId') submissionId: string,
    @Body() dto: ApproveOnboardingDto,
  ) {
    return this.adminService.approveMccOnboardingSubmission(user, accountId, submissionId, dto);
  }

  @Post('onboarding-submissions/:submissionId/reject')
  @RequirePermission('manage_users')
  @ApiOperation({ summary: 'Reject onboarding submission' })
  @ApiParam({ name: 'submissionId', description: 'Submission UUID' })
  @ApiBody({ type: RejectOnboardingDto })
  async rejectOnboardingSubmission(
    @CurrentUser() user: User,
    @CurrentAccount() accountId: string,
    @Param('submissionId') submissionId: string,
    @Body() dto: RejectOnboardingDto,
  ) {
    return this.adminService.rejectMccOnboardingSubmission(user, accountId, submissionId, dto.notes);
  }

  @Post('onboarding-submissions/:submissionId/needs-changes')
  @RequirePermission('manage_users')
  @ApiOperation({ summary: 'Mark onboarding submission as needs changes' })
  @ApiParam({ name: 'submissionId', description: 'Submission UUID' })
  @ApiBody({ type: NeedsChangesOnboardingDto })
  async needsChangesOnboardingSubmission(
    @CurrentUser() user: User,
    @CurrentAccount() accountId: string,
    @Param('submissionId') submissionId: string,
    @Body() dto: NeedsChangesOnboardingDto,
  ) {
    return this.adminService.needsChangesMccOnboardingSubmission(user, accountId, submissionId, dto.notes);
  }

  @Get('users')
  @RequirePermission('manage_users')
  @ApiOperation({
    summary: 'Get all users with pagination',
    description: 'Retrieve a paginated list of all users in the system. Supports search functionality. Requires manage_users permission.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20)',
    example: 20,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search term for filtering users by name, email, or phone',
    example: 'John',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filter by user status: active or inactive',
    example: 'active',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    type: String,
    description: 'Filter by account role: owner, admin, manager, collector, supplier, customer',
    example: 'admin',
  })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Users retrieved successfully.',
      data: {
        users: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'John Doe',
            email: 'john@example.com',
            phone: '250788123456',
            account_type: 'mcc',
            status: 'active',
            created_at: '2025-01-20T10:00:00Z',
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1250,
          total_pages: 63,
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
  @ApiForbiddenResponse({
    description: 'Insufficient permissions - requires manage_users permission',
    example: {
      code: 403,
      status: 'error',
      message: 'Insufficient permissions. manage_users permission required.',
    },
  })
  async getUsers(
    @CurrentUser() user: User,
    @CurrentAccount() accountId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('role') role?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.adminService.getUsers(user, accountId, pageNum, limitNum, search, status, role);
  }

  @Get('users/:id')
  @RequirePermission('manage_users')
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Retrieve detailed information about a specific user by their ID. Requires manage_users permission.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'User ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'User retrieved successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'User retrieved successfully.',
      data: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '250788123456',
        account_type: 'mcc',
        status: 'active',
        accounts: [],
        created_at: '2025-01-20T10:00:00Z',
        updated_at: '2025-01-20T10:00:00Z',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid UUID format',
    example: {
      code: 400,
      status: 'error',
      message: 'Invalid user ID format.',
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
  @ApiForbiddenResponse({
    description: 'Insufficient permissions - requires manage_users permission',
    example: {
      code: 403,
      status: 'error',
      message: 'Insufficient permissions. manage_users permission required.',
    },
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    example: {
      code: 404,
      status: 'error',
      message: 'User not found.',
    },
  })
  async getUserById(
    @CurrentUser() user: User,
    @CurrentAccount() accountId: string,
    @Param('id') userId: string,
  ) {
    return this.adminService.getUserById(user, accountId, userId);
  }

  @Put('users/:userId/immis-link')
  @RequirePermission('manage_users')
  @ApiOperation({
    summary: 'Link Gemura user to IMMIS member (or unlink)',
    description:
      'Target user must belong to the current account. Body: { "immis_member_id": 10 } to link, { "immis_member_id": null } to unlink.',
  })
  @ApiParam({ name: 'userId', description: 'Gemura user UUID' })
  @ApiBody({ type: LinkUserImmisDto })
  async linkUserImmis(
    @CurrentUser() user: User,
    @CurrentAccount() accountId: string,
    @Param('userId') userId: string,
    @Body() dto: LinkUserImmisDto,
  ) {
    return this.adminService.linkUserImmisMember(user, accountId, userId, dto.immis_member_id);
  }

  @Post('users')
  @RequirePermission('manage_users')
  @ApiOperation({
    summary: 'Create new user',
    description: 'Create a new user account in the system. Requires manage_users permission. Email and phone must be unique.',
  })
  @ApiBody({
    type: CreateUserDto,
    description: 'User creation data',
    examples: {
      createUser: {
        summary: 'Create new user',
        value: {
          name: 'Jane Smith',
          email: 'jane@example.com',
          phone: '250788654321',
          password: 'SecurePassword123!',
          account_type: 'farmer',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    example: {
      code: 201,
      status: 'success',
      message: 'User created successfully.',
      data: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '250788654321',
        account_type: 'farmer',
        status: 'active',
        created_at: '2025-01-28T10:00:00Z',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation error or email/phone already exists',
    examples: {
      validationError: {
        summary: 'Validation error',
        value: {
          code: 400,
          status: 'error',
          message: 'Name, email, phone, and password are required.',
        },
      },
      duplicateEmail: {
        summary: 'Email already exists',
        value: {
          code: 400,
          status: 'error',
          message: 'Email already exists.',
        },
      },
      duplicatePhone: {
        summary: 'Phone already exists',
        value: {
          code: 400,
          status: 'error',
          message: 'Phone number already exists.',
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
  @ApiForbiddenResponse({
    description: 'Insufficient permissions - requires manage_users permission',
    example: {
      code: 403,
      status: 'error',
      message: 'Insufficient permissions. manage_users permission required.',
    },
  })
  async createUser(
    @CurrentUser() user: User,
    @CurrentAccount() accountId: string,
    @Body() createDto: CreateUserDto,
  ) {
    return this.adminService.createUser(user, accountId, createDto);
  }

  @Put('users/:id')
  @RequirePermission('manage_users')
  @ApiOperation({
    summary: 'Update user',
    description: 'Update user information. Requires manage_users permission. All fields are optional.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'User ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiBody({
    type: UpdateUserDto,
    description: 'User update data',
    examples: {
      updateName: {
        summary: 'Update name',
        value: {
          name: 'John Doe Updated',
        },
      },
      updateStatus: {
        summary: 'Update status',
        value: {
          status: 'inactive',
        },
      },
      updateAll: {
        summary: 'Update multiple fields',
        value: {
          name: 'John Doe Updated',
          email: 'newemail@example.com',
          status: 'active',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'User updated successfully.',
      data: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe Updated',
        email: 'newemail@example.com',
        status: 'active',
        updated_at: '2025-01-28T10:00:00Z',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request or duplicate email/phone',
    example: {
      code: 400,
      status: 'error',
      message: 'Email already exists.',
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
  @ApiForbiddenResponse({
    description: 'Insufficient permissions - requires manage_users permission',
    example: {
      code: 403,
      status: 'error',
      message: 'Insufficient permissions. manage_users permission required.',
    },
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    example: {
      code: 404,
      status: 'error',
      message: 'User not found.',
    },
  })
  async updateUser(
    @CurrentUser() user: User,
    @CurrentAccount() accountId: string,
    @Param('id') userId: string,
    @Body() updateDto: UpdateUserDto,
  ) {
    return this.adminService.updateUser(user, accountId, userId, updateDto);
  }

  @Delete('users/:id')
  @RequirePermission('manage_users')
  @ApiOperation({
    summary: 'Delete user (soft delete)',
    description: 'Soft delete a user by setting their status to inactive. The user will no longer be able to access the system but data is preserved. Requires manage_users permission.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'User ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'User deleted successfully.',
      data: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe',
        status: 'inactive',
        deleted_at: '2025-01-28T10:00:00Z',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid UUID format',
    example: {
      code: 400,
      status: 'error',
      message: 'Invalid user ID format.',
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
  @ApiForbiddenResponse({
    description: 'Insufficient permissions - requires manage_users permission',
    example: {
      code: 403,
      status: 'error',
      message: 'Insufficient permissions. manage_users permission required.',
    },
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    example: {
      code: 404,
      status: 'error',
      message: 'User not found.',
    },
  })
  async deleteUser(
    @CurrentUser() user: User,
    @CurrentAccount() accountId: string,
    @Param('id') userId: string,
  ) {
    return this.adminService.deleteUser(user, accountId, userId);
  }
}
