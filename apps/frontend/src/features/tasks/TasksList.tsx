import type { Task } from '@shared/api/tasks.api'
import styles from './TasksPanel.module.css'

const STATUS_LABEL: Record<Task['status'], string> = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  DONE: 'DONE',
  FAILED: 'FAILED',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface TasksListProps {
  tasks: Task[]
  onSelect: (task: Task) => void
}

export function TasksList({ tasks, onSelect }: TasksListProps) {
  if (tasks.length === 0) {
    return <p className={styles.empty}>Задач пока нет</p>
  }

  const sorted = [...tasks].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return (
    <ul className={styles.list}>
      {sorted.map((task) => (
        <li key={task.id} className={styles.taskItem} onClick={() => onSelect(task)}>
          <StatusBadge status={task.status} />
          <div className={styles.taskInfo}>
            <span className={styles.taskTitle}>{task.title}</span>
            {task.agentName && (
              <span className={styles.taskAgent}>{task.agentName}</span>
            )}
          </div>
          <span className={styles.taskDate}>{formatDate(task.createdAt)}</span>
        </li>
      ))}
    </ul>
  )
}

export function StatusBadge({ status }: { status: Task['status'] }) {
  return (
    <span className={`${styles.badge} ${styles[`badge_${status}`]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}
