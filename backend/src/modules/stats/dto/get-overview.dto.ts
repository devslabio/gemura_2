import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class GetOverviewDto {
  @ApiPropertyOptional({
    description:
      'When true, aggregates milk KPIs across all tenants (Gemura Admin). Requires manage_users or platform admin on the request membership context. Ignores account_id for milk scope.',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  aggregate_all_accounts?: boolean;

  @ApiPropertyOptional({
    description: 'Account ID to get overview for. Uses user default account when omitted.',
  })
  @IsOptional()
  @IsUUID()
  account_id?: string;

  @ApiPropertyOptional({
    description: 'Start of period (YYYY-MM-DD). When omitted, no start filter.',
  })
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'date_from must be YYYY-MM-DD' })
  date_from?: string;

  @ApiPropertyOptional({
    description: 'End of period (YYYY-MM-DD). When omitted, no end filter.',
  })
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'date_to must be YYYY-MM-DD' })
  date_to?: string;

  @ApiPropertyOptional({
    description:
      'When sent with date_from and date_to: calendar days are interpreted in this fixed offset from UTC (minutes east of Greenwich). Use the same value as `-Date.getTimezoneOffset()` in JavaScript. Omit for legacy UTC-midnight boundaries per date string.',
    minimum: -840,
    maximum: 840,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-840)
  @Max(840)
  tz_offset_minutes?: number;
}
