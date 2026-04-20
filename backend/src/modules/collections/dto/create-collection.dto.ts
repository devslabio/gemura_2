import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';
import { IsNotFutureDate } from '../../../common/validators/not-future-date.validator';

export class CreateCollectionDto {
  @ApiProperty({
    description: 'Supplier account code (from supplier creation)',
    example: 'A_ABC123',
    required: true,
  })
  @IsNotEmpty({ message: 'Supplier account code is required' })
  @IsString({ message: 'Supplier account code must be a string' })
  supplier_account_code: string;

  @ApiProperty({
    description: 'Quantity of milk collected in liters',
    example: 120.5,
    minimum: 0.01,
    required: true,
  })
  @IsNotEmpty({ message: 'Quantity is required' })
  @IsNumber({}, { message: 'Quantity must be a number' })
  quantity: number;

  @ApiProperty({
    description: 'Collection status',
    example: 'accepted',
    enum: ['pending', 'accepted', 'rejected', 'cancelled'],
    required: false,
    default: 'accepted',
  })
  @IsOptional()
  @IsString({ message: 'Status must be a string' })
  status?: string;

  @ApiProperty({
    description: 'Collection date and time (must not be in the future)',
    example: '2025-01-04 10:00:00',
    required: true,
  })
  @IsNotEmpty({ message: 'Collection date/time is required' })
  @IsString({ message: 'Collection date/time must be a string' })
  @IsNotFutureDate({ message: 'Collection date must not be in the future' })
  collection_at: string;

  @ApiProperty({
    description: 'Additional notes about the collection (optional)',
    example: 'Morning collection, good quality milk',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Notes must be a string' })
  notes?: string;

  @ApiProperty({
    description: 'Rejection reason. Required when status is rejected',
    example: 'Added water',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Rejection reason must be a string' })
  rejection_reason?: string;

  @ApiProperty({
    description: 'Payment status - whether payment has been made',
    example: 'paid',
    enum: ['paid', 'unpaid'],
    required: false,
    default: 'unpaid',
  })
  @IsOptional()
  @IsString({ message: 'Payment status must be a string' })
  payment_status?: string;

  @ApiProperty({
    description: 'Optional animal ID (UUID) - link collection to a specific animal belonging to the supplier',
    required: false,
  })
  @IsOptional()
  @IsString()
  animal_id?: string;

  @ApiProperty({
    description: 'Optional milk production record ID (UUID) - link this sale to a recorded production',
    required: false,
  })
  @IsOptional()
  @IsString()
  milk_production_id?: string;
}

