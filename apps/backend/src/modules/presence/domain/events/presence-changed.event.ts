import { DomainEvent } from '../../../../../../../libs/shared-kernel/src/domain/domain-event.base';
import { PresenceStateValue } from '../value-objects/presence-state.vo';

export class PresenceChangedEvent extends DomainEvent {
  readonly eventType = 'presence.state_changed';

  constructor(
    public readonly aggregateId: string, // presenceId
    public readonly tenantId: string,
    public readonly agentId: string,
    public readonly fromState: PresenceStateValue,
    public readonly toState: PresenceStateValue,
    public readonly zoneId: string | null,
    params?: { correlationId?: string },
  ) {
    super(params);
  }

  toPayload(): Record<string, unknown> {
    return {
      presenceId: this.aggregateId,
      tenantId: this.tenantId,
      agentId: this.agentId,
      fromState: this.fromState,
      toState: this.toState,
      zoneId: this.zoneId,
      occurredAt: this.occurredAt.toISOString(),
    };
  }
}
