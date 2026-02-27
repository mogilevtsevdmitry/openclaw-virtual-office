export abstract class DomainEvent {
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly correlationId?: string;
  readonly causationId?: string;

  abstract readonly eventType: string;
  abstract readonly aggregateId: string;
  abstract readonly tenantId: string;

  constructor(params?: { correlationId?: string; causationId?: string }) {
    this.eventId = crypto.randomUUID();
    this.occurredAt = new Date();
    this.correlationId = params?.correlationId;
    this.causationId = params?.causationId;
  }

  abstract toPayload(): Record<string, unknown>;
}
