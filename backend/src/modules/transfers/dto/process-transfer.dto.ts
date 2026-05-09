import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsIn, Min } from 'class-validator';

export class ProcessTransferDto {
  @ApiProperty({ enum: ['accepted', 'rejected'] })
  @IsIn(['accepted', 'rejected'])
  status: 'accepted' | 'rejected';

  @ApiPropertyOptional({ description: 'Accepted quantity in liters (for partial acceptance)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  accepted_liters?: number;

  @ApiPropertyOptional({ description: 'Required if status is rejected' })
  @IsOptional()
  @IsString()
  rejection_reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
