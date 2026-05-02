import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsDateString, Min, Max, IsArray, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { IsNotFutureDate } from '../../../../common/validators/not-future-date.validator';

export class UpdateTransactionDto {
  @ApiProperty({ description: 'Amount', example: 1000.0, required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0.01)
  amount?: number;

  @ApiProperty({ description: 'Description', example: 'Updated description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Transaction date (must not be in the future)', example: '2025-01-18', required: false })
  @IsOptional()
  @IsDateString()
  @IsNotFutureDate({ message: 'Transaction date must not be in the future' })
  transaction_date?: string;

  @ApiProperty({ description: 'Optional dairy share percentage (0-100)', example: 75, required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  dairy_share_pct?: number;

  @ApiProperty({ description: 'Optional cost tags', type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cost_tags?: string[];

  @ApiProperty({ description: 'Optional farm UUID for cost attribution', required: false })
  @IsOptional()
  @IsUUID()
  farm_id?: string;
}
