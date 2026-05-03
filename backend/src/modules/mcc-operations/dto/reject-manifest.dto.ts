import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class RejectManifestDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  account_id?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  rejection_reason!: string;
}
