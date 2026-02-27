import { Module } from '@nestjs/common';
import { OfficeController } from './office.controller';
import { CreateFloorUseCase } from './application/use-cases/create-floor.use-case';
import { CreateDepartmentUseCase } from './application/use-cases/create-department.use-case';
import { PlaceDeskForAgentUseCase } from './application/use-cases/place-desk-for-agent.use-case';
import { FloorPrismaRepository } from './infrastructure/floor-prisma.repository';
import { FLOOR_REPOSITORY } from './domain/floor.repository.interface';
import { OutboxService } from '../../../../../libs/shared-kernel/src/infrastructure/outbox.service';

@Module({
  controllers: [OfficeController],
  providers: [
    CreateFloorUseCase,
    CreateDepartmentUseCase,
    PlaceDeskForAgentUseCase,
    OutboxService,
    {
      provide: FLOOR_REPOSITORY,
      useClass: FloorPrismaRepository,
    },
  ],
  exports: [PlaceDeskForAgentUseCase],
})
export class OfficeModule {}
