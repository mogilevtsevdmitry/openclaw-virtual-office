import type { Task } from '@shared/api/tasks.api'
import { tasksApi } from '@shared/api/tasks.api'
import { AgentFlow } from './AgentFlow'
import { HistoryBlock } from './HistoryBlock'
import { StatusBadge } from './TasksList'
import styles from './TasksPanel.module.css'

interface TaskDetailProps {
  task: Task
  onBack: () => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function TaskDetail({ task, onBack }: TaskDetailProps) {
  // derive agents from the task — currently we know the direct agent
  // Пятница (manager) → agentName (worker)
  const agents = task.agentName ? ['🖤 Пятница', task.agentName] : ['🖤 Пятница']

  return (
    <div className={styles.detail}>
      <button className={styles.backBtn} onClick={onBack}>
        ← Задачи
      </button>

      <div className={styles.detailHeader}>
        <h3 className={styles.detailTitle}>{task.title}</h3>
        <StatusBadge status={task.status} />
      </div>

      <div className={styles.detailMeta}>
        {task.agentName && <span>{task.agentName}</span>}
        <span>•</span>
        <span>{formatDate(task.createdAt)}</span>
      </div>

      {task.description && (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Описание</h4>
          <p className={styles.description}>{task.description}</p>
        </section>
      )}

      {task.result && (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Результат</h4>
          <p className={styles.description}>{task.result}</p>
        </section>
      )}

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Флоу агентов</h4>
        <AgentFlow agents={agents} />
        {task.agentName && (
          <p className={styles.flowCaption}>
            Пятница поставила задачу {task.agentName}
          </p>
        )}
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Детализация</h4>
        <HistoryBlock taskId={task.id} loadHistory={tasksApi.getHistory} />
      </section>
    </div>
  )
}
