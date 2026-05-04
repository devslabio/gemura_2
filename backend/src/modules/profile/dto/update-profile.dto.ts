import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({ required: false, description: 'Given name' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiProperty({ required: false, description: 'Family name' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiProperty({ required: false, description: 'Deprecated: use first_name + last_name; split if sent alone.' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nid?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sector?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cell?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  village?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  id_number?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  id_front_photo_url?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  id_back_photo_url?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  selfie_photo_url?: string;
}

