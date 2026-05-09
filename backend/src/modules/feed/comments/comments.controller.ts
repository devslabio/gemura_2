import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiNotFoundResponse, ApiBadRequestResponse, ApiParam } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { GetRepliesDto } from './dto/get-replies.dto';
import { TokenGuard } from '../../../common/guards/token.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { User } from '@prisma/client';

@ApiTags('Feed Comments')
@ApiBearerAuth()
@Controller('feed/comments')
@UseGuards(TokenGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new comment' })
  @ApiResponse({ status: 201, description: 'Comment created successfully.' })
  create(@CurrentUser() user: User, @Body() createCommentDto: CreateCommentDto) {
    return this.commentsService.create(user.id, createCommentDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get comments for a post' })
  @ApiResponse({ status: 200, description: 'Comments retrieved successfully.' })
  findAll(
    @Query('post_id') postId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.commentsService.findAll(
      postId,
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
    );
  }

  @Post('replies')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get replies to a comment',
    description: 'Retrieve all replies (nested comments) for a specific parent comment. Returns replies ordered by creation date.',
  })
  @ApiBody({
    type: GetRepliesDto,
    description: 'Comment ID to get replies for',
    examples: {
      getReplies: {
        summary: 'Get comment replies',
        value: {
          comment_id: 'comment-uuid',
          limit: 20,
          offset: 0,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Comment replies fetched successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Comment replies fetched successfully.',
      data: [
        {
          id: 'reply-uuid',
          post_id: 'post-uuid',
          user_id: 'user-uuid',
          user_name: 'Jane Doe',
          content: 'This is a reply to the comment',
          parent_comment_id: 'parent-comment-uuid',
          likes_count: 5,
          is_liked: false,
          status: 'active',
          created_at: '2025-01-04T10:00:00Z',
          updated_at: '2025-01-04T10:00:00Z',
        },
      ],
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Parent comment not found',
    example: {
      code: 404,
      status: 'error',
      message: 'Parent comment not found.',
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid UUID format or validation error',
    example: {
      code: 400,
      status: 'error',
      message: 'Validation failed',
    },
  })
  async getReplies(
    @CurrentUser() user: User,
    @Body() getRepliesDto: GetRepliesDto,
  ) {
    return this.commentsService.getReplies(
      user.id,
      getRepliesDto.comment_id,
      getRepliesDto.limit || 20,
      getRepliesDto.offset || 0,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a comment by ID' })
  @ApiParam({ name: 'id', description: 'Comment ID.' })
  @ApiResponse({ status: 200, description: 'Comment retrieved successfully.' })
  @ApiResponse({ status: 404, description: 'Comment not found.' })
  findOne(@Param('id') id: string) {
    return this.commentsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a comment' })
  @ApiParam({ name: 'id', description: 'Comment ID.' })
  @ApiResponse({ status: 200, description: 'Comment updated successfully.' })
  @ApiResponse({ status: 404, description: 'Comment not found.' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() updateCommentDto: UpdateCommentDto,
  ) {
    return this.commentsService.update(id, user.id, updateCommentDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a comment' })
  @ApiParam({ name: 'id', description: 'Comment ID.' })
  @ApiResponse({ status: 200, description: 'Comment deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Comment not found.' })
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.commentsService.remove(id, user.id);
  }
}

