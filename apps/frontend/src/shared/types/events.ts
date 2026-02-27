export type PresenceState = 'IDLE' | 'WORKING' | 'RESTING' | 'SMOKING' | 'CHATTING'

export type ZoneType = 'WORK' | 'REST' | 'SMOKING' | 'FINANCE'

export interface WsEnvelope {
  eventId: string
  eventType: string
  payload: unknown
  tenantId: string
  occurredAt: string
}

// ─── Domain event payloads ───────────────────────────────────────────────────

export interface AgentHiredPayload {
  agentId: string
  name: string
  role: string
  departmentId: string
  tenantId: string
}

export interface DeskPlacedPayload {
  deskId: string
  agentId: string
  zoneId: string
  x: number
  y: number
}

export interface PresenceChangedPayload {
  agentId: string
  previousState: PresenceState
  newState: PresenceState
  zoneId: string
}

export interface MessagePostedPayload {
  messageId: string
  agentId: string
  agentName: string
  chatRoomId: string
  text: string
  postedAt: string
}

export interface ZoneCreatedPayload {
  zoneId: string
  floorId: string
  type: ZoneType
  label: string
  x: number
  y: number
  width: number
  height: number
}

export interface FloorCreatedPayload {
  floorId: string
  name: string
  tenantId: string
}

export interface DepartmentCreatedPayload {
  departmentId: string
  name: string
  type: ZoneType
  floorId: string
}

export interface ChatRoomCreatedPayload {
  chatRoomId: string
  zoneId: string
  name: string
}

// ─── Typed domain events ─────────────────────────────────────────────────────

export type DomainEvent =
  | { eventType: 'agent.hired';         payload: AgentHiredPayload }
  | { eventType: 'desk.placed';          payload: DeskPlacedPayload }
  | { eventType: 'presence.state_changed'; payload: PresenceChangedPayload }
  | { eventType: 'message.created';     payload: MessagePostedPayload }
  | { eventType: 'zone.created';        payload: ZoneCreatedPayload }
  | { eventType: 'floor.created';       payload: FloorCreatedPayload }
  | { eventType: 'department.created';  payload: DepartmentCreatedPayload }
  | { eventType: 'chat_room.created';   payload: ChatRoomCreatedPayload }

export type TypedWsEvent = WsEnvelope & DomainEvent
