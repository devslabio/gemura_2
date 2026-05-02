import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, MaxLength, IsUUID } from 'class-validator';

export class UpdateEmployeeDto {
  @ApiPropertyOptional({
    description: 'Platform role slug',
    example: 'admin',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  role?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  platform_role_id?: string;

  @ApiProperty({
    description: 'Permission group preset',
    enum: ['general_access', 'limited_access', 'milk_receptionist_access'],
    example: 'limited_access',
    required: false,
  })
  @IsOptional()
  @IsEnum(['general_access', 'limited_access', 'milk_receptionist_access'], { message: 'Invalid access_group' })
  access_group?: 'general_access' | 'limited_access' | 'milk_receptionist_access';

  @ApiProperty({
    description: 'Permission codes array',
    example: ['view_sales', 'create_sales', 'view_collections'],
    required: false,
  })
  @IsOptional()
  permissions?: string[];

  @ApiProperty({
    description: 'Employee status',
    enum: ['active', 'inactive'],
    example: 'active',
    required: false,
  })
  @IsOptional()
  @IsEnum(['active', 'inactive'], { message: 'Status must be active or inactive' })
  status?: string;
}

