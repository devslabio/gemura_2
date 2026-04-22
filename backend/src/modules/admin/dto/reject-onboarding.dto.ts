import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectOnboardingDto {
  @ApiProperty({ description: 'Reason for rejection (required).' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(5000)
  notes: string;
}
