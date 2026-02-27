import { AgentPresence } from './agent-presence.aggregate';

export const PRESENCE_REPOSITORY = Symbol('PRESENCE_REPOSITORY');

export interface IPresenceRepository {
  findByAgentId(agentId: string): Promise<AgentPresence | null>;
  findByTenantId(tenantId: string): Promise<AgentPresence[]>;
  save(presence: AgentPresence): Promise<void>;
}
