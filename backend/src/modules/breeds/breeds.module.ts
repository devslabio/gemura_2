import { Module } from '@nestjs/common';
import { BreedsController } from './breeds.controller';
import { BreedsService } from './breeds.service';
import { SpeciesController } from './species.controller';
import { SpeciesService } from './species.service';

@Module({
  controllers: [BreedsController, SpeciesController],
  providers: [BreedsService, SpeciesService],
  exports: [BreedsService, SpeciesService],
})
export class BreedsModule {}
