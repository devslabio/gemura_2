import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOnboardingOperationalConfigDto {
  @ApiPropertyOptional({
    description: 'Expected number of deliveries per day for this MCC account. Send null to clear.',
    example: 12,
  })
  @IsOptional()
  expected_daily_deliveries?: number | string | null;

  @ApiPropertyOptional({ description: 'Current tank used litres. Send null to clear.', example: 6200 })
  @IsOptional()
  tank_used_litres?: number | string | null;

  @ApiPropertyOptional({ description: 'Current tank used percentage (0-100). Send null to clear.', example: 62 })
  @IsOptional()
  tank_used_pct?: number | string | null;

  @ApiPropertyOptional({ description: 'Current cooling temperature in Celsius. Send null to clear.', example: 3.8 })
  @IsOptional()
  cooling_temperature_c?: number | string | null;

  @ApiPropertyOptional({
    description: 'Current power status. Send null to clear.',
    enum: ['grid', 'generator', 'solar', 'outage', 'unknown'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['grid', 'generator', 'solar', 'outage', 'unknown'])
  power_status?: string | null;

  @ApiPropertyOptional({
    description: 'Generator status. Send null to clear.',
    enum: ['available', 'running', 'fault', 'offline', 'unknown'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['available', 'running', 'fault', 'offline', 'unknown'])
  generator_status?: string | null;

  @ApiPropertyOptional({ description: 'Generator fuel percentage (0-100). Send null to clear.', example: 78 })
  @IsOptional()
  generator_fuel_pct?: number | string | null;

  @ApiPropertyOptional({
    description: 'ISO timestamp for when these facility values were observed. Send null to clear.',
    example: '2026-05-09T10:30:00.000Z',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  observed_at?: string | null;
}
