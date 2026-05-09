import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class SetRegionalSupervisorScopeDto {
  @ApiProperty({
    description: 'District location UUIDs (Location.location_type = DISTRICT) this user may supervise.',
    type: [String],
    example: [],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  district_location_ids!: string[];
}
