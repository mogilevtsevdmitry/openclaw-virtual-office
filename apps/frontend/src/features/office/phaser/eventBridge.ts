import mitt from 'mitt'
import type { ZoneEntry, AgentEntry, DeskEntry } from '../officeStore'

export type BridgeEvents = {
  'zone:added': ZoneEntry
  'agent:added': AgentEntry
  'agent:moved': { agentId: string; zoneId: string; presenceState: AgentEntry['presenceState'] }
  'desk:added': DeskEntry
  'scene:sync': {
    zones: ZoneEntry[]
    agents: AgentEntry[]
    desks: DeskEntry[]
  }
}

export const eventBridge = mitt<BridgeEvents>()
