import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsNumber, IsDateString, IsUUID, Min } from 'class-validator';
import { AnimalGenderEnum, AnimalSourceEnum, AnimalStatusEnum } from './create-animal.dto';
import { IsNotFutureDate } from '../../../common/validators/not-future-date.validator';

export class UpdateAnimalDto {
  @ApiPropertyOptional({ description: 'Tag number' })
  @IsOptional()
  @IsString()
  tag_number?: string;

  @ApiPropertyOptional({ description: 'Name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description:
      'Species ID (UUID) – only when updating breed_id; must match the new breed’s species. Omit to derive from breed.',
  })
  @IsOptional()
  @IsUUID()
  species_id?: string;

  @ApiPropertyOptional({ description: 'Breed ID (UUID) – from GET /api/breeds?species_id=…' })
  @IsOptional()
  @IsUUID()
  breed_id?: string;

  @ApiPropertyOptional({ enum: AnimalGenderEnum })
  @IsOptional()
  @IsEnum(AnimalGenderEnum)
  gender?: AnimalGenderEnum;

  @ApiPropertyOptional({ description: 'Date of birth (ISO date), must not be in the future' })
  @IsOptional()
  @IsDateString()
  @IsNotFutureDate({ message: 'Date of birth must not be in the future' })
  date_of_birth?: string;

  @ApiPropertyOptional({ enum: AnimalSourceEnum })
  @IsOptional()
  @IsEnum(AnimalSourceEnum)
  source?: AnimalSourceEnum;

  @ApiPropertyOptional({ description: 'Purchase date (must not be in the future)' })
  @IsOptional()
  @IsDateString()
  @IsNotFutureDate({ message: 'Purchase date must not be in the future' })
  purchase_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  purchase_price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mother_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  father_id?: string;

  @ApiPropertyOptional({ enum: AnimalStatusEnum })
  @IsOptional()
  @IsEnum(AnimalStatusEnum)
  status?: AnimalStatusEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photo_url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Farm ID where the animal is kept (UUID)' })
  @IsOptional()
  @IsString()
  farm_id?: string;
}
