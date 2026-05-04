import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSupplierDto } from './create-supplier.dto';

export class BulkCreateSuppliersDto {
  @ApiProperty({
    description: 'Array of suppliers to create or update',
    type: [CreateSupplierDto],
    example: [
      { first_name: 'Supplier', last_name: 'One', phone: '250788111111', price_per_liter: 390, nid: '1199887766554433' },
      { first_name: 'Supplier', last_name: 'Two', phone: '250788222222', price_per_liter: 400, email: 'two@example.com', nid: '1199887766554434' },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSupplierDto)
  rows: CreateSupplierDto[];
}
