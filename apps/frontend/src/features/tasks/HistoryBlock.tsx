import { useState } from 'react'
import type { SessionMessage, ToolCall } from '@shared/api/tasks.api'
import styles from './TasksPanel.module.css'

interface HistoryBlockProps {
  taskId: string
  loadHistory: (id: string) => Promise<SessionMessage[]>
}

export function HistoryBlock({ taskId, loadHistory }: HistoryBlockProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<SessionMessage[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleToggle = async () => {
    const nextOpen = !open
    setOpen(nextOpen)

    if (nextOpen && messages === null && !loading) {
      setLoading(true)
      setError(null)
      try {
        const data = await loadHistory(taskId)
        setMessages(data)
      } catch {
        setError('Не удалось загрузить историю')
      } finally {
        setLoading(false)
      }
    }
  }

  const toggleLabel = buildToggleLabel(messages)

  return (
    <div className={styles.historyBlock}>
      <button className={styles.historyToggle} onClick={handleToggle}>
        {open ? '▲' : '▼'} {toggleLabel}
      </button>

      {open && (
        <div className={styles.historyContent}>
          {loading && <p className={styles.historyLoading}>Загружаем историю...</p>}
          {error && <p className={styles.historyError}>{error}</p>}
          {!loading && !error && messages !== null && messages.length === 0 && (
            <EmptyHistory />
          )}
          {messages?.map((msg, i) => (
            <MessageRow key={i} message={msg} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}

function buildToggleLabel(messages: SessionMessage[] | null): string {
  if (messages !== null && messages.length > 0) {
    return `История работы (${messages.length} ${pluralizeMessages(messages.length)})`
  }
  return 'История работы'
}

function pluralizeMessages(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100

  if (mod100 >= 11 && mod100 <= 14) return 'сообщений'
  if (mod10 === 1) return 'сообщение'
  if (mod10 >= 2 && mod10 <= 4) return 'сообщения'
  return 'сообщений'
}

function EmptyHistory() {
  return (
    <div className={styles.historyEmpty}>
      <span className={styles.historyEmptyIcon}>🗂️</span>
      <p className={styles.historyEmptyTitle}>История недоступна</p>
      <p className={styles.historyEmptyDesc}>
        Сессия была завершена и очищена системой.
        <br />
        Новые задачи сохраняют историю автоматически.
      </p>
    </div>
  )
}

function MessageRow({ message, index }: { message: SessionMessage; index: number }) {
  const isUser = message.role === 'user'
  const [toolsOpen, setToolsOpen] = useState(false)

  return (
    <div
      className={`${styles.messageRow} ${isUser ? styles.messageUser : styles.messageAssistant}`}
      style={{ background: index % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent' }}
    >
      <div className={styles.messageHeader}>
        <span className={styles.messageRole}>
          {isUser ? '👤' : '🛠️'} {isUser ? 'Менеджер' : 'Агент'}
        </span>
        {message.timestamp && (
          <span className={styles.messageTime}>
            {new Date(message.timestamp).toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
      </div>
      <p className={styles.messageContent}>{message.content}</p>

      {message.hasToolCalls && message.toolCalls && message.toolCalls.length > 0 && (
        <ToolCallsBlock toolCalls={message.toolCalls} open={toolsOpen} onToggle={() => setToolsOpen((v) => !v)} />
      )}
    </div>
  )
}

function ToolCallsBlock({
  toolCalls,
  open,
  onToggle,
}: {
  toolCalls: ToolCall[]
  open: boolean
  onToggle: () => void
}) {
  return (
    <div className={styles.toolBlock}>
      <button className={styles.toolToggle} onClick={onToggle}>
        🔧 Технические детали {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className={styles.toolContent}>
          {toolCalls.map((tc, i) => (
            <div key={i} className={styles.toolCall}>
              <div className={styles.toolName}>{tc.name}</div>
              <pre className={styles.toolPre}>
                {typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input, null, 2)}
              </pre>
              {tc.output && (
                <pre className={`${styles.toolPre} ${styles.toolOutput}`}>{tc.output}</pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
