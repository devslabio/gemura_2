import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreatePlatformRoleDto {
  @ApiProperty({ example: 'Senior receptionist' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({
    description: 'Machine slug (unique). Omit to derive from name.',
    example: 'senior-receptionist',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Permission row IDs from GET /admin/permissions',
    type: [String],
    example: [],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  permission_ids: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({
    description: 'If false, role is excluded from employee invite dropdowns.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  is_assignable?: boolean;
}
