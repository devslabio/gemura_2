import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class NeedsChangesOnboardingDto {
  @ApiProperty({ description: 'What the applicant should fix or supply.' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(5000)
  notes: string;
}
