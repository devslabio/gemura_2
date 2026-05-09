import { Controller, Post, Get, Put, Delete, Body, UseGuards, Param, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiBadRequestResponse, ApiUnauthorizedResponse, ApiNotFoundResponse, ApiParam } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { TokenGuard } from '../../common/guards/token.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User } from '@prisma/client';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(TokenGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Create notification',
    description: 'Create a new notification for the authenticated user. Notifications can be of different types (info, success, warning, error) and are associated with the user\'s account.',
  })
  @ApiBody({
    type: CreateNotificationDto,
    description: 'Notification data',
    examples: {
      info: {
        summary: 'Info notification',
        value: {
          title: 'New Sale Recorded',
          message: 'A new sale of 120.5 liters has been recorded.',
          type: 'info',
        },
      },
      success: {
        summary: 'Success notification',
        value: {
          title: 'Payment Successful',
          message: 'Your payment of 50,000 RWF has been processed.',
          type: 'success',
        },
      },
      warning: {
        summary: 'Warning notification',
        value: {
          title: 'Low Stock Alert',
          message: 'Fresh Milk 500ml is running low. Current stock: 25 units.',
          type: 'warning',
        },
      },
      error: {
        summary: 'Error notification',
        value: {
          title: 'Payment Failed',
          message: 'Payment processing failed. Please try again.',
          type: 'error',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Notification created successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Notification created successfully.',
      data: {
        id: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
        title: 'New Sale Recorded',
        message: 'A new sale of 120.5 liters has been recorded.',
        type: 'info',
        is_read: false,
        created_at: '2025-01-28T10:00:00Z',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request - missing required fields',
    example: {
      code: 400,
      status: 'error',
      message: 'Title, message, and type are required.',
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
  async createNotification(@CurrentUser() user: User, @Body() createDto: CreateNotificationDto) {
    return this.notificationsService.createNotification(user, createDto);
  }

  @Post('get')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get notifications',
    description: 'Retrieve all notifications for the authenticated user. Returns both read and unread notifications, ordered by creation date (newest first).',
  })
  @ApiResponse({
    status: 200,
    description: 'Notifications fetched successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Notifications fetched successfully.',
      data: [
        {
          id: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
          title: 'New Sale Recorded',
          message: 'A new sale of 120.5 liters has been recorded.',
          type: 'info',
          is_read: false,
          created_at: '2025-01-28T10:00:00Z',
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          title: 'Payment Successful',
          message: 'Your payment of 50,000 RWF has been processed.',
          type: 'success',
          is_read: true,
          created_at: '2025-01-27T15:30:00Z',
        },
      ],
      unread_count: 1,
      total_count: 2,
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
  async getNotifications(@CurrentUser() user: User) {
    return this.notificationsService.getNotifications(user);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update notification',
    description: 'Update notification status (mark as read/unread). Only notifications belonging to the authenticated user can be updated.',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification ID (UUID)',
    example: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
    type: String,
  })
  @ApiBody({
    type: UpdateNotificationDto,
    description: 'Notification update data',
    examples: {
      markAsRead: {
        summary: 'Mark as read',
        value: {
          is_read: true,
        },
      },
      markAsUnread: {
        summary: 'Mark as unread',
        value: {
          is_read: false,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Notification updated successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Notification updated successfully.',
      data: {
        id: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
        is_read: true,
        updated_at: '2025-01-28T10:00:00Z',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request',
    example: {
      code: 400,
      status: 'error',
      message: 'is_read field is required.',
    },
  })
  @ApiNotFoundResponse({
    description: 'Notification not found',
    example: {
      code: 404,
      status: 'error',
      message: 'Notification not found.',
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
  async updateNotification(@CurrentUser() user: User, @Param('id') id: string, @Body() updateDto: UpdateNotificationDto) {
    return this.notificationsService.updateNotification(user, id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete notification',
    description: 'Delete a notification permanently. Only notifications belonging to the authenticated user can be deleted.',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification ID (UUID)',
    example: 'cb9ad42f-12dc-401e-9ac9-05585b9b311e',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Notification deleted successfully.',
    },
  })
  @ApiNotFoundResponse({
    description: 'Notification not found',
    example: {
      code: 404,
      status: 'error',
      message: 'Notification not found.',
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
  async deleteNotification(@CurrentUser() user: User, @Param('id') id: string) {
    return this.notificationsService.deleteNotification(user, id);
  }
}

