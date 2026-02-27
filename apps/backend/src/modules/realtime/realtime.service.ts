import { Injectable, LoggerService, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression, Interval } from '@nestjs/schedule';
import { RealtimeGateway } from './realtime.gateway';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { v4 as uuidv4 } from 'uuid';
import { PresenceChangedEvent } from '../presence/domain/events/presence-changed.event';
import { AgentHiredEvent } from '../agents/domain/events/agent-hired.event';
import { DeskPlacedEvent } from '../office/domain/events/desk-placed.event';
import { FloorCreatedEvent } from '../office/domain/events/floor-created.event';

export interface WsEvent {
  eventId: string;
  eventType: string;
  payload: object;
  tenantId: string;
  occurredAt: string;
}

@Injectable()
export class RealtimeService {
  constructor(
    private readonly gateway: RealtimeGateway,
    private readonly prisma: PrismaService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  /**
   * Broadcast a WsEvent to all tenant subscribers
   */
  broadcast(event: WsEvent): void {
    const room = event.tenantId;

    if (!this.gateway.server) {
      this.logger.warn(
        { message: 'WS server not ready yet, skipping broadcast', eventType: event.eventType },
        'RealtimeService',
      );
      return;
    }

    this.gateway.server.to(room).emit('domain_event', event);

    this.logger.log(
      { message: 'WS broadcast', eventType: event.eventType, tenantId: event.tenantId },
      'RealtimeService',
    );
  }

  /**
   * Subscribe handler: return events since sinceEventId
   */
  async getEventsSince(
    tenantId: string,
    sinceEventId: string,
    limit = 200,
  ): Promise<WsEvent[]> {
    const sinceRecord = await this.prisma.outbox.findUnique({
      where: { eventId: sinceEventId },
      select: { createdAt: true },
    });

    if (!sinceRecord) return [];

    const records = await this.prisma.outbox.findMany({
      where: { tenantId, createdAt: { gt: sinceRecord.createdAt } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return records.map((r) => ({
      eventId: r.eventId,
      eventType: r.eventType,
      payload: r.payload as object,
      tenantId: r.tenantId,
      occurredAt: r.createdAt.toISOString(),
    }));
  }

  // ─── Domain event listeners → WS broadcast ─────────────────────────────

  @OnEvent('presence.state_changed')
  onPresenceChanged(event: PresenceChangedEvent): void {
    this.broadcast({
      eventId: event.eventId,
      eventType: 'presence.state_changed',
      payload: event.toPayload(),
      tenantId: event.tenantId,
      occurredAt: event.occurredAt.toISOString(),
    });
  }

  @OnEvent('agent.hired')
  onAgentHired(event: AgentHiredEvent): void {
    this.broadcast({
      eventId: event.eventId,
      eventType: 'agent.hired',
      payload: event.toPayload(),
      tenantId: event.tenantId,
      occurredAt: event.occurredAt.toISOString(),
    });
  }

  @OnEvent('desk.placed')
  onDeskPlaced(event: DeskPlacedEvent): void {
    this.broadcast({
      eventId: event.eventId,
      eventType: 'desk.placed',
      payload: event.toPayload(),
      tenantId: event.tenantId,
      occurredAt: event.occurredAt.toISOString(),
    });
  }

  @OnEvent('floor.created')
  onFloorCreated(event: FloorCreatedEvent): void {
    this.broadcast({
      eventId: event.eventId,
      eventType: 'floor.created',
      payload: event.toPayload(),
      tenantId: event.tenantId,
      occurredAt: event.occurredAt.toISOString(),
    });
  }

  @OnEvent('message.created')
  onMessageCreated(payload: {
    messageId: string;
    roomId: string;
    tenantId: string;
    authorAgentId: string;
    text: string;
    createdAt: string;
  }): void {
    this.broadcast({
      eventId: payload.messageId,
      eventType: 'message.created',
      payload,
      tenantId: payload.tenantId,
      occurredAt: payload.createdAt,
    });
  }

  /**
   * Outbox relay: каждые 500ms читаем необработанные записи, маркируем и пушим в WS
   */
  @Interval(500)
  async relayOutboxEvents(): Promise<void> {
    const unprocessed = await this.prisma.outbox.findMany({
      where: { processed: false, retries: { lt: 5 } },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    for (const record of unprocessed) {
      try {
        const wsEvent: WsEvent = {
          eventId: record.eventId,
          eventType: record.eventType,
          payload: record.payload as object,
          tenantId: record.tenantId,
          occurredAt: record.createdAt.toISOString(),
        };

        this.broadcast(wsEvent);

        await this.prisma.outbox.update({
          where: { id: record.id },
          data: { processed: true, processedAt: new Date() },
        });
      } catch (err) {
        await this.prisma.outbox.update({
          where: { id: record.id },
          data: {
            retries: { increment: 1 },
            error: err instanceof Error ? err.message : String(err),
          },
        });

        this.logger.error(
          {
            message: 'Outbox relay error',
            eventId: record.eventId,
            error: err instanceof Error ? err.message : String(err),
          },
          'RealtimeService',
        );
      }
    }
  }
}
