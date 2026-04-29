import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { AnalyticsQueryDto } from './analytics-query.dto';

export class UnifiedAnalyticsQueryDto extends AnalyticsQueryDto {
  // Override base limit — no upper cap, no default for /everything
  @ApiPropertyOptional({
    description: 'Number of top-level accounts to return. No upper cap. Omit to return all accounts.',
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  override limit?: number;

  @ApiPropertyOptional({
    description: 'Free-text search across account code/name and linked user name/phone/email',
    example: 'gahengeri',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter accounts by status',
    example: 'active',
  })
  @IsOptional()
  @IsString()
  account_status?: string;

  @ApiPropertyOptional({
    description: 'Filter linked users by status',
    example: 'active',
  })
  @IsOptional()
  @IsString()
  user_status?: string;

  @ApiPropertyOptional({
    description: 'Filter supplier/customer relationships by status',
    example: 'active',
  })
  @IsOptional()
  @IsString()
  relationship_status?: string;

  @ApiPropertyOptional({
    description: 'Filter sales/collections by sale status',
    example: 'accepted',
  })
  @IsOptional()
  @IsString()
  sale_status?: string;

  @ApiPropertyOptional({
    description: 'Filter sales/collections by payment status',
    example: 'paid',
  })
  @IsOptional()
  @IsString()
  payment_status?: string;

  @ApiPropertyOptional({
    description: 'Nested section page number (users, suppliers, customers, collections, sales)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  nested_page?: number;

  @ApiPropertyOptional({
    description: 'Nested section page size (users, suppliers, customers, collections, sales). No upper cap. Omit to return all records.',
    example: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  nested_limit?: number;
}
