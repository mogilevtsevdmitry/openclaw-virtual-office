import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@shared/api'
import { useOfficeStore, type PipelineAgentMap } from './officeStore'
import styles from './PipelinePanel.module.css'

// Maps ownerAgent (openclaw agentId) → active stage label
const STAGE_LABELS: Record<string, string> = {
  IDEA: 'Пишет PRD',
  DISCOVERY: 'Исследует рынок',
  ARCHITECTURE: 'Проектирует архитектуру',
  PLANNING: 'Планирует спринт',
  BUILD: 'Пишет код',
  QA: 'Тестирует',
  SECURITY_GATE: 'Аудит безопасности',
  DEPLOY: 'Деплоит',
  PRODUCTION: 'Финальная проверка',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PipelineStage {
  stageName: string
  status: string
  ownerAgent: string
}

interface PipelineRun {
  projectId: string
  runId: string
  name: string
  type: string
  status: string
  currentStage: string
  progress: string
  stages: PipelineStage[]
}

interface PipelineStatus {
  activeProjects: number
  pendingProjects: number
  completedToday: number
  recentRuns: PipelineRun[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseProgress(progress: string): { current: number; total: number; pct: number } {
  const [a, b] = progress.split('/').map(Number)
  const current = a ?? 0
  const total = b ?? 1
  return { current, total, pct: total > 0 ? Math.round((current / total) * 100) : 0 }
}

function stageIconClass(status: string): string {
  switch (status.toUpperCase()) {
    case 'DONE':
    case 'COMPLETED':
      return styles.stageIconDone
    case 'ACTIVE':
    case 'RUNNING':
      return styles.stageIconActive
    case 'FAILED':
      return styles.stageIconFailed
    default:
      return styles.stageIconPending
  }
}

function badgeClass(status: string): string {
  switch (status.toUpperCase()) {
    case 'ACTIVE':
    case 'RUNNING':
      return styles.badgeACTIVE
    case 'PENDING':
      return styles.badgePENDING
    case 'COMPLETED':
    case 'DONE':
      return styles.badgeCOMPLETED
    case 'FAILED':
      return styles.badgeFAILED
    default:
      return styles.badgePENDING
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StageList({ stages }: { stages: PipelineStage[] }) {
  return (
    <div className={styles.stagesExpanded}>
      {stages.map((s) => (
        <div key={s.stageName} className={styles.stageRow}>
          <div className={`${styles.stageIcon} ${stageIconClass(s.status)}`} />
          <span className={styles.stageName}>{s.stageName}</span>
          <span className={styles.stageAgent}>{s.ownerAgent}</span>
        </div>
      ))}
    </div>
  )
}

function RunItem({ run }: { run: PipelineRun }) {
  const [expanded, setExpanded] = useState(false)
  const { current, total, pct } = parseProgress(run.progress)

  return (
    <div className={styles.runItem} onClick={() => setExpanded((v) => !v)}>
      <div className={styles.runHeader}>
        <span className={styles.runName}>{run.name}</span>
        <span className={`${styles.badge} ${badgeClass(run.status)}`}>{run.status}</span>
      </div>

      <div className={styles.progressRow}>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>
        <span className={styles.progressText}>{current}/{total}</span>
      </div>

      {!expanded && (
        <div className={styles.currentStage}>
          <span className={styles.arrow}>→</span>
          {run.currentStage}
        </div>
      )}

      {expanded && run.stages.length > 0 && <StageList stages={run.stages} />}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 15_000

interface PipelinePanelProps {
  onNewProject: () => void
}

export function PipelinePanel({ onNewProject }: PipelinePanelProps) {
  const [data, setData] = useState<PipelineStatus | null>(null)
  const [error, setError] = useState(false)
  const applyPipelineStages = useOfficeStore((s) => s.applyPipelineStages)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiClient.get<PipelineStatus>('/pipeline/status')
      setData(res.data)
      setError(false)

      // Build agentId → { stage, project } map from ACTIVE stages across all RUNNING runs
      const agentTaskMap: PipelineAgentMap = {}
      for (const run of res.data.recentRuns) {
        if (run.status !== 'RUNNING' && run.status !== 'ACTIVE') continue
        for (const stage of run.stages) {
          if (stage.status === 'ACTIVE') {
            agentTaskMap[stage.ownerAgent] = {
              stage: STAGE_LABELS[stage.stageName] ?? stage.stageName,
              project: run.name,
            }
          }
        }
      }
      applyPipelineStages(agentTaskMap)
    } catch {
      setError(true)
    }
  }, [applyPipelineStages])

  useEffect(() => {
    fetchStatus()
    const id = setInterval(fetchStatus, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [fetchStatus])

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>🏭 Pipeline</span>
        {data && (
          <div className={styles.summary}>
            <span>
              <span className={`${styles.dot} ${styles.dotActive}`} />
              {data.activeProjects} активных
            </span>
            <span>
              <span className={`${styles.dot} ${styles.dotPending}`} />
              {data.pendingProjects} ожидает
            </span>
          </div>
        )}
      </div>

      <div className={styles.runsList}>
        {error && (
          <div className={styles.loadingText}>⚠️ Нет данных</div>
        )}
        {!error && !data && (
          <div className={styles.loadingText}>Загрузка...</div>
        )}
        {!error && data && data.recentRuns.length === 0 && (
          <div className={styles.empty}>Нет активных проектов</div>
        )}
        {!error && data && data.recentRuns.map((run) => (
          <RunItem key={run.runId} run={run} />
        ))}
      </div>

      <div className={styles.footer}>
        <button className={styles.newProjectBtn} onClick={onNewProject}>
          + Новый проект
        </button>
      </div>
    </div>
  )
}
