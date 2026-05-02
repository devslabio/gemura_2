import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class AssignUserAccountMembershipDto {
  @ApiProperty({ description: 'Active tenant or branch account to grant access to (link target)' })
  @IsUUID()
  link_account_id: string;

  @ApiPropertyOptional({ description: 'Platform role for access in this account (defaults to viewer)' })
  @IsOptional()
  @IsUUID()
  platform_role_id?: string;
}
