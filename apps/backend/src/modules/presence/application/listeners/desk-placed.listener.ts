import { Injectable, LoggerService, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DeskPlacedEvent } from '../../../office/domain/events/desk-placed.event';
import { IPresenceRepository, PRESENCE_REPOSITORY } from '../../domain/presence.repository.interface';
import { AgentPresence } from '../../domain/agent-presence.aggregate';
import { OutboxService } from '../../../../../../../libs/shared-kernel/src/infrastructure/outbox.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Injectable()
export class DeskPlacedListener {
  constructor(
    @Inject(PRESENCE_REPOSITORY)
    private readonly presenceRepository: IPresenceRepository,
    private readonly outboxService: OutboxService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  @OnEvent('desk.placed')
  async handleDeskPlaced(event: DeskPlacedEvent): Promise<void> {
    this.logger.log(
      {
        message: 'DeskPlacedListener: initializing presence for agent',
        agentId: event.agentId,
        zoneId: event.zoneId,
      },
      'DeskPlacedListener',
    );

    // Idempotency check: presence may already exist
    const existing = await this.presenceRepository.findByAgentId(event.agentId);
    if (existing) {
      this.logger.warn(
        {
          message: 'DeskPlacedListener: presence already exists, skipping',
          agentId: event.agentId,
        },
        'DeskPlacedListener',
      );
      return;
    }

    try {
      const presence = AgentPresence.initializeFromDeskPlaced({
        agentId: event.agentId,
        tenantId: event.tenantId,
        zoneId: event.zoneId,
        correlationId: event.correlationId,
      });

      await this.presenceRepository.save(presence);
      await this.outboxService.saveEvents(presence.domainEvents as any[], 'presence');

      for (const domainEvent of presence.domainEvents) {
        this.eventEmitter.emit(domainEvent.eventType, domainEvent);
      }
      presence.clearDomainEvents();

      this.logger.log(
        { message: 'Presence initialized', agentId: event.agentId, presenceId: presence.id },
        'DeskPlacedListener',
      );
    } catch (err) {
      this.logger.error(
        {
          message: 'DeskPlacedListener: failed to initialize presence',
          agentId: event.agentId,
          error: err instanceof Error ? err.message : String(err),
        },
        'DeskPlacedListener',
      );
    }
  }
}
