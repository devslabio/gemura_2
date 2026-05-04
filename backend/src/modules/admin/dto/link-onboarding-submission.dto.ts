import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class LinkOnboardingSubmissionDto {
  @ApiProperty({ description: 'Existing Gemura user UUID to attach this onboarding row to' })
  @IsUUID()
  linkUserId: string;

  @ApiPropertyOptional({
    description:
      'Optional tenant or branch account UUID. When set, the user must be an active member of that account. When omitted, only linked_user_id is set and linked_account_id is cleared.',
  })
  @IsOptional()
  @IsUUID()
  linkAccountId?: string;
}
