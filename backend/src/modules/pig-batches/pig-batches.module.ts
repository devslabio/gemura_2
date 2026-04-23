import { Module } from '@nestjs/common';
import { PigBatchesController } from './pig-batches.controller';
import { PigFarrowingsController } from './pig-farrowings.controller';
import { PigBatchesService } from './pig-batches.service';

@Module({
  controllers: [PigBatchesController, PigFarrowingsController],
  providers: [PigBatchesService],
  exports: [PigBatchesService],
})
export class PigBatchesModule {}
