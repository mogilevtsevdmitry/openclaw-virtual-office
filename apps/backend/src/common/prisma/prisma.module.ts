import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Alias token used by shared-kernel OutboxService
export const PRISMA_SERVICE = 'PRISMA_SERVICE';

@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: PRISMA_SERVICE,
      useExisting: PrismaService,
    },
  ],
  exports: [PrismaService, PRISMA_SERVICE],
})
export class PrismaModule {}
