import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class CreateEmployeeDto {
  @ApiProperty({
    description: 'User ID to add as employee',
    example: 'user-uuid',
  })
  @IsNotEmpty({ message: 'User ID is required' })
  @IsUUID('4', { message: 'User ID must be a valid UUID' })
  user_id: string;

  @ApiProperty({
    description: 'Account ID to add employee to',
    example: 'account-uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'Account ID must be a valid UUID' })
  account_id?: string;

  @ApiProperty({
    description: 'Platform role slug (see GET /employees/roles or admin roles)',
    example: 'manager',
  })
  @IsNotEmpty({ message: 'Role is required' })
  @IsString()
  @MaxLength(64)
  role: string;

  @ApiPropertyOptional({
    description: 'Assign by PlatformRole id (optional alternative to slug)',
  })
  @IsOptional()
  @IsUUID('4')
  platform_role_id?: string;

  @ApiProperty({
    description: 'Permission codes array',
    example: ['view_sales', 'create_sales'],
    required: false,
  })
  @IsOptional()
  permissions?: string[];
}

