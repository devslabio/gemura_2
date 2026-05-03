import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGateDeliveryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  account_id?: string;

  @ApiProperty({ enum: ['direct', 'umucunda_a', 'umucunda_b'] })
  @IsEnum(['direct', 'umucunda_a', 'umucunda_b'])
  source_type!: 'direct' | 'umucunda_a' | 'umucunda_b';

  @ApiProperty()
  @IsUUID('4')
  source_account_id!: string;

  @ApiProperty({ example: 120.5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  gate_volume_litres!: number;

  @ApiProperty({ required: false, description: 'ISO 8601 datetime; defaults to now.' })
  @IsOptional()
  @IsString()
  arrived_at?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
