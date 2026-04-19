import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  IsUUID,
  Min,
} from 'class-validator';
import { IsNotFutureDate } from '../../../common/validators/not-future-date.validator';

export enum AnimalGenderEnum {
  male = 'male',
  female = 'female',
}

export enum AnimalSourceEnum {
  born_on_farm = 'born_on_farm',
  purchased = 'purchased',
  donated = 'donated',
  other = 'other',
}

export enum AnimalStatusEnum {
  active = 'active',
  lactating = 'lactating',
  dry = 'dry',
  pregnant = 'pregnant',
  sick = 'sick',
  sold = 'sold',
  dead = 'dead',
  culled = 'culled',
}

export class CreateAnimalDto {
  @ApiProperty({ description: 'Unique tag number (e.g. ear tag)', example: 'TAG-001' })
  @IsNotEmpty()
  @IsString()
  tag_number: string;

  @ApiPropertyOptional({ description: 'Optional name', example: 'Bella' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description:
      'Optional species ID (UUID) – must match the breed’s species (GET /api/species). Omit to infer species from breed only.',
    example: '11111111-1111-4111-8111-111111111101',
  })
  @IsOptional()
  @IsUUID()
  species_id?: string;

  @ApiProperty({ description: 'Breed ID (UUID) – from GET /api/breeds?species_id=…', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsNotEmpty()
  @IsUUID()
  breed_id: string;

  @ApiProperty({ description: 'Gender', enum: AnimalGenderEnum })
  @IsNotEmpty()
  @IsEnum(AnimalGenderEnum)
  gender: AnimalGenderEnum;

  @ApiProperty({ description: 'Date of birth (ISO date), must not be in the future', example: '2022-03-15' })
  @IsNotEmpty()
  @IsDateString()
  @IsNotFutureDate({ message: 'Date of birth must not be in the future' })
  date_of_birth: string;

  @ApiProperty({ description: 'Source', enum: AnimalSourceEnum })
  @IsNotEmpty()
  @IsEnum(AnimalSourceEnum)
  source: AnimalSourceEnum;

  @ApiPropertyOptional({ description: 'Purchase date if source is purchased (must not be in the future)' })
  @IsOptional()
  @IsDateString()
  @IsNotFutureDate({ message: 'Purchase date must not be in the future' })
  purchase_date?: string;

  @ApiPropertyOptional({ description: 'Purchase price if purchased' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  purchase_price?: number;

  @ApiPropertyOptional({ description: 'Mother animal ID (UUID)' })
  @IsOptional()
  @IsString()
  mother_id?: string;

  @ApiPropertyOptional({ description: 'Father animal ID (UUID)' })
  @IsOptional()
  @IsString()
  father_id?: string;

  @ApiPropertyOptional({ description: 'Status', enum: AnimalStatusEnum, default: 'active' })
  @IsOptional()
  @IsEnum(AnimalStatusEnum)
  status?: AnimalStatusEnum;

  @ApiPropertyOptional({ description: 'Photo URL' })
  @IsOptional()
  @IsString()
  photo_url?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Farm ID where the animal is kept (UUID). Animal registration is limited to one farm.' })
  @IsNotEmpty()
  @IsUUID()
  farm_id: string;
}
