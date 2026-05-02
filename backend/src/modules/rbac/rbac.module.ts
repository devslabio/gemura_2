import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RbacService } from './rbac.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [RbacService],
  exports: [RbacService],
})
export class RbacModule {}
