import { DomainEvent } from '../../../../../../../libs/shared-kernel/src/domain/domain-event.base';

export class AgentDeactivatedEvent extends DomainEvent {
  readonly eventType = 'agent.deactivated';

  constructor(
    public readonly aggregateId: string,
    public readonly tenantId: string,
    params?: { correlationId?: string },
  ) {
    super(params);
  }

  toPayload(): Record<string, unknown> {
    return {
      agentId: this.aggregateId,
      tenantId: this.tenantId,
      occurredAt: this.occurredAt.toISOString(),
    };
  }
}
