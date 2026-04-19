import { Module } from '@nestjs/common';
import { PoultryFlocksController } from './poultry-flocks.controller';
import { PoultryFlocksService } from './poultry-flocks.service';

@Module({
  controllers: [PoultryFlocksController],
  providers: [PoultryFlocksService],
  exports: [PoultryFlocksService],
})
export class PoultryFlocksModule {}
