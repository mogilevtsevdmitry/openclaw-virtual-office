import { DomainEvent } from '../../../../../../../libs/shared-kernel/src/domain/domain-event.base';

export class DeskPlacedEvent extends DomainEvent {
  readonly eventType = 'desk.placed';

  constructor(
    public readonly aggregateId: string, // deskId (officeObjectId)
    public readonly tenantId: string,
    public readonly agentId: string,
    public readonly zoneId: string,
    public readonly floorId: string,
    params?: { correlationId?: string },
  ) {
    super(params);
  }

  toPayload(): Record<string, unknown> {
    return {
      deskId: this.aggregateId,
      tenantId: this.tenantId,
      agentId: this.agentId,
      zoneId: this.zoneId,
      floorId: this.floorId,
      occurredAt: this.occurredAt.toISOString(),
    };
  }
}
