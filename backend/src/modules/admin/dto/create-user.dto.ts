import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsEnum, IsObject, MinLength, MaxLength, IsUUID } from 'class-validator';
import { UserStatus, UserAccountType } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'john.doe@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '250788123456' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'SecurePassword123!' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ enum: UserAccountType, example: 'mcc' })
  @IsEnum(UserAccountType)
  @IsOptional()
  account_type?: UserAccountType;

  @ApiPropertyOptional({ enum: UserStatus, example: 'active' })
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'Role slug (PlatformRole.slug), e.g. viewer, manager', example: 'viewer' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  role?: string;

  @ApiPropertyOptional({
    description: 'Optional: assign by PlatformRole id instead of slug.',
  })
  @IsOptional()
  @IsUUID('4')
  platform_role_id?: string;

  @ApiPropertyOptional({ example: { manage_users: true, view_sales: true } })
  @IsObject()
  @IsOptional()
  permissions?: Record<string, boolean>;

  @ApiPropertyOptional({ description: 'Milk app segment for supplier/farmer' })
  @IsString()
  @IsOptional()
  supplier_segment?: string;

  @ApiPropertyOptional({ description: 'Full supplier onboarding JSON (MCC import)' })
  @IsObject()
  @IsOptional()
  onboarding_payload?: Record<string, unknown>;
}
