import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsOptional, Length, Matches, MaxLength } from 'class-validator';

export class CreateSupplierDto {
  @ApiProperty({ description: 'Given name', example: 'Jean', required: true })
  @IsNotEmpty({ message: 'First name is required' })
  @IsString()
  @MaxLength(80)
  first_name: string;

  @ApiProperty({ description: 'Family name', example: 'Uwimana', required: true })
  @IsNotEmpty({ message: 'Last name is required' })
  @IsString()
  @MaxLength(80)
  last_name: string;

  @ApiProperty({
    description: 'Supplier phone number in Rwandan format (250XXXXXXXXX)',
    example: '250788123456',
    pattern: '^250[0-9]{9}$',
    required: true,
  })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString({ message: 'Phone number must be a string' })
  phone: string;

  @ApiProperty({
    description: 'Price per liter of milk in RWF',
    example: 390.0,
    minimum: 0,
    required: true,
  })
  @IsNotEmpty({ message: 'Price per liter is required' })
  @IsNumber({}, { message: 'Price per liter must be a number' })
  price_per_liter: number;

  @ApiProperty({
    description: 'Supplier email address (optional)',
    example: 'supplier@example.com',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Email must be a string' })
  email?: string;

  @ApiProperty({
    description: 'National ID number (16 digits, must start with 1)',
    example: '1199887766554433',
    required: true,
    minLength: 16,
    maxLength: 16,
    pattern: '^1[0-9]{15}$',
  })
  @IsNotEmpty({ message: 'National ID is required' })
  @IsString({ message: 'National ID must be a string' })
  @Length(16, 16, { message: 'National ID must be exactly 16 digits' })
  @Matches(/^1[0-9]{15}$/, { message: 'National ID must be 16 digits and start with 1' })
  nid: string;

  @ApiProperty({
    description: 'Physical address (optional)',
    example: 'Kigali, Rwanda',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Address must be a string' })
  address?: string;

  @ApiProperty({
    description: 'Bank name for supplier payout (optional)',
    example: 'Bank of Kigali',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Bank name must be a string' })
  @MaxLength(120, { message: 'Bank name must be at most 120 characters' })
  bank_name?: string;

  @ApiProperty({
    description: 'Bank account number for supplier payout (optional)',
    example: '0123456789012',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Bank account number must be a string' })
  @MaxLength(64, { message: 'Bank account number must be at most 64 characters' })
  bank_account_number?: string;
}
