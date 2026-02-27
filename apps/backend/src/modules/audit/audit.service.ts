import { Injectable, LoggerService, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

const RETENTION_DAYS = 90;

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  /**
   * Daily cleanup at 03:00 — удаляем записи старше 90 дней
   */
  @Cron('0 3 * * *')
  async cleanupOldRecords(): Promise<void> {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const [eventsDeleted, outboxDeleted, inboxDeleted] = await Promise.all([
      this.prisma.event.deleteMany({ where: { occurredAt: { lt: cutoff } } }),
      this.prisma.outbox.deleteMany({
        where: { createdAt: { lt: cutoff }, processed: true },
      }),
      this.prisma.inbox.deleteMany({ where: { processedAt: { lt: cutoff } } }),
    ]);

    this.logger.log(
      {
        message: 'Audit cleanup completed',
        eventsDeleted: eventsDeleted.count,
        outboxDeleted: outboxDeleted.count,
        inboxDeleted: inboxDeleted.count,
        cutoff: cutoff.toISOString(),
      },
      'AuditService',
    );
  }
}
