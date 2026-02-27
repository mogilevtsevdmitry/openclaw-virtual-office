import { Injectable, Inject, LoggerService, Optional } from '@nestjs/common';
import { DomainEvent } from '../domain/domain-event.base';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

// PrismaService is injected by the backend app — we use a dynamic import token
export const PRISMA_SERVICE_TOKEN = 'PRISMA_SERVICE';

@Injectable()
export class OutboxService {
  constructor(
    @Inject(PRISMA_SERVICE_TOKEN)
    private readonly prisma: any,
    @Optional()
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger?: LoggerService,
  ) {}

  async saveEvents(events: DomainEvent[], sourceBC: string): Promise<void> {
    if (events.length === 0) return;

    const outboxRecords = events.map((event) => ({
      eventId: event.eventId,
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      tenantId: event.tenantId,
      payload: event.toPayload() as any,
      processed: false,
      retries: 0,
    }));

    const auditRecords = events.map((event) => ({
      eventId: event.eventId,
      eventType: event.eventType,
      sourceBC,
      aggregateId: event.aggregateId,
      tenantId: event.tenantId,
      payload: event.toPayload() as any,
      correlationId: event.correlationId,
      causationId: event.causationId,
      version: 1,
      occurredAt: event.occurredAt,
    }));

    await this.prisma.$transaction([
      this.prisma.outbox.createMany({ data: outboxRecords, skipDuplicates: true }),
      this.prisma.event.createMany({ data: auditRecords, skipDuplicates: true }),
    ]);

    this.logger?.log?.(
      { message: 'Domain events saved to outbox', count: events.length, sourceBC },
      'OutboxService',
    );
  }

  async markProcessed(eventId: string): Promise<void> {
    await this.prisma.outbox.update({
      where: { eventId },
      data: { processed: true, processedAt: new Date() },
    });
  }

  async markFailed(eventId: string, error: string): Promise<void> {
    await this.prisma.outbox.update({
      where: { eventId },
      data: { error, retries: { increment: 1 } },
    });
  }

  async getUnprocessed(limit = 100): Promise<any[]> {
    return this.prisma.outbox.findMany({
      where: { processed: false, retries: { lt: 5 } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async getSince(tenantId: string, sinceEventId: string, limit = 200): Promise<any[]> {
    const sinceRecord = await this.prisma.outbox.findUnique({
      where: { eventId: sinceEventId },
      select: { createdAt: true },
    });

    if (!sinceRecord) return [];

    return this.prisma.outbox.findMany({
      where: {
        tenantId,
        createdAt: { gt: sinceRecord.createdAt },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }
}
