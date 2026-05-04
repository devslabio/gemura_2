import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEmail, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'Given name',
    example: 'John',
    minLength: 1,
    maxLength: 80,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(80)
  first_name: string;

  @ApiProperty({
    description: 'Family name',
    example: 'Doe',
    minLength: 1,
    maxLength: 80,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(80)
  last_name: string;

  @ApiProperty({
    description: 'Phone number (required)',
    example: '+250788123456',
    pattern: '^\\+?[0-9]{10,15}$',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9]{10,15}$/, {
    message: 'Phone number must be a valid phone number format (10-15 digits, optional + prefix)',
  })
  phone_number: string;

  @ApiProperty({
    description: 'Email address (optional)',
    example: 'user@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiProperty({
    description: 'Location/address (optional)',
    example: 'Kigali, Rwanda',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @ApiProperty({
    description: 'Password for the new user',
    example: 'SecurePassword123!',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
