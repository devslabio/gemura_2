import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, IsEnum, IsUUID, ValidateNested } from 'class-validator';
import { FarmStatus } from '@prisma/client';
import { FarmSpeciesFocusDto } from './farm-species-focus.dto';

export class UpdateFarmDto {
  @ApiPropertyOptional({ description: 'Farm name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Administrative location ID from /api/locations hierarchy' })
  @IsOptional()
  @IsUUID()
  location_id?: string;

  @ApiPropertyOptional({ description: 'Extra address or location notes (free text)' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Description / notes about the farm' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Farm status', enum: FarmStatus })
  @IsOptional()
  @IsEnum(FarmStatus)
  status?: FarmStatus;

  @ApiPropertyOptional({
    type: [FarmSpeciesFocusDto],
    description: 'Replace farm species focus rows when provided (omit to leave unchanged)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FarmSpeciesFocusDto)
  species_focus?: FarmSpeciesFocusDto[];
}

