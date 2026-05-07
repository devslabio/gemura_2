import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'User ID (legacy numeric ID or UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @ApiProperty({
    description: '6-digit reset code received via SMS/email',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  reset_code: string;

  @ApiProperty({
    description: 'New password (minimum 6 characters)',
    example: 'NewSecurePassword123!',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  new_password: string;
}

