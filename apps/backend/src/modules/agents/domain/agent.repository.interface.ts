import { Agent } from './agent.aggregate';

export const AGENT_REPOSITORY = Symbol('AGENT_REPOSITORY');

export interface IAgentRepository {
  findById(id: string): Promise<Agent | null>;
  findByTenantId(tenantId: string): Promise<Agent[]>;
  countByTenantId(tenantId: string): Promise<number>;
  save(agent: Agent): Promise<void>;
}
