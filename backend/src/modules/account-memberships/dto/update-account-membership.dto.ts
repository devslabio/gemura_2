import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional } from 'class-validator';
import { AccountMembershipStatus } from '@prisma/client';

export class UpdateAccountMembershipDto {
  @ApiPropertyOptional({ enum: AccountMembershipStatus })
  @IsOptional()
  @IsEnum(AccountMembershipStatus)
  status?: AccountMembershipStatus;

  @ApiPropertyOptional({ description: 'ISO 8601' })
  @IsOptional()
  @IsISO8601()
  member_since?: string | null;
}
