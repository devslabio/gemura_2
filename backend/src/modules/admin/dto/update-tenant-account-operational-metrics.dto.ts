import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';

/** Facility dashboard snapshot fields (same semantics as onboarding operational-config snapshot). */
export class FacilitySnapshotPatchDto {
  @ApiPropertyOptional({ description: 'Send null to clear.', example: 6200 })
  @IsOptional()
  tank_used_litres?: number | string | null;

  @ApiPropertyOptional({ description: 'Send null to clear.', example: 62 })
  @IsOptional()
  tank_used_pct?: number | string | null;

  @ApiPropertyOptional({ description: 'Send null to clear.', example: 3.8 })
  @IsOptional()
  cooling_temperature_c?: number | string | null;

  @ApiPropertyOptional({
    description: 'Send null to clear (grid | generator | solar | outage | unknown).',
  })
  @IsOptional()
  power_status?: string | null;

  @ApiPropertyOptional({
    description: 'Send null to clear (available | running | fault | offline | unknown).',
  })
  @IsOptional()
  generator_status?: string | null;

  @ApiPropertyOptional({ description: 'Send null to clear.', example: 78 })
  @IsOptional()
  generator_fuel_pct?: number | string | null;

  @ApiPropertyOptional({
    description: 'ISO timestamp. Send null to clear.',
    example: '2026-05-09T10:30:00.000Z',
  })
  @IsOptional()
  observed_at?: string | null;
}

export class CoolingTankRowDto {
  @ApiPropertyOptional()
  @IsOptional()
  tank_number?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  capacity_litres?: number | string | null;

  @ApiPropertyOptional()
  @IsOptional()
  year_or_age?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  condition?: string | null;
}

export class TenantOperationalProfilePatchDto {
  @ApiPropertyOptional({ description: 'Send null to clear.', example: 12 })
  @IsOptional()
  expected_daily_deliveries?: number | string | null;

  @ApiPropertyOptional()
  @IsOptional()
  daily_milk_volume_litres?: number | string | null;

  @ApiPropertyOptional()
  @IsOptional()
  max_milk_one_day_litres?: number | string | null;

  @ApiPropertyOptional()
  @IsOptional()
  tank_capacity_sufficiency?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  insufficient_capacity_plan?: string | null;

  @ApiPropertyOptional({
    description: 'Structured JSON (e.g. list of supply sources). Send null to clear.',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  power_supply_sources?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  @IsOptional()
  generator_capacity_kva?: number | string | null;

  @ApiPropertyOptional()
  @IsOptional()
  mobile_connectivity?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  total_farmers_supplying?: number | string | null;

  @ApiPropertyOptional()
  @IsOptional()
  new_farmers_last_3_months?: number | string | null;

  @ApiPropertyOptional()
  @IsOptional()
  milk_transporters_count?: number | string | null;

  @ApiPropertyOptional()
  @IsOptional()
  average_distance_km?: number | string | null;

  @ApiPropertyOptional()
  @IsOptional()
  furthest_farm_km?: number | string | null;

  @ApiPropertyOptional()
  @IsOptional()
  evening_milk_pattern?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  own_milk_transport_type?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  record_system?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  avg_days_delivery_to_payment?: number | string | null;

  @ApiPropertyOptional()
  @IsOptional()
  average_annual_revenue_rwf?: number | string | null;

  @ApiPropertyOptional()
  @IsOptional()
  main_buyer_name?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  formal_supply_agreement_details?: string | null;
}

export class UpdateTenantAccountOperationalMetricsDto {
  @ApiPropertyOptional({ type: TenantOperationalProfilePatchDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TenantOperationalProfilePatchDto)
  profile?: TenantOperationalProfilePatchDto;

  @ApiPropertyOptional({ type: FacilitySnapshotPatchDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FacilitySnapshotPatchDto)
  facility_snapshot?: FacilitySnapshotPatchDto;

  @ApiPropertyOptional({
    type: [CoolingTankRowDto],
    description:
      'When present, replaces all cooling tanks for this account (empty array removes all rows). Omit property to leave tanks unchanged.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CoolingTankRowDto)
  cooling_tanks?: CoolingTankRowDto[];
}
