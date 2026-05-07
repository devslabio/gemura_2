import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { AccountMembershipStatus } from '@prisma/client';

export class CreateAccountMembershipDto {
  @ApiProperty({ format: 'uuid', description: 'MCC / tenant account' })
  @IsUUID()
  account_id: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  user_id: string;

  @ApiPropertyOptional({ enum: AccountMembershipStatus, default: AccountMembershipStatus.active })
  @IsOptional()
  @IsEnum(AccountMembershipStatus)
  status?: AccountMembershipStatus;

  @ApiPropertyOptional({ description: 'When cooperative membership started (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  member_since?: string;
}
