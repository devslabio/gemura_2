import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsEnum, IsObject, MinLength, MaxLength, IsUUID } from 'class-validator';
import { UserStatus, UserAccountType } from '@prisma/client';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'John' })
  @IsString()
  @IsOptional()
  first_name?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsString()
  @IsOptional()
  last_name?: string;

  @ApiPropertyOptional({ description: 'Deprecated: prefer first_name + last_name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'john.updated@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '250788123456' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'NewSecurePassword123!' })
  @IsString()
  @MinLength(6)
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({ enum: UserAccountType })
  @IsEnum(UserAccountType)
  @IsOptional()
  account_type?: UserAccountType;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'Role slug (PlatformRole.slug)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  role?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  platform_role_id?: string;

  @ApiPropertyOptional({ example: { manage_users: true, view_sales: true } })
  @IsObject()
  @IsOptional()
  permissions?: Record<string, boolean>;
}
