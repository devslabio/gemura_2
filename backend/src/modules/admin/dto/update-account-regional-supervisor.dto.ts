import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

/** Body must include `regional_supervisor_user_id` (UUID or null to clear). */
export class UpdateAccountRegionalSupervisorDto {
  @ApiProperty({ nullable: true, required: true, description: 'Supervisor user id, or null to clear.' })
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  regional_supervisor_user_id!: string | null;
}
