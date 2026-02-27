import { useEffect } from 'react'
import { apiClient } from '@shared/api'
import { useOfficeStore } from '@features/office/officeStore'

interface ActivityStatus {
  agentId: string   // openclaw id: main, finance, ...
  presenceState: 'WORKING' | 'IDLE'
  lastSeenMs: number | null
}

// Map openclaw agent id → display name (with emoji)
const NAME_BY_ID: Record<string, string> = {
  main:     '🖤 Пятница',
  finance:  '💰 Зина',
  backend:  '🏗️ Ваня',
  devops:   '🛠️ Федя',
  frontend: '⚡ Макс',
}

const POLL_MS = 15_000

export function useAgentActivity() {
  useEffect(() => {
    async function poll() {
      try {
        const activities: ActivityStatus[] = await apiClient
          .get('/openclaw-agents/activity')
          .then((r) => r.data)

        const store = useOfficeStore.getState()

        for (const activity of activities) {
          const displayName = NAME_BY_ID[activity.agentId]
          if (!displayName) continue

          // Find agent in store by name
          const agent = Object.values(store.agents).find((a) => a.name === displayName)
          if (!agent) continue

          if (agent.presenceState !== activity.presenceState) {
            store.applyPresenceChanged(
              {
                agentId: agent.agentId,
                previousState: agent.presenceState as any,
                newState: activity.presenceState,
                zoneId: agent.zoneId ?? '',
              },
              `activity-${agent.agentId}-${Date.now()}`,
            )
          }
        }
      } catch {
        // non-critical
      }
    }

    poll() // immediate
    const id = setInterval(poll, POLL_MS)
    return () => clearInterval(id)
  }, [])
}
