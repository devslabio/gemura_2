import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsEnum, IsOptional, IsUUID, IsDateString, Min, Max, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { IsNotFutureDate } from '../../../../common/validators/not-future-date.validator';

export enum TransactionType {
  REVENUE = 'revenue',
  EXPENSE = 'expense',
}

export class CreateTransactionDto {
  @ApiProperty({ 
    description: 'Transaction type - either "revenue" or "expense"', 
    enum: TransactionType,
    example: TransactionType.REVENUE,
    enumName: 'TransactionType',
  })
  @IsNotEmpty()
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({
    description: 'Transaction amount (must be positive, minimum 0.01)',
    example: 1000.0,
    minimum: 0.01,
  })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  @Min(0.01)
  amount: number;

  @ApiProperty({
    description: 'Description of the transaction',
    example: 'Milk sales revenue',
    maxLength: 500,
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Transaction date in YYYY-MM-DD format (must not be in the future)',
    example: '2025-01-18',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  })
  @IsNotEmpty()
  @IsDateString()
  @IsNotFutureDate({ message: 'Transaction date must not be in the future' })
  transaction_date: string;

  @ApiProperty({
    description: 'Optional: Chart of account ID (UUID) for specific revenue/expense category. If not provided, a default account will be created/used.',
    required: false,
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsUUID()
  account_id?: string; // Optional: specific revenue/expense account from chart of accounts

  @ApiProperty({
    description: 'Optional farm UUID for direct farm-level cost attribution.',
    required: false,
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsUUID()
  farm_id?: string;

  @ApiProperty({
    description: 'Optional percentage of this transaction attributable to dairy costing (0-100). Defaults to 100 when omitted.',
    required: false,
    example: 80,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  dairy_share_pct?: number;

  @ApiProperty({
    description: 'Optional cost tags (e.g. dairy, feed, labour).',
    required: false,
    type: [String],
    example: ['dairy', 'feed'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cost_tags?: string[];
}
