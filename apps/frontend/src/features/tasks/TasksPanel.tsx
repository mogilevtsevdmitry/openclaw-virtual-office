import { useEffect, useState } from 'react'
import { tasksApi, type Task } from '@shared/api/tasks.api'
import { TasksList } from './TasksList'
import { TaskDetail } from './TaskDetail'
import styles from './TasksPanel.module.css'

interface TasksPanelProps {
  onClose: () => void
}

type View = { kind: 'list' } | { kind: 'detail'; task: Task }

export function TasksPanel({ onClose }: TasksPanelProps) {
  const [view, setView] = useState<View>({ kind: 'list' })
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    tasksApi
      .list()
      .then((data) => {
        if (!cancelled) setTasks(data)
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось загрузить задачи')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  const isDetail = view.kind === 'detail'

  return (
    <>
      {/* Backdrop */}
      <div className={styles.backdrop} onClick={onClose} />

      {/* Panel */}
      <aside className={`${styles.panel} ${isDetail ? styles.panel__detail : ''}`}>
        <header className={styles.header}>
          <span className={styles.headerTitle}>📋 Задачи</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </header>

        <div className={styles.body}>
          {view.kind === 'list' ? (
            <>
              {loading && <p className={styles.loadingText}>Загружаем задачи...</p>}
              {error && <p className={styles.errorText}>{error}</p>}
              {!loading && !error && (
                <TasksList
                  tasks={tasks}
                  onSelect={(task) => setView({ kind: 'detail', task })}
                />
              )}
            </>
          ) : (
            <TaskDetail
              task={view.task}
              onBack={() => setView({ kind: 'list' })}
            />
          )}
        </div>
      </aside>
    </>
  )
}
