import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiUnauthorizedResponse, ApiBadRequestResponse, ApiNotFoundResponse, ApiBody, ApiConflictResponse } from '@nestjs/swagger';
import { ReferralsService } from './referrals.service';
import { TokenGuard } from '../../common/guards/token.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User } from '@prisma/client';
import { UseReferralCodeDto } from './dto/use-referral-code.dto';

@ApiTags('Referrals')
@Controller('referrals')
@UseGuards(TokenGuard)
@ApiBearerAuth()
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('get-code')
  @ApiOperation({
    summary: 'Get or generate referral code',
    description: 'Retrieve the user\'s referral code. If the user doesn\'t have one, a unique code will be generated automatically.',
  })
  @ApiResponse({
    status: 200,
    description: 'Referral code retrieved successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Referral code retrieved successfully.',
      data: {
        user_id: 'user-uuid',
        user_name: 'John Doe',
        referral_code: 'ABC12345',
        total_referrals: 5,
        recent_referrals: 2,
        total_points: 150,
        referral_url: 'https://app.gemura.rw/register?ref=ABC12345',
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
  async getReferralCode(@CurrentUser() user: User) {
    return this.referralsService.getReferralCode(user);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get referral statistics',
    description: 'Retrieve comprehensive referral statistics including total referrals, recent referrals, points history, and breakdown by time periods.',
  })
  @ApiResponse({
    status: 200,
    description: 'Referral statistics retrieved successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Referral statistics retrieved successfully.',
      data: {
        user_info: {
          name: 'John Doe',
          referral_code: 'ABC12345',
          total_points: 150,
          available_points: 120,
        },
        statistics: {
          total_referrals: 25,
          recent_week: 3,
          recent_month: 8,
          recent_quarter: 18,
        },
        recent_referrals: [
          {
            name: 'Jane Smith',
            phone: '+250788123456',
            joined_at: '2025-01-04T10:00:00Z',
            points_earned: 1,
          },
        ],
        points_history: [
          {
            points: 1,
            source: 'referral',
            description: 'Referred user: Jane Smith',
            earned_at: '2025-01-04T10:00:00Z',
          },
        ],
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
  async getReferralStats(@CurrentUser() user: User) {
    return this.referralsService.getReferralStats(user);
  }

  @Post('use-code')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Use a referral code',
    description: 'Apply a referral code to link the current user to a referrer. This can only be done once per user and awards points to the referrer.',
  })
  @ApiBody({
    type: UseReferralCodeDto,
    description: 'Referral code to use',
    examples: {
      useCode: {
        summary: 'Use referral code',
        value: {
          referral_code: 'ABC12345',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Referral code applied successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Referral code applied successfully.',
      data: {
        referrer_name: 'John Doe',
        referral_code: 'ABC12345',
        points_awarded: 1,
        applied_at: '2025-01-04T10:00:00Z',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'User already has a referrer or cannot refer self',
    example: {
      code: 400,
      status: 'error',
      message: 'User already has a referrer.',
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
  @ApiNotFoundResponse({
    description: 'Invalid referral code',
    example: {
      code: 404,
      status: 'error',
      message: 'Invalid referral code.',
    },
  })
  @ApiConflictResponse({
    description: 'Referral relationship already exists',
    example: {
      code: 409,
      status: 'error',
      message: 'Referral relationship already exists.',
    },
  })
  async useReferralCode(@CurrentUser() user: User, @Body() useReferralCodeDto: UseReferralCodeDto) {
    return this.referralsService.useReferralCode(user, useReferralCodeDto);
  }
}
