import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateTestResultDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  account_id?: string;

  @ApiProperty({ enum: ['pending', 'accepted', 'rejected'] })
  @IsEnum(['pending', 'accepted', 'rejected'])
  outcome!: 'pending' | 'accepted' | 'rejected';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  rejection_cause?: string;
}
