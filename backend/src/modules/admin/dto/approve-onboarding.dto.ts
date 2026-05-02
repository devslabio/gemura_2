import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MinLength, MaxLength } from 'class-validator';

export class ApproveOnboardingDto {
  @ApiPropertyOptional({
    description: 'If omitted, a strong temporary password is generated and returned once.',
    minLength: 8,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional({
    description:
      'Link an existing Gemura user (phone must match submission manager phone). Skips user creation; creates account + wallet + system_admin UserAccount link.',
  })
  @IsOptional()
  @IsUUID()
  linkExistingUserId?: string;

  @ApiPropertyOptional({ description: 'Optional internal notes stored on the submission.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  reviewNotes?: string;
}
