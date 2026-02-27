export interface HireAgentCommand {
  idempotencyKey: string
  name: string
  role: string
  departmentId: string
}

export interface ChangePresenceCommand {
  idempotencyKey: string
  agentId: string
  newState: 'IDLE' | 'WORKING' | 'RESTING' | 'SMOKING' | 'CHATTING'
  zoneId: string
}

export interface PostMessageCommand {
  idempotencyKey: string
  agentId: string
  chatRoomId: string
  text: string
}

export interface CreateFloorCommand {
  idempotencyKey: string
  name: string
}

export interface CreateDepartmentCommand {
  idempotencyKey: string
  name: string
  type: 'WORK' | 'REST' | 'SMOKING' | 'FINANCE'
  floorId: string
}
