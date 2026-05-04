import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEmail, Min, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ description: 'Given name', example: 'Marie' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  first_name: string;

  @ApiProperty({ description: 'Family name', example: 'Mukamana' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  last_name: string;

  @ApiProperty({
    description: 'Phone number',
    example: '250788123456',
  })
  @IsString()
  phone: string;

  @ApiProperty({
    description: 'Email address',
    example: 'customer@example.com',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: 'National ID',
    example: '1199887766554433',
    required: false,
  })
  @IsString()
  @IsOptional()
  nid?: string;

  @ApiProperty({
    description: 'Address',
    example: 'Kigali, Rwanda',
    required: false,
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({
    description: 'Price per liter for this customer',
    example: 400.0,
    minimum: 0,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  price_per_liter?: number;
}
