import { create } from 'zustand'
import type {
  PresenceState,
  ZoneType,
  AgentHiredPayload,
  DeskPlacedPayload,
  PresenceChangedPayload,
  MessagePostedPayload,
  ZoneCreatedPayload,
} from '@shared/types'

export interface AgentEntry {
  agentId: string
  name: string
  role: string
  departmentId: string
  presenceState: PresenceState
  zoneId: string | null
  deskId: string | null
}

export interface DeskEntry {
  deskId: string
  agentId: string
  zoneId: string
  x: number
  y: number
}

export interface ZoneEntry {
  zoneId: string
  floorId: string
  type: ZoneType
  label: string
  x: number
  y: number
  width: number
  height: number
}

export interface ChatMessage {
  messageId: string
  agentId: string
  agentName: string
  chatRoomId: string
  text: string
  postedAt: string
}

interface OfficeState {
  agents: Record<string, AgentEntry>
  desks: Record<string, DeskEntry>
  zones: Record<string, ZoneEntry>
  chatMessages: ChatMessage[]
  lastEventId: string | null

  // Reducers
  applyAgentHired: (payload: AgentHiredPayload, eventId: string) => void
  applyDeskPlaced: (payload: DeskPlacedPayload, eventId: string) => void
  applyPresenceChanged: (payload: PresenceChangedPayload, eventId: string) => void
  applyMessagePosted: (payload: MessagePostedPayload, eventId: string) => void
  applyZoneCreated: (payload: ZoneCreatedPayload, eventId: string) => void
  setLastEventId: (eventId: string) => void
}

const LS_LAST_EVENT_KEY = 'office_last_event_id'

export const useOfficeStore = create<OfficeState>()((set) => ({
  agents: {},
  desks: {},
  zones: {},
  chatMessages: [],
  lastEventId: localStorage.getItem(LS_LAST_EVENT_KEY),

  applyAgentHired: (payload, eventId) =>
    set((s) => ({
      agents: {
        ...s.agents,
        [payload.agentId]: {
          agentId: payload.agentId,
          name: payload.name,
          role: payload.role,
          departmentId: payload.departmentId,
          presenceState: 'IDLE',
          zoneId: null,
          deskId: null,
        },
      },
      lastEventId: eventId,
    })),

  applyDeskPlaced: (payload, eventId) =>
    set((s) => {
      const agent = s.agents[payload.agentId]
      return {
        desks: {
          ...s.desks,
          [payload.deskId]: {
            deskId: payload.deskId,
            agentId: payload.agentId,
            zoneId: payload.zoneId,
            x: payload.x,
            y: payload.y,
          },
        },
        agents: agent
          ? {
              ...s.agents,
              [payload.agentId]: {
                ...agent,
                zoneId: payload.zoneId,
                deskId: payload.deskId,
              },
            }
          : s.agents,
        lastEventId: eventId,
      }
    }),

  applyPresenceChanged: (payload, eventId) =>
    set((s) => {
      const agent = s.agents[payload.agentId]
      if (!agent) return { lastEventId: eventId }
      return {
        agents: {
          ...s.agents,
          [payload.agentId]: {
            ...agent,
            presenceState: payload.newState,
            zoneId: payload.zoneId,
          },
        },
        lastEventId: eventId,
      }
    }),

  applyMessagePosted: (payload, eventId) =>
    set((s) => ({
      chatMessages: [
        ...s.chatMessages.slice(-499),
        {
          messageId: payload.messageId,
          agentId: payload.agentId,
          agentName: payload.agentName,
          chatRoomId: payload.chatRoomId,
          text: payload.text,
          postedAt: payload.postedAt,
        },
      ],
      lastEventId: eventId,
    })),

  applyZoneCreated: (payload, eventId) =>
    set((s) => ({
      zones: {
        ...s.zones,
        [payload.zoneId]: {
          zoneId: payload.zoneId,
          floorId: payload.floorId,
          type: payload.type,
          label: payload.label,
          x: payload.x,
          y: payload.y,
          width: payload.width,
          height: payload.height,
        },
      },
      lastEventId: eventId,
    })),

  setLastEventId: (eventId) => {
    localStorage.setItem(LS_LAST_EVENT_KEY, eventId)
    set({ lastEventId: eventId })
  },
}))
