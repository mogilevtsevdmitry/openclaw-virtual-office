import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IPresenceRepository, PRESENCE_REPOSITORY } from '../../domain/presence.repository.interface';
import { ChangeActivityDto } from '../dto/change-activity.dto';
import { OutboxService } from '../../../../../../../libs/shared-kernel/src/infrastructure/outbox.service';
import { PresenceStateValue } from '../../domain/value-objects/presence-state.vo';

@Injectable()
export class ChangeActivityUseCase {
  constructor(
    @Inject(PRESENCE_REPOSITORY)
    private readonly presenceRepository: IPresenceRepository,
    private readonly outboxService: OutboxService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(agentId: string, dto: ChangeActivityDto): Promise<{
    agentId: string;
    state: string;
    zoneId: string | null;
  }> {
    const presence = await this.presenceRepository.findByAgentId(agentId);
    if (!presence) {
      throw new NotFoundException(
        `Presence not found for agent ${agentId}. Presence is initialized only via DeskPlaced event.`,
      );
    }

    presence.changeActivity(dto.state as PresenceStateValue, dto.zoneId);

    await this.presenceRepository.save(presence);
    await this.outboxService.saveEvents(presence.domainEvents as any[], 'presence');

    for (const event of presence.domainEvents) {
      this.eventEmitter.emit(event.eventType, event);
    }
    presence.clearDomainEvents();

    return {
      agentId: presence.agentId,
      state: presence.state.value,
      zoneId: presence.zoneId,
    };
  }
}
