import { Module } from '@nestjs/common';
import { PresenceController } from './presence.controller';
import { ChangeActivityUseCase } from './application/use-cases/change-activity.use-case';
import { DeskPlacedListener } from './application/listeners/desk-placed.listener';
import { PresencePrismaRepository } from './infrastructure/presence-prisma.repository';
import { PRESENCE_REPOSITORY } from './domain/presence.repository.interface';
import { OutboxService } from '../../../../../libs/shared-kernel/src/infrastructure/outbox.service';

@Module({
  controllers: [PresenceController],
  providers: [
    ChangeActivityUseCase,
    DeskPlacedListener,
    OutboxService,
    {
      provide: PRESENCE_REPOSITORY,
      useClass: PresencePrismaRepository,
    },
  ],
})
export class PresenceModule {}
