import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class ApproveTestResolutionDto {
  @ApiProperty({
    enum: ['resolved', 'secondary_test', 'frozen'],
    example: 'resolved',
  })
  @IsEnum(['resolved', 'secondary_test', 'frozen'])
  source_resolution_status!: 'resolved' | 'secondary_test' | 'frozen';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  account_id?: string;
}
