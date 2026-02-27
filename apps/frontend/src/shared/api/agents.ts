import { apiClient } from './client'
import type { HireAgentCommand } from '../types'

export interface Agent {
  agentId: string
  name: string
  role: string
  departmentId: string
  isActive: boolean
}

export const agentsApi = {
  hireAgent: (cmd: HireAgentCommand) =>
    apiClient.post<{ commandId: string }>('/agents', cmd).then((r) => r.data),

  listAgents: () =>
    apiClient.get<Agent[]>('/agents').then((r) => r.data),
}
