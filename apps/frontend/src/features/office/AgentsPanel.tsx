import { useShallow } from 'zustand/react/shallow'
import { useOfficeStore } from './officeStore'
import type { AgentEntry } from './officeStore'
import styles from './AgentsPanel.module.css'

const PRESENCE_LABEL: Record<AgentEntry['presenceState'], string> = {
  IDLE: 'Не активен',
  WORKING: 'Работает',
  RESTING: 'Отдыхает',
  SMOKING: 'Перекур',
  CHATTING: 'В чате',
}

const PRESENCE_COLOR: Record<AgentEntry['presenceState'], string> = {
  IDLE: '#cccccc',
  WORKING: '#4a90d9',
  RESTING: '#7ed321',
  SMOKING: '#9b9b9b',
  CHATTING: '#f8e71c',
}

export function AgentsPanel() {
  // useShallow — сравнивает массив поэлементно, не создаёт новую ссылку каждый рендер
  const agents = useOfficeStore(useShallow((s) => Object.values(s.agents)))

  return (
    <aside className={styles.panel}>
      <h2 className={styles.title}>Агенты ({agents.length})</h2>
      <ul className={styles.list}>
        {agents.map((agent) => (
          <li key={agent.agentId} className={styles.card}>
            <div className={styles.name}>{agent.name}</div>
            <div className={styles.role}>{agent.role}</div>
            <div
              className={styles.badge}
              style={{ background: PRESENCE_COLOR[agent.presenceState] }}
            >
              {PRESENCE_LABEL[agent.presenceState]}
            </div>
          </li>
        ))}
        {agents.length === 0 && (
          <li className={styles.empty}>Нет агентов</li>
        )}
      </ul>
    </aside>
  )
}
