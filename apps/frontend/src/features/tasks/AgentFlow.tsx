import styles from './TasksPanel.module.css'

interface AgentFlowProps {
  /** e.g. ['🖤 Пятница', '🛠️ Федя'] */
  agents: string[]
}

export function AgentFlow({ agents }: AgentFlowProps) {
  if (agents.length === 0) return null

  return (
    <div className={styles.agentFlow}>
      {agents.map((agent, i) => (
        <div key={i} className={styles.agentFlowItem}>
          <div className={styles.agentCircle}>{agent}</div>
          {i < agents.length - 1 && (
            <span className={styles.agentArrow}>→</span>
          )}
        </div>
      ))}
    </div>
  )
}
