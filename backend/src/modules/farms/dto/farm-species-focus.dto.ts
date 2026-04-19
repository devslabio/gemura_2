import { ApiProperty } from '@nestjs/swagger';
import { FarmProductionMode } from '@prisma/client';
import { IsArray, IsEnum, IsUUID } from 'class-validator';

export class FarmSpeciesFocusDto {
  @ApiProperty({ description: 'Species UUID', format: 'uuid' })
  @IsUUID()
  species_id: string;

  @ApiProperty({
    description: 'Production modes for this species at this farm',
    enum: FarmProductionMode,
    isArray: true,
    example: ['dairy', 'meat'],
  })
  @IsArray()
  @IsEnum(FarmProductionMode, { each: true })
  modes: FarmProductionMode[];
}
