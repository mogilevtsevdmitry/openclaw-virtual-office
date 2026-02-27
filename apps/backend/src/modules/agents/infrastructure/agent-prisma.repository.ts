import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { IAgentRepository } from '../domain/agent.repository.interface';
import { Agent } from '../domain/agent.aggregate';
import { AgentName } from '../domain/value-objects/agent-name.vo';
import { AgentRole } from '../domain/value-objects/agent-role.vo';

@Injectable()
export class AgentPrismaRepository implements IAgentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Agent | null> {
    const record = await this.prisma.agent.findUnique({ where: { id } });
    if (!record) return null;
    return this.toDomain(record);
  }

  async findByTenantId(tenantId: string): Promise<Agent[]> {
    const records = await this.prisma.agent.findMany({
      where: { tenantId, status: { not: 'DEACTIVATED' } },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async countByTenantId(tenantId: string): Promise<number> {
    return this.prisma.agent.count({
      where: { tenantId, status: { not: 'DEACTIVATED' } },
    });
  }

  async save(agent: Agent): Promise<void> {
    await this.prisma.agent.upsert({
      where: { id: agent.id },
      create: {
        id: agent.id,
        tenantId: agent.tenantId,
        name: agent.name.value,
        role: agent.role.value,
        departmentId: agent.departmentId,
        status: agent.isActive ? 'IDLE' : 'DEACTIVATED',
        version: agent.version,
      },
      update: {
        name: agent.name.value,
        role: agent.role.value,
        departmentId: agent.departmentId,
        status: agent.isActive ? 'IDLE' : 'DEACTIVATED',
        version: agent.version,
        updatedAt: new Date(),
      },
    });
  }

  private toDomain(record: {
    id: string;
    tenantId: string;
    name: string;
    role: string;
    departmentId: string | null;
    status: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): Agent {
    return Agent.reconstitute(record.id, {
      name: new AgentName(record.name),
      role: new AgentRole(record.role),
      tenantId: record.tenantId,
      departmentId: record.departmentId,
      isActive: record.status !== 'DEACTIVATED',
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
