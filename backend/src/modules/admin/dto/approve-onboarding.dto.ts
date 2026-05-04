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
      'Link an existing Gemura user (phone must match submission manager phone when linkExistingAccountId is omitted). Skips user creation; creates account + wallet + system_admin UserAccount link.',
  })
  @IsOptional()
  @IsUUID()
  linkExistingUserId?: string;

  @ApiPropertyOptional({
    description:
      'When set with linkExistingUserId: approve as KYC only — link submission to this tenant/branch account. No new account, wallet, or membership is created; phone match is not required (admin-verified).',
  })
  @IsOptional()
  @IsUUID()
  linkExistingAccountId?: string;

  @ApiPropertyOptional({ description: 'Optional internal notes stored on the submission.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  reviewNotes?: string;
}
