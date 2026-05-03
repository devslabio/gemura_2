import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class ManifestLineInputDto {
  @ApiProperty()
  @IsUUID('4')
  farmer_supplier_account_id!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  declared_litres!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  container_id?: string;
}

export class CreateManifestDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  account_id?: string;

  @ApiProperty()
  @IsUUID('4')
  gate_delivery_id!: string;

  @ApiProperty({ description: 'Usually the Umucunda supplier account on the gate delivery.' })
  @IsUUID('4')
  umucunda_supplier_account_id!: string;

  @ApiProperty({ type: [ManifestLineInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManifestLineInputDto)
  lines!: ManifestLineInputDto[];
}
