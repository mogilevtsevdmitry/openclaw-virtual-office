import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { IPresenceRepository } from '../domain/presence.repository.interface';
import { AgentPresence } from '../domain/agent-presence.aggregate';
import { PresenceState } from '../domain/value-objects/presence-state.vo';

@Injectable()
export class PresencePrismaRepository implements IPresenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByAgentId(agentId: string): Promise<AgentPresence | null> {
    const record = await this.prisma.presence.findUnique({ where: { agentId } });
    if (!record) return null;
    return this.toDomain(record);
  }

  async findByTenantId(tenantId: string): Promise<AgentPresence[]> {
    const records = await this.prisma.presence.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async save(presence: AgentPresence): Promise<void> {
    await this.prisma.presence.upsert({
      where: { agentId: presence.agentId },
      create: {
        id: presence.id,
        agentId: presence.agentId,
        tenantId: presence.tenantId,
        zoneId: presence.zoneId,
        state: presence.state.value,
        version: presence.version,
      },
      update: {
        zoneId: presence.zoneId,
        state: presence.state.value,
        version: presence.version,
        updatedAt: new Date(),
      },
    });
  }

  private toDomain(record: {
    id: string;
    agentId: string;
    tenantId: string;
    zoneId: string | null;
    state: string;
    version: number;
    updatedAt: Date;
  }): AgentPresence {
    return AgentPresence.reconstitute(record.id, {
      agentId: record.agentId,
      tenantId: record.tenantId,
      zoneId: record.zoneId,
      state: new PresenceState(record.state),
      version: record.version,
      updatedAt: record.updatedAt,
    });
  }
}
