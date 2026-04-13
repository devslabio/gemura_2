import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min, MaxLength } from 'class-validator';

export class UpdateSupplierDto {
  @ApiProperty({
    description: 'Supplier account code',
    example: 'A_ABC123',
  })
  @IsString()
  supplier_account_code: string;

  @ApiProperty({
    description: 'Price per liter',
    example: 400.0,
    minimum: 0,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  price_per_liter?: number;

  @ApiProperty({
    description: 'Relationship status',
    enum: ['active', 'inactive'],
    example: 'active',
    required: false,
  })
  @IsString()
  @IsOptional()
  relationship_status?: 'active' | 'inactive';

  @ApiProperty({
    description: 'Bank name for supplier payout',
    example: 'Bank of Kigali',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  bank_name?: string;

  @ApiProperty({
    description: 'Bank account number for supplier payout',
    example: '0123456789012',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(64)
  bank_account_number?: string;
}

