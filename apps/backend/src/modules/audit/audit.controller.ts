import { Controller, Get, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/infrastructure/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TenantId } from '../auth/decorators/tenant.decorator';
import { JwtPayload } from '../auth/infrastructure/jwt.strategy';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('events')
  async getEvents(
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: string,
    @Query('limit') limit?: string,
    @Query('eventType') eventType?: string,
    @Query('aggregateId') aggregateId?: string,
    @Query('sinceEventId') sinceEventId?: string,
  ) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can view audit events');
    }

    let sinceId: bigint | undefined;
    if (sinceEventId) {
      const record = await this.prisma.event.findUnique({
        where: { eventId: sinceEventId },
        select: { id: true },
      });
      if (record) sinceId = record.id;
    }

    const events = await this.prisma.event.findMany({
      where: {
        tenantId,
        ...(eventType ? { eventType } : {}),
        ...(aggregateId ? { aggregateId } : {}),
        ...(sinceId ? { id: { gt: sinceId } } : {}),
      },
      orderBy: { id: 'desc' },
      take: Math.min(parseInt(limit ?? '50', 10), 500),
    });

    return {
      events: events.map((e) => ({
        id: e.id.toString(),
        eventId: e.eventId,
        eventType: e.eventType,
        sourceBC: e.sourceBC,
        aggregateId: e.aggregateId,
        tenantId: e.tenantId,
        payload: e.payload,
        occurredAt: e.occurredAt,
      })),
      count: events.length,
    };
  }

  @Get('outbox')
  async getOutbox(
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: string,
    @Query('processed') processed?: string,
    @Query('limit') limit?: string,
  ) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can view outbox');
    }

    const records = await this.prisma.outbox.findMany({
      where: {
        tenantId,
        ...(processed !== undefined ? { processed: processed === 'true' } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit ?? '50', 10), 200),
    });

    return { records, count: records.length };
  }
}
