/**
 * Periodically syncs OpenClaw agent roster → virtual office agents
 * New agents added via chat will appear automatically within SYNC_INTERVAL_MS
 */
import { useEffect } from 'react'
import { apiClient } from '@shared/api'
import { useOfficeStore } from '@features/office/officeStore'

interface OpenClawAgent {
  id: string
  name: string
  emoji: string
  role: string
  officeRole: 'DIRECTOR' | 'MANAGER' | 'FINANCIER' | 'WORKER' | 'ARCHIVIST'
}

const SYNC_INTERVAL_MS = 30_000 // check for new agents every 30s

export function useAgentSync(directorZoneId: string | null) {
  useEffect(() => {
    if (!directorZoneId) return
    const zoneId: string = directorZoneId

    async function sync() {
      try {
        const [openClawAgents, virtualAgents]: [OpenClawAgent[], any[]] = await Promise.all([
          apiClient.get('/openclaw-agents').then(r => r.data),
          apiClient.get('/agents').then(r => r.data),
        ])

        const existingNames = new Set(virtualAgents.map((a: any) => a.name as string))
        const store = useOfficeStore.getState()

        for (const ocAgent of openClawAgents) {
          const fullName = `${ocAgent.emoji} ${ocAgent.name}`
          if (existingNames.has(fullName) || existingNames.has(ocAgent.name)) continue

          // New agent — create in virtual office
          const created = await apiClient.post<any>('/agents', {
            idempotencyKey: `openclaw-${ocAgent.id}-v1`,
            name: fullName,
            role: ocAgent.officeRole,
            departmentId: zoneId,
          }).then(r => r.data).catch(() => null)

          if (created) {
            const agentId = created.agentId ?? created.id ?? ''
            if (agentId && !store.agents[agentId]) {
              store.applyAgentHired(
                { agentId, name: fullName, role: ocAgent.officeRole, departmentId: zoneId, tenantId: '' },
                `sync-${agentId}`,
              )
            }
          }
        }
      } catch {
        // non-critical
      }
    }

    const id = setInterval(sync, SYNC_INTERVAL_MS)
    return () => clearInterval(id)
  }, [directorZoneId])
}
