import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEnum, IsDateString, Min } from 'class-validator';
import { MilkSaleStatus } from '@prisma/client';
import { IsNotFutureDate } from '../../../common/validators/not-future-date.validator';

export class UpdateCollectionDto {
  @ApiProperty({
    description: 'Collection ID',
    example: 'collection-uuid',
  })
  @IsString()
  collection_id: string;

  @ApiProperty({
    description: 'Quantity of milk in liters',
    example: 120.5,
    minimum: 0,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  quantity?: number;

  @ApiProperty({
    description: 'Collection status',
    enum: ['pending', 'accepted', 'rejected', 'cancelled'],
    example: 'accepted',
    required: false,
  })
  @IsEnum(['pending', 'accepted', 'rejected', 'cancelled'])
  @IsOptional()
  status?: MilkSaleStatus;

  @ApiProperty({
    description: 'Collection date and time (must not be in the future)',
    example: '2025-01-04T10:00:00Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  @IsNotFutureDate({ message: 'Collection date must not be in the future' })
  collection_at?: string;

  @ApiProperty({
    description: 'Additional notes',
    example: 'Updated after verification',
    required: false,
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({
    description: 'Rejection reason. Required when status is rejected',
    example: 'Added water',
    required: false,
  })
  @IsString()
  @IsOptional()
  rejection_reason?: string;

  @ApiProperty({
    description: 'Optional animal ID (UUID) - link collection to a specific animal belonging to the supplier',
    required: false,
  })
  @IsOptional()
  @IsString()
  animal_id?: string;
}

