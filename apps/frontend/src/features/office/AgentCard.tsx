import { useEffect, useState } from 'react'
import { apiClient } from '@shared/api'
import styles from './AgentCard.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityEntry {
  timestamp: string
  description: string
}

interface AgentDetails {
  agentId: string
  name: string
  role: string
  presenceState: string
  currentTask?: string
  reportsTo?: string
  specialization?: string
  skills?: string
  recentActivity?: ActivityEntry[]
}

interface AgentClickData {
  agentId: string
  name: string
  role: string
  presenceState: string
}

interface AgentCardProps {
  agent: AgentClickData
  onClose: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusDotClass(state: string): string {
  switch (state.toUpperCase()) {
    case 'WORKING':
      return styles.statusWORKING
    case 'IDLE':
      return styles.statusIDLE
    default:
      return styles.statusOFFLINE
  }
}

function statusEmoji(state: string): string {
  switch (state.toUpperCase()) {
    case 'WORKING':
      return '🟢'
    case 'IDLE':
      return '🟡'
    default:
      return '⚫'
  }
}

// ─── Mock fallback ────────────────────────────────────────────────────────────

function buildMockDetails(base: AgentClickData): AgentDetails {
  const roleMap: Record<string, { specialization: string; skills: string; reportsTo: string }> = {
    BACKEND: {
      specialization: 'NestJS, PostgreSQL',
      skills: 'API, микросервисы, DDD',
      reportsTo: 'Tech Lead',
    },
    FRONTEND: {
      specialization: 'React, TypeScript',
      skills: 'UI, компоненты, Vite',
      reportsTo: 'Tech Lead',
    },
    DEVOPS: {
      specialization: 'Docker, CI/CD',
      skills: 'инфраструктура, мониторинг',
      reportsTo: 'Director',
    },
    FINANCIER: {
      specialization: 'Бюджет, метрики',
      skills: 'аналитика, отчётность',
      reportsTo: 'Director',
    },
    DIRECTOR: {
      specialization: 'Стратегия, команда',
      skills: 'управление, планирование',
      reportsTo: '—',
    },
  }

  const meta = roleMap[base.role.toUpperCase()] ?? {
    specialization: '—',
    skills: '—',
    reportsTo: '—',
  }

  return {
    ...base,
    ...meta,
    recentActivity: [],
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AgentCard({ agent, onClose }: AgentCardProps) {
  const [details, setDetails] = useState<AgentDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const fetch = async () => {
      try {
        const res = await apiClient.get<AgentDetails>(`/agents/${agent.agentId}`)
        if (!cancelled) {
          setDetails(res.data)
        }
      } catch {
        // API ещё не готово — используем мок
        if (!cancelled) {
          setDetails(buildMockDetails(agent))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetch()
    return () => { cancelled = true }
  }, [agent])

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  const d = details ?? buildMockDetails(agent)

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <span className={styles.agentName}>👤 {d.name}</span>
            <span className={styles.agentRole}>{d.role}</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className={styles.loadingText}>Загрузка...</div>
        ) : (
          <>
            {/* Status section */}
            <div className={styles.section}>
              <div className={styles.infoRow}>
                <span className={styles.infoKey}>Статус</span>
                <span className={styles.infoValue}>
                  {statusEmoji(d.presenceState)}{' '}
                  <span className={`${styles.statusDot} ${statusDotClass(d.presenceState)}`} />
                  {d.presenceState}
                </span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoKey}>Роль</span>
                <span className={styles.infoValue}>{d.role}</span>
              </div>
              {d.currentTask && (
                <div className={styles.infoRow}>
                  <span className={styles.infoKey}>Текущая задача</span>
                  <span className={styles.infoValue}>{d.currentTask}</span>
                </div>
              )}
            </div>

            {/* Details section */}
            <div className={styles.section}>
              {d.reportsTo && (
                <div className={styles.infoRow}>
                  <span className={styles.infoKey}>Подчиняется</span>
                  <span className={styles.infoValue}>{d.reportsTo}</span>
                </div>
              )}
              {d.specialization && (
                <div className={styles.infoRow}>
                  <span className={styles.infoKey}>Специализация</span>
                  <span className={styles.infoValue}>{d.specialization}</span>
                </div>
              )}
              {d.skills && (
                <div className={styles.infoRow}>
                  <span className={styles.infoKey}>Навыки</span>
                  <span className={styles.infoValue}>{d.skills}</span>
                </div>
              )}
            </div>

            {/* Activity section */}
            {d.recentActivity && d.recentActivity.length > 0 && (
              <div className={styles.section}>
                <span className={styles.sectionTitle}>История активности (последние 3)</span>
                <div className={styles.activityList}>
                  {d.recentActivity.slice(0, 3).map((entry, i) => (
                    <div key={i} className={styles.activityItem}>
                      <span className={styles.activityTime}>{entry.timestamp}</span>
                      <span>{entry.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
