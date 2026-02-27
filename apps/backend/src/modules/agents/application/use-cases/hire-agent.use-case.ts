import { Injectable, ForbiddenException, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IAgentRepository, AGENT_REPOSITORY } from '../../domain/agent.repository.interface';
import { Agent } from '../../domain/agent.aggregate';
import { AgentName } from '../../domain/value-objects/agent-name.vo';
import { AgentRole } from '../../domain/value-objects/agent-role.vo';
import { HireAgentDto } from '../dto/hire-agent.dto';
import { OutboxService } from '../../../../../../../libs/shared-kernel/src/infrastructure/outbox.service';

const MAX_AGENTS_PER_TENANT = 100;

export interface HireAgentResult {
  agentId: string;
  name: string;
  role: string;
  tenantId: string;
  departmentId: string | null;
}

@Injectable()
export class HireAgentUseCase {
  constructor(
    @Inject(AGENT_REPOSITORY)
    private readonly agentRepository: IAgentRepository,
    private readonly outboxService: OutboxService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(dto: HireAgentDto, tenantId: string): Promise<HireAgentResult> {
    // Quota check
    const count = await this.agentRepository.countByTenantId(tenantId);
    if (count >= MAX_AGENTS_PER_TENANT) {
      throw new ForbiddenException(
        `Agent quota exceeded. Max ${MAX_AGENTS_PER_TENANT} agents per tenant.`,
      );
    }

    const agent = Agent.hire({
      name: new AgentName(dto.name),
      role: new AgentRole(dto.role),
      tenantId,
      departmentId: dto.departmentId ?? null,
    });

    await this.agentRepository.save(agent);

    // Save domain events to outbox + audit
    await this.outboxService.saveEvents(agent.domainEvents as any[], 'agents');

    // Emit for local listeners (policy: AgentHired → PlaceDesk)
    for (const event of agent.domainEvents) {
      this.eventEmitter.emit(event.eventType, event);
    }

    agent.clearDomainEvents();

    return {
      agentId: agent.id,
      name: agent.name.value,
      role: agent.role.value,
      tenantId: agent.tenantId,
      departmentId: agent.departmentId,
    };
  }
}
