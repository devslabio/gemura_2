import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { ManifestLineInputDto } from './create-manifest.dto';

export class UpdateManifestDraftDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  account_id?: string;

  @ApiProperty({ type: [ManifestLineInputDto], required: false, description: 'Replace all lines when provided.' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManifestLineInputDto)
  lines?: ManifestLineInputDto[];
}
