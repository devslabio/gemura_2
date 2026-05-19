import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LocationsController } from './locations.controller';
import { PublicLocationsController } from './public-locations.controller';
import { LocationsService } from './locations.service';

@Module({
  imports: [PrismaModule],
  controllers: [LocationsController, PublicLocationsController],
  providers: [LocationsService],
  exports: [LocationsService],
})
export class LocationsModule {}
