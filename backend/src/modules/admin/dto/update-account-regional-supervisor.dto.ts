import { ApiProperty } from '@nestjs/swagger';

/** Body must include `regional_supervisor_user_id` (UUID or null to clear). */
export class UpdateAccountRegionalSupervisorDto {
  @ApiProperty({ nullable: true, required: true, description: 'Supervisor user id, or null to clear.' })
  regional_supervisor_user_id!: string | null;
}
