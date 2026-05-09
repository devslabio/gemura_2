import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class UpdateAccountOperationalLocationDto {
  @ApiPropertyOptional({
    description: 'Admin location UUID (typically village). Send null to clear geography.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o: UpdateAccountOperationalLocationDto) => o.operational_location_id != null && o.operational_location_id !== '')
  @IsUUID()
  operational_location_id?: string | null;
}
