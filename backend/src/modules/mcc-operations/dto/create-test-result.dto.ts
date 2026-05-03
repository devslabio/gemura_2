import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

/** Optional structured quality readings (temperature, fat %, strips, etc.) stored as JSON on `MccMilkTestResult.detail`. */
export class CreateTestResultDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  account_id?: string;

  @ApiProperty()
  @IsUUID('4')
  mcc_gate_delivery_id!: string;

  @ApiProperty({ required: false, description: 'When testing a manifest line.' })
  @IsOptional()
  @IsUUID('4')
  manifest_line_id?: string;

  @ApiProperty({ enum: ['pending', 'accepted', 'rejected'] })
  @IsEnum(['pending', 'accepted', 'rejected'])
  outcome!: 'pending' | 'accepted' | 'rejected';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  rejection_cause?: string;

  @ApiProperty({
    required: false,
    description:
      'Structured quality fields (e.g. temperature_c, fat_percent, alcohol_pass, lactometer_reading, antibiotic_strip, visual_ok, notes).',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  detail?: Record<string, unknown>;
}
