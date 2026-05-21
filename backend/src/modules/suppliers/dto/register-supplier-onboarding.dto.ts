import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  IsObject,
  IsIn,
  IsUUID,
  IsNumber,
  IsArray,
  Min,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

function trimOrUndef(val: unknown): string | undefined {
  if (val == null) return undefined;
  if (typeof val !== 'string') return undefined;
  const t = val.trim();
  return t.length ? t : undefined;
}

export class RegisterSupplierOnboardingDto {
  @ApiProperty({ description: 'MCC (customer) account id the supplier will sell milk to' })
  @IsUUID()
  mcc_account_id: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ example: '250788123456' })
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @IsString()
  @Matches(/^250[0-9]{9}$/, {
    message: 'Phone must be Rwandan format: 250 followed by 9 digits (e.g. 250788123456).',
  })
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ enum: ['farmer', 'supplier'] })
  @IsIn(['farmer', 'supplier'])
  account_type: 'farmer' | 'supplier';

  @ApiPropertyOptional({ enum: ['direct_farmer', 'farmer_collector', 'pure_collector'] })
  @IsOptional()
  @IsIn(['direct_farmer', 'farmer_collector', 'pure_collector'])
  supplier_segment?: string;

  @ApiProperty({ description: 'Full buildOnboardingPayload object from the web app' })
  @IsObject()
  onboarding: Record<string, unknown>;

  /** Same as CreateSupplier — milk price for this MCC relationship (RWF). */
  @ApiProperty({ example: 390 })
  @Type(() => Number)
  @IsNumber({}, { message: 'Price per liter must be a number' })
  @Min(0.01, { message: 'Price per liter must be greater than 0' })
  price_per_liter: number;

  @ApiProperty({ description: 'National ID — 16 digits, starts with 1', example: '1199887766554433' })
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @IsString()
  @Length(16, 16, { message: 'National ID must be exactly 16 digits' })
  @Matches(/^1[0-9]{15}$/, { message: 'National ID must be 16 digits and start with 1' })
  nid: string;

  @ApiPropertyOptional()
  @Transform(({ value }) => trimOrUndef(value))
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Address is too long' })
  address?: string;

  @ApiPropertyOptional()
  @Transform(({ value }) => trimOrUndef(value))
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'Bank name must be at most 120 characters' })
  bank_name?: string;

  @ApiPropertyOptional()
  @Transform(({ value }) => trimOrUndef(value))
  @ValidateIf((_o, v) => typeof v === 'string' && v.trim().length > 0)
  @IsOptional()
  @IsString()
  @MinLength(5, { message: 'Bank account number looks too short' })
  @MaxLength(64, { message: 'Bank account number must be at most 64 characters' })
  bank_account_number?: string;
}

export class UpdateSupplierMilkOnboardingDto {
  @ApiPropertyOptional({ description: 'Patch updates into onboarding.draft (shallow merge at draft root)' })
  @IsOptional()
  @IsObject()
  draft?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'When set, replaces the entire milk onboarding JSON document (supplier self-service wizard save).',
  })
  @IsOptional()
  @IsObject()
  onboarding?: Record<string, unknown>;
}

export class CreateManagedFarmDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ enum: ['active', 'inactive'] })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}

export class UpdateManagedFarmDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ enum: ['active', 'inactive'] })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}

export class DeleteManagedFarmDto {
  @ApiProperty()
  @IsString()
  id: string;
}

export class CreateManagedCollectionDto {
  @ApiProperty()
  @IsString()
  farm_id: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  farm_name?: string;

  @ApiProperty({ enum: ['own_farm', 'external_farm'] })
  @IsIn(['own_farm', 'external_farm'])
  source_type: 'own_farm' | 'external_farm';

  @ApiProperty()
  @IsNumber()
  liters: number;

  @ApiProperty()
  @IsString()
  collected_at: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  quality_grade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateManagedProductionDto {
  @ApiProperty()
  @IsNumber()
  liters: number;

  @ApiProperty()
  @IsString()
  produced_at: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class TransferCollectionLineDto {
  @ApiProperty()
  @IsString()
  collection_id: string;

  @ApiProperty({ description: 'Liters from this collection to include in the manifest (≤ remaining on hand)' })
  @Type(() => Number)
  @IsNumber({}, { message: 'Liters must be a number' })
  @Min(0.01, { message: 'Transfer liters must be greater than 0' })
  liters: number;
}

export class CreateManagedTransferDto {
  @ApiPropertyOptional({ type: [String], description: 'Legacy: include full remaining liters per collection' })
  @IsOptional()
  collection_ids?: string[];

  @ApiPropertyOptional({
    type: [TransferCollectionLineDto],
    description: 'Preferred: pick collections and liters to transfer (partial allowed)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferCollectionLineDto)
  lines?: TransferCollectionLineDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SubmitManagedTransferDto {
  @ApiProperty()
  @IsString()
  id: string;
}
