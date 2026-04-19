import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { FarmSpeciesFocusDto } from './farm-species-focus.dto';

export class CreateFarmDto {
  @ApiProperty({ description: 'Farm name', example: 'Main Dairy Farm' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Administrative location (village/cell/sector/district/province). ID from /api/locations hierarchy.' })
  @IsOptional()
  @IsUUID()
  location_id?: string;

  @ApiPropertyOptional({ description: 'Extra address or location notes (free text)', example: 'Near main road' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Description / notes about the farm', example: 'Main milking unit with 50 lactating cows.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    type: [FarmSpeciesFocusDto],
    description: 'Optional species + production modes for this farm (feature gates / nav)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FarmSpeciesFocusDto)
  species_focus?: FarmSpeciesFocusDto[];
}

