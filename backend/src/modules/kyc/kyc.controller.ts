import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiBadRequestResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { KycService } from './kyc.service';
import { TokenGuard } from '../../common/guards/token.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User } from '@prisma/client';
import { UploadPhotoDto } from './dto/upload-photo.dto';

@ApiTags('KYC')
@Controller('kyc')
@UseGuards(TokenGuard)
@ApiBearerAuth()
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('upload-photo')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Upload KYC photo',
    description: 'Upload a KYC verification photo (ID front, ID back, or selfie). Uploading any photo sets KYC status to pending.',
  })
  @ApiBody({
    type: UploadPhotoDto,
    description: 'KYC photo upload data',
    examples: {
      idFront: {
        summary: 'Upload ID front photo',
        value: {
          photo_type: 'id_front',
          photo_url: 'https://example.com/uploads/id-front.jpg',
        },
      },
      idBack: {
        summary: 'Upload ID back photo',
        value: {
          photo_type: 'id_back',
          photo_url: 'https://example.com/uploads/id-back.jpg',
        },
      },
      selfie: {
        summary: 'Upload selfie photo',
        value: {
          photo_type: 'selfie',
          photo_url: 'https://example.com/uploads/selfie.jpg',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'KYC photo uploaded successfully',
    example: {
      code: 200,
      status: 'success',
      message: 'KYC photo uploaded successfully.',
      data: {
        user_id: 'user-uuid',
        photo_type: 'id_front',
        photo_url: 'https://example.com/uploads/id-front.jpg',
        kyc_status: 'pending',
        kyc_photos: {
          id_front: 'https://example.com/uploads/id-front.jpg',
          id_back: null,
          selfie: null,
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request - missing fields or invalid photo type',
    example: {
      code: 400,
      status: 'error',
      message: 'Invalid photo type.',
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
  async uploadPhoto(@CurrentUser() user: User, @Body() uploadDto: UploadPhotoDto) {
    return this.kycService.uploadPhoto(user, uploadDto);
  }
}

