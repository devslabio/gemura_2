import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

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

  @ApiProperty({
    required: false,
    description: 'Replaces existing detail when provided.',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  detail?: Record<string, unknown>;

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'Optional manifest line for this gate delivery; send null to clear. Line must belong to the same gate as the test.',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUUID('4')
  manifest_line_id?: string | null;
}
