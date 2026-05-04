import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class WalletDto {
  @ApiProperty({
    description: 'Wallet type',
    enum: ['saving', 'regular'],
    example: 'regular',
    required: false,
  })
  @IsOptional()
  @IsEnum(['saving', 'regular'])
  type?: 'saving' | 'regular';

  @ApiProperty({
    description: 'Whether wallet is joint',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  is_joint?: boolean;
}

export class RegisterDto {
  @ApiProperty({ description: 'Given name', example: 'John' })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({ description: 'Family name', example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  last_name: string;

  @ApiProperty({
    description: 'Phone number in Rwandan format (250XXXXXXXXX)',
    example: '250788123456',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    description: 'Email address (optional)',
    example: 'user@example.com',
    required: false,
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({
    description: 'Password (minimum 6 characters)',
    example: 'SecurePassword123!',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    description: 'Account name (optional, defaults to first + last name if not provided)',
    example: 'My Business Account',
    required: false,
  })
  @IsOptional()
  @IsString()
  account_name?: string;

  @ApiProperty({
    description: 'Account type',
    enum: ['mcc', 'agent', 'collector', 'veterinarian', 'supplier', 'customer', 'farmer', 'owner'],
    example: 'mcc',
  })
  @IsEnum(['mcc', 'agent', 'collector', 'veterinarian', 'supplier', 'customer', 'farmer', 'owner'])
  account_type: 'mcc' | 'agent' | 'collector' | 'veterinarian' | 'supplier' | 'customer' | 'farmer' | 'owner';

  @ApiProperty({
    description: 'National ID number (optional)',
    example: '1199887766554433',
    required: false,
  })
  @IsOptional()
  @IsString()
  nid?: string;

  @ApiProperty({
    description: 'Platform role slug for the new account link (legacy `owner` is normalized to `system_admin`)',
    enum: ['system_admin', 'owner', 'admin', 'collector', 'supplier', 'customer'],
    example: 'customer',
    required: false,
  })
  @IsOptional()
  @IsEnum(['system_admin', 'owner', 'admin', 'collector', 'supplier', 'customer'])
  role?: 'system_admin' | 'owner' | 'admin' | 'collector' | 'supplier' | 'customer';

  @ApiProperty({
    description: 'Custom permissions object (optional)',
    example: { can_collect: true, can_add_supplier: true },
    required: false,
  })
  @IsOptional()
  @IsObject()
  permissions?: Record<string, any>;

  @ApiProperty({
    description: 'Wallet configuration (optional)',
    type: WalletDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => WalletDto)
  wallet?: WalletDto;
}

