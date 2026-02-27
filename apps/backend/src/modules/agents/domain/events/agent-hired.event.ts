import { DomainEvent } from '../../../../../../../libs/shared-kernel/src/domain/domain-event.base';

export class AgentHiredEvent extends DomainEvent {
  readonly eventType = 'agent.hired';

  constructor(
    public readonly aggregateId: string,
    public readonly tenantId: string,
    public readonly agentName: string,
    public readonly agentRole: string,
    public readonly departmentId: string | null,
    params?: { correlationId?: string },
  ) {
    super(params);
  }

  toPayload(): Record<string, unknown> {
    return {
      agentId: this.aggregateId,
      tenantId: this.tenantId,
      name: this.agentName,
      role: this.agentRole,
      departmentId: this.departmentId,
      occurredAt: this.occurredAt.toISOString(),
    };
  }
}
