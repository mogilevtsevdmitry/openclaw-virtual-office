import { DomainEvent } from '../../../../../../../libs/shared-kernel/src/domain/domain-event.base';

export class DepartmentCreatedEvent extends DomainEvent {
  readonly eventType = 'department.created';

  constructor(
    public readonly aggregateId: string, // zoneId
    public readonly tenantId: string,
    public readonly floorId: string,
    public readonly name: string,
    public readonly type: string,
    params?: { correlationId?: string },
  ) {
    super(params);
  }

  toPayload(): Record<string, unknown> {
    return {
      departmentId: this.aggregateId,
      tenantId: this.tenantId,
      floorId: this.floorId,
      name: this.name,
      type: this.type,
      occurredAt: this.occurredAt.toISOString(),
    };
  }
}
