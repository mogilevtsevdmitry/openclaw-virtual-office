import { apiClient } from './client'

export interface Task {
  id: string
  title: string
  description?: string
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED'
  agentName?: string
  sessionKey?: string
  result?: string
  createdAt: string
  updatedAt: string
}

export interface ToolCall {
  name: string
  input: unknown
  output: string
}

export interface SessionMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
  hasToolCalls: boolean
  toolCalls?: ToolCall[]
}

interface PaginatedResponse<T> {
  data: T[]
  meta: { total: number; page: number; limit: number; pages: number }
}

export const tasksApi = {
  list: (): Promise<Task[]> =>
    apiClient
      .get<PaginatedResponse<Task> | Task[]>('/tasks')
      .then((r) => (Array.isArray(r.data) ? r.data : r.data.data)),

  getById: (id: string): Promise<Task> =>
    apiClient.get<Task>(`/tasks/${id}`).then((r) => r.data),

  getHistory: (id: string): Promise<SessionMessage[]> =>
    apiClient.get<SessionMessage[]>(`/tasks/${id}/history`).then((r) => r.data),
}
