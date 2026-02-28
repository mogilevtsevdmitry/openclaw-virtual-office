import { useEffect, useRef, useState } from 'react'
import { createGame, destroyGame } from './phaser/GameInstance'
import { eventBridge } from './phaser/eventBridge'
import { useOfficeStore } from './officeStore'
import { useOfficeWebSocket } from '@shared/hooks/useOfficeWebSocket'
import { useAgentActivity } from '@shared/hooks/useAgentActivity'
import { useAgentSync } from '@shared/hooks/useAgentSync'
import { apiClient } from '@shared/api'
import { AgentsPanel } from './AgentsPanel'
import { TasksPanel } from '../tasks/TasksPanel'
import { TokenWidget } from './TokenWidget'
import { PipelinePanel } from './PipelinePanel'
import { NewProjectForm } from './NewProjectForm'
import { AgentCard } from './AgentCard'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import taskStyles from '../tasks/TasksPanel.module.css'
import styles from './OfficeApp.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OpenClawAgent {
  id: string
  name: string
  emoji: string
  role: string
  isDefault: boolean
  officeRole: 'DIRECTOR' | 'BACKEND' | 'FINANCIER' | 'FRONTEND' | 'DEVOPS'
}

interface AgentClickData {
  agentId: string
  name: string
  role: string
  presenceState: string
}

// ─── Phaser sync ──────────────────────────────────────────────────────────────

function usePhaserSync() {
  const agents = useOfficeStore((s) => s.agents)
  const zones = useOfficeStore((s) => s.zones)
  const desks = useOfficeStore((s) => s.desks)
  const prevAgentsRef = useRef<typeof agents>({})

  useEffect(() => {
    const prevAgents = prevAgentsRef.current
    Object.values(agents).forEach((agent) => {
      if (!prevAgents[agent.agentId]) {
        eventBridge.emit('agent:added', agent)
      } else if (prevAgents[agent.agentId].presenceState !== agent.presenceState) {
        eventBridge.emit('agent:moved', {
          agentId: agent.agentId,
          zoneId: agent.zoneId ?? '',
          presenceState: agent.presenceState,
        })
      }
    })
    prevAgentsRef.current = agents
  }, [agents])

  useEffect(() => {
    Object.values(zones).forEach((zone) => eventBridge.emit('zone:added', zone))
  }, [zones])

  useEffect(() => {
    Object.values(desks).forEach((desk) => eventBridge.emit('desk:added', desk))
  }, [desks])

  // Re-sync all agents when Phaser scene signals it's ready
  useEffect(() => {
    const onReady = () => {
      const allAgents = Object.values(useOfficeStore.getState().agents)
      eventBridge.emit('scene:sync', { zones: [], agents: allAgents, desks: [] })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(eventBridge as any).on('scene:ready', onReady)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return () => { (eventBridge as any).off('scene:ready', onReady) }
  }, [])
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function bootstrapOffice(): Promise<{ floorId: string; zoneId: string }> {
  // 1. Load real OpenClaw agents from system
  const openClawAgents: OpenClawAgent[] = await apiClient
    .get('/openclaw-agents')
    .then((r) => r.data)

  if (openClawAgents.length === 0) {
    throw new Error('No OpenClaw agents found in system')
  }

  // 2. Get or create floor
  const floors = await apiClient.get<any[]>('/floors').then((r) => r.data)
  let floorId: string

  if (floors.length === 0) {
    const floor = await apiClient.post<any>('/floors', { name: 'Главный офис' }).then((r) => r.data)
    floorId = floor.floorId ?? floor.id
  } else {
    const f = floors[0]
    floorId = f.floorId ?? f.id
  }

  // 3. Get existing zones on this floor
  const floorsWithZones = await apiClient.get<any[]>('/floors').then((r) => r.data)
  const currentFloor = floorsWithZones.find((f: any) => (f.floorId ?? f.id) === floorId)
  const existingZones: any[] = currentFloor?.zones ?? []

  // 4. Ensure "Кабинет директора" zone exists (for the main/director agent)
  let directorZoneId: string
  const directorZone = existingZones.find(
    (z: any) => z.name === 'Кабинет директора' || z.type === 'WORK',
  )

  if (!directorZone) {
    const dept = await apiClient
      .post<any>(`/floors/${floorId}/departments`, { name: 'Кабинет директора', type: 'WORK' })
      .then((r) => r.data)
    directorZoneId = dept.departmentId ?? dept.id
  } else {
    directorZoneId = directorZone.id ?? directorZone.departmentId
  }

  // 5. Get existing virtual agents
  const existingAgents: any[] = await apiClient.get('/agents').then((r) => r.data)
  // Build lookup by both raw name and emoji+name to avoid duplicates
  const existingNames = new Set(existingAgents.map((a: any) => a.name as string))

  // 6. Sync: create virtual agent for each OpenClaw agent if not exists
  for (const ocAgent of openClawAgents) {
    const fullName = `${ocAgent.emoji} ${ocAgent.name}`
    // Check both variants (with and without emoji) to be safe
    if (!existingNames.has(fullName) && !existingNames.has(ocAgent.name)) {
      await apiClient.post('/agents', {
        idempotencyKey: `openclaw-${ocAgent.id}-v1`,
        name: fullName,
        role: ocAgent.officeRole,
        departmentId: directorZoneId,
      })
    }
  }

  return { floorId, zoneId: directorZoneId }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OfficeApp() {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [floorId, setFloorId] = useState<string | null>(null)
  const [zoneId, setZoneId] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'bootstrapping' | 'ready' | 'error'>('loading')
  const [tasksOpen, setTasksOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [pipelineKey, setPipelineKey] = useState(0)
  const [clickedAgent, setClickedAgent] = useState<AgentClickData | null>(null)

  const isMobile = useMediaQuery('(max-width: 768px)')

  // ── Listen for agent:click from Phaser ──
  useEffect(() => {
    const handler = (data: AgentClickData) => {
      setClickedAgent(data)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(eventBridge as any).on('agent:click', handler)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return () => { (eventBridge as any).off('agent:click', handler) }
  }, [])

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        const floors = await apiClient.get<any[]>('/floors').then((r) => r.data)
        if (!cancelled && floors.length === 0) setStatus('bootstrapping')

        const { floorId: id, zoneId: zone } = await bootstrapOffice()
        if (cancelled) return
        setZoneId(zone)

        // Load all agents into zustand store
        const agents = await apiClient.get<any[]>('/agents').then((r) => r.data)
        if (!cancelled) {
          const store = useOfficeStore.getState()
          agents.forEach((a: any) => {
            const agentId = a.agentId ?? a.id ?? ''
            if (agentId && !store.agents[agentId]) {
              store.applyAgentHired(
                { agentId, name: a.name, role: a.role, departmentId: a.departmentId, tenantId: '' },
                `bootstrap-${agentId}`,
              )
            }
          })
          setFloorId(id)
          setStatus('ready')
        }
      } catch (e) {
        console.error('[OfficeApp] init error:', e)
        if (!cancelled) setStatus('error')
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  useOfficeWebSocket(floorId ?? '')
  usePhaserSync()
  useAgentActivity()        // polls OpenClaw activity every 15s
  useAgentSync(zoneId)      // syncs new agents from OpenClaw roster every 30s

  useEffect(() => {
    if (status !== 'ready' || !canvasRef.current) return
    createGame(canvasRef.current)
    return () => destroyGame()
  }, [status])

  // Close drawer when switching to desktop
  useEffect(() => {
    if (!isMobile) setDrawerOpen(false)
  }, [isMobile])

  if (status === 'loading' || status === 'bootstrapping') {
    return (
      <Splash
        text={
          status === 'bootstrapping'
            ? 'Первый запуск — создаём офис команды... 🖤'
            : 'Загружаем офис...'
        }
      />
    )
  }
  if (status === 'error') {
    return <Splash text="Ошибка подключения к серверу. Обновите страницу." />
  }

  const pipelinePanel = (
    <PipelinePanel
      key={pipelineKey}
      onNewProject={() => setNewProjectOpen(true)}
    />
  )

  return (
    <div className={styles.layout}>
      {/* Left sidebar — desktop only */}
      {!isMobile && (
        <div className={styles.leftSidebar}>
          <AgentsPanel />
          <button
            className={taskStyles.tasksButton}
            onClick={() => setTasksOpen(true)}
          >
            📋 Задачи
          </button>
        </div>
      )}

      {/* Canvas area */}
      <main className={styles.canvas}>
        <div ref={canvasRef} className={styles.phaserMount} />

        {/* Hamburger — mobile only */}
        {isMobile && (
          <button
            className={styles.hamburger}
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label={drawerOpen ? 'Закрыть меню' : 'Открыть меню'}
          >
            {drawerOpen ? '✕' : '☰'}
          </button>
        )}
      </main>

      {/* Right sidebar — Pipeline Panel, desktop only */}
      {!isMobile && (
        <div className={styles.rightSidebar}>
          {pipelinePanel}
        </div>
      )}

      {/* Tasks Panel — modal on desktop, drawer on mobile */}
      {isMobile ? (
        <>
          {/* Backdrop */}
          {drawerOpen && (
            <div className={styles.drawerBackdrop} onClick={() => setDrawerOpen(false)} />
          )}

          {/* Drawer panel */}
          <div className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ''}`}>
            <div className={styles.drawerHeader}>
              <span className={styles.drawerTitle}>Меню</span>
              <button className={styles.drawerClose} onClick={() => setDrawerOpen(false)}>✕</button>
            </div>
            <div className={styles.drawerContent}>
              <AgentsPanel />
              {/* Pipeline in mobile drawer */}
              <div className={styles.drawerPipeline}>
                {pipelinePanel}
              </div>
              <button
                className={taskStyles.tasksButton}
                onClick={() => {
                  setTasksOpen(true)
                  setDrawerOpen(false)
                }}
              >
                📋 Задачи
              </button>
            </div>
          </div>
        </>
      ) : null}

      {/* Tasks Modal */}
      {tasksOpen && <TasksPanel onClose={() => setTasksOpen(false)} />}

      {/* New Project Form */}
      {newProjectOpen && (
        <NewProjectForm
          onClose={() => setNewProjectOpen(false)}
          onCreated={() => setPipelineKey((k) => k + 1)}
        />
      )}

      {/* Agent Card Modal */}
      {clickedAgent && (
        <AgentCard
          agent={clickedAgent}
          onClose={() => setClickedAgent(null)}
        />
      )}

      {/* Token Widget */}
      <TokenWidget />
    </div>
  )
}

function Splash({ text }: { text: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: '100%', height: '100%', background: '#1e1e2e',
      color: '#cdd6f4', fontSize: '1rem', fontFamily: 'sans-serif',
    }}>
      {text}
    </div>
  )
}
