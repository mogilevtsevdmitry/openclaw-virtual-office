import { Injectable, Inject } from '@nestjs/common';
import { IAgentRepository, AGENT_REPOSITORY } from '../../domain/agent.repository.interface';
import { Agent } from '../../domain/agent.aggregate';

export interface AgentDto {
  id: string;
  name: string;
  role: string;
  tenantId: string;
  departmentId: string | null;
  isActive: boolean;
  createdAt: Date;
}

@Injectable()
export class ListAgentsUseCase {
  constructor(
    @Inject(AGENT_REPOSITORY)
    private readonly agentRepository: IAgentRepository,
  ) {}

  async execute(tenantId: string): Promise<AgentDto[]> {
    const agents = await this.agentRepository.findByTenantId(tenantId);
    return agents.map(this.toDto);
  }

  private toDto(agent: Agent): AgentDto {
    return {
      id: agent.id,
      name: agent.name.value,
      role: agent.role.value,
      tenantId: agent.tenantId,
      departmentId: agent.departmentId,
      isActive: agent.isActive,
      createdAt: agent.createdAt,
    };
  }
}
