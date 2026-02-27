import { DomainEvent } from '../../../../../../../libs/shared-kernel/src/domain/domain-event.base';

export class FloorCreatedEvent extends DomainEvent {
  readonly eventType = 'floor.created';

  constructor(
    public readonly aggregateId: string,
    public readonly tenantId: string,
    public readonly floorName: string,
    params?: { correlationId?: string },
  ) {
    super(params);
  }

  toPayload(): Record<string, unknown> {
    return {
      floorId: this.aggregateId,
      tenantId: this.tenantId,
      name: this.floorName,
      occurredAt: this.occurredAt.toISOString(),
    };
  }
}
