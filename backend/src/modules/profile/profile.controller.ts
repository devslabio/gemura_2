import { Controller, Get, Put, Post, Delete, Body, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiBadRequestResponse, ApiUnauthorizedResponse, ApiParam } from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { TokenGuard } from '../../common/guards/token.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User } from '@prisma/client';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { LinkImmisDto } from './dto/link-immis.dto';

@ApiTags('Profile')
@Controller('profile')
@UseGuards(TokenGuard)
@ApiBearerAuth()
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('get')
  @ApiOperation({
    summary: 'Get user profile',
    description: 'Retrieve the authenticated user\'s profile information including personal details, accounts, and profile completion percentage.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Profile retrieved successfully',
      data: {
        user: {
          id: 'uuid-here',
          name: 'John Doe',
          email: 'user@example.com',
          phone: '250788123456',
          account_type: 'mcc',
          status: 'active',
          token: 'auth-token-here',
        },
        account: {
          id: 'account-uuid',
          code: 'ACC001',
          name: 'Main Account',
          type: 'tenant',
        },
        accounts: [],
        total_accounts: 1,
        profile_completion: 75,
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing authentication token',
    example: {
      code: 403,
      status: 'error',
      message: 'Unauthorized. Invalid token.',
    },
  })
  async getProfile(@CurrentUser() user: User) {
    return this.profileService.getProfile(user);
  }

  @Get('mcc-onboarding/:submissionId')
  @ApiOperation({
    summary: 'Get your linked MCC gate onboarding (KYC) submission',
    description:
      'Returns the onboarding wizard payload for a row where `linked_user_id` is the current user. Not available for arbitrary submission IDs.',
  })
  @ApiParam({ name: 'submissionId', description: 'Onboarding submission ID.' })
  @ApiResponse({ status: 200, description: 'Onboarding submission retrieved successfully.' })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing authentication token',
    example: { code: 403, status: 'error', message: 'Unauthorized. Invalid token.' },
  })
  async getOwnMccOnboarding(
    @CurrentUser() user: User,
    @Param('submissionId') submissionId: string,
  ) {
    return this.profileService.getOwnLinkedMccOnboarding(user, submissionId);
  }

  @Put('update')
  @ApiOperation({
    summary: 'Update user profile',
    description: 'Update user profile information including personal details and KYC information. Uploading KYC photos automatically sets KYC status to pending.',
  })
  @ApiBody({
    type: UpdateProfileDto,
    description: 'Profile update data (all fields optional except name and phone)',
    examples: {
      basicUpdate: {
        summary: 'Update basic information',
        value: {
          name: 'John Doe Updated',
          phone: '250788123456',
          email: 'newemail@example.com',
        },
      },
      kycUpdate: {
        summary: 'Update with KYC information',
        value: {
          name: 'John Doe',
          phone: '250788123456',
          province: 'Kigali',
          district: 'Nyarugenge',
          sector: 'Nyamirambo',
          id_number: '1199887766554433',
          id_front_photo_url: 'https://example.com/id-front.jpg',
          id_back_photo_url: 'https://example.com/id-back.jpg',
          selfie_photo_url: 'https://example.com/selfie.jpg',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'Profile retrieved successfully',
      data: {
        user: {
          id: 'uuid-here',
          name: 'John Doe Updated',
          email: 'newemail@example.com',
          phone: '250788123456',
          account_type: 'mcc',
          status: 'active',
          token: 'auth-token-here',
        },
        accounts: [],
        total_accounts: 1,
        profile_completion: 85,
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request - missing required fields',
    example: {
      code: 400,
      status: 'error',
      message: 'Name and phone are required.',
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing authentication token',
    example: {
      code: 403,
      status: 'error',
      message: 'Unauthorized. Invalid token.',
    },
  })
  async updateProfile(@CurrentUser() user: User, @Body() updateDto: UpdateProfileDto) {
    return this.profileService.updateProfile(user, updateDto);
  }

  @Post('immis-link')
  @ApiOperation({ summary: 'Link your account to an IMMIS member record' })
  @ApiBody({ type: LinkImmisDto })
  async linkImmis(@CurrentUser() user: User, @Body() dto: LinkImmisDto) {
    return this.profileService.linkImmisMember(user, dto.immis_member_id);
  }

  @Delete('immis-link')
  @ApiOperation({ summary: 'Remove IMMIS member link from your account' })
  async unlinkImmis(@CurrentUser() user: User) {
    return this.profileService.unlinkImmisMember(user);
  }
}
