import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsArray, MinLength, MaxLength, IsUUID } from 'class-validator';

export class InviteEmployeeDto {
  @ApiProperty({ description: 'Full name', example: 'Jane Doe' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Email (required if no phone)', example: 'jane@example.com', required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ description: 'Phone (required if no email)', example: '250788123456', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ description: 'Initial password (required only when adding a new user who has no account)', example: 'SecurePass123', minLength: 6, required: false })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password?: string;

  @ApiProperty({
    description: 'Platform role slug',
    example: 'manager',
  })
  @IsString()
  @MaxLength(64)
  role: string;

  @ApiPropertyOptional({ description: 'Assign by PlatformRole id (optional)' })
  @IsOptional()
  @IsUUID('4')
  platform_role_id?: string;

  @ApiProperty({
    description: 'Permission group preset',
    enum: ['general_access', 'limited_access', 'milk_receptionist_access'],
    example: 'general_access',
    required: false,
  })
  @IsOptional()
  @IsEnum(['general_access', 'limited_access', 'milk_receptionist_access'], { message: 'Invalid access_group' })
  access_group?: 'general_access' | 'limited_access' | 'milk_receptionist_access';

  @ApiProperty({
    description: 'Permission codes (optional override)',
    example: ['view_sales', 'create_sales'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @ApiProperty({ description: 'Account ID (default: user default account)', required: false })
  @IsOptional()
  @IsString()
  account_id?: string;
}
